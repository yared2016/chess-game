// convex/financial/withdrawals.ts — Financial withdrawals and reservation lifecycle
import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { requireAdmin, requirePlayer, optionalPlayer } from "../lib/auth";
import { vFinancialWithdrawalStatus } from "../lib/validators";
import { postLedgerEntry } from "../ledger";
import { createNotification } from "../notifications";

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
 * Finalize or reverse a withdrawal based on provider transfer outcome.
 * If success: clears reserved funds from locked balance.
 * If failure: reverses reserved funds back to available balance.
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
    const now = Date.now();

    const withdrawal = await ctx.db
      .query("financialWithdrawals")
      .withIndex("by_internalTransferRef", (q) => q.eq("internalTransferRef", args.internalTransferRef))
      .unique();

    if (!withdrawal) throw new Error("withdrawal-not-found");
    if (withdrawal.status === "completed" || withdrawal.status === "reversed") {
      return { success: true, alreadyFinalized: true };
    }

    const wallet = await ctx.db.get(withdrawal.walletId);
    if (!wallet) throw new Error("wallet-not-found");

    const currentAvailableSantims =
      wallet.availableSantims ?? Math.round(wallet.availableBalance * 100);
    const currentLockedSantims =
      wallet.lockedSantims ?? Math.round(wallet.lockedBalance * 100);

    if (args.outcome === "completed") {
      const newLockedSantims = Math.max(0, currentLockedSantims - withdrawal.totalReservedSantims);

      // Post WITHDRAWAL_COMPLETE
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

      // Post WITHDRAWAL_FEE
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

      await ctx.db.patch(wallet._id, {
        lockedSantims: newLockedSantims,
        lockedBalance: newLockedSantims / 100,
        totalWithdrawn: wallet.totalWithdrawn + withdrawal.requestedAmountSantims / 100,
        updatedAt: now,
      });

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
    } else {
      // Reversal: restore funds from locked back to available
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
        idempotencyKey: `withdrawal_reversal_${withdrawal.internalTransferRef}`,
        description: `Reversal of failed withdrawal (${withdrawal.totalReservedSantims / 100} ETB restored)`,
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

      await ctx.db.patch(withdrawal._id, {
        status: "reversed",
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
    }

    return { success: true, alreadyFinalized: false };
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
    const player = await requirePlayer(ctx);
    const limit = args.limit ?? 20;

    return await ctx.db
      .query("financialWithdrawals")
      .withIndex("by_userId_and_status", (q) => q.eq("userId", player._id))
      .order("desc")
      .take(limit);
  },
});
