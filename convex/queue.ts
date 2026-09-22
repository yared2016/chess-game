// convex/queue.ts — matchmaking (FR-22…FR-26)
//
// Split writer model (convex-clerk-nextjs.md §4.8.2): `join`/`leave` are per-caller
// mutations with a NARROW read set (only that player's own rows), while `pair` is
// the ONLY function that scans the whole queue and creates games. `pair` runs from
// the scheduler and from a 5 s cron, so Convex's "at most one run of a cron job at
// any moment" plus automatic retry of scheduled mutations makes it a single writer
// whose OCC aborts never reach a user.
import { Chess } from "chess.js";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation, mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { optionalPlayer, requirePlayer } from "./lib/auth";
import { COMMISSION_RATE, DEFAULT_FEN, QUEUE_MAX_WAIT_MS, QUEUE_SCAN_LIMIT, STAKE_TIERS, queueRangeAt } from "./lib/constants";
import { findActiveGame } from "./lib/games";

/** FR-22 / FR-26. Idempotent: a second click while queued is a no-op. */
export const join = mutation({
  args: { stake: v.optional(v.number()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const player = await requirePlayer(ctx);

    const active = await findActiveGame(ctx, player._id);
    if (active !== null) throw new Error("already-in-game");

    const existing = await ctx.db
      .query("queue")
      .withIndex("by_playerId", (q) => q.eq("playerId", player._id))
      .unique();
    if (existing !== null) return null;

    if (args.stake !== undefined && args.stake > 0) {
      if (!(STAKE_TIERS as readonly number[]).includes(args.stake)) throw new Error("invalid-stake");
      const wallet = await ctx.db
        .query("wallets")
        .withIndex("by_userId", (q) => q.eq("userId", player._id))
        .unique();
      if (!wallet || wallet.availableBalance < args.stake) throw new Error("insufficient-funds");
      
      await ctx.db.patch(wallet._id, {
        availableBalance: wallet.availableBalance - args.stake,
        lockedBalance: wallet.lockedBalance + args.stake,
        updatedAt: Date.now(),
      });
    }

    await ctx.db.insert("queue", {
      playerId: player._id,
      rating: player.ratingHuman,
      joinedAt: Date.now(),
      stake: args.stake ?? undefined,
    });
    // Pair immediately when a second player is already waiting; the cron is the
    // liveness/widening safety net, not the primary path (§E.2 step 2).
    await ctx.scheduler.runAfter(0, internal.queue.pair, {});
    return null;
  },
});

/** FR-25. */
export const leave = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const player = await requirePlayer(ctx);
    const existing = await ctx.db
      .query("queue")
      .withIndex("by_playerId", (q) => q.eq("playerId", player._id))
      .unique();
    if (existing !== null) {
      if (existing.stake !== undefined && existing.stake > 0) {
        const wallet = await ctx.db
          .query("wallets")
          .withIndex("by_userId", (q) => q.eq("userId", player._id))
          .unique();
        if (wallet) {
          await ctx.db.patch(wallet._id, {
            availableBalance: wallet.availableBalance + existing.stake,
            lockedBalance: wallet.lockedBalance - existing.stake,
            updatedAt: Date.now(),
          });
        }
      }
      await ctx.db.delete("queue", existing._id);
    }
    return null;
  },
});

/**
 * No wall-clock read (Convex queries are not re-run as time passes, §I-14). The
 * client derives elapsed time and the current rating window from `joinedAt` with
 * `queueRangeAt()` from src/lib/constants.ts.
 */
export const myStatus = query({
  args: {},
  returns: v.object({
    inQueue: v.boolean(),
    joinedAt: v.union(v.number(), v.null()),
    stake: v.optional(v.union(v.number(), v.null())),
  }),
  handler: async (ctx) => {
    const player = await optionalPlayer(ctx);
    if (player === null) return { inQueue: false, joinedAt: null };
    const existing = await ctx.db
      .query("queue")
      .withIndex("by_playerId", (q) => q.eq("playerId", player._id))
      .unique();
    if (existing === null) return { inQueue: false, joinedAt: null };
    return {
      inQueue: true,
      joinedAt: existing.joinedAt,
      ...(existing.stake !== undefined ? { stake: existing.stake } : {}),
    };
  },
});

/**
 * FR-23: greedy oldest-first pairing with a rating window that widens by 100 every
 * 10 s. Both entries must accept each other, so the test is symmetric on the wider
 * of the two windows. Colours are random (FR-23) — `Math.random()` is seeded per
 * transaction by Convex, so an OCC re-run reproduces the same assignment.
 */
export const pair = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const now = Date.now();
    const waiting = await ctx.db
      .query("queue")
      .withIndex("by_joinedAt")
      .order("asc")
      .take(QUEUE_SCAN_LIMIT);

    const consumed = new Set<string>();

    // Drop rows nobody could match any more (§E.2 step 7).
    for (const entry of waiting) {
      if (now - entry.joinedAt > QUEUE_MAX_WAIT_MS) {
        if (entry.stake !== undefined && entry.stake > 0) {
          const wallet = await ctx.db
            .query("wallets")
            .withIndex("by_userId", (q) => q.eq("userId", entry.playerId))
            .unique();
          if (wallet) {
            await ctx.db.patch(wallet._id, {
              availableBalance: wallet.availableBalance + entry.stake,
              lockedBalance: wallet.lockedBalance - entry.stake,
              updatedAt: now,
            });
          }
        }
        await ctx.db.delete("queue", entry._id);
        consumed.add(entry._id);
      }
    }

    const startPgn = new Chess().pgn();

    for (let i = 0; i < waiting.length; i++) {
      const a = waiting[i];
      if (consumed.has(a._id)) continue;
      const rangeA = queueRangeAt(a.joinedAt, now);

      for (let j = i + 1; j < waiting.length; j++) {
        const b = waiting[j];
        if (consumed.has(b._id)) continue;
        if (a.playerId === b.playerId) continue;
        if ((a.stake ?? 0) !== (b.stake ?? 0)) continue;
        const rangeB = queueRangeAt(b.joinedAt, now);
        if (Math.abs(a.rating - b.rating) > Math.max(rangeA, rangeB)) continue;

        // Re-read before writing so a duplicate run of this tick is a no-op.
        const freshA = await ctx.db.get("queue", a._id);
        const freshB = await ctx.db.get("queue", b._id);
        if (freshA === null || freshB === null) continue;

        const aIsWhite = Math.random() < 0.5;
        const whiteId: Id<"players"> = aIsWhite ? a.playerId : b.playerId;
        const blackId: Id<"players"> = aIsWhite ? b.playerId : a.playerId;

        const stake = a.stake ?? 0;
        const escrowFields = stake > 0 ? {
          stake,
          escrowTotal: stake * 2,
          commission: Math.round(stake * 2 * COMMISSION_RATE),
          payout: Math.round(stake * 2 * (1 - COMMISSION_RATE)),
          escrowSettled: false,
        } : {};

        const gameId = await ctx.db.insert("games", {
          whiteId,
          blackId,
          mode: "online",
          fen: DEFAULT_FEN,
          moves: [],
          pgn: startPgn,
          turn: "w",
          status: "active",
          rated: true,
          undoCount: 0,
          hintsUsed: 0,
          spectatorCount: 0,
          createdAt: now,
          lastMoveAt: now,
          ...escrowFields,
        });

        await ctx.db.delete("queue", freshA._id);
        await ctx.db.delete("queue", freshB._id);
        consumed.add(a._id);
        consumed.add(b._id);

        // Seed presence so the 60 s abandon clock starts immediately (FR-32).
        await ctx.db.insert("presence", {
          gameId,
          playerId: whiteId,
          role: "w",
          lastSeen: now,
        });
        await ctx.db.insert("presence", {
          gameId,
          playerId: blackId,
          role: "b",
          lastSeen: now,
        });
        break;
      }
    }
    return null;
  },
});

