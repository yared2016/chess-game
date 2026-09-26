import { describe, expect, test } from "vitest";
import { api } from "../_generated/api";
import { as, makeTest, signUp } from "./harness.setup";

describe("Withdrawal Lifecycle Domain Operations", () => {
  test("Scenario A: Successful withdrawal lifecycle (1000 avail -> 487 avail / 513 locked -> 487 avail / 0 locked COMPLETED)", async () => {
    const t = makeTest();
    const alice = await signUp(t, "alice");

    // Seed wallet with 1000 ETB (100,000 santims)
    await as(t, alice).mutation(api.wallets.ensureWallet, {});
    await t.run(async (ctx) => {
      const wallet = await ctx.db
        .query("wallets")
        .withIndex("by_userId", (q) => q.eq("userId", alice.id))
        .first();
      expect(wallet).not.toBeNull();
      await ctx.db.patch(wallet!._id, {
        availableSantims: 100000,
        availableBalance: 1000,
        lockedSantims: 0,
        lockedBalance: 0,
      });
    });

    // 1. Reserve 500 ETB payout + 13 ETB fee = 513 ETB total (51,300 santims)
    const reserveRes = await as(t, alice).mutation(api.financial.withdrawals.reserveWithdrawal, {
      internalTransferRef: "WDR_TEST_SUCCESS_001",
      requestedAmountSantims: 50000,
      providerFeeSantims: 1300,
      totalReservedSantims: 51300,
      provider: "chapa",
      bankName: "telebirr",
      bankCode: "855",
      accountNumberMasked: "****5678",
      accountHolderName: "Alice Tester",
    });

    expect(reserveRes.internalTransferRef).toBe("WDR_TEST_SUCCESS_001");

    // Verify after reservation: available 487 ETB, locked 513 ETB
    let balance = await as(t, alice).query(api.wallets.getBalance, {});
    expect(balance.available).toBe(487);
    expect(balance.locked).toBe(513);
    expect(balance.total).toBe(1000); // 487 + 513 = 1000

    // 2. Mark processing
    await as(t, alice).mutation(api.financial.withdrawals.markWithdrawalProcessing, {
      internalTransferRef: "WDR_TEST_SUCCESS_001",
      providerTransferId: "TR_CHAPA_001",
    });

    // Verify status is processing, balances remain reserved
    let wdr = await t.run(async (ctx) => {
      return await ctx.db
        .query("financialWithdrawals")
        .withIndex("by_internalTransferRef", (q) => q.eq("internalTransferRef", "WDR_TEST_SUCCESS_001"))
        .unique();
    });
    expect(wdr?.status).toBe("processing");
    expect(wdr?.providerTransferId).toBe("TR_CHAPA_001");

    balance = await as(t, alice).query(api.wallets.getBalance, {});
    expect(balance.available).toBe(487);
    expect(balance.locked).toBe(513);

    // 3. Complete withdrawal
    const completeRes = await as(t, alice).mutation(api.financial.withdrawals.completeWithdrawal, {
      internalTransferRef: "WDR_TEST_SUCCESS_001",
      providerTransferId: "TR_CHAPA_001",
    });
    expect(completeRes.success).toBe(true);

    // Verify after completion: available 487 ETB, locked 0 ETB, total 487 ETB
    balance = await as(t, alice).query(api.wallets.getBalance, {});
    expect(balance.available).toBe(487);
    expect(balance.locked).toBe(0);
    expect(balance.total).toBe(487);

    wdr = await t.run(async (ctx) => {
      return await ctx.db
        .query("financialWithdrawals")
        .withIndex("by_internalTransferRef", (q) => q.eq("internalTransferRef", "WDR_TEST_SUCCESS_001"))
        .unique();
    });
    expect(wdr?.status).toBe("completed");
    expect(wdr?.completedAt).toBeDefined();

    // Verify ledger entries exist
    const ledger = await t.run(async (ctx) => {
      return await ctx.db
        .query("financialLedger")
        .withIndex("by_userId", (q) => q.eq("userId", alice.id))
        .collect();
    });
    const types = ledger.map((l) => l.entryType);
    expect(types).toContain("withdrawal_reserve");
    expect(types).toContain("withdrawal_complete");
    expect(types).toContain("withdrawal_fee");
  });

  test("Scenario B: Failed withdrawal lifecycle (restores reserved funds back to available)", async () => {
    const t = makeTest();
    const bob = await signUp(t, "bob");

    // Seed wallet with 1000 ETB
    await as(t, bob).mutation(api.wallets.ensureWallet, {});
    await t.run(async (ctx) => {
      const wallet = await ctx.db
        .query("wallets")
        .withIndex("by_userId", (q) => q.eq("userId", bob.id))
        .first();
      await ctx.db.patch(wallet!._id, {
        availableSantims: 100000,
        availableBalance: 1000,
        lockedSantims: 0,
        lockedBalance: 0,
      });
    });

    // Reserve 513 ETB
    await as(t, bob).mutation(api.financial.withdrawals.reserveWithdrawal, {
      internalTransferRef: "WDR_TEST_FAIL_002",
      requestedAmountSantims: 50000,
      providerFeeSantims: 1300,
      totalReservedSantims: 51300,
      provider: "chapa",
      bankName: "telebirr",
      bankCode: "855",
      accountNumberMasked: "****1234",
      accountHolderName: "Bob Tester",
    });

    let balance = await as(t, bob).query(api.wallets.getBalance, {});
    expect(balance.available).toBe(487);
    expect(balance.locked).toBe(513);

    // Fail withdrawal
    const failRes = await as(t, bob).mutation(api.financial.withdrawals.failWithdrawalAndReleaseReservation, {
      internalTransferRef: "WDR_TEST_FAIL_002",
      failureReason: "Invalid recipient telebirr account",
    });
    expect(failRes.success).toBe(true);

    // Verify after failure: available 1000 ETB, locked 0 ETB
    balance = await as(t, bob).query(api.wallets.getBalance, {});
    expect(balance.available).toBe(1000);
    expect(balance.locked).toBe(0);
    expect(balance.total).toBe(1000);

    const wdr = await t.run(async (ctx) => {
      return await ctx.db
        .query("financialWithdrawals")
        .withIndex("by_internalTransferRef", (q) => q.eq("internalTransferRef", "WDR_TEST_FAIL_002"))
        .unique();
    });
    expect(wdr?.status).toBe("failed");
    expect(wdr?.failureReason).toBe("Invalid recipient telebirr account");

    // Verify ledger has reversal
    const ledger = await t.run(async (ctx) => {
      return await ctx.db
        .query("financialLedger")
        .withIndex("by_userId", (q) => q.eq("userId", bob.id))
        .collect();
    });
    const types = ledger.map((l) => l.entryType);
    expect(types).toContain("withdrawal_reserve");
    expect(types).toContain("withdrawal_reversal");
  });

  test("Scenario D & E: Duplicate webhook / idempotency protection", async () => {
    const t = makeTest();
    const charlie = await signUp(t, "charlie");

    await as(t, charlie).mutation(api.wallets.ensureWallet, {});
    await t.run(async (ctx) => {
      const wallet = await ctx.db
        .query("wallets")
        .withIndex("by_userId", (q) => q.eq("userId", charlie.id))
        .first();
      await ctx.db.patch(wallet!._id, {
        availableSantims: 100000,
        availableBalance: 1000,
        lockedSantims: 0,
        lockedBalance: 0,
      });
    });

    await as(t, charlie).mutation(api.financial.withdrawals.reserveWithdrawal, {
      internalTransferRef: "WDR_TEST_IDEMPOTENT_003",
      requestedAmountSantims: 50000,
      providerFeeSantims: 1300,
      totalReservedSantims: 51300,
      provider: "chapa",
      bankName: "telebirr",
      bankCode: "855",
      accountNumberMasked: "****9999",
      accountHolderName: "Charlie",
    });

    // Complete once
    const res1 = await as(t, charlie).mutation(api.financial.withdrawals.completeWithdrawal, {
      internalTransferRef: "WDR_TEST_IDEMPOTENT_003",
    });
    expect(res1.alreadyFinalized).toBeFalsy();

    const balanceAfterFirst = await as(t, charlie).query(api.wallets.getBalance, {});
    expect(balanceAfterFirst.available).toBe(487);
    expect(balanceAfterFirst.locked).toBe(0);

    // Call complete again (simulate duplicate webhook)
    const res2 = await as(t, charlie).mutation(api.financial.withdrawals.completeWithdrawal, {
      internalTransferRef: "WDR_TEST_IDEMPOTENT_003",
    });
    expect(res2.alreadyFinalized).toBe(true);

    // Balances must remain identical!
    const balanceAfterSecond = await as(t, charlie).query(api.wallets.getBalance, {});
    expect(balanceAfterSecond.available).toBe(487);
    expect(balanceAfterSecond.locked).toBe(0);
    expect(balanceAfterSecond.total).toBe(487);
  });

  test("Scenario F: Insufficient funds is rejected before reservation", async () => {
    const t = makeTest();
    const dave = await signUp(t, "dave");

    await as(t, dave).mutation(api.wallets.ensureWallet, {});
    // Dave has 0 balance

    await expect(
      as(t, dave).mutation(api.financial.withdrawals.reserveWithdrawal, {
        internalTransferRef: "WDR_TEST_NO_FUNDS_004",
        requestedAmountSantims: 50000,
        providerFeeSantims: 1300,
        totalReservedSantims: 51300,
        provider: "chapa",
        bankName: "telebirr",
        bankCode: "855",
        accountNumberMasked: "****0000",
        accountHolderName: "Dave",
      })
    ).rejects.toThrow(/Insufficient funds/);

    const balance = await as(t, dave).query(api.wallets.getBalance, {});
    expect(balance.available).toBe(0);
    expect(balance.locked).toBe(0);
  });
});
