// convex/financial/withdrawals.ts — Financial withdrawals and reservation lifecycle
import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { requireAdmin, requirePlayer, optionalPlayer, requireCompletedPlayer, requireAdminPermission, requireOwner } from "../lib/auth";
import { vFinancialWithdrawalStatus } from "../lib/validators";
import { postLedgerEntry } from "../ledger";
import { createNotification } from "../notifications";
import { withRateLimit } from "../rateLimit";
import { postJournalTransaction, type JournalPostingInput } from "./ledger";
import { calculateTariffFee, type TariffRoute } from "./tariffs";
import { assertChannelActive } from "./channels";
import {
  vPaymentChannelKey,
  vCanonicalWithdrawalStatus,
} from "./validators";

/**
 * Reserve a withdrawal. Atomically moves requested amount + fee from available
 * balance into locked balance and records a WITHDRAWAL_RESERVE ledger entry.
 */
export const reserveWithdrawal = mutation({
  args: {
    clerkId: v.optional(v.string()),
    internalTransferRef: v.string(),
    requestedAmountSantims: v.number(),
    providerFeeSantims: v.number(),
    totalReservedSantims: v.number(),
    chapaServiceFeeSantims: v.optional(v.number()),
    chapaVatSantims: v.optional(v.number()),
    effectiveRateBps: v.optional(v.number()),
    provider: v.string(),
    bankName: v.string(),
    bankCode: v.string(),
    accountNumberMasked: v.string(),
    accountHolderName: v.string(),
  },
  handler: async (ctx, args) => {
    if (args.clerkId) {
      await withRateLimit(ctx, args.clerkId, "withdrawal", { limit: 3, windowMs: 60000 });
    }
    
    let player = await optionalPlayer(ctx);
    if (!player && args.clerkId) {
      player = await ctx.db
        .query("players")
        .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId!))
        .first();
    }
    if (!player) {
      player = await requirePlayer(ctx);
    }
    const now = Date.now();

    const wallet = await ctx.db
      .query("wallets")
      .withIndex("by_userId", (q) => q.eq("userId", player._id))
      .unique();

    if (!wallet) throw new Error("wallet-not-found");
    if (wallet.status === "frozen") throw new Error("wallet-is-frozen");

    const currentAvailableSantims =
      wallet.availableSantims ?? Math.round(wallet.availableBalance * 100);
    const currentLockedSantims =
      wallet.lockedSantims ?? Math.round(wallet.lockedBalance * 100);

    if (currentAvailableSantims < args.totalReservedSantims) {
      throw new Error(
        `Insufficient funds. Available: ${currentAvailableSantims / 100} ETB, Required (with fee): ${
          args.totalReservedSantims / 100
        } ETB`
      );
    }

    const newAvailableSantims = currentAvailableSantims - args.totalReservedSantims;
    const newLockedSantims = currentLockedSantims + args.totalReservedSantims;

    // 1. Post WITHDRAWAL_RESERVE ledger entry
    await postLedgerEntry(ctx, {
      userId: player._id,
      walletId: wallet._id,
      entryType: "withdrawal_reserve",
      amountSantims: args.totalReservedSantims,
      balanceAfterSantims: newAvailableSantims,
      lockedAfterSantims: newLockedSantims,
      referenceType: "withdrawal",
      referenceId: args.internalTransferRef,
      idempotencyKey: `withdrawal_reserve_${args.internalTransferRef}`,
      description: `Withdrawal reserved for ${args.bankName} (${args.requestedAmountSantims / 100} ETB + fee)`,
      now,
    });

    // 2. Patch wallet balances atomically
    await ctx.db.patch(wallet._id, {
      availableSantims: newAvailableSantims,
      availableBalance: newAvailableSantims / 100,
      lockedSantims: newLockedSantims,
      lockedBalance: newLockedSantims / 100,
      updatedAt: now,
    });

    // 3. Create financialWithdrawals document
    const withdrawalId = await ctx.db.insert("financialWithdrawals", {
      userId: player._id,
      walletId: wallet._id,
      provider: args.provider,
      internalTransferRef: args.internalTransferRef,
      requestedAmountSantims: args.requestedAmountSantims,
      providerFeeSantims: args.providerFeeSantims,
      totalReservedSantims: args.totalReservedSantims,
      chapaServiceFeeSantims: args.chapaServiceFeeSantims,
      chapaVatSantims: args.chapaVatSantims,
      effectiveRateBps: args.effectiveRateBps,
      currency: "ETB",
      bankName: args.bankName,
      bankCode: args.bankCode,
      accountNumberMasked: args.accountNumberMasked,
      accountHolderName: args.accountHolderName,
      status: "reserved",
      createdAt: now,
      updatedAt: now,
    });

    await createNotification(ctx, {
      userId: player._id,
      type: "withdrawal_submitted",
      title: "Withdrawal Reserved 💸",
      message: `${(args.requestedAmountSantims / 100).toFixed(2)} ETB to ${args.bankName} has been reserved and queued for transfer.`,
      link: "/wallet",
    });

    return { withdrawalId, internalTransferRef: args.internalTransferRef };
  },
});

/**
 * Mark a withdrawal as processing once Chapa transfer API successfully queues the payout.
 */
export const markWithdrawalProcessing = mutation({
  args: {
    internalTransferRef: v.string(),
    providerTransferId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const withdrawal = await ctx.db
      .query("financialWithdrawals")
      .withIndex("by_internalTransferRef", (q) => q.eq("internalTransferRef", args.internalTransferRef))
      .unique();

    if (!withdrawal) throw new Error("withdrawal-not-found");
    if (withdrawal.status !== "reserved") {
      return { success: true, status: withdrawal.status };
    }

    const now = Date.now();
    await ctx.db.patch(withdrawal._id, {
      status: "processing",
      providerTransferId: args.providerTransferId ?? withdrawal.providerTransferId,
      updatedAt: now,
    });

    return { success: true, status: "processing" };
  },
});

/**
 * Complete a withdrawal once provider confirms success.
 * Permanently releases the hold on locked balance and marks withdrawal completed.
 * Idempotent: safe against duplicate webhook calls.
 */
export const completeWithdrawal = mutation({
  args: {
    internalTransferRef: v.string(),
    providerTransferId: v.optional(v.string()),
    webhookSecret: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const withdrawal = await ctx.db
      .query("financialWithdrawals")
      .withIndex("by_internalTransferRef", (q) => q.eq("internalTransferRef", args.internalTransferRef))
      .unique();

    if (!withdrawal) throw new Error("withdrawal-not-found");
    if (withdrawal.status === "completed") {
      return { success: true, alreadyFinalized: true, status: "completed" };
    }
    if (withdrawal.status === "reversed" || withdrawal.status === "failed") {
      return { success: false, alreadyFinalized: true, status: withdrawal.status };
    }

    const wallet = await ctx.db.get(withdrawal.walletId);
    if (!wallet) throw new Error("wallet-not-found");

    const currentAvailableSantims =
      wallet.availableSantims ?? Math.round(wallet.availableBalance * 100);
    const currentLockedSantims =
      wallet.lockedSantims ?? Math.round(wallet.lockedBalance * 100);

    const newLockedSantims = Math.max(0, currentLockedSantims - withdrawal.totalReservedSantims);

    // 1. Post WITHDRAWAL_COMPLETE
    await postLedgerEntry(ctx, {
      userId: withdrawal.userId,
      walletId: wallet._id,
      entryType: "withdrawal_complete",
      amountSantims: withdrawal.requestedAmountSantims,
      balanceAfterSantims: currentAvailableSantims,
      lockedAfterSantims: newLockedSantims,
      referenceType: "withdrawal",
      referenceId: withdrawal.internalTransferRef,
      idempotencyKey: `withdrawal_complete_${withdrawal.internalTransferRef}`,
      description: `Withdrawal transfer completed (${withdrawal.requestedAmountSantims / 100} ETB)`,
      now,
    });

    // 2. Post WITHDRAWAL_FEE if applicable
    if (withdrawal.providerFeeSantims > 0) {
      await postLedgerEntry(ctx, {
        userId: withdrawal.userId,
        walletId: wallet._id,
        entryType: "withdrawal_fee",
        amountSantims: withdrawal.providerFeeSantims,
        balanceAfterSantims: currentAvailableSantims,
        lockedAfterSantims: newLockedSantims,
        referenceType: "withdrawal",
        referenceId: withdrawal.internalTransferRef,
        idempotencyKey: `withdrawal_fee_${withdrawal.internalTransferRef}`,
        description: `Transfer fee for ${withdrawal.internalTransferRef}`,
        now,
      });
    }

    // 3. Patch wallet balances (decrease locked liability)
    await ctx.db.patch(wallet._id, {
      lockedSantims: newLockedSantims,
      lockedBalance: newLockedSantims / 100,
      totalWithdrawn: wallet.totalWithdrawn + withdrawal.requestedAmountSantims / 100,
      updatedAt: now,
    });

    // 4. Update withdrawal record
    await ctx.db.patch(withdrawal._id, {
      status: "completed",
      providerTransferId: args.providerTransferId ?? withdrawal.providerTransferId,
      completedAt: now,
      updatedAt: now,
    });

    await createNotification(ctx, {
      userId: withdrawal.userId,
      type: "withdrawal_completed",
      title: "Payout Sent! 🎉",
      message: `${(withdrawal.requestedAmountSantims / 100).toFixed(2)} ETB has been transferred to your ${withdrawal.bankName} account.`,
      link: "/wallet",
    });

    return { success: true, alreadyFinalized: false, status: "completed" };
  },
});

/**
 * Fail a withdrawal and release the reserved funds back to available balance.
 * Idempotent: safe against duplicate failure calls.
 */
export const failWithdrawalAndReleaseReservation = mutation({
  args: {
    internalTransferRef: v.string(),
    failureReason: v.optional(v.any()),
    webhookSecret: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const withdrawal = await ctx.db
      .query("financialWithdrawals")
      .withIndex("by_internalTransferRef", (q) => q.eq("internalTransferRef", args.internalTransferRef))
      .unique();

    if (!withdrawal) throw new Error("withdrawal-not-found");
    if (withdrawal.status === "completed") {
      return { success: false, alreadyFinalized: true, status: "completed" };
    }
    if (withdrawal.status === "reversed" || withdrawal.status === "failed") {
      return { success: true, alreadyFinalized: true, status: withdrawal.status };
    }

    const wallet = await ctx.db.get(withdrawal.walletId);
    if (!wallet) throw new Error("wallet-not-found");

    const currentAvailableSantims =
      wallet.availableSantims ?? Math.round(wallet.availableBalance * 100);
    const currentLockedSantims =
      wallet.lockedSantims ?? Math.round(wallet.lockedBalance * 100);

    const newLockedSantims = Math.max(0, currentLockedSantims - withdrawal.totalReservedSantims);
    const newAvailableSantims = currentAvailableSantims + withdrawal.totalReservedSantims;

    // 1. Post compensating WITHDRAWAL_REVERSAL
    await postLedgerEntry(ctx, {
      userId: withdrawal.userId,
      walletId: wallet._id,
      entryType: "withdrawal_reversal",
      amountSantims: withdrawal.totalReservedSantims,
      balanceAfterSantims: newAvailableSantims,
      lockedAfterSantims: newLockedSantims,
      referenceType: "withdrawal",
      referenceId: withdrawal.internalTransferRef,
      idempotencyKey: `withdrawal_reversal_${withdrawal.internalTransferRef}`,
      description: `Reversal of failed withdrawal (${withdrawal.totalReservedSantims / 100} ETB restored)`,
      now,
    });

    // 2. Restore wallet balance (locked -> available)
    await ctx.db.patch(wallet._id, {
      availableSantims: newAvailableSantims,
      availableBalance: newAvailableSantims / 100,
      lockedSantims: newLockedSantims,
      lockedBalance: newLockedSantims / 100,
      updatedAt: now,
    });

    let cleanReason = "Provider transfer was rejected or failed";
    if (typeof args.failureReason === "string") {
      cleanReason = args.failureReason;
    } else if (args.failureReason) {
      try {
        cleanReason =
          typeof args.failureReason === "object"
            ? JSON.stringify(args.failureReason)
            : String(args.failureReason);
      } catch {
        cleanReason = "Provider transfer rejected";
      }
    }

    // 3. Mark withdrawal status as failed
    await ctx.db.patch(withdrawal._id, {
      status: "failed",
      failureReason: cleanReason,
      updatedAt: now,
    });

    await createNotification(ctx, {
      userId: withdrawal.userId,
      type: "withdrawal_rejected",
      title: "Withdrawal Failed & Refunded ⚠️",
      message: `Your withdrawal of ${(withdrawal.requestedAmountSantims / 100).toFixed(2)} ETB could not be completed and the funds have been restored to your wallet.`,
      link: "/wallet",
    });

    return { success: true, alreadyFinalized: false, status: "failed" };
  },
});

/**
 * Universal outcome settler delegating to completeWithdrawal or failWithdrawalAndReleaseReservation.
 */
export const settleWithdrawalOutcome = mutation({
  args: {
    internalTransferRef: v.string(),
    outcome: v.union(v.literal("completed"), v.literal("failed")),
    providerTransferId: v.optional(v.string()),
    failureReason: v.optional(v.any()),
    webhookSecret: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.outcome === "completed") {
      const res = await ctx.db
        .query("financialWithdrawals")
        .withIndex("by_internalTransferRef", (q) => q.eq("internalTransferRef", args.internalTransferRef))
        .unique();
      if (!res) throw new Error("withdrawal-not-found");
      const wallet = await ctx.db.get(res.walletId);
      if (!wallet) throw new Error("wallet-not-found");

      if (res.status === "completed") return { success: true, alreadyFinalized: true };
      if (res.status === "reversed" || res.status === "failed") return { success: false, alreadyFinalized: true };

      const now = Date.now();
      const currentAvailableSantims = wallet.availableSantims ?? Math.round(wallet.availableBalance * 100);
      const currentLockedSantims = wallet.lockedSantims ?? Math.round(wallet.lockedBalance * 100);
      const newLockedSantims = Math.max(0, currentLockedSantims - res.totalReservedSantims);

      await postLedgerEntry(ctx, {
        userId: res.userId,
        walletId: wallet._id,
        entryType: "withdrawal_complete",
        amountSantims: res.requestedAmountSantims,
        balanceAfterSantims: currentAvailableSantims,
        lockedAfterSantims: newLockedSantims,
        referenceType: "withdrawal",
        referenceId: res.internalTransferRef,
        idempotencyKey: `withdrawal_complete_${res.internalTransferRef}`,
        description: `Withdrawal transfer completed (${res.requestedAmountSantims / 100} ETB)`,
        now,
      });

      if (res.providerFeeSantims > 0) {
        await postLedgerEntry(ctx, {
          userId: res.userId,
          walletId: wallet._id,
          entryType: "withdrawal_fee",
          amountSantims: res.providerFeeSantims,
          balanceAfterSantims: currentAvailableSantims,
          lockedAfterSantims: newLockedSantims,
          referenceType: "withdrawal",
          referenceId: res.internalTransferRef,
          idempotencyKey: `withdrawal_fee_${res.internalTransferRef}`,
          description: `Transfer fee for ${res.internalTransferRef}`,
          now,
        });
      }

      await ctx.db.patch(wallet._id, {
        lockedSantims: newLockedSantims,
        lockedBalance: newLockedSantims / 100,
        totalWithdrawn: wallet.totalWithdrawn + res.requestedAmountSantims / 100,
        updatedAt: now,
      });

      await ctx.db.patch(res._id, {
        status: "completed",
        providerTransferId: args.providerTransferId ?? res.providerTransferId,
        completedAt: now,
        updatedAt: now,
      });

      return { success: true, alreadyFinalized: false };
    } else {
      const res = await ctx.db
        .query("financialWithdrawals")
        .withIndex("by_internalTransferRef", (q) => q.eq("internalTransferRef", args.internalTransferRef))
        .unique();
      if (!res) throw new Error("withdrawal-not-found");
      const wallet = await ctx.db.get(res.walletId);
      if (!wallet) throw new Error("wallet-not-found");

      if (res.status === "completed") return { success: false, alreadyFinalized: true };
      if (res.status === "reversed" || res.status === "failed") return { success: true, alreadyFinalized: true };

      const now = Date.now();
      const currentAvailableSantims = wallet.availableSantims ?? Math.round(wallet.availableBalance * 100);
      const currentLockedSantims = wallet.lockedSantims ?? Math.round(wallet.lockedBalance * 100);
      const newLockedSantims = Math.max(0, currentLockedSantims - res.totalReservedSantims);
      const newAvailableSantims = currentAvailableSantims + res.totalReservedSantims;

      await postLedgerEntry(ctx, {
        userId: res.userId,
        walletId: wallet._id,
        entryType: "withdrawal_reversal",
        amountSantims: res.totalReservedSantims,
        balanceAfterSantims: newAvailableSantims,
        lockedAfterSantims: newLockedSantims,
        referenceType: "withdrawal",
        referenceId: res.internalTransferRef,
        idempotencyKey: `withdrawal_reversal_${res.internalTransferRef}`,
        description: `Reversal of failed withdrawal (${res.totalReservedSantims / 100} ETB restored)`,
        now,
      });

      await ctx.db.patch(wallet._id, {
        availableSantims: newAvailableSantims,
        availableBalance: newAvailableSantims / 100,
        lockedSantims: newLockedSantims,
        lockedBalance: newLockedSantims / 100,
        updatedAt: now,
      });

      let cleanReason = "Provider transfer was rejected or failed";
      if (typeof args.failureReason === "string") {
        cleanReason = args.failureReason;
      }

      await ctx.db.patch(res._id, {
        status: "failed",
        failureReason: cleanReason,
        updatedAt: now,
      });

      return { success: true, alreadyFinalized: false };
    }
  },
});

/**
 * Reconcile stuck withdrawals in "reserved" status.
 * Reverses reserved funds back into user available balance and updates status to "reversed".
 */
export const reconcileStuckWithdrawals = mutation({
  args: {
    clerkId: v.optional(v.string()),
    internalTransferRef: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const stuck = await ctx.db
      .query("financialWithdrawals")
      .withIndex("by_status", (q) => q.eq("status", "reserved"))
      .collect();

    const results = [];
    const now = Date.now();

    for (const withdrawal of stuck) {
      if (args.internalTransferRef && withdrawal.internalTransferRef !== args.internalTransferRef) {
        continue;
      }
      if (args.clerkId) {
        const player = await ctx.db.get(withdrawal.userId);
        if (player?.clerkId !== args.clerkId) continue;
      }

      const wallet = await ctx.db.get(withdrawal.walletId);
      if (!wallet) continue;

      const currentAvailableSantims =
        wallet.availableSantims ?? Math.round(wallet.availableBalance * 100);
      const currentLockedSantims =
        wallet.lockedSantims ?? Math.round(wallet.lockedBalance * 100);

      const newLockedSantims = Math.max(0, currentLockedSantims - withdrawal.totalReservedSantims);
      const newAvailableSantims = currentAvailableSantims + withdrawal.totalReservedSantims;

      await postLedgerEntry(ctx, {
        userId: withdrawal.userId,
        walletId: wallet._id,
        entryType: "withdrawal_reversal",
        amountSantims: withdrawal.totalReservedSantims,
        balanceAfterSantims: newAvailableSantims,
        lockedAfterSantims: newLockedSantims,
        referenceType: "withdrawal",
        referenceId: withdrawal.internalTransferRef,
        idempotencyKey: `withdrawal_reconcile_${withdrawal.internalTransferRef}`,
        description: `Reconciliation reversal of stuck withdrawal (${withdrawal.totalReservedSantims / 100} ETB restored)`,
        now,
      });

      await ctx.db.patch(wallet._id, {
        availableSantims: newAvailableSantims,
        availableBalance: newAvailableSantims / 100,
        lockedSantims: newLockedSantims,
        lockedBalance: newLockedSantims / 100,
        updatedAt: now,
      });

      await ctx.db.patch(withdrawal._id, {
        status: "reversed",
        failureReason: "Reconciled stuck withdrawal: Bank code format error (reverted to available balance)",
        updatedAt: now,
      });

      results.push({
        ref: withdrawal.internalTransferRef,
        amountEtb: withdrawal.totalReservedSantims / 100,
        status: "reversed",
      });
    }

    return { reconciledCount: results.length, reversals: results };
  },
});

/**
 * User query for own withdrawals.
 */
export const myWithdrawals = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const player = await optionalPlayer(ctx);
    if (!player) return [];
    const limit = args.limit ?? 20;

    return await ctx.db
      .query("financialWithdrawals")
      .withIndex("by_userId_and_createdAt", (q) => q.eq("userId", player._id))
      .order("desc")
      .take(limit);
  },
});

// =========================================================================
// v4.2.7-PROD NET WITHDRAWAL GUARANTEE & PROVIDER FEE PASS-THROUGH (PHASE 5)
// =========================================================================

/**
 * Phase 1 & 2: Requests a canonical withdrawal with Net Payout Guarantee.
 * Reserves (Requested Amount X + Quoted Fee F) from Account 2010.
 * Double-entry: Debit 2010 (X + F), Credit 2030 (X), Credit 2040 (F).
 */
export const requestCanonicalWithdrawal = mutation({
  args: {
    paymentChannel: vPaymentChannelKey,
    payoutDestination: v.string(),
    payoutDestinationName: v.string(),
    requestedAmountSantims: v.int64(),
  },
  handler: async (ctx, args) => {
    const player = await requireCompletedPlayer(ctx);
    await assertChannelActive(ctx, args.paymentChannel, "outflow");

    // Enforce single withdrawal limit (OD-10: 50,000 ETB = 5,000,000 santims)
    if (args.requestedAmountSantims > BigInt(5000000)) {
      throw new Error(`ERR_WITHDRAWAL_LIMIT_EXCEEDED: Maximum single withdrawal is 50,000.00 ETB.`);
    }
    if (args.requestedAmountSantims < BigInt(5000)) {
      throw new Error(`ERR_MINIMUM_WITHDRAWAL: Minimum withdrawal is 50.00 ETB.`);
    }

    const route: TariffRoute = args.paymentChannel === "telebirr" ? "telebirr_p2p" : "cbe_a2a";

    // 1. Calculate provider fee and check boundary quarantines
    const tariffResult = await calculateTariffFee(ctx, {
      route,
      amountSantims: args.requestedAmountSantims,
    });

    const netPayoutSantims = args.requestedAmountSantims;
    const quotedFeeSantims = tariffResult.feeSantims;
    const totalReservedSantims = netPayoutSantims + quotedFeeSantims;

    // 2. Validate player available balance in playerBalances
    const balanceRecord = await ctx.db
      .query("playerBalances")
      .withIndex("by_playerId", (q) => q.eq("playerId", player._id))
      .unique();

    const availableSantims = balanceRecord?.availableSantims ?? BigInt(0);
    if (availableSantims < totalReservedSantims) {
      throw new Error(
        `ERR_INSUFFICIENT_FUNDS: Available ${availableSantims} santims, required ${totalReservedSantims} santims (net ${netPayoutSantims} + fee ${quotedFeeSantims}).`
      );
    }

    const now = Date.now();
    const withdrawalId = `wd_${now}_${Math.random().toString(36).substring(2, 9)}`;

    // 3. Double-entry reservation posting (RB-11)
    await postJournalTransaction(ctx, {
      idempotencyKey: `wd_res_${withdrawalId}`,
      transactionType: "withdrawal_reservation",
      description: `Withdrawal Reservation for ${args.paymentChannel} (Net ${netPayoutSantims} + Fee ${quotedFeeSantims})`,
      referenceType: "withdrawal",
      referenceId: withdrawalId,
      postings: [
        {
          accountNumber: "2010",
          direction: "debit",
          amountSantims: totalReservedSantims,
          playerId: player._id,
        },
        {
          accountNumber: "2030",
          direction: "credit",
          amountSantims: netPayoutSantims,
          playerId: player._id,
        },
        {
          accountNumber: "2040",
          direction: "credit",
          amountSantims: quotedFeeSantims,
        },
      ],
      postedBy: player.clerkId,
      now,
    });

    // 4. Create withdrawal request record
    const initialStatus = tariffResult.isAutomatedPayoutAllowed ? "reserved" : "quarantined";

    await ctx.db.insert("withdrawalRequests", {
      withdrawalId,
      playerId: player._id,
      clerkId: player.clerkId,
      paymentChannel: args.paymentChannel,
      payoutDestination: args.payoutDestination,
      payoutDestinationName: args.payoutDestinationName,
      requestedAmountSantims: netPayoutSantims,
      quotedFeeSantims,
      totalReservedSantims,
      tariffSnapshot: {
        tariffId: tariffResult.tariffId,
        version: tariffResult.version,
        effectiveBps: tariffResult.effectiveBps,
        effectiveFixedSantims: tariffResult.effectiveFixedSantims,
        route,
      },
      status: initialStatus,
      quarantineReason: tariffResult.quarantineReason,
      createdAt: now,
      updatedAt: now,
    });

    return {
      withdrawalId,
      netPayoutSantims,
      quotedFeeSantims,
      totalReservedSantims,
      status: initialStatus,
      isQuarantined: !tariffResult.isAutomatedPayoutAllowed,
      quarantineReason: tariffResult.quarantineReason,
    };
  },
});

/**
 * Phase 6 & 7: Settlement execution with variance absorption (RB-12, RB-18, RB-57, RB-58).
 * Absorbs under-collection variance into Account 5010, or refunds over-collection into Account 2010.
 * Enforces mandatory independent bank reference or CBS voucher (RB-71).
 */
export const executeCanonicalWithdrawalSettlement = mutation({
  args: {
    withdrawalId: v.string(),
    actualFeeSantims: v.int64(),
    cbe_cbs_voucher: v.optional(v.string()),
    externalSettlementReference: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdminPermission(ctx, "review_withdrawals");

    const withdrawal = await ctx.db
      .query("withdrawalRequests")
      .withIndex("by_withdrawalId", (q) => q.eq("withdrawalId", args.withdrawalId))
      .unique();

    if (!withdrawal) throw new Error(`ERR_WITHDRAWAL_NOT_FOUND`);
    if (withdrawal.status === "settled") return { success: true, alreadySettled: true };

    // RB-71: Mandatory independent evidence before settlement
    if (withdrawal.paymentChannel === "cbe_a2a" && !args.cbe_cbs_voucher?.trim()) {
      throw new Error(`ERR_MISSING_CBS_VOUCHER: CBE Account-to-Account settlement requires a valid CBS voucher reference (RB-71).`);
    }
    if (!args.cbe_cbs_voucher?.trim() && !args.externalSettlementReference?.trim()) {
      throw new Error(`ERR_MISSING_SETTLEMENT_REFERENCE: Independent provider settlement reference is mandatory (RB-71).`);
    }

    const now = Date.now();
    const X = withdrawal.requestedAmountSantims; // Net payout guaranteed
    const F = withdrawal.quotedFeeSantims;       // Quoted fee in Account 2040
    const f = args.actualFeeSantims;             // Actual provider fee charged
    const totalBankDebit = X + f;                // Total cash leaving bank account

    const destinationAccount = withdrawal.paymentChannel === "telebirr" ? "1020" : "1010";
    const postings: JournalPostingInput[] = [];

    // Always clear reservation of net payout X from Account 2030
    postings.push({
      accountNumber: "2030",
      direction: "debit",
      amountSantims: X,
      playerId: withdrawal.playerId,
    });

    // Always clear quoted fee F from Account 2040
    postings.push({
      accountNumber: "2040",
      direction: "debit",
      amountSantims: F,
    });

    // Credited cash leaving the bank
    postings.push({
      accountNumber: destinationAccount,
      direction: "credit",
      amountSantims: totalBankDebit,
    });

    // Variance resolution:
    if (f > F) {
      // Under-collection: platform absorbs difference into Account 5010 (RB-18 / Scenario B)
      const variance = f - F;
      postings.push({
        accountNumber: "5010",
        direction: "debit",
        amountSantims: variance,
      });
    } else if (f < F) {
      // Over-collection: excess quoted fee refunded to player Account 2010 (Scenario C)
      const refund = F - f;
      postings.push({
        accountNumber: "2010",
        direction: "credit",
        amountSantims: refund,
        playerId: withdrawal.playerId,
      });
    }

    // Post double-entry settlement journal
    await postJournalTransaction(ctx, {
      idempotencyKey: `wd_stl_${withdrawal.withdrawalId}`,
      transactionType: "withdrawal_settlement",
      description: `Withdrawal Settlement via ${withdrawal.paymentChannel} (Actual fee: ${f}, Quoted: ${F})`,
      referenceType: "withdrawal",
      referenceId: withdrawal.withdrawalId,
      postings,
      postedBy: admin.identity.subject,
      now,
    });

    await ctx.db.patch(withdrawal._id, {
      status: "settled",
      actualFeeSantims: f,
      cbe_cbs_voucher: args.cbe_cbs_voucher,
      externalSettlementReference: args.externalSettlementReference,
      settledAt: now,
      updatedAt: now,
    });

    return {
      success: true,
      status: "settled",
      netPayoutSantims: X,
      actualFeeSantims: f,
      varianceAbsorbedSantims: f > F ? f - F : BigInt(0),
    };
  },
});

/**
 * Rejection / Cancellation of pending withdrawal.
 * Unwinds reservation: Debit 2030 (X), Debit 2040 (F), Credit 2010 (X + F).
 */
export const cancelOrRejectCanonicalWithdrawal = mutation({
  args: {
    withdrawalId: v.string(),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdminPermission(ctx, "review_withdrawals");

    const withdrawal = await ctx.db
      .query("withdrawalRequests")
      .withIndex("by_withdrawalId", (q) => q.eq("withdrawalId", args.withdrawalId))
      .unique();

    if (!withdrawal) throw new Error(`ERR_WITHDRAWAL_NOT_FOUND`);
    if (withdrawal.status === "settled") {
      throw new Error(`ERR_CANNOT_CANCEL_SETTLED_WITHDRAWAL`);
    }

    const now = Date.now();
    const X = withdrawal.requestedAmountSantims;
    const F = withdrawal.quotedFeeSantims;

    await postJournalTransaction(ctx, {
      idempotencyKey: `wd_cnl_${withdrawal.withdrawalId}`,
      transactionType: "withdrawal_cancellation",
      description: `Withdrawal Cancelled / Rejected: ${args.reason}`,
      referenceType: "withdrawal",
      referenceId: withdrawal.withdrawalId,
      postings: [
        {
          accountNumber: "2030",
          direction: "debit",
          amountSantims: X,
          playerId: withdrawal.playerId,
        },
        {
          accountNumber: "2040",
          direction: "debit",
          amountSantims: F,
        },
        {
          accountNumber: "2010",
          direction: "credit",
          amountSantims: X + F,
          playerId: withdrawal.playerId,
        },
      ],
      postedBy: admin.identity.subject,
      now,
    });

    await ctx.db.patch(withdrawal._id, {
      status: "cancelled",
      failureReason: args.reason,
      updatedAt: now,
    });

    return { success: true, status: "cancelled", restoredSantims: X + F };
  },
});

/**
 * Two-Step Returned Transfer Protocol (RB-72):
 * Handles bank-returned transfers where initial disbursement occurred but was returned.
 */
export const processReturnedTransfer = mutation({
  args: {
    withdrawalId: v.string(),
    returnType: v.union(v.literal("case_e2_net_returned"), v.literal("case_e3_full_returned")),
    bankReference: v.string(),
  },
  handler: async (ctx, args) => {
    await requireOwner(ctx); // Returned transfers require Owner authorization

    const withdrawal = await ctx.db
      .query("withdrawalRequests")
      .withIndex("by_withdrawalId", (q) => q.eq("withdrawalId", args.withdrawalId))
      .unique();

    if (!withdrawal || withdrawal.status !== "settled") {
      throw new Error(`ERR_INVALID_RETURN_STATE: Only settled withdrawals can be returned by bank.`);
    }

    const now = Date.now();
    const X = withdrawal.requestedAmountSantims;
    const F = withdrawal.quotedFeeSantims;
    const f = withdrawal.actualFeeSantims ?? F;
    const destinationAccount = withdrawal.paymentChannel === "telebirr" ? "1020" : "1010";

    const postings: JournalPostingInput[] = [];

    if (args.returnType === "case_e2_net_returned") {
      // Bank debited X + f, provider kept fee f, returned net X to bank:
      // Inflow to 1010/1020 (X), re-credit player 2010 (X)
      postings.push({
        accountNumber: destinationAccount,
        direction: "debit",
        amountSantims: X,
      });
      postings.push({
        accountNumber: "2010",
        direction: "credit",
        amountSantims: X,
        playerId: withdrawal.playerId,
      });
    } else {
      // Case E3: Full refund of X + f returned by bank:
      postings.push({
        accountNumber: destinationAccount,
        direction: "debit",
        amountSantims: X + f,
      });
      postings.push({
        accountNumber: "2010",
        direction: "credit",
        amountSantims: X + F,
        playerId: withdrawal.playerId,
      });
      if (f > F) {
        postings.push({
          accountNumber: "5010",
          direction: "credit",
          amountSantims: f - F,
        });
      }
    }

    await postJournalTransaction(ctx, {
      idempotencyKey: `wd_ret_${withdrawal.withdrawalId}_${now}`,
      transactionType: "withdrawal_returned_recredit",
      description: `Returned Transfer (${args.returnType}) - Ref: ${args.bankReference}`,
      referenceType: "withdrawal",
      referenceId: withdrawal.withdrawalId,
      postings,
      postedBy: (await ctx.auth.getUserIdentity())?.subject ?? "owner",
      now,
    });

    await ctx.db.patch(withdrawal._id, {
      status: "returned",
      updatedAt: now,
    });

    return { success: true, status: "returned" };
  },
});
