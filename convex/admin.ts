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
    const adminPlayer = await requireAdmin(ctx);

    const commissions = await ctx.db.query("commissions").collect();
    const totalCommissionEarned = commissions.reduce((sum, c) => sum + c.amount, 0);
    const pendingCommission = commissions.filter((c) => !c.transferred).reduce((sum, c) => sum + c.amount, 0);

    const users = await ctx.db.query("players").collect();
    const totalUsers = users.length;

    const deposits = await ctx.db.query("deposits").withIndex("by_status", (q) => q.eq("status", "approved")).collect();
    const totalDeposits = deposits.reduce((sum, d) => sum + d.amount, 0);

    const withdrawals = await ctx.db.query("withdrawals").withIndex("by_status", (q) => q.eq("status", "completed")).collect();
    const totalWithdrawals = withdrawals.reduce((sum, w) => sum + w.amount, 0);

    const adminWallet = await ctx.db
      .query("wallets")
      .withIndex("by_userId", (q) => q.eq("userId", adminPlayer._id))
      .unique();

    // Sort recent commissions desc
    const sortedCommissions = commissions.sort((a, b) => b.createdAt - a.createdAt).slice(0, 20);

    return {
      // Both naming conventions for frontend compatibility
      totalCommission: totalCommissionEarned,
      totalCommissionEarned,
      pendingTransfer: pendingCommission,
      pendingCommission,
      adminWalletBalance: adminWallet?.availableBalance ?? 0,
      adminWalletLocked: adminWallet?.lockedBalance ?? 0,
      totalUsers,
      totalDeposits,
      totalWithdrawals,
      recentCommissions: sortedCommissions,
    };
  },
});

export const markCommissionTransferred = mutation({
  args: { amount: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const untransferred = await ctx.db
      .query("commissions")
      .withIndex("by_transferred", (q) => q.eq("transferred", false))
      .order("asc")
      .collect();

    let remaining = args.amount ?? untransferred.reduce((sum, c) => sum + c.amount, 0);

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

export const syncCommissionsToWallet = mutation({
  args: {},
  handler: async (ctx) => {
    const adminPlayer = await requireAdmin(ctx);

    const commissions = await ctx.db.query("commissions").collect();
    const totalCommission = commissions.reduce((sum, c) => sum + c.amount, 0);

    let adminWallet = await ctx.db
      .query("wallets")
      .withIndex("by_userId", (q) => q.eq("userId", adminPlayer._id))
      .unique();

    if (!adminWallet) {
      await ctx.db.insert("wallets", {
        userId: adminPlayer._id,
        availableBalance: totalCommission,
        lockedBalance: 0,
        totalDeposited: 0,
        totalWithdrawn: 0,
        totalWon: totalCommission,
        totalLost: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      return { syncedAmount: totalCommission, newBalance: totalCommission };
    } else {
      const currentWon = adminWallet.totalWon ?? 0;
      const diff = Math.max(0, totalCommission - currentWon);
      if (diff > 0) {
        await ctx.db.patch(adminWallet._id, {
          availableBalance: adminWallet.availableBalance + diff,
          totalWon: currentWon + diff,
          updatedAt: Date.now(),
        });
      }
      return { syncedAmount: diff, newBalance: adminWallet.availableBalance + diff };
    }
  },
});

export const listPlayers = query({
  args: { search: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    let players = await ctx.db.query("players").order("desc").take(100);
    if (args.search) {
      const s = args.search.toLowerCase();
      players = players.filter(
        (p) =>
          p.username.toLowerCase().includes(s) ||
          p.clerkId.toLowerCase().includes(s)
      );
    }
    const enriched = await Promise.all(
      players.map(async (p) => {
        const wallet = await ctx.db
          .query("wallets")
          .withIndex("by_userId", (q) => q.eq("userId", p._id))
          .unique();
        return {
          _id: p._id,
          username: p.username,
          avatarUrl: p.avatarUrl,
          clerkId: p.clerkId,
          rating: p.rating,
          wins: p.wins,
          losses: p.losses,
          draws: p.draws,
          proUntil: p.proUntil,
          createdAt: p.createdAt,
          availableBalance: wallet?.availableBalance ?? 0,
          lockedBalance: wallet?.lockedBalance ?? 0,
          totalDeposited: wallet?.totalDeposited ?? 0,
          totalWon: wallet?.totalWon ?? 0,
        };
      })
    );
    return enriched;
  },
});

export const recentGames = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const limit = args.limit ?? 30;
    const games = await ctx.db.query("games").order("desc").take(limit);
    return await Promise.all(
      games.map(async (g) => {
        const white = g.whiteId ? await ctx.db.get(g.whiteId) : null;
        const black = g.blackId ? await ctx.db.get(g.blackId) : null;
        return {
          _id: g._id,
          mode: g.mode,
          status: g.status,
          winner: g.winner,
          endReason: g.endReason,
          stake: g.stake ?? 0,
          escrowTotal: g.escrowTotal ?? 0,
          commission: g.commission ?? 0,
          payout: g.payout ?? 0,
          escrowSettled: g.escrowSettled ?? false,
          moveCount: g.moves.length,
          whiteUsername: white?.username ?? "AI / Guest",
          blackUsername: black?.username ?? "AI / Guest",
          createdAt: g._creationTime,
        };
      })
    );
  },
});

