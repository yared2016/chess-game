// convex/admin.ts
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAdmin } from "./lib/auth";

export const isAdmin = query({
  args: {},
  handler: async (ctx) => {
    try {
      await requireAdmin(ctx);
      return true;
    } catch {
      return false;
    }
  },
});

export const platformStats = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);

    const commissions = await ctx.db.query("commissions").collect();
    const totalCommissionEarned = commissions.reduce((sum, c) => sum + c.amount, 0);
    const pendingCommission = commissions.filter((c) => !c.transferred).reduce((sum, c) => sum + c.amount, 0);

    const users = await ctx.db.query("players").collect();
    const totalUsers = users.length;

    const deposits = await ctx.db.query("deposits").withIndex("by_status", (q) => q.eq("status", "approved")).collect();
    const totalDeposits = deposits.reduce((sum, d) => sum + d.amount, 0);

    const withdrawals = await ctx.db.query("withdrawals").withIndex("by_status", (q) => q.eq("status", "completed")).collect();
    const totalWithdrawals = withdrawals.reduce((sum, w) => sum + w.amount, 0);

    return {
      totalCommissionEarned,
      pendingCommission,
      totalUsers,
      totalDeposits,
      totalWithdrawals,
    };
  },
});

export const markCommissionTransferred = mutation({
  args: { amount: v.number() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const untransferred = await ctx.db
      .query("commissions")
      .withIndex("by_transferred", (q) => q.eq("transferred", false))
      .order("asc")
      .collect();

    let remaining = args.amount;

    for (const c of untransferred) {
      if (remaining <= 0) break;

      if (c.amount <= remaining) {
        await ctx.db.patch(c._id, { transferred: true });
        remaining -= c.amount;
      } else {
        break;
      }
    }
  },
});
