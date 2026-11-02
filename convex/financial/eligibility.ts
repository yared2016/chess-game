// convex/financial/eligibility.ts
// Withdrawal Eligibility & First-Time Player Verification Engine (Abay Chess v4.2.7-PROD)

import { v } from "convex/values";
import { query, QueryCtx, MutationCtx } from "../_generated/server";
import { requirePlayer, AnyCtx } from "../lib/auth";
import { Id } from "../_generated/dataModel";

export interface WithdrawalEligibilityResult {
  isEligible: boolean;
  isFirstWithdrawal: boolean;
  completedMatchesCount: number;
  requiredMatchesCount: number;
  progressLabel: string;
  reason?: string;
}

/**
 * Checks if a player has met the requirements for initiating a withdrawal.
 * Policy B (First Successful Withdrawal Eligibility):
 * - If the player has previously completed a successful withdrawal, requirement is permanently fulfilled.
 * - If this is the player's first withdrawal, they must have completed at least 3 legitimate chess matches
 *   (server-verified, non-abandoned, non-aborted, >= 2 moves played).
 */
export async function checkWithdrawalEligibility(
  ctx: AnyCtx,
  playerId: Id<"players">
): Promise<WithdrawalEligibilityResult> {
  // 1. Check if player has any prior completed/settled withdrawal
  const settledV4Withdrawal = await ctx.db
    .query("withdrawalRequests")
    .withIndex("by_playerId", (q) => q.eq("playerId", playerId))
    .filter((q) => q.eq(q.field("status"), "settled"))
    .first();

  if (settledV4Withdrawal) {
    return {
      isEligible: true,
      isFirstWithdrawal: false,
      completedMatchesCount: 3,
      requiredMatchesCount: 3,
      progressLabel: "Eligible (Recurring Player)",
    };
  }

  const legacyCompletedWithdrawal = await ctx.db
    .query("financialWithdrawals")
    .withIndex("by_userId_and_status", (q) =>
      q.eq("userId", playerId).eq("status", "completed")
    )
    .first();

  if (legacyCompletedWithdrawal) {
    return {
      isEligible: true,
      isFirstWithdrawal: false,
      completedMatchesCount: 3,
      requiredMatchesCount: 3,
      progressLabel: "Eligible (Recurring Player)",
    };
  }

  // 2. First withdrawal verification: Query legitimate completed games
  // Legitimate completed statuses: "checkmate", "stalemate", "draw", "resigned"
  const legitimateStatuses = new Set(["checkmate", "stalemate", "draw", "resigned"]);
  const completedGameIds = new Set<string>();

  // Fetch games where player was White
  for (const status of legitimateStatuses) {
    const whiteGames = await ctx.db
      .query("games")
      .withIndex("by_whiteId_and_status", (q) =>
        q.eq("whiteId", playerId).eq("status", status as any)
      )
      .collect();

    for (const g of whiteGames) {
      if (g.whiteId && g.blackId && Array.isArray(g.moves) && g.moves.length >= 2) {
        completedGameIds.add(g._id);
      }
    }
  }

  // Fetch games where player was Black
  for (const status of legitimateStatuses) {
    const blackGames = await ctx.db
      .query("games")
      .withIndex("by_blackId_and_status", (q) =>
        q.eq("blackId", playerId).eq("status", status as any)
      )
      .collect();

    for (const g of blackGames) {
      if (g.whiteId && g.blackId && Array.isArray(g.moves) && g.moves.length >= 2) {
        completedGameIds.add(g._id);
      }
    }
  }

  const completedMatchesCount = completedGameIds.size;
  const isEligible = completedMatchesCount >= 3;
  const progressLabel = isEligible
    ? "Eligible (3/3 completed matches)"
    : `${completedMatchesCount}/3 completed matches`;

  return {
    isEligible,
    isFirstWithdrawal: true,
    completedMatchesCount,
    requiredMatchesCount: 3,
    progressLabel,
    reason: isEligible
      ? undefined
      : `First withdrawal requires at least 3 completed chess matches. Current progress: ${completedMatchesCount}/3 matches.`,
  };
}

/**
 * Public query for player to inspect their withdrawal eligibility and match progress.
 */
export const getMyWithdrawalEligibility = query({
  args: {},
  handler: async (ctx) => {
    const player = await requirePlayer(ctx);
    return await checkWithdrawalEligibility(ctx, player._id);
  },
});
