// convex/wallets.ts
import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { optionalPlayer, requirePlayer } from "./lib/auth";
import { COMMISSION_RATE, PRO_ETB_PRICE } from "./lib/constants";

export const getOrCreate = query({
  args: {},
  handler: async (ctx) => {
    const player = await optionalPlayer(ctx);
    if (!player) return null;
    return await ctx.db
      .query("wallets")
      .withIndex("by_userId", (q) => q.eq("userId", player._id))
      .first();
  },
});

export const ensureWallet = mutation({
  args: {},
  handler: async (ctx) => {
    const player = await requirePlayer(ctx);
    const existing = await ctx.db
      .query("wallets")
      .withIndex("by_userId", (q) => q.eq("userId", player._id))
      .first();

    if (existing !== null) return existing._id;

    const now = Date.now();
    return await ctx.db.insert("wallets", {
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
  },
});

export const getBalance = query({
  args: {},
  handler: async (ctx) => {
    const player = await optionalPlayer(ctx);
    if (!player) {
      return { available: 0, locked: 0, total: 0 };
    }
    const wallet = await ctx.db
      .query("wallets")
      .withIndex("by_userId", (q) => q.eq("userId", player._id))
      .first();

    if (wallet === null) {
      return { available: 0, locked: 0, total: 0 };
    }

    return {
      available: wallet.availableBalance,
      locked: wallet.lockedBalance,
      total: wallet.availableBalance + wallet.lockedBalance,
    };
  },
});

export const lockForMatch = internalMutation({
  args: {
    playerId: v.id("players"),
    amount: v.number(),
  },
  handler: async (ctx, args) => {
    const wallet = await ctx.db
      .query("wallets")
      .withIndex("by_userId", (q) => q.eq("userId", args.playerId))
      .unique();

    if (wallet === null) throw new Error("wallet-not-found");
    if (wallet.availableBalance < args.amount) throw new Error("insufficient-funds");

    await ctx.db.patch(wallet._id, {
      availableBalance: wallet.availableBalance - args.amount,
      lockedBalance: wallet.lockedBalance + args.amount,
      updatedAt: Date.now(),
    });
  },
});

export const releaseToWinner = internalMutation({
  args: {
    winnerId: v.id("players"),
    loserId: v.id("players"),
    stake: v.number(),
    gameId: v.id("games"),
  },
  handler: async (ctx, args) => {
    const winnerWallet = await ctx.db
      .query("wallets")
      .withIndex("by_userId", (q) => q.eq("userId", args.winnerId))
      .unique();
    const loserWallet = await ctx.db
      .query("wallets")
      .withIndex("by_userId", (q) => q.eq("userId", args.loserId))
      .unique();

    if (!winnerWallet || !loserWallet) throw new Error("wallet-not-found");

    const totalPool = args.stake * 2;
    const commission = totalPool * COMMISSION_RATE;
    const payout = totalPool - commission;

    await ctx.db.patch(winnerWallet._id, {
      lockedBalance: winnerWallet.lockedBalance - args.stake,
      availableBalance: winnerWallet.availableBalance + payout,
      totalWon: winnerWallet.totalWon + payout,
      updatedAt: Date.now(),
    });

    await ctx.db.patch(loserWallet._id, {
      lockedBalance: loserWallet.lockedBalance - args.stake,
      totalLost: loserWallet.totalLost + args.stake,
      updatedAt: Date.now(),
    });

    await ctx.db.insert("commissions", {
      gameId: args.gameId,
      amount: commission,
      transferred: false,
      createdAt: Date.now(),
    });

    // Credit commission directly to Admin's wallet balance
    if (commission > 0) {
      const adminClerkId = process.env.ADMIN_CLERK_ID;
      let adminPlayer = adminClerkId
        ? await ctx.db
            .query("players")
            .withIndex("by_clerkId", (q) => q.eq("clerkId", adminClerkId))
            .unique()
        : null;

      if (!adminPlayer) {
        adminPlayer = await ctx.db.query("players").order("asc").first();
      }

      if (adminPlayer) {
        let adminWallet = await ctx.db
          .query("wallets")
          .withIndex("by_userId", (q) => q.eq("userId", adminPlayer._id))
          .unique();

        if (!adminWallet) {
          await ctx.db.insert("wallets", {
            userId: adminPlayer._id,
            availableBalance: commission,
            lockedBalance: 0,
            totalDeposited: 0,
            totalWithdrawn: 0,
            totalWon: commission,
            totalLost: 0,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          });
        } else {
          await ctx.db.patch(adminWallet._id, {
            availableBalance: adminWallet.availableBalance + commission,
            totalWon: (adminWallet.totalWon ?? 0) + commission,
            updatedAt: Date.now(),
          });
        }
      }
    }
  },
});

export const refundBoth = internalMutation({
  args: {
    whiteId: v.id("players"),
    blackId: v.id("players"),
    stake: v.number(),
  },
  handler: async (ctx, args) => {
    const whiteWallet = await ctx.db
      .query("wallets")
      .withIndex("by_userId", (q) => q.eq("userId", args.whiteId))
      .unique();
    const blackWallet = await ctx.db
      .query("wallets")
      .withIndex("by_userId", (q) => q.eq("userId", args.blackId))
      .unique();

    if (whiteWallet) {
      await ctx.db.patch(whiteWallet._id, {
        lockedBalance: whiteWallet.lockedBalance - args.stake,
        availableBalance: whiteWallet.availableBalance + args.stake,
        updatedAt: Date.now(),
      });
    }

    if (blackWallet) {
      await ctx.db.patch(blackWallet._id, {
        lockedBalance: blackWallet.lockedBalance - args.stake,
        availableBalance: blackWallet.availableBalance + args.stake,
        updatedAt: Date.now(),
      });
    }
  },
});

export const buyProWithEtb = mutation({
  args: {},
  handler: async (ctx) => {
    const player = await requirePlayer(ctx);
    const wallet = await ctx.db
      .query("wallets")
      .withIndex("by_userId", (q) => q.eq("userId", player._id))
      .unique();

    if (!wallet) throw new Error("wallet-not-found");
    if (wallet.availableBalance < PRO_ETB_PRICE) {
      throw new Error(`Insufficient funds. Pro membership requires ${PRO_ETB_PRICE} ETB.`);
    }

    const now = Date.now();
    const currentProUntil = player.proUntil && player.proUntil > now ? player.proUntil : now;
    const newProUntil = currentProUntil + 30 * 24 * 60 * 60 * 1000;

    await ctx.db.patch(wallet._id, {
      availableBalance: wallet.availableBalance - PRO_ETB_PRICE,
      updatedAt: now,
    });

    await ctx.db.patch(player._id, {
      proUntil: newProUntil,
      updatedAt: now,
    });

    return { proUntil: newProUntil };
  },
});
