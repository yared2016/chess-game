import { describe, expect, test } from "vitest";
import { api } from "../_generated/api";
import { as, makeTest, signUp } from "./harness.setup";

describe("Admin Authoritative Backend Queries & Security", () => {
  async function setupAdmin(t: ReturnType<typeof makeTest>) {
    const admin = await signUp(t, "admin_user");
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
        nickname: "admin_user",
        pictureUrl: "https://img.clerk.com/admin_user.png",
      },
    };
  }

  test("1. Security boundary: Non-admin calls reject with unauthorized-admin", async () => {
    const t = makeTest();
    const bob = await signUp(t, "regular_bob");

    // All admin queries must reject non-admins
    await expect(as(t, bob).query(api.admin.getPlatformKpis, {})).rejects.toThrow("unauthorized-admin");
    await expect(as(t, bob).query(api.admin.getUnifiedTransactions, {})).rejects.toThrow("unauthorized-admin");
    await expect(as(t, bob).query(api.admin.getRecentActivity, {})).rejects.toThrow("unauthorized-admin");
    await expect(as(t, bob).query(api.admin.getSystemHealth, {})).rejects.toThrow("unauthorized-admin");
    await expect(as(t, bob).query(api.admin.searchPlayers, {})).rejects.toThrow("unauthorized-admin");
    await expect(
      as(t, bob).query(api.admin.getPlayerDetails, { playerId: bob.id })
    ).rejects.toThrow("unauthorized-admin");

    // Admin mutation must reject non-admins
    await expect(
      as(t, bob).mutation(api.admin.finance.setPlayerWalletRestrictions, {
        targetUserId: bob.id,
        depositsRestricted: true,
        reason: "Test non-admin reject",
      })
    ).rejects.toThrow("unauthorized-admin");
  });

  test("2. getPlatformKpis computes correct KPIs and reserves", async () => {
    const t = makeTest();
    const admin = await setupAdmin(t);
    const alice = await signUp(t, "alice");
    const bob = await signUp(t, "bob");

    const now = Date.now();

    await t.run(async (ctx) => {
      // Presence: alice is online (10s ago), bob is offline (120s ago)
      await ctx.db.insert("userPresence", {
        playerId: alice.id,
        lastSeen: now - 10_000,
        updatedAt: now - 10_000,
      });
      await ctx.db.insert("userPresence", {
        playerId: bob.id,
        lastSeen: now - 120_000,
        updatedAt: now - 120_000,
      });

      // Active game with stake
      await ctx.db.insert("games", {
        whiteId: alice.id,
        blackId: bob.id,
        mode: "online",
        fen: "startpos",
        moves: [],
        pgn: "",
        turn: "w",
        status: "active",
        rated: true,
        undoCount: 0,
        hintsUsed: 0,
        stake: 50,
        escrowTotal: 100,
        createdAt: now,
        lastMoveAt: now,
      });

      // Completed game
      await ctx.db.insert("games", {
        whiteId: alice.id,
        blackId: bob.id,
        mode: "online",
        fen: "startpos",
        moves: [],
        pgn: "",
        turn: "w",
        status: "checkmate",
        winner: "w",
        rated: true,
        undoCount: 0,
        hintsUsed: 0,
        stake: 20,
        escrowTotal: 40,
        createdAt: now - 3600_000,
        lastMoveAt: now - 3600_000,
      });

      // Wallets
      const aliceWalletId = await ctx.db.insert("wallets", {
        userId: alice.id,
        availableBalance: 400,
        lockedBalance: 50,
        totalDeposited: 1000,
        totalWithdrawn: 200,
        totalWon: 50,
        totalLost: 10,
        createdAt: now,
        updatedAt: now,
      });
      await ctx.db.insert("wallets", {
        userId: bob.id,
        availableBalance: 300,
        lockedBalance: 0,
        totalDeposited: 500,
        totalWithdrawn: 100,
        totalWon: 0,
        totalLost: 40,
        createdAt: now,
        updatedAt: now,
      });

      // Approved deposits (manual: 1000 ETB, financial: 500 ETB)
      await ctx.db.insert("deposits", {
        userId: alice.id,
        walletId: aliceWalletId,
        amount: 1000,
        code: "DEP_1001",
        status: "approved",
        createdAt: now,
        reviewedAt: now,
      });
      await ctx.db.insert("financialDeposits", {
        userId: alice.id,
        walletId: aliceWalletId,
        provider: "chapa",
        internalTxRef: "DEP_CHAPA_001",
        requestedCreditSantims: 50_000, // 500 ETB
        providerFeeSantims: 1250,
        grossAmountSantims: 51_250,
        currency: "ETB",
        status: "credited",
        feeMode: "additive",
        createdAt: now,
        updatedAt: now,
        verifiedAt: now,
      });

      // Completed withdrawals (manual: 200 ETB, financial: 100 ETB)
      await ctx.db.insert("withdrawals", {
        userId: alice.id,
        walletId: aliceWalletId,
        amount: 200,
        payoutMethod: "telebirr",
        payoutAccount: "0911223344",
        status: "completed",
        createdAt: now,
        completedAt: now,
      });
      await ctx.db.insert("financialWithdrawals", {
        userId: alice.id,
        walletId: aliceWalletId,
        provider: "chapa",
        internalTransferRef: "WDR_CHAPA_001",
        requestedAmountSantims: 10_000, // 100 ETB
        providerFeeSantims: 500,
        totalReservedSantims: 10_500,
        currency: "ETB",
        bankName: "telebirr",
        bankCode: "855",
        accountNumberMasked: "****3344",
        accountHolderName: "Alice",
        status: "completed",
        createdAt: now,
        updatedAt: now,
        completedAt: now,
      });

      // Pending withdrawal (150 ETB)
      await ctx.db.insert("withdrawals", {
        userId: alice.id,
        walletId: aliceWalletId,
        amount: 150,
        payoutMethod: "telebirr",
        payoutAccount: "0911223344",
        status: "pending",
        createdAt: now,
      });

      // Commission today
      await ctx.db.insert("commissions", {
        gameId: (await ctx.db.query("games").first())!._id,
        amount: 10,
        transferred: false,
        createdAt: now,
      });

      // Pending actions: fair play report & feedback
      await ctx.db.insert("fairPlayReports", {
        gameId: (await ctx.db.query("games").first())!._id,
        reporterId: bob.id,
        reporterUsername: "bob",
        reportedPlayerId: alice.id,
        reportedUsername: "alice",
        reason: "suspicious_timing",
        status: "pending",
        createdAt: now,
      });
      await ctx.db.insert("feedback", {
        userId: alice.id,
        clerkId: "user_alice",
        userName: "alice",
        userEmail: "alice@test.com",
        category: "chess_game",
        description: "Great game!",
        attachments: [],
        status: "NEW",
        emailStatus: "NOT_SENT",
        createdAt: now,
        updatedAt: now,
      });
    });

    const kpis = await as(t, admin).query(api.admin.getPlatformKpis, {});

    // Assertions
    expect(kpis.totalPlayers).toBe(3); // admin + alice + bob
    expect(kpis.onlineNow).toBe(1); // alice (< 60s)
    expect(kpis.activeGames).toBe(1); // status === "active"
    expect(kpis.gamesToday).toBe(2); // both games created today
    expect(kpis.platformBalance).toBe(1200); // (1000 + 500) - (200 + 100) = 1200 ETB
    expect(kpis.userLiabilities).toBe(700); // 400 + 300 = 700 ETB
    expect(kpis.lockedEscrow).toBe(100); // active game escrowTotal = 100
    expect(kpis.pendingWithdrawalReserve).toBe(150); // 150 ETB pending
    expect(kpis.revenueToday).toBe(10); // 10 ETB commission
    expect(kpis.depositsToday).toBe(1500); // 1000 + 500
    expect(kpis.withdrawalsToday).toBe(300); // 200 + 100
    expect(kpis.pendingActions.pendingWithdrawals).toBe(1);
    expect(kpis.pendingActions.fairPlayReports).toBe(1);
    expect(kpis.pendingActions.userFeedback).toBe(1);
    expect(Array.isArray(kpis.chartData)).toBe(true);
    expect(kpis.chartData.length).toBe(7);
  });

  test("3. setPlayerWalletRestrictions enforces validation and records financialAuditLogs", async () => {
    const t = makeTest();
    const admin = await setupAdmin(t);
    const alice = await signUp(t, "alice");

    // Initialize wallet
    await as(t, alice).mutation(api.wallets.ensureWallet, {});

    // Empty reason must throw
    await expect(
      as(t, admin).mutation(api.admin.finance.setPlayerWalletRestrictions, {
        targetUserId: alice.id,
        depositsRestricted: true,
        reason: "   ",
      })
    ).rejects.toThrow("reason-required");

    // Apply restrictions and full freeze
    const res = await as(t, admin).mutation(api.admin.finance.setPlayerWalletRestrictions, {
      targetUserId: alice.id,
      depositsRestricted: true,
      stakingRestricted: true,
      withdrawalsRestricted: false,
      freezeEntireWallet: true,
      reason: "Fair play investigation pending",
    });
    expect(res.success).toBe(true);

    // Verify wallet state
    const wallet = await t.run(async (ctx) => {
      return await ctx.db
        .query("wallets")
        .withIndex("by_userId", (q) => q.eq("userId", alice.id))
        .unique();
    });
    expect(wallet?.depositsRestricted).toBe(true);
    expect(wallet?.stakingRestricted).toBe(true);
    expect(wallet?.withdrawalsRestricted).toBe(false);
    expect(wallet?.status).toBe("frozen");
    expect(wallet?.freezeReason).toBe("Fair play investigation pending");

    // Verify financialAuditLogs record
    const auditLogs = await t.run(async (ctx) => {
      return await ctx.db
        .query("financialAuditLogs")
        .withIndex("by_targetUserId", (q) => q.eq("targetUserId", alice.id))
        .collect();
    });
    expect(auditLogs.length).toBe(1);
    const log = auditLogs[0];
    expect(log.action).toBe("wallet_restrictions_update");
    expect(log.adminId).toBe(admin.id);
    expect(log.targetUserId).toBe(alice.id);
    expect(log.reason).toBe("Fair play investigation pending");
    const meta = JSON.parse(log.metadata ?? "{}");
    expect(meta.depositsRestricted).toBe(true);
    expect(meta.stakingRestricted).toBe(true);
    expect(meta.withdrawalsRestricted).toBe(false);
    expect(meta.freezeEntireWallet).toBe(true);
    expect(meta.adminClerkId).toBe("user_3JfrI7CJEW9GIMo1UsEAvK9M0Ki");
  });

  test("4. searchPlayers and getPlayerDetails omit university concepts and return full profile", async () => {
    const t = makeTest();
    const admin = await setupAdmin(t);
    const alice = await signUp(t, "alice");

    await as(t, alice).mutation(api.wallets.ensureWallet, {});

    // 4.1 searchPlayers
    const searchRes = await as(t, admin).query(api.admin.searchPlayers, { query: "alice" });
    expect(searchRes.length).toBe(1);
    const p = searchRes[0];
    expect(p.username).toBe("alice");
    expect(p.wallet.status).toBe("active");
    // Verify ZERO university fields
    expect((p as any).universityId).toBeUndefined();
    expect((p as any).universityName).toBeUndefined();
    expect((p as any).studentId).toBeUndefined();
    expect((p as any).playerType).toBeUndefined();

    // 4.2 getPlayerDetails
    const details = await as(t, admin).query(api.admin.getPlayerDetails, { playerId: alice.id });
    expect(details.profile.username).toBe("alice");
    expect(details.profile.accountStatus).toBe("active");
    expect(details.wallet.availableBalance).toBe(0);
    expect(details.fairPlay.isBanned).toBe(false);
    expect(Array.isArray(details.auditHistory)).toBe(true);

    // Verify ZERO university fields in profile
    expect((details.profile as any).universityId).toBeUndefined();
    expect((details.profile as any).universityName).toBeUndefined();
    expect((details.profile as any).studentId).toBeUndefined();
  });

  test("5. getUnifiedTransactions queries financialLedger and enriches transactions", async () => {
    const t = makeTest();
    const admin = await setupAdmin(t);
    const alice = await signUp(t, "alice");

    await as(t, alice).mutation(api.wallets.ensureWallet, {});
    const now = Date.now();

    await t.run(async (ctx) => {
      const wallet = (await ctx.db
        .query("wallets")
        .withIndex("by_userId", (q) => q.eq("userId", alice.id))
        .unique())!;

      // Insert financial deposit
      await ctx.db.insert("financialDeposits", {
        userId: alice.id,
        walletId: wallet._id,
        provider: "chapa",
        internalTxRef: "DEP_REF_100",
        providerTxId: "CHAPA_TX_999",
        requestedCreditSantims: 25_000, // 250 ETB
        providerFeeSantims: 625,
        grossAmountSantims: 25_625,
        currency: "ETB",
        status: "credited",
        feeMode: "additive",
        createdAt: now - 5000,
        updatedAt: now - 5000,
        verifiedAt: now - 5000,
      });

      // Insert financialLedger for deposit
      await ctx.db.insert("financialLedger", {
        userId: alice.id,
        walletId: wallet._id,
        entryType: "deposit_credit",
        amountSantims: 25_000,
        balanceAfterSantims: 25_000,
        lockedAfterSantims: 0,
        referenceType: "deposit",
        referenceId: "DEP_REF_100",
        idempotencyKey: "dep_ledger_100",
        description: "Deposit credited via Chapa",
        createdAt: now - 5000,
      });

      // Insert completed withdrawal in financialWithdrawals
      await ctx.db.insert("financialWithdrawals", {
        userId: alice.id,
        walletId: wallet._id,
        provider: "chapa",
        internalTransferRef: "WDR_REF_200",
        providerTransferId: "CHAPA_TR_888",
        requestedAmountSantims: 10_000, // 100 ETB
        providerFeeSantims: 250,
        totalReservedSantims: 10_250,
        currency: "ETB",
        bankName: "telebirr",
        bankCode: "855",
        accountNumberMasked: "****1234",
        accountHolderName: "Alice Tester",
        status: "completed",
        createdAt: now - 2000,
        updatedAt: now - 1000,
        completedAt: now - 1000,
      });

      // Insert financialLedger for withdrawal_reserve and withdrawal_complete
      await ctx.db.insert("financialLedger", {
        userId: alice.id,
        walletId: wallet._id,
        entryType: "withdrawal_reserve",
        amountSantims: 10_250,
        balanceAfterSantims: 14_750,
        lockedAfterSantims: 10_250,
        referenceType: "withdrawal",
        referenceId: "WDR_REF_200",
        idempotencyKey: "wdr_res_200",
        description: "Withdrawal reserved",
        createdAt: now - 2000,
      });
      await ctx.db.insert("financialLedger", {
        userId: alice.id,
        walletId: wallet._id,
        entryType: "withdrawal_complete",
        amountSantims: 10_000,
        balanceAfterSantims: 14_750,
        lockedAfterSantims: 0,
        referenceType: "withdrawal",
        referenceId: "WDR_REF_200",
        idempotencyKey: "wdr_comp_200",
        description: "Withdrawal completed",
        createdAt: now - 1000,
      });
    });

    // Query all transactions
    const txs = await as(t, admin).query(api.admin.getUnifiedTransactions, {});
    expect(txs.length).toBeGreaterThanOrEqual(2);

    // Verify deposit entry
    const depTx = txs.find((t) => t.type === "deposits");
    expect(depTx).toBeDefined();
    expect(depTx?.amountEtb).toBe(250);
    expect(depTx?.username).toBe("alice");
    expect(depTx?.providerTxId).toBe("CHAPA_TX_999");

    // Filter by type "withdrawals" — must not double count reserve & complete
    const wdrTxs = await as(t, admin).query(api.admin.getUnifiedTransactions, { type: "withdrawals" });
    expect(wdrTxs.length).toBe(1);
    expect(wdrTxs[0].amountEtb).toBe(100);
    expect(wdrTxs[0].providerTxId).toBe("CHAPA_TR_888");

    // Filter by search
    const searchTxs = await as(t, admin).query(api.admin.getUnifiedTransactions, { search: "DEP_REF" });
    expect(searchTxs.length).toBe(1);
    expect(searchTxs[0].referenceId).toBe("DEP_REF_100");
  });

  test("6. getRecentActivity returns chronological activity stream", async () => {
    const t = makeTest();
    const admin = await setupAdmin(t);
    const alice = await signUp(t, "alice");

    const activity = await as(t, admin).query(api.admin.getRecentActivity, { limit: 10 });
    expect(Array.isArray(activity)).toBe(true);
    expect(activity.length).toBeGreaterThanOrEqual(1); // At least signups
    expect(activity[0]).toHaveProperty("type");
    expect(activity[0]).toHaveProperty("timestamp");
    expect(activity[0]).toHaveProperty("title");
  });

  test("7. getSystemHealth returns system statuses", async () => {
    const t = makeTest();
    const admin = await setupAdmin(t);

    const health = await as(t, admin).query(api.admin.getSystemHealth, {});
    expect(health.convex).toBe("HEALTHY");
    expect(health.database).toBe("HEALTHY");
    expect(health.auth).toBe("HEALTHY");
    expect(health.webhooks).toBe("HEALTHY");
    expect(health.errorRate).toBeDefined();
    expect(health.latency).toBeDefined();
  });
});
