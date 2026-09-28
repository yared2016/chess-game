// convex/fairPlay.ts
// Castle Fair Play & Anti-Cheat Engine (CFP-AC)
// Statistical engine correlation and behavioral telemetry inspired by Ken Regan's IPR and Chess.com Fair Play.

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAdmin, requirePlayer, optionalPlayer } from "./lib/auth";

export interface SuspicionMetrics {
  tabBlurCount: number;
  blursPerMove: number;
  moveTimeVariance: number;
  totalMoves: number;
  acpl?: number; // Average Centipawn Loss
  top1MatchRate?: number; // %
  playerRating: number;
}

/**
 * Calculates statistical suspicion score (0 - 100) based on:
 * 1. Window defocus cadence during player turns (copying to external engine)
 * 2. Unnatural timing uniformity (lacking human blitz/think variance)
 * 3. Engine move correlation (ACPL vs expected player Elo)
 */
export function computeSuspicionScore(metrics: SuspicionMetrics): {
  score: number;
  isFlagged: boolean;
  reasons: string[];
} {
  let score = 0;
  const reasons: string[] = [];

  // 1. Tab / Window Defocus Telemetry
  if (metrics.tabBlurCount >= 4 && metrics.blursPerMove >= 0.4) {
    score += 45;
    reasons.push("Excessive window defocus during turns (likely external engine consultation)");
  } else if (metrics.tabBlurCount >= 3 && metrics.blursPerMove >= 0.2) {
    score += 25;
    reasons.push("Frequent tab switching during move turns");
  }

  // 2. Move Cadence & Timing Uniformity (Biometric Timing)
  // Human players exhibit high variance (>1800ms). Engine cheaters take mechanically uniform ~3-5s.
  if (metrics.totalMoves >= 12) {
    if (metrics.moveTimeVariance < 750) {
      score += 30;
      reasons.push("Unnatural uniform move timing without human tactical variance");
    } else if (metrics.moveTimeVariance < 1200) {
      score += 15;
      reasons.push("Low move time variance");
    }
  }

  // 3. Engine Move Correlation (ACPL & Top-1 Match Rate vs Player Rating)
  if (metrics.acpl !== undefined) {
    // Under 15 ACPL is Super-GM level (2700+)
    if (metrics.acpl <= 15 && metrics.playerRating < 1800) {
      score += 40;
      reasons.push(`Super-GM centipawn precision (ACPL ${metrics.acpl}) improbable for ${metrics.playerRating} Elo`);
    } else if (metrics.acpl <= 25 && metrics.playerRating < 1500) {
      score += 25;
      reasons.push(`Master-tier accuracy (ACPL ${metrics.acpl}) for amateur rating`);
    }
  }

  if (metrics.top1MatchRate !== undefined && metrics.totalMoves >= 15) {
    if (metrics.top1MatchRate >= 90 && metrics.playerRating < 1800) {
      score += 30;
      reasons.push(`90%+ top-engine choice match rate over ${metrics.totalMoves} moves`);
    } else if (metrics.top1MatchRate >= 80 && metrics.playerRating < 1500) {
      score += 20;
      reasons.push(`80%+ engine match rate`);
    }
  }

  const finalScore = Math.min(100, Math.max(0, Math.round(score)));
  const isFlagged = finalScore >= 70;

  return {
    score: finalScore,
    isFlagged,
    reasons,
  };
}

export const recordGameTelemetry = mutation({
  args: {
    gameId: v.id("games"),
    tabBlurCount: v.number(),
    blursPerMove: v.number(),
    avgMoveTimeMs: v.number(),
    moveTimeVariance: v.number(),
    totalMoves: v.number(),
    acpl: v.optional(v.number()),
    top1MatchRate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const player = await requirePlayer(ctx);
    const game = await ctx.db.get("games", args.gameId);
    if (!game) throw new Error("game-not-found");

    const evaluation = computeSuspicionScore({
      tabBlurCount: args.tabBlurCount,
      blursPerMove: args.blursPerMove,
      moveTimeVariance: args.moveTimeVariance,
      totalMoves: args.totalMoves,
      acpl: args.acpl,
      top1MatchRate: args.top1MatchRate,
      playerRating: player.rating,
    });

    const now = Date.now();
    await ctx.db.insert("fairPlayTelemetry", {
      gameId: args.gameId,
      playerId: player._id,
      playerUsername: player.username,
      tabBlurCount: args.tabBlurCount,
      blursPerMove: Math.round(args.blursPerMove * 100) / 100,
      avgMoveTimeMs: Math.round(args.avgMoveTimeMs),
      moveTimeVariance: Math.round(args.moveTimeVariance),
      top1MatchRate: args.top1MatchRate,
      acpl: args.acpl,
      suspicionScore: evaluation.score,
      isFlagged: evaluation.isFlagged,
      flagReason: evaluation.reasons.join("; ") || undefined,
      createdAt: now,
    });

    if (evaluation.isFlagged) {
      await ctx.db.patch(player._id, {
        fairPlayFlags: (player.fairPlayFlags ?? 0) + 1,
        updatedAt: now,
      });

      // Auto-create pending review report for admin
      await ctx.db.insert("fairPlayReports", {
        gameId: args.gameId,
        reporterId: player._id,
        reporterUsername: "SYSTEM (CFP-AC)",
        reportedPlayerId: player._id,
        reportedUsername: player.username,
        reason: "engine_assistance",
        notes: `Automated Fair Play Flag: Score ${evaluation.score}/100. ${evaluation.reasons.join(". ")}`,
        status: "pending",
        createdAt: now,
      });
    }

    return { suspicionScore: evaluation.score, isFlagged: evaluation.isFlagged };
  },
});

export const reportPlayer = mutation({
  args: {
    gameId: v.id("games"),
    reportedPlayerId: v.id("players"),
    reason: v.union(
      v.literal("engine_assistance"),
      v.literal("suspicious_timing"),
      v.literal("stalling"),
      v.literal("other")
    ),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const reporter = await requirePlayer(ctx);
    if (reporter._id === args.reportedPlayerId) {
      throw new Error("cannot-report-self");
    }

    const reportedPlayer = await ctx.db.get("players", args.reportedPlayerId);
    if (!reportedPlayer) throw new Error("player-not-found");

    // Check duplicate reports
    const existing = await ctx.db
      .query("fairPlayReports")
      .withIndex("by_gameId_and_reporterId", (q) =>
        q.eq("gameId", args.gameId).eq("reporterId", reporter._id)
      )
      .first();

    if (existing) {
      throw new Error("report-already-submitted");
    }

    const now = Date.now();
    await ctx.db.insert("fairPlayReports", {
      gameId: args.gameId,
      reporterId: reporter._id,
      reporterUsername: reporter.username,
      reportedPlayerId: reportedPlayer._id,
      reportedUsername: reportedPlayer.username,
      reason: args.reason,
      notes: args.notes,
      status: "pending",
      createdAt: now,
    });

    return { success: true };
  },
});

export const getMyFairPlayStatus = query({
  args: {},
  handler: async (ctx) => {
    const player = await optionalPlayer(ctx);
    if (!player) return { isBanned: false, warning: null };
    return {
      isBanned: Boolean(player.isFairPlayBanned),
      warning: player.fairPlayWarning ?? null,
    };
  },
});

export const listFlaggedGames = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const limit = args.limit ?? 50;
    return await ctx.db
      .query("fairPlayTelemetry")
      .withIndex("by_isFlagged", (q) => q.eq("isFlagged", true))
      .order("desc")
      .take(limit);
  },
});

export const listReports = query({
  args: { status: v.optional(v.string()), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const limit = args.limit ?? 50;
    let reports = await ctx.db.query("fairPlayReports").order("desc").take(limit);
    if (args.status && args.status !== "all") {
      reports = reports.filter((r) => r.status === args.status);
    }
    return reports;
  },
});

export const getFairPlayStats = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const flagged = await ctx.db
      .query("fairPlayTelemetry")
      .withIndex("by_isFlagged", (q) => q.eq("isFlagged", true))
      .collect();

    const reports = await ctx.db.query("fairPlayReports").collect();
    const pendingReports = reports.filter((r) => r.status === "pending").length;

    const players = await ctx.db.query("players").collect();
    const bannedPlayers = players.filter((p) => p.isFairPlayBanned).length;
    const warnedPlayers = players.filter((p) => p.fairPlayWarning).length;

    return {
      totalFlaggedGames: flagged.length,
      pendingReports,
      bannedPlayers,
      warnedPlayers,
    };
  },
});

export const takeFairPlayAction = mutation({
  args: {
    action: v.union(v.literal("ban"), v.literal("warn"), v.literal("dismiss"), v.literal("refund")),
    targetPlayerId: v.id("players"),
    reportId: v.optional(v.id("fairPlayReports")),
    gameId: v.optional(v.id("games")),
    adminNotes: v.optional(v.string()),
    warningMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const targetPlayer = await ctx.db.get("players", args.targetPlayerId);
    if (!targetPlayer) throw new Error("player-not-found");

    const now = Date.now();

    if (args.action === "ban") {
      await ctx.db.patch(targetPlayer._id, {
        isFairPlayBanned: true,
        updatedAt: now,
      });

      // Freeze wallet if player has one
      const wallet = await ctx.db
        .query("wallets")
        .withIndex("by_userId", (q) => q.eq("userId", targetPlayer._id))
        .first();
      if (wallet) {
        await ctx.db.patch(wallet._id, {
          status: "frozen",
          freezeReason: "Account suspended for Fair Play violation",
          updatedAt: now,
        });
      }

      // Notify player
      await ctx.db.insert("notifications", {
        userId: targetPlayer._id,
        title: "Account Suspended — Fair Play Violation",
        message: "Your account has been restricted from multiplayer play due to automated engine assistance detection.",
        type: "system",
        read: false,
        createdAt: now,
      });
    } else if (args.action === "warn") {
      const msg = args.warningMessage || "Our Fair Play system detected unusual external window focus patterns during your games. Please play fairly without external assistance.";
      await ctx.db.patch(targetPlayer._id, {
        fairPlayWarning: msg,
        updatedAt: now,
      });

      await ctx.db.insert("notifications", {
        userId: targetPlayer._id,
        title: "Fair Play Warning",
        message: msg,
        type: "system",
        read: false,
        createdAt: now,
      });
    } else if (args.action === "refund" && args.gameId) {
      const game = await ctx.db.get("games", args.gameId);
      if (game && game.stake && game.stake > 0) {
        // Find opponent to refund
        const victimId = game.whiteId === targetPlayer._id ? game.blackId : game.whiteId;
        if (victimId) {
          const victimWallet = await ctx.db
            .query("wallets")
            .withIndex("by_userId", (q) => q.eq("userId", victimId))
            .first();
          if (victimWallet) {
            const stakeInSantims = game.stake * 100;
            await ctx.db.patch(victimWallet._id, {
              availableBalance: victimWallet.availableBalance + stakeInSantims,
              updatedAt: now,
            });

            await ctx.db.insert("notifications", {
              userId: victimId,
              title: "Stake Refunded — Fair Play Resolution",
              message: `Your stake of ${game.stake} ETB has been refunded following a Fair Play review of game ${game._id}.`,
              type: "system",
              read: false,
              createdAt: now,
            });
          }
        }
      }
    }

    if (args.reportId) {
      const report = await ctx.db.get("fairPlayReports", args.reportId);
      if (report) {
        await ctx.db.patch(report._id, {
          status: args.action === "ban" ? "banned" : args.action === "warn" ? "warned" : "reviewed_clean",
          adminNotes: args.adminNotes,
          resolvedAt: now,
        });
      }
    }

    return { success: true, action: args.action };
  },
});
