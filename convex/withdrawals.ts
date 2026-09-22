// convex/withdrawals.ts
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requirePlayer, requireAdmin } from "./lib/auth";
import { MIN_WITHDRAWAL } from "./lib/constants";
import { vPayoutMethod } from "./lib/validators";

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

    const wallet = await ctx.db
      .query("wallets")
      .withIndex("by_userId", (q) => q.eq("userId", player._id))
      .unique();

    if (!wallet) throw new Error("wallet-not-found");
    if (wallet.availableBalance < args.amount) {
      throw new Error("insufficient-funds");
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

    await ctx.db.patch(withdrawal._id, {
      status: "rejected",
      rejectionReason: args.reason ?? "Rejected by admin",
      completedAt: Date.now(),
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
