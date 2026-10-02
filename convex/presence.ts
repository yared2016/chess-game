import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requirePlayer } from "./lib/auth";

const ONLINE_THRESHOLD_MS = 60_000;

/**
 * Platform-wide heartbeat mutation.
 * Records the player's presence in the `userPresence` table.
 */
export const heartbeat = mutation({
  args: {},
  handler: async (ctx) => {
    const player = await requirePlayer(ctx);
    const now = Date.now();

    const existing = await ctx.db
      .query("userPresence")
      .withIndex("by_playerId", (q) => q.eq("playerId", player._id))
      .unique();

    if (existing !== null) {
      await ctx.db.patch(existing._id, {
        lastSeen: now,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("userPresence", {
        playerId: player._id,
        lastSeen: now,
        updatedAt: now,
      });
    }

    return null;
  },
});

/**
 * Returns online presence and last-seen timestamp for a single player.
 */
export const getPresence = query({
  args: { playerId: v.id("players") },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("userPresence")
      .withIndex("by_playerId", (q) => q.eq("playerId", args.playerId))
      .unique();

    if (!row) {
      return { isOnline: false, lastSeen: 0 };
    }

    const isOnline = Date.now() - row.lastSeen <= ONLINE_THRESHOLD_MS;
    return { isOnline, lastSeen: row.lastSeen };
  },
});

/**
 * Batch-retrieves online presence and last-seen timestamp for multiple players.
 * Returns an object mapping playerId to { isOnline, lastSeen }.
 */
export const getBatchPresence = query({
  args: { playerIds: v.array(v.id("players")) },
  handler: async (ctx, args) => {
    const now = Date.now();
    const rows = await Promise.all(
      args.playerIds.map(async (playerId) => {
        const row = await ctx.db
          .query("userPresence")
          .withIndex("by_playerId", (q) => q.eq("playerId", playerId))
          .unique();
        return { playerId, row };
      }),
    );

    const result: Record<string, { isOnline: boolean; lastSeen: number }> = {};
    for (const { playerId, row } of rows) {
      if (!row) {
        result[playerId] = { isOnline: false, lastSeen: 0 };
      } else {
        result[playerId] = {
          isOnline: now - row.lastSeen <= ONLINE_THRESHOLD_MS,
          lastSeen: row.lastSeen,
        };
      }
    }

    return result;
  },
});
