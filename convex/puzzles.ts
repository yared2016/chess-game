// convex/puzzles.ts
// Queries and mutations for tactical puzzles, daily puzzle, and puzzle Elo/streaks.

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { optionalPlayer, requirePlayer } from "./lib/auth";
import { START_RATING, applyDelta } from "./lib/elo";
import { TACTICAL_PUZZLES_DATA, type TacticalPuzzleDef } from "./puzzlesData";

const K_PUZZLE = 24;

export function puzzleRatingDelta(
  playerRating: number,
  puzzleRating: number,
  solved: boolean,
): number {
  const expected = 1 / (1 + Math.pow(10, (puzzleRating - playerRating) / 400));
  const score = solved ? 1 : 0;
  return Math.round(K_PUZZLE * (score - expected));
}

/**
 * Returns list of tactical puzzles with optional filters.
 */
export const listPuzzles = query({
  args: {
    theme: v.optional(v.string()),
    difficulty: v.optional(v.string()), // "beginner" | "intermediate" | "advanced" | "master"
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Check if puzzles are in DB, otherwise use static data
    let dbPuzzles = await ctx.db.query("puzzles").collect();
    if (dbPuzzles.length === 0) {
      dbPuzzles = TACTICAL_PUZZLES_DATA as any;
    }

    let results = dbPuzzles;

    if (args.theme && args.theme !== "all") {
      results = results.filter((p) => p.themes.includes(args.theme!));
    }

    if (args.difficulty) {
      if (args.difficulty === "beginner") {
        results = results.filter((p) => p.rating < 1100);
      } else if (args.difficulty === "intermediate") {
        results = results.filter((p) => p.rating >= 1100 && p.rating < 1400);
      } else if (args.difficulty === "advanced") {
        results = results.filter((p) => p.rating >= 1400 && p.rating < 1800);
      } else if (args.difficulty === "master") {
        results = results.filter((p) => p.rating >= 1800);
      }
    }

    const limit = args.limit ?? 50;
    return results.slice(0, limit);
  },
});

/**
 * Get a specific puzzle by ID.
 */
export const getPuzzleById = query({
  args: { puzzleId: v.string() },
  handler: async (ctx, args) => {
    const puzzle = await ctx.db
      .query("puzzles")
      .withIndex("by_puzzleId", (q) => q.eq("puzzleId", args.puzzleId))
      .first();

    if (puzzle) return puzzle;

    // Fallback to static data
    const fallback = TACTICAL_PUZZLES_DATA.find((p) => p.puzzleId === args.puzzleId);
    return fallback ?? null;
  },
});

/**
 * Get the daily puzzle based on current UTC date.
 */
export const getDailyPuzzle = query({
  args: {},
  handler: async (ctx) => {
    const today = new Date().toISOString().slice(0, 10);
    let hash = 0;
    for (let i = 0; i < today.length; i++) {
      hash = (hash << 5) - hash + today.charCodeAt(i);
      hash |= 0;
    }

    const allPuzzles = await ctx.db.query("puzzles").collect();
    const pool = allPuzzles.length > 0 ? allPuzzles : (TACTICAL_PUZZLES_DATA as any);
    const index = Math.abs(hash) % pool.length;
    const daily = pool[index];

    // Check if player has solved today's puzzle
    const player = await optionalPlayer(ctx);
    let alreadySolved = false;

    if (player && daily) {
      const attempt = await ctx.db
        .query("puzzleAttempts")
        .withIndex("by_playerId_and_puzzleId", (q) =>
          q.eq("playerId", player._id).eq("puzzleId", daily.puzzleId),
        )
        .first();
      alreadySolved = Boolean(attempt?.solved);
    }

    return {
      puzzle: daily,
      date: today,
      alreadySolved,
    };
  },
});

/**
 * Get current player's puzzle stats, rating, streak, and recent attempts.
 */
export const getPlayerPuzzleStats = query({
  args: {},
  handler: async (ctx) => {
    const player = await optionalPlayer(ctx);
    if (!player) {
      return {
        rating: START_RATING,
        streak: 0,
        bestStreak: 0,
        solvedCount: 0,
        recentAttempts: [],
      };
    }

    const recentAttempts = await ctx.db
      .query("puzzleAttempts")
      .withIndex("by_playerId_and_createdAt", (q) => q.eq("playerId", player._id))
      .order("desc")
      .take(10);

    return {
      rating: player.ratingPuzzle ?? START_RATING,
      streak: player.puzzleStreak ?? 0,
      bestStreak: player.bestPuzzleStreak ?? 0,
      solvedCount: player.puzzlesSolved ?? 0,
      recentAttempts,
    };
  },
});

/**
 * Record a puzzle attempt, adjust Elo and streak.
 */
export const recordAttempt = mutation({
  args: {
    puzzleId: v.string(),
    solved: v.boolean(),
    timeTakenMs: v.number(),
  },
  handler: async (ctx, args) => {
    const player = await requirePlayer(ctx);

    // Look up puzzle
    let puzzle = await ctx.db
      .query("puzzles")
      .withIndex("by_puzzleId", (q) => q.eq("puzzleId", args.puzzleId))
      .first();

    const puzzleRating = puzzle?.rating ?? 1200;
    const currentRating = player.ratingPuzzle ?? START_RATING;

    const delta = puzzleRatingDelta(currentRating, puzzleRating, args.solved);
    const newRating = applyDelta(currentRating, delta);

    const currentStreak = player.puzzleStreak ?? 0;
    const bestStreak = player.bestPuzzleStreak ?? 0;
    const newStreak = args.solved ? currentStreak + 1 : 0;
    const newBestStreak = Math.max(bestStreak, newStreak);
    const solvedCount = (player.puzzlesSolved ?? 0) + (args.solved ? 1 : 0);

    // Update player
    await ctx.db.patch(player._id, {
      ratingPuzzle: newRating,
      puzzleStreak: newStreak,
      bestPuzzleStreak: newBestStreak,
      puzzlesSolved: solvedCount,
      updatedAt: Date.now(),
    });

    // Record attempt
    await ctx.db.insert("puzzleAttempts", {
      playerId: player._id,
      puzzleId: args.puzzleId,
      solved: args.solved,
      ratingBefore: currentRating,
      ratingAfter: newRating,
      timeTakenMs: Math.max(0, args.timeTakenMs),
      createdAt: Date.now(),
    });

    // Update puzzle counts if doc exists in DB
    if (puzzle) {
      await ctx.db.patch(puzzle._id, {
        playedCount: (puzzle.playedCount ?? 0) + 1,
        solvedCount: (puzzle.solvedCount ?? 0) + (args.solved ? 1 : 0),
      });
    }

    return {
      solved: args.solved,
      delta,
      newRating,
      streak: newStreak,
      bestStreak: newBestStreak,
      puzzlesSolved: solvedCount,
    };
  },
});

/**
 * Seed database with initial tactical puzzles if not already populated.
 */
export const seedPuzzles = mutation({
  args: {},
  handler: async (ctx) => {
    let inserted = 0;
    for (const puzzle of TACTICAL_PUZZLES_DATA) {
      const existing = await ctx.db
        .query("puzzles")
        .withIndex("by_puzzleId", (q) => q.eq("puzzleId", puzzle.puzzleId))
        .first();

      if (!existing) {
        await ctx.db.insert("puzzles", {
          ...puzzle,
          playedCount: 0,
          solvedCount: 0,
        });
        inserted++;
      }
    }
    return { inserted, total: TACTICAL_PUZZLES_DATA.length };
  },
});
