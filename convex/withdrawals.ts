// convex/withdrawals.ts
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requirePlayer, requireAdmin } from "./lib/auth";
import { MIN_WITHDRAWAL } from "./lib/constants";
import { vPayoutMethod } from "./lib/validators";
import { createNotification } from "./notifications";

export const request = mutation({
  args: { 
    amount: v.number(), 
    payoutMethod: vPayoutMethod, 
    payoutAccount: v.string() 
  },
  handler: async (ctx, args) => {
    const player = await requirePlayer(ctx);

    if (args.amount < MIN_WITHDRAWAL) {
      throw new Error(`Minimum withdrawal is ${MIN_WITHDRAWAL} ETB`);
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
      throw new Error(`Insufficient balance. Available: ${wallet?.availableBalance ?? 0} ETB, Requested: ${args.amount} ETB`);
    }

    // Deduct immediately
    await ctx.db.patch(wallet._id, {
      availableBalance: wallet.availableBalance - args.amount,
      updatedAt: Date.now(),
    });

    await ctx.db.insert("withdrawals", {
      userId: player._id,
      walletId: wallet._id,
      amount: args.amount,
      payoutMethod: args.payoutMethod,
      payoutAccount: args.payoutAccount,
      status: "pending",
      createdAt: Date.now(),
    });
  },
});

export const complete = mutation({
  args: { withdrawalId: v.id("withdrawals") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const withdrawal = await ctx.db.get(args.withdrawalId);
    if (!withdrawal) throw new Error("withdrawal-not-found");
    if (withdrawal.status !== "pending") throw new Error("withdrawal-not-pending");

    const wallet = await ctx.db.get(withdrawal.walletId);
    if (!wallet) throw new Error("wallet-not-found");

    await ctx.db.patch(withdrawal._id, {
      status: "completed",
      completedAt: Date.now(),
    });

    await ctx.db.patch(wallet._id, {
      totalWithdrawn: wallet.totalWithdrawn + withdrawal.amount,
      updatedAt: Date.now(),
    });

    await createNotification(ctx, {
      userId: withdrawal.userId,
      type: "withdrawal_completed",
      title: "Withdrawal Sent! 💸",
      message: `Your withdrawal of ${withdrawal.amount} ETB to ${withdrawal.payoutMethod.toUpperCase()} (${withdrawal.payoutAccount}) has been completed.`,
      link: `/wallet?tab=history&txId=${withdrawal._id}`,
    });
  },
});

export const reject = mutation({
  args: { withdrawalId: v.id("withdrawals"), reason: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const withdrawal = await ctx.db.get(args.withdrawalId);
    if (!withdrawal) throw new Error("withdrawal-not-found");
    if (withdrawal.status !== "pending") throw new Error("withdrawal-not-pending");

    const wallet = await ctx.db.get(withdrawal.walletId);
    if (!wallet) throw new Error("wallet-not-found");

    // Refund
    await ctx.db.patch(wallet._id, {
      availableBalance: wallet.availableBalance + withdrawal.amount,
      updatedAt: Date.now(),
    });

    const reason = args.reason ?? "Rejected by admin";
    await ctx.db.patch(withdrawal._id, {
      status: "rejected",
      rejectionReason: reason,
      completedAt: Date.now(),
    });

    await createNotification(ctx, {
      userId: withdrawal.userId,
      type: "withdrawal_rejected",
      title: "Withdrawal Rejected & Refunded",
      message: `Your withdrawal of ${withdrawal.amount} ETB was rejected and refunded to your available balance. Reason: ${reason}`,
      link: `/wallet?tab=history&txId=${withdrawal._id}`,
    });
  },
});

export const myWithdrawals = query({
  args: {},
  handler: async (ctx) => {
    const player = await requirePlayer(ctx);
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
      });
    }
    return results;
  },
});
