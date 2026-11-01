// convex/financial/games.ts
// Canonical Game Financial Engine, Match Escrow, and Commission Rake (Abay Chess v4.2.7-PROD Phase 6)

import { v } from "convex/values";
import { mutation, query, internalMutation } from "../_generated/server";
import { requirePlayer } from "../lib/auth";
import { postJournalTransaction } from "./ledger";
import { calculateSolvencyMetrics } from "./solvency";
import type { Id } from "../_generated/dataModel";

/**
 * TSK-601: Atomic match escrow lock mutation.
 * Locks stake amount S by debiting Account 2010 (Available) and crediting Account 2020 (Match Escrow).
 * Verifies availableSantims >= stakeSantims (RB-09).
 * Idempotent per player and match (RB-03).
 */
export const lockMatchStakeCanonical = mutation({
  args: {
    gameId: v.id("games"),
    stakeSantims: v.int64(),
  },
  handler: async (ctx, args) => {
    const player = await requirePlayer(ctx);
    const now = Date.now();

    if (args.stakeSantims <= BigInt(0)) {
      throw new Error("invalid-stake");
    }

    // OD-10: Emergency Circuit-Breaker Stakes Limit (Option A: 50.00 ETB / 5,000 santims max stake during Caution Mode)
    if (args.stakeSantims > BigInt(5000)) {
      const solvency = await calculateSolvencyMetrics(ctx);
      if (solvency.status === "warning") {
        throw new Error(
          `ERR_CAUTION_MODE_STAKE_LIMIT: Platform is in Caution Mode (solvency < 105%). Match stakes are capped at 50.00 ETB (5,000 santims) per OD-10 Option A.`
        );
      }
    }

    const game = await ctx.db.get(args.gameId);
    if (!game) {
      throw new Error("game-not-found");
    }

    // Verify player is a participant
    if (game.whiteId !== player._id && game.blackId !== player._id) {
      throw new Error("not-a-participant");
    }

    // Check player balance (RB-09 Stake Escrow Under-Lock Prevention)
    const balanceRecord = await ctx.db
      .query("playerBalances")
      .withIndex("by_playerId", (q) => q.eq("playerId", player._id))
      .unique();

    const availableSantims = balanceRecord?.availableSantims ?? BigInt(0);

    if (availableSantims < args.stakeSantims) {
      throw new Error(
        `insufficient-available-funds: Available balance (${availableSantims} santims) is less than required stake (${args.stakeSantims} santims).`
      );
    }

    const idempotencyKey = `match_lock_${player._id}_${args.gameId}`;

    // Post GL double-entry transaction:
    // Debit 2010 (Player Deposits) -> Available decreases by S
    // Credit 2020 (Active Match Escrow) -> Reserved increases by S
    const journalResult = await postJournalTransaction(ctx, {
      idempotencyKey,
      transactionType: "match_escrow_lock",
      referenceType: "game",
      referenceId: String(args.gameId),
      description: `Match stake escrow lock for game ${args.gameId}`,
      postings: [
        {
          accountNumber: "2010",
          direction: "debit",
          amountSantims: args.stakeSantims,
          playerId: player._id,
        },
        {
          accountNumber: "2020",
          direction: "credit",
          amountSantims: args.stakeSantims,
          playerId: player._id,
        },
      ],
      postedBy: `player:${player._id}`,
      now,
    });

    // Update game record escrow state
    const currentEscrowTotal = game.escrowTotalSantims ?? BigInt(0);
    const newEscrowTotal = currentEscrowTotal + args.stakeSantims;

    await ctx.db.patch(game._id, {
      stakeSantims: args.stakeSantims,
      escrowTotalSantims: newEscrowTotal,
      escrowTransactionId: journalResult.txId,
    });

    // Dual-write legacy wallet state if present for UI backward compatibility
    const wallet = await ctx.db
      .query("wallets")
      .withIndex("by_userId", (q) => q.eq("userId", player._id))
      .unique();
    if (wallet) {
      const wAvail = BigInt(wallet.availableSantims ?? Math.round(wallet.availableBalance * 100));
      const wLocked = BigInt(wallet.lockedSantims ?? Math.round(wallet.lockedBalance * 100));
      const newWAvail = wAvail >= args.stakeSantims ? wAvail - args.stakeSantims : BigInt(0);
      const newWLocked = wLocked + args.stakeSantims;
      await ctx.db.patch(wallet._id, {
        availableSantims: Number(newWAvail),
        availableBalance: Number(newWAvail) / 100,
        lockedSantims: Number(newWLocked),
        lockedBalance: Number(newWLocked) / 100,
        updatedAt: now,
      });
    }

    return {
      success: true,
      txId: journalResult.txId,
      escrowTotalSantims: newEscrowTotal,
    };
  },
});

/**
 * TSK-602: Normal win settlement with 10% commission rake (Account 4010).
 * Total pot = 2 * stakeSantims.
 * Commission = 10% of pot = floor(0.10 * 2S) santims (Account 4010).
 * Winner payout = totalPot - commission = 90% of pot (Account 2010).
 * Journal:
 *   Debit 2020 (Winner stake): S
 *   Debit 2020 (Loser stake): S
 *   Credit 2010 (Winner payout): 2S - Commission
 *   Credit 4010 (Platform commission): Commission
 * Debits (2S) === Credits (2S).
 * Concurrency guard: escrowSettled check prevents double settlement (RB-08).
 */
export const settleMatchWinCanonical = mutation({
  args: {
    gameId: v.id("games"),
    winnerId: v.id("players"),
    loserId: v.id("players"),
    stakeSantims: v.int64(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const game = await ctx.db.get(args.gameId);
    if (!game) {
      throw new Error("game-not-found");
    }

    // RB-08 Double-Spend Rapid Result Claims Guard
    if (game.escrowSettled) {
      return {
        success: true,
        alreadySettled: true,
        message: "Match escrow has already been settled.",
      };
    }

    if (args.stakeSantims <= BigInt(0)) {
      throw new Error("invalid-stake");
    }

    const totalPotSantims = args.stakeSantims * BigInt(2);
    // 10% platform commission rake (RB-05)
    const commissionSantims = (totalPotSantims * BigInt(10)) / BigInt(100);
    const payoutSantims = totalPotSantims - commissionSantims;

    const idempotencyKey = `match_win_${args.gameId}`;

    // Post double-entry settlement
    const journalResult = await postJournalTransaction(ctx, {
      idempotencyKey,
      transactionType: "match_win_payout",
      referenceType: "game",
      referenceId: String(args.gameId),
      description: `Normal win settlement (10% rake) for game ${args.gameId}`,
      postings: [
        // Clear winner's reserved stake from Account 2020
        {
          accountNumber: "2020",
          direction: "debit",
          amountSantims: args.stakeSantims,
          playerId: args.winnerId,
        },
        // Clear loser's reserved stake from Account 2020
        {
          accountNumber: "2020",
          direction: "debit",
          amountSantims: args.stakeSantims,
          playerId: args.loserId,
        },
        // Credit winner's available balance with 90% of pot
        {
          accountNumber: "2010",
          direction: "credit",
          amountSantims: payoutSantims,
          playerId: args.winnerId,
        },
        // Credit platform commission revenue (Account 4010) with 10% rake
        {
          accountNumber: "4010",
          direction: "credit",
          amountSantims: commissionSantims,
        },
      ],
      postedBy: "system:settle_match_win",
      now,
    });

    // Mark game as settled
    await ctx.db.patch(game._id, {
      escrowSettled: true,
      payoutSantims,
      commissionSantims,
      escrowTotalSantims: totalPotSantims,
      settlementTransactionId: journalResult.txId,
      endedAt: now,
    });

    // Dual-write legacy wallets if present
    const winnerWallet = await ctx.db
      .query("wallets")
      .withIndex("by_userId", (q) => q.eq("userId", args.winnerId))
      .unique();
    if (winnerWallet) {
      const avail = BigInt(winnerWallet.availableSantims ?? Math.round(winnerWallet.availableBalance * 100));
      const locked = BigInt(winnerWallet.lockedSantims ?? Math.round(winnerWallet.lockedBalance * 100));
      const newLocked = locked >= args.stakeSantims ? locked - args.stakeSantims : BigInt(0);
      const newAvail = avail + payoutSantims;
      await ctx.db.patch(winnerWallet._id, {
        availableSantims: Number(newAvail),
        availableBalance: Number(newAvail) / 100,
        lockedSantims: Number(newLocked),
        lockedBalance: Number(newLocked) / 100,
        totalWon: (winnerWallet.totalWon ?? 0) + Number(payoutSantims) / 100,
        updatedAt: now,
      });
    }

    const loserWallet = await ctx.db
      .query("wallets")
      .withIndex("by_userId", (q) => q.eq("userId", args.loserId))
      .unique();
    if (loserWallet) {
      const locked = BigInt(loserWallet.lockedSantims ?? Math.round(loserWallet.lockedBalance * 100));
      const newLocked = locked >= args.stakeSantims ? locked - args.stakeSantims : BigInt(0);
      await ctx.db.patch(loserWallet._id, {
        lockedSantims: Number(newLocked),
        lockedBalance: Number(newLocked) / 100,
        totalLost: (loserWallet.totalLost ?? 0) + Number(args.stakeSantims) / 100,
        updatedAt: now,
      });
    }

    return {
      success: true,
      txId: journalResult.txId,
      totalPotSantims,
      payoutSantims,
      commissionSantims,
    };
  },
});

/**
 * TSK-603: Organic draw settlement (100% full refund to both players, 0% rake).
 * Covers: Stalemate, 50-move rule, three-fold repetition, insufficient material (RB-06, RB-44).
 * Journal:
 *   Debit 2020 (White stake): S
 *   Debit 2020 (Black stake): S
 *   Credit 2010 (White refund): S
 *   Credit 2010 (Black refund): S
 * Debits (2S) === Credits (2S). Commission = 0.
 */
export const settleMatchOrganicDrawCanonical = mutation({
  args: {
    gameId: v.id("games"),
    whiteId: v.id("players"),
    blackId: v.id("players"),
    stakeSantims: v.int64(),
    drawReason: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const game = await ctx.db.get(args.gameId);
    if (!game) {
      throw new Error("game-not-found");
    }

    // RB-08 Double-Spend Guard
    if (game.escrowSettled) {
      return {
        success: true,
        alreadySettled: true,
        message: "Match escrow has already been settled.",
      };
    }

    if (args.stakeSantims <= BigInt(0)) {
      throw new Error("invalid-stake");
    }

    const totalPotSantims = args.stakeSantims * BigInt(2);
    const idempotencyKey = `match_draw_${args.gameId}`;

    // Post double-entry 100% refund (0% rake)
    const journalResult = await postJournalTransaction(ctx, {
      idempotencyKey,
      transactionType: "match_draw_refund",
      referenceType: "game",
      referenceId: String(args.gameId),
      description: `Organic draw 100% full refund (0% rake) for game ${args.gameId}: ${args.drawReason}`,
      postings: [
        // Clear White's reserved stake from 2020
        {
          accountNumber: "2020",
          direction: "debit",
          amountSantims: args.stakeSantims,
          playerId: args.whiteId,
        },
        // Clear Black's reserved stake from 2020
        {
          accountNumber: "2020",
          direction: "debit",
          amountSantims: args.stakeSantims,
          playerId: args.blackId,
        },
        // Refund White's available balance (Account 2010)
        {
          accountNumber: "2010",
          direction: "credit",
          amountSantims: args.stakeSantims,
          playerId: args.whiteId,
        },
        // Refund Black's available balance (Account 2010)
        {
          accountNumber: "2010",
          direction: "credit",
          amountSantims: args.stakeSantims,
          playerId: args.blackId,
        },
      ],
      postedBy: "system:settle_organic_draw",
      now,
    });

    // Mark game settled with 0 commission
    await ctx.db.patch(game._id, {
      escrowSettled: true,
      commissionSantims: BigInt(0),
      escrowTotalSantims: totalPotSantims,
      settlementTransactionId: journalResult.txId,
      endedAt: now,
    });

    // Dual-write legacy wallets if present
    for (const pId of [args.whiteId, args.blackId]) {
      const pWallet = await ctx.db
        .query("wallets")
        .withIndex("by_userId", (q) => q.eq("userId", pId))
        .unique();
      if (pWallet) {
        const avail = BigInt(pWallet.availableSantims ?? Math.round(pWallet.availableBalance * 100));
        const locked = BigInt(pWallet.lockedSantims ?? Math.round(pWallet.lockedBalance * 100));
        const newLocked = locked >= args.stakeSantims ? locked - args.stakeSantims : BigInt(0);
        const newAvail = avail + args.stakeSantims;
        await ctx.db.patch(pWallet._id, {
          availableSantims: Number(newAvail),
          availableBalance: Number(newAvail) / 100,
          lockedSantims: Number(newLocked),
          lockedBalance: Number(newLocked) / 100,
          updatedAt: now,
        });
      }
    }

    return {
      success: true,
      txId: journalResult.txId,
      refundPerPlayerSantims: args.stakeSantims,
      commissionSantims: BigInt(0),
    };
  },
});

/**
 * TSK-604: Mutual accepted draw policy (GUARDRAIL OD-09).
 * Unratified Owner Decision OD-09: Mutual draw commission proposals (5% or 2.5%) are BLOCKED.
 * Until Owner ratification, mutual accepted draws fall back to 100% full refund with 0% rake (RB-07).
 * Any attempt to deduct commission on a mutual draw throws ERR_MUTUAL_DRAW_RAKE_BLOCKED.
 */
export const settleMatchMutualDrawCanonical = mutation({
  args: {
    gameId: v.id("games"),
    whiteId: v.id("players"),
    blackId: v.id("players"),
    stakeSantims: v.int64(),
    requestedAlternative: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // GUARDRAIL OD-09: Rake deduction on mutual draw is strictly blocked
    if (
      args.requestedAlternative &&
      args.requestedAlternative !== "100_percent_refund" &&
      args.requestedAlternative !== "fallback_full_refund"
    ) {
      throw new Error(
        `ERR_MUTUAL_DRAW_RAKE_BLOCKED: Mutual accepted draw rake is blocked under Guardrail OD-09 pending Owner ratification. Fallback to 100% refund applied.`
      );
    }

    // Execute approved fallback: 100% refund to both players (0% rake)
    const game = await ctx.db.get(args.gameId);
    if (!game) {
      throw new Error("game-not-found");
    }

    if (game.escrowSettled) {
      return {
        success: true,
        alreadySettled: true,
        message: "Match escrow has already been settled.",
      };
    }

    const now = Date.now();
    const totalPotSantims = args.stakeSantims * BigInt(2);
    const idempotencyKey = `match_draw_mutual_${args.gameId}`;

    const journalResult = await postJournalTransaction(ctx, {
      idempotencyKey,
      transactionType: "match_draw_refund",
      referenceType: "game",
      referenceId: String(args.gameId),
      description: `Mutual accepted draw fallback 100% refund (OD-09 Guardrail, 0% rake) for game ${args.gameId}`,
      postings: [
        {
          accountNumber: "2020",
          direction: "debit",
          amountSantims: args.stakeSantims,
          playerId: args.whiteId,
        },
        {
          accountNumber: "2020",
          direction: "debit",
          amountSantims: args.stakeSantims,
          playerId: args.blackId,
        },
        {
          accountNumber: "2010",
          direction: "credit",
          amountSantims: args.stakeSantims,
          playerId: args.whiteId,
        },
        {
          accountNumber: "2010",
          direction: "credit",
          amountSantims: args.stakeSantims,
          playerId: args.blackId,
        },
      ],
      postedBy: "system:settle_mutual_draw_od09",
      now,
    });

    await ctx.db.patch(game._id, {
      escrowSettled: true,
      commissionSantims: BigInt(0),
      escrowTotalSantims: totalPotSantims,
      settlementTransactionId: journalResult.txId,
      endedAt: now,
    });

    // Dual-write legacy wallets if present
    for (const pId of [args.whiteId, args.blackId]) {
      const pWallet = await ctx.db
        .query("wallets")
        .withIndex("by_userId", (q) => q.eq("userId", pId))
        .unique();
      if (pWallet) {
        const avail = BigInt(pWallet.availableSantims ?? Math.round(pWallet.availableBalance * 100));
        const locked = BigInt(pWallet.lockedSantims ?? Math.round(pWallet.lockedBalance * 100));
        const newLocked = locked >= args.stakeSantims ? locked - args.stakeSantims : BigInt(0);
        const newAvail = avail + args.stakeSantims;
        await ctx.db.patch(pWallet._id, {
          availableSantims: Number(newAvail),
          availableBalance: Number(newAvail) / 100,
          lockedSantims: Number(newLocked),
          lockedBalance: Number(newLocked) / 100,
          updatedAt: now,
        });
      }
    }

    return {
      success: true,
      txId: journalResult.txId,
      refundPerPlayerSantims: args.stakeSantims,
      commissionSantims: BigInt(0),
      guardrailNotice: "OD-09_MUTUAL_DRAW_RAKE_BLOCKED_FALLBACK_APPLIED",
    };
  },
});

/**
 * Refund locked match stake before match commences (e.g. queue leave, challenge decline).
 * Unwinds reservation: Debit 2020, Credit 2010.
 */
export const refundMatchStakeBeforeStartCanonical = mutation({
  args: {
    gameId: v.id("games"),
    playerId: v.id("players"),
    stakeSantims: v.int64(),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const idempotencyKey = `match_prestart_refund_${args.playerId}_${args.gameId}`;

    const journalResult = await postJournalTransaction(ctx, {
      idempotencyKey,
      transactionType: "match_draw_refund",
      referenceType: "game",
      referenceId: String(args.gameId),
      description: `Pre-start match escrow refund: ${args.reason}`,
      postings: [
        {
          accountNumber: "2020",
          direction: "debit",
          amountSantims: args.stakeSantims,
          playerId: args.playerId,
        },
        {
          accountNumber: "2010",
          direction: "credit",
          amountSantims: args.stakeSantims,
          playerId: args.playerId,
        },
      ],
      postedBy: "system:refund_prestart",
      now,
    });

    return {
      success: true,
      txId: journalResult.txId,
      refundedSantims: args.stakeSantims,
    };
  },
});
