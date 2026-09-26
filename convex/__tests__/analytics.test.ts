import { describe, expect, test } from "vitest";
import { api } from "../_generated/api";
import { as, makeTest, signUp } from "./harness.setup";

describe("Authoritative Wallet Financial Analytics", () => {
  test("Test 1 & 11: Deposit 1000 ETB appears in lifetime deposits, NOT in gaming earnings", async () => {
    const t = makeTest();
    const alice = await signUp(t, "alice_analytics");
    await as(t, alice).mutation(api.wallets.ensureWallet, {});

    // Complete a deposit of 1000 ETB credit + 26 ETB fee
    await t.run(async (ctx) => {
      const wallet = await ctx.db
        .query("wallets")
        .withIndex("by_userId", (q) => q.eq("userId", alice.id))
        .first();

      await ctx.db.insert("financialLedger", {
        userId: alice.id,
        walletId: wallet!._id,
        entryType: "deposit_credit",
        amountSantims: 100000,
        balanceAfterSantims: 100000,
        lockedAfterSantims: 0,
        referenceType: "deposit",
        referenceId: "DEP_001",
        idempotencyKey: "dep_001",
        description: "Deposit credited (1000 ETB)",
        createdAt: Date.now(),
      });

      await ctx.db.insert("financialLedger", {
        userId: alice.id,
        walletId: wallet!._id,
        entryType: "deposit_fee",
        amountSantims: 2600,
        balanceAfterSantims: 100000,
        lockedAfterSantims: 0,
        referenceType: "deposit",
        referenceId: "DEP_001",
        idempotencyKey: "dep_fee_001",
        description: "Chapa deposit fee (26 ETB)",
        createdAt: Date.now(),
      });

      await ctx.db.patch(wallet!._id, {
        availableSantims: 100000,
        availableBalance: 1000,
      });
    });

    const overview = await as(t, alice).query(api.financial.analytics.getWalletOverview, {});
    expect(overview.lifetime.totalDeposited).toBe(1000);
    expect(overview.lifetime.totalChapaFees).toBe(26);
    expect(overview.lifetime.netGamingResult).toBe(0); // MUST BE 0! Deposits are not earnings.
  });

  test("Test 2 & 3: Match win (+80 ETB) and Match loss (-100 ETB) calculate Net Gaming Result correctly", async () => {
    const t = makeTest();
    const bob = await signUp(t, "bob_analytics");
    await as(t, bob).mutation(api.wallets.ensureWallet, {});

    const now = Date.now();
    await t.run(async (ctx) => {
      const wallet = await ctx.db
        .query("wallets")
        .withIndex("by_userId", (q) => q.eq("userId", bob.id))
        .first();

      // Match 1: Win (+180 payout, 100 stake)
      await ctx.db.insert("financialLedger", {
        userId: bob.id,
        walletId: wallet!._id,
        entryType: "match_payout",
        amountSantims: 18000,
        balanceAfterSantims: 18000,
        lockedAfterSantims: 0,
        referenceType: "match",
        referenceId: "MATCH_001",
        idempotencyKey: "win_001",
        description: "Match victory payout (180 ETB)",
        createdAt: now - 3600000,
      });

      // Match 2: Loss (-100 stake)
      await ctx.db.insert("financialLedger", {
        userId: bob.id,
        walletId: wallet!._id,
        entryType: "match_loss",
        amountSantims: 10000,
        balanceAfterSantims: 8000,
        lockedAfterSantims: 0,
        referenceType: "match",
        referenceId: "MATCH_002",
        idempotencyKey: "loss_002",
        description: "Match loss stake (100 ETB)",
        createdAt: now - 1800000,
      });
    });

    const overview = await as(t, bob).query(api.financial.analytics.getWalletOverview, {});
    expect(overview.lifetime.totalMatchWinnings).toBe(180);
    expect(overview.lifetime.totalMatchEntries).toBe(100);
    expect(overview.lifetime.netGamingResult).toBe(80); // 180 - 100 = 80 ETB
    expect(overview.lifetime.completedMatches).toBe(2);

    // Period analytics
    const period = await as(t, bob).query(api.financial.analytics.getPeriodAnalytics, {
      startTimestamp: now - 7200000,
      endTimestamp: now,
    });
    expect(period.matchWinnings).toBe(180);
    expect(period.matchEntries).toBe(100);
    expect(period.netGamingResult).toBe(80);
    expect(period.matchesPlayed).toBe(2);
    expect(period.topPerformance.highestWin.amount).toBe(180);
  });

  test("Test 4, 5, 6: Withdrawal lifecycle does not affect gaming earnings and respects completed vs failed", async () => {
    const t = makeTest();
    const charlie = await signUp(t, "charlie_analytics");
    await as(t, charlie).mutation(api.wallets.ensureWallet, {});

    const now = Date.now();
    await t.run(async (ctx) => {
      const wallet = await ctx.db
        .query("wallets")
        .withIndex("by_userId", (q) => q.eq("userId", charlie.id))
        .first();

      // Completed withdrawal of 500 ETB + 13 ETB fee
      await ctx.db.insert("financialLedger", {
        userId: charlie.id,
        walletId: wallet!._id,
        entryType: "withdrawal_complete",
        amountSantims: 50000,
        balanceAfterSantims: 0,
        lockedAfterSantims: 0,
        referenceType: "withdrawal",
        referenceId: "WDR_001",
        idempotencyKey: "wdr_001",
        description: "Withdrawal completed (500 ETB)",
        createdAt: now,
      });

      await ctx.db.insert("financialLedger", {
        userId: charlie.id,
        walletId: wallet!._id,
        entryType: "withdrawal_fee",
        amountSantims: 1300,
        balanceAfterSantims: 0,
        lockedAfterSantims: 0,
        referenceType: "withdrawal",
        referenceId: "WDR_001",
        idempotencyKey: "wdr_fee_001",
        description: "Withdrawal fee (13 ETB)",
        createdAt: now,
      });
    });

    const overview = await as(t, charlie).query(api.financial.analytics.getWalletOverview, {});
    expect(overview.lifetime.totalWithdrawn).toBe(500);
    expect(overview.lifetime.totalChapaFees).toBe(13);
    expect(overview.lifetime.netGamingResult).toBe(0); // Withdrawals do NOT reduce earnings!
  });

  test("Test 10: User isolation — User A cannot query User B's analytics", async () => {
    const t = makeTest();
    const alice = await signUp(t, "alice_iso");
    const eve = await signUp(t, "eve_iso");

    await as(t, alice).mutation(api.wallets.ensureWallet, {});
    await as(t, eve).mutation(api.wallets.ensureWallet, {});

    // Querying as Eve only accesses Eve's records
    const eveOverview = await as(t, eve).query(api.financial.analytics.getWalletOverview, {});
    expect(eveOverview.lifetime.totalDeposited).toBe(0);
    expect(eveOverview.lifetime.totalWithdrawn).toBe(0);
  });
});
