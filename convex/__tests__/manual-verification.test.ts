import { describe, expect, test } from "vitest";
import { api } from "../_generated/api";
import { as, makeTest, signUp } from "./harness.setup";

describe("Manual Receipt Verification & Financial Workflow", () => {
  async function setupAdmin(t: ReturnType<typeof makeTest>) {
    const admin = await signUp(t, "admin_verifier");
    await t.run(async (ctx) => {
      await ctx.db.patch(admin.id, {
        clerkId: "user_3JfrI7CJEW9GIMo1UsEAvK9M0Ki",
        email: "yaredusk@gmail.com",
      });
    });
    return {
      id: admin.id,
      identity: {
        subject: "user_3JfrI7CJEW9GIMo1UsEAvK9M0Ki",
        nickname: "admin_verifier",
        pictureUrl: "https://img.clerk.com/admin_verifier.png",
      },
    };
  }

  test("1. Deposit creation enters pending_review and generates unique ABAY code", async () => {
    const t = makeTest();
    const alice = await signUp(t, "alice");

    const res = await as(t, alice).mutation(api.deposits.create, {
      amount: 1000,
      paymentMethod: "telebirr",
      transactionReference: "TEL_REF_001",
      senderInfo: "Alice Doe (0911223344)",
    });

    expect(res.code).toMatch(/^ABAY-[A-Z0-9]{6}$/);
    expect(res.depositId).toBeDefined();

    const deposit = await t.run(async (ctx) => {
      return await ctx.db.get(res.depositId);
    });

    expect(deposit).not.toBeNull();
    expect(deposit?.status).toBe("pending_review");
    expect(deposit?.amount).toBe(1000);
    expect(deposit?.paymentMethod).toBe("telebirr");
    expect(deposit?.transactionReference).toBe("TEL_REF_001");
  });

  test("2. Duplicate transaction references are rejected", async () => {
    const t = makeTest();
    const alice = await signUp(t, "alice");
    const bob = await signUp(t, "bob");

    await as(t, alice).mutation(api.deposits.create, {
      amount: 500,
      paymentMethod: "cbe_bank",
      transactionReference: "CBE_TX_DUP_01",
    });

    // Submitting duplicate reference must reject
    await expect(
      as(t, bob).mutation(api.deposits.create, {
        amount: 500,
        paymentMethod: "cbe_bank",
        transactionReference: "CBE_TX_DUP_01",
      })
    ).rejects.toThrow("duplicate-reference");
  });

  test("3. Admin approval credits exact deposit amount and records immutable ledger", async () => {
    const t = makeTest();
    const admin = await setupAdmin(t);
    const alice = await signUp(t, "alice");

    const depRes = await as(t, alice).mutation(api.deposits.create, {
      amount: 1000,
      paymentMethod: "telebirr",
      transactionReference: "TEL_TX_VERIFIED_1000",
    });

    // Verify wallet starts empty
    let balance = await as(t, alice).query(api.wallets.getBalance, {});
    expect(balance.available).toBe(0);

    // Admin approves with verification note
    const approveRes = await as(t, admin).mutation(api.deposits.approve, {
      depositId: depRes.depositId,
      verificationNote: "Tina Verify receipt confirmed, funds in Telebirr",
    });
    expect(approveRes.success).toBe(true);

    // Wallet is credited exact 1,000 ETB (0 fee)
    balance = await as(t, alice).query(api.wallets.getBalance, {});
    expect(balance.available).toBe(1000);
    expect(balance.locked).toBe(0);
    expect(balance.total).toBe(1000);

    // Deposit status updated
    const dep = await t.run(async (ctx) => {
      return await ctx.db.get(depRes.depositId);
    });
    expect(dep?.status).toBe("approved");
    expect(dep?.reviewedBy).toBe(admin.id);
    expect(dep?.verificationNote).toBe("Tina Verify receipt confirmed, funds in Telebirr");

    // Immutable ledger entry verified
    const ledger = await t.run(async (ctx) => {
      return await ctx.db
        .query("financialLedger")
        .withIndex("by_userId", (q) => q.eq("userId", alice.id))
        .collect();
    });
    const creditEntry = ledger.find((e) => e.entryType === "deposit_credit");
    expect(creditEntry).toBeDefined();
    expect(creditEntry?.amountSantims).toBe(100000);
    expect(creditEntry?.balanceAfterSantims).toBe(100000);

    // Duplicate approval attempt must fail
    await expect(
      as(t, admin).mutation(api.deposits.approve, {
        depositId: depRes.depositId,
      })
    ).rejects.toThrow("deposit-not-pending");
  });

  test("4. Admin rejection requires reason and does not credit wallet", async () => {
    const t = makeTest();
    const admin = await setupAdmin(t);
    const bob = await signUp(t, "bob");

    const depRes = await as(t, bob).mutation(api.deposits.create, {
      amount: 750,
      paymentMethod: "cbe_birr",
      transactionReference: "CBE_BIRR_FAKE_01",
    });

    // Rejection without reason fails
    await expect(
      as(t, admin).mutation(api.deposits.reject, {
        depositId: depRes.depositId,
        reason: "   ",
      })
    ).rejects.toThrow("reason-required");

    // Reject with valid reason
    const rejectRes = await as(t, admin).mutation(api.deposits.reject, {
      depositId: depRes.depositId,
      reason: "Tina Verify flagged screenshot as altered / fake",
      verificationNote: "Digital font mismatch detected",
    });
    expect(rejectRes.success).toBe(true);

    // Wallet remains 0 ETB
    const balance = await as(t, bob).query(api.wallets.getBalance, {});
    expect(balance.available).toBe(0);
    expect(balance.total).toBe(0);

    // Deposit status marked rejected
    const dep = await t.run(async (ctx) => {
      return await ctx.db.get(depRes.depositId);
    });
    expect(dep?.status).toBe("rejected");
    expect(dep?.rejectionReason).toBe("Tina Verify flagged screenshot as altered / fake");

    // Cannot approve an already rejected deposit
    await expect(
      as(t, admin).mutation(api.deposits.approve, {
        depositId: depRes.depositId,
      })
    ).rejects.toThrow("deposit-not-pending");
  });

  test("5. Withdrawal hold, payout completion with transfer reference, and ledger trail", async () => {
    const t = makeTest();
    const admin = await setupAdmin(t);
    const alice = await signUp(t, "alice");

    // Fund alice's wallet with 1000 ETB
    const dep = await as(t, alice).mutation(api.deposits.create, {
      amount: 1000,
      paymentMethod: "telebirr",
    });
    await as(t, admin).mutation(api.deposits.approve, {
      depositId: dep.depositId,
    });

    // Payout account validation
    await expect(
      as(t, alice).mutation(api.withdrawals.request, {
        amount: 400,
        payoutMethod: "telebirr",
        payoutAccount: "   ",
      })
    ).rejects.toThrow("payout-account-required");

    // Request 400 ETB withdrawal
    const wdrRes = await as(t, alice).mutation(api.withdrawals.request, {
      amount: 400,
      payoutMethod: "telebirr",
      payoutAccount: "0911223344",
      accountHolderName: "Alice Doe",
    });
    expect(wdrRes.withdrawalId).toBeDefined();

    // Verify hold placed: 600 available, 400 locked
    let balance = await as(t, alice).query(api.wallets.getBalance, {});
    expect(balance.available).toBe(600);
    expect(balance.locked).toBe(400);
    expect(balance.total).toBe(1000);

    // Completion requires transfer reference
    await expect(
      as(t, admin).mutation(api.withdrawals.complete, {
        withdrawalId: wdrRes.withdrawalId,
        transferReference: "   ",
      })
    ).rejects.toThrow("transfer-reference-required");

    // Admin executes transfer and records provider reference
    const completeRes = await as(t, admin).mutation(api.withdrawals.complete, {
      withdrawalId: wdrRes.withdrawalId,
      transferReference: "TELE_OUT_897123",
      verificationNote: "Sent via Telebirr business portal",
    });
    expect(completeRes.success).toBe(true);

    // Verify after completion: 600 available, 0 locked, total 600
    balance = await as(t, alice).query(api.wallets.getBalance, {});
    expect(balance.available).toBe(600);
    expect(balance.locked).toBe(0);
    expect(balance.total).toBe(600);

    const wdr = await t.run(async (ctx) => {
      return await ctx.db.get(wdrRes.withdrawalId);
    });
    expect(wdr?.status).toBe("completed");
    expect(wdr?.transferReference).toBe("TELE_OUT_897123");
    expect(wdr?.reviewedBy).toBe(admin.id);

    // Check ledger entries: withdrawal_reserve and withdrawal_complete
    const ledger = await t.run(async (ctx) => {
      return await ctx.db
        .query("financialLedger")
        .withIndex("by_userId", (q) => q.eq("userId", alice.id))
        .collect();
    });
    const reserve = ledger.find((e) => e.entryType === "withdrawal_reserve");
    const complete = ledger.find((e) => e.entryType === "withdrawal_complete");
    expect(reserve).toBeDefined();
    expect(complete).toBeDefined();
  });

  test("6. Withdrawal rejection releases held funds back to available balance", async () => {
    const t = makeTest();
    const admin = await setupAdmin(t);
    const alice = await signUp(t, "alice");

    // Fund alice's wallet with 500 ETB
    const dep = await as(t, alice).mutation(api.deposits.create, {
      amount: 500,
      paymentMethod: "cbe_bank",
    });
    await as(t, admin).mutation(api.deposits.approve, {
      depositId: dep.depositId,
    });

    // Request 300 ETB withdrawal
    const wdrRes = await as(t, alice).mutation(api.withdrawals.request, {
      amount: 300,
      payoutMethod: "cbe_bank",
      payoutAccount: "1000123456789",
    });

    // 200 available, 300 locked
    let balance = await as(t, alice).query(api.wallets.getBalance, {});
    expect(balance.available).toBe(200);
    expect(balance.locked).toBe(300);

    // Rejection without reason fails
    await expect(
      as(t, admin).mutation(api.withdrawals.reject, {
        withdrawalId: wdrRes.withdrawalId,
        reason: "",
      })
    ).rejects.toThrow("reason-required");

    // Admin rejects with valid reason
    const rejectRes = await as(t, admin).mutation(api.withdrawals.reject, {
      withdrawalId: wdrRes.withdrawalId,
      reason: "CBE account number invalid or closed",
    });
    expect(rejectRes.success).toBe(true);

    // Funds restored: 500 available, 0 locked!
    balance = await as(t, alice).query(api.wallets.getBalance, {});
    expect(balance.available).toBe(500);
    expect(balance.locked).toBe(0);
    expect(balance.total).toBe(500);

    // Withdrawal status marked rejected
    const wdr = await t.run(async (ctx) => {
      return await ctx.db.get(wdrRes.withdrawalId);
    });
    expect(wdr?.status).toBe("rejected");
    expect(wdr?.rejectionReason).toBe("CBE account number invalid or closed");

    // Reversal ledger entry present
    const ledger = await t.run(async (ctx) => {
      return await ctx.db
        .query("financialLedger")
        .withIndex("by_userId", (q) => q.eq("userId", alice.id))
        .collect();
    });
    const reversal = ledger.find((e) => e.entryType === "withdrawal_reversal");
    expect(reversal).toBeDefined();
    expect(reversal?.amountSantims).toBe(30000);
    expect(reversal?.balanceAfterSantims).toBe(50000);
    expect(reversal?.lockedAfterSantims).toBe(0);
  });

  test("7. Security boundary: Non-admin users cannot approve/reject deposits or complete/reject withdrawals", async () => {
    const t = makeTest();
    const alice = await signUp(t, "alice");
    const bob = await signUp(t, "bob");

    const dep = await as(t, alice).mutation(api.deposits.create, {
      amount: 100,
      paymentMethod: "telebirr",
    });

    // Bob tries to approve or reject deposit
    await expect(
      as(t, bob).mutation(api.deposits.approve, { depositId: dep.depositId })
    ).rejects.toThrow("unauthorized-admin");
    await expect(
      as(t, bob).mutation(api.deposits.reject, {
        depositId: dep.depositId,
        reason: "Hacker attempt",
      })
    ).rejects.toThrow("unauthorized-admin");

    // Seed wallet and request withdrawal
    await t.run(async (ctx) => {
      const wallet = await ctx.db
        .query("wallets")
        .withIndex("by_userId", (q) => q.eq("userId", alice.id))
        .unique();
      if (wallet) {
        await ctx.db.patch(wallet._id, {
          availableBalance: 500,
          availableSantims: 50000,
        });
      }
    });

    const wdr = await as(t, alice).mutation(api.withdrawals.request, {
      amount: 200,
      payoutMethod: "telebirr",
      payoutAccount: "0911223344",
    });

    // Bob tries to complete or reject withdrawal
    await expect(
      as(t, bob).mutation(api.withdrawals.complete, {
        withdrawalId: wdr.withdrawalId,
        transferReference: "REF_HACK",
      })
    ).rejects.toThrow("unauthorized-admin");
    await expect(
      as(t, bob).mutation(api.withdrawals.reject, {
        withdrawalId: wdr.withdrawalId,
        reason: "Hacker attempt",
      })
    ).rejects.toThrow("unauthorized-admin");
  });
});
