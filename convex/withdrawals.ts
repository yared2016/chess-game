// convex/withdrawals.ts
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requirePlayer, requireAdmin, optionalPlayer } from "./lib/auth";
import { MIN_WITHDRAWAL } from "./lib/constants";
import { vPayoutMethod, vWithdrawalStatus } from "./lib/validators";
import { createNotification } from "./notifications";
import { postLedgerEntry } from "./ledger";

export const request = mutation({
  args: {
    amount: v.number(),
    payoutMethod: vPayoutMethod,
    payoutAccount: v.string(),
    accountHolderName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const player = await requirePlayer(ctx);

    if (args.amount < MIN_WITHDRAWAL) {
      throw new Error(`Minimum withdrawal is ${MIN_WITHDRAWAL} ETB`);
    }

    const cleanAccount = args.payoutAccount.trim();
    if (!cleanAccount) {
      throw new Error("payout-account-required");
    }

    let wallet = await ctx.db
      .query("wallets")
      .withIndex("by_userId", (q) => q.eq("userId", player._id))
      .unique();

    if (!wallet) {
      const now = Date.now();
      const walletId = await ctx.db.insert("wallets", {
        userId: player._id,
        availableBalance: 0,
        lockedBalance: 0,
        availableSantims: 0,
        lockedSantims: 0,
        totalDeposited: 0,
        totalWithdrawn: 0,
        totalWon: 0,
        totalLost: 0,
        createdAt: now,
        updatedAt: now,
      });
      wallet = await ctx.db.get(walletId);
    }

    if (!wallet || wallet.availableBalance < args.amount) {
      throw new Error(
        `Insufficient balance. Available: ${wallet?.availableBalance ?? 0} ETB, Requested: ${args.amount} ETB`,
      );
    }

    const now = Date.now();
    const amountSantims = Math.round(args.amount * 100);
    const currentAvailSantims =
      wallet.availableSantims ?? Math.round(wallet.availableBalance * 100);
    const currentLockedSantims =
      wallet.lockedSantims ?? Math.round((wallet.lockedBalance ?? 0) * 100);

    const newAvailBalance = wallet.availableBalance - args.amount;
    const newLockedBalance = (wallet.lockedBalance ?? 0) + args.amount;
    const newAvailSantims = currentAvailSantims - amountSantims;
    const newLockedSantims = currentLockedSantims + amountSantims;

    // Place requested amount on hold atomically
    await ctx.db.patch(wallet._id, {
      availableBalance: newAvailBalance,
      lockedBalance: newLockedBalance,
      availableSantims: newAvailSantims,
      lockedSantims: newLockedSantims,
      updatedAt: now,
    });

    const withdrawalId = await ctx.db.insert("withdrawals", {
      userId: player._id,
      walletId: wallet._id,
      amount: args.amount,
      payoutMethod: args.payoutMethod,
      payoutAccount: cleanAccount,
      accountHolderName: args.accountHolderName?.trim() || undefined,
      status: "pending",
      createdAt: now,
    });

    // Record hold reservation in ledger
    await postLedgerEntry(ctx, {
      userId: player._id,
      walletId: wallet._id,
      entryType: "withdrawal_reserve",
      amountSantims: amountSantims,
      balanceAfterSantims: newAvailSantims,
      lockedAfterSantims: newLockedSantims,
      referenceType: "withdrawal",
      referenceId: withdrawalId,
      idempotencyKey: `withdrawal_reserve_${withdrawalId}`,
      description: `Manual withdrawal hold placed (${args.payoutMethod.toUpperCase()} - ${cleanAccount})`,
      now,
    });

    await createNotification(ctx, {
      userId: player._id,
      type: "withdrawal_submitted",
      title: "Withdrawal Requested",
      message: `Your withdrawal request for ${args.amount} ETB via ${args.payoutMethod.toUpperCase()} (${cleanAccount}) has been submitted and is pending processing.`,
      link: `/wallet?tab=history&txId=${withdrawalId}`,
    });

    return { withdrawalId };
  },
});

export const complete = mutation({
  args: {
    withdrawalId: v.id("withdrawals"),
    transferReference: v.string(),
    verificationNote: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const withdrawal = await ctx.db.get(args.withdrawalId);
    if (!withdrawal) throw new Error("withdrawal-not-found");
    if (withdrawal.status !== "pending") throw new Error("withdrawal-not-pending");

    const transferRef = args.transferReference.trim();
    if (!transferRef) {
      throw new Error("transfer-reference-required");
    }

    const wallet = await ctx.db.get(withdrawal.walletId);
    if (!wallet) throw new Error("wallet-not-found");

    const now = Date.now();
    const amountSantims = Math.round(withdrawal.amount * 100);
    const currentLockedSantims =
      wallet.lockedSantims ?? Math.round((wallet.lockedBalance ?? 0) * 100);
    const newLockedBalance = Math.max(0, (wallet.lockedBalance ?? 0) - withdrawal.amount);
    const newLockedSantims = Math.max(0, currentLockedSantims - amountSantims);
    const currentAvailSantims =
      wallet.availableSantims ?? Math.round(wallet.availableBalance * 100);

    // Atomically debit locked hold balance and increment totalWithdrawn
    await ctx.db.patch(wallet._id, {
      lockedBalance: newLockedBalance,
      lockedSantims: newLockedSantims,
      totalWithdrawn: (wallet.totalWithdrawn ?? 0) + withdrawal.amount,
      updatedAt: now,
    });

    // Mark withdrawal completed with payout reference
    await ctx.db.patch(withdrawal._id, {
      status: "completed",
      transferReference: transferRef,
      verificationNote: args.verificationNote?.trim() || undefined,
      reviewedBy: admin._id,
      completedAt: now,
    });

    // Immutable ledger posting
    await postLedgerEntry(ctx, {
      userId: withdrawal.userId,
      walletId: wallet._id,
      entryType: "withdrawal_complete",
      amountSantims: amountSantims,
      balanceAfterSantims: currentAvailSantims,
      lockedAfterSantims: newLockedSantims,
      referenceType: "withdrawal",
      referenceId: withdrawal._id,
      idempotencyKey: `withdrawal_complete_${withdrawal._id}`,
      description: `Manual withdrawal payout executed (Ref: ${transferRef})`,
      metadata: JSON.stringify({
        adminId: admin._id,
        transferReference: transferRef,
        verificationNote: args.verificationNote,
      }),
      now,
    });

    await createNotification(ctx, {
      userId: withdrawal.userId,
      type: "withdrawal_completed",
      title: "Withdrawal Sent! 💸",
      message: `Your withdrawal of ${withdrawal.amount} ETB to ${withdrawal.payoutMethod.toUpperCase()} (${withdrawal.payoutAccount}) has been completed. Ref: ${transferRef}.`,
      link: `/wallet?tab=history&txId=${withdrawal._id}`,
    });

    return { success: true, withdrawalId: withdrawal._id };
  },
});

export const reject = mutation({
  args: {
    withdrawalId: v.id("withdrawals"),
    reason: v.string(),
    verificationNote: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const withdrawal = await ctx.db.get(args.withdrawalId);
    if (!withdrawal) throw new Error("withdrawal-not-found");
    if (withdrawal.status !== "pending") throw new Error("withdrawal-not-pending");

    const reason = args.reason.trim();
    if (!reason) {
      throw new Error("reason-required");
    }

    const wallet = await ctx.db.get(withdrawal.walletId);
    if (!wallet) throw new Error("wallet-not-found");

    const now = Date.now();
    const amountSantims = Math.round(withdrawal.amount * 100);
    const currentAvailSantims =
      wallet.availableSantims ?? Math.round(wallet.availableBalance * 100);
    const currentLockedSantims =
      wallet.lockedSantims ?? Math.round((wallet.lockedBalance ?? 0) * 100);

    const newAvailBalance = wallet.availableBalance + withdrawal.amount;
    const newLockedBalance = Math.max(0, (wallet.lockedBalance ?? 0) - withdrawal.amount);
    const newAvailSantims = currentAvailSantims + amountSantims;
    const newLockedSantims = Math.max(0, currentLockedSantims - amountSantims);

    // Atomically release hold back to available balance
    await ctx.db.patch(wallet._id, {
      availableBalance: newAvailBalance,
      lockedBalance: newLockedBalance,
      availableSantims: newAvailSantims,
      lockedSantims: newLockedSantims,
      updatedAt: now,
    });

    await ctx.db.patch(withdrawal._id, {
      status: "rejected",
      rejectionReason: reason,
      verificationNote: args.verificationNote?.trim() || undefined,
      reviewedBy: admin._id,
      completedAt: now,
    });

    // Immutable ledger reversal entry
    await postLedgerEntry(ctx, {
      userId: withdrawal.userId,
      walletId: wallet._id,
      entryType: "withdrawal_reversal",
      amountSantims: amountSantims,
      balanceAfterSantims: newAvailSantims,
      lockedAfterSantims: newLockedSantims,
      referenceType: "withdrawal",
      referenceId: withdrawal._id,
      idempotencyKey: `withdrawal_reversal_${withdrawal._id}`,
      description: `Withdrawal hold released: ${reason}`,
      metadata: JSON.stringify({
        adminId: admin._id,
        reason,
        verificationNote: args.verificationNote,
      }),
      now,
    });

    await createNotification(ctx, {
      userId: withdrawal.userId,
      type: "withdrawal_rejected",
      title: "Withdrawal Rejected & Refunded",
      message: `Your withdrawal of ${withdrawal.amount} ETB was rejected and refunded to your available balance. Reason: ${reason}`,
      link: `/wallet?tab=history&txId=${withdrawal._id}`,
    });

    return { success: true, withdrawalId: withdrawal._id };
  },
});

export const myWithdrawals = query({
  args: {},
  handler: async (ctx) => {
    const player = await optionalPlayer(ctx);
    if (!player) return [];
    return await ctx.db
      .query("withdrawals")
      .withIndex("by_userId", (q) => q.eq("userId", player._id))
      .order("desc")
      .take(50);
  },
});

export const pendingWithdrawals = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const withdrawals = await ctx.db
      .query("withdrawals")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .order("asc")
      .collect();

    const results = [];
    for (const w of withdrawals) {
      const player = await ctx.db.get(w.userId);
      results.push({
        ...w,
        username: player?.username ?? "Unknown",
        userEmail: player?.email,
      });
    }
    return results;
  },
});

export const listAdminWithdrawals = query({
  args: {
    status: v.optional(
      v.union(
        v.literal("all"),
        v.literal("pending"),
        v.literal("completed"),
        v.literal("rejected"),
      ),
    ),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const limit = args.limit ?? 100;
    const all = await ctx.db.query("withdrawals").order("desc").take(limit);

    let filtered = all;
    if (args.status && args.status !== "all") {
      filtered = all.filter((w) => w.status === args.status);
    }

    return await Promise.all(
      filtered.map(async (w) => {
        const player = await ctx.db.get(w.userId);
        let reviewerName: string | undefined;
        if (w.reviewedBy) {
          const reviewer = await ctx.db.get(w.reviewedBy);
          reviewerName = reviewer?.username;
        }

        return {
          ...w,
          username: player?.username ?? "Unknown",
          userEmail: player?.email,
          userClerkId: player?.clerkId,
          reviewerName,
        };
      }),
    );
  },
});
