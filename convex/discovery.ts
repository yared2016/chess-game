// convex/discovery.ts — Player discovery and recommendation algorithms
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { query, type QueryCtx } from "./_generated/server";
import { optionalPlayer } from "./lib/auth";

const ONLINE_THRESHOLD_MS = 60_000;
const ONE_HOUR_MS = 60 * 60 * 1000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export const vPublicPlayerProjection = v.object({
  _id: v.id("players"),
  username: v.string(),
  displayName: v.string(),
  avatarUrl: v.string(),
  rating: v.number(),
  ratingHuman: v.number(),
  playerType: v.union(v.literal("university_student"), v.literal("public_player")),
  universityName: v.optional(v.string()),
  universityId: v.optional(v.id("universities")),
  verificationStatus: v.optional(v.union(v.literal("none"), v.literal("pending"), v.literal("verified"))),
  isOnline: v.boolean(),
  lastSeen: v.number(),
});

export const vRecommendedPlayerProjection = v.object({
  _id: v.id("players"),
  username: v.string(),
  displayName: v.string(),
  avatarUrl: v.string(),
  rating: v.number(),
  ratingHuman: v.number(),
  playerType: v.union(v.literal("university_student"), v.literal("public_player")),
  universityName: v.optional(v.string()),
  universityId: v.optional(v.id("universities")),
  verificationStatus: v.optional(v.union(v.literal("none"), v.literal("pending"), v.literal("verified"))),
  isOnline: v.boolean(),
  lastSeen: v.number(),
  recommendationScore: v.number(),
});

/**
 * Returns a set of player IDs blocked by the player or who blocked the player.
 */
async function getBlockedPlayerIds(
  ctx: QueryCtx,
  playerId: Id<"players"> | undefined,
): Promise<Set<string>> {
  if (!playerId) return new Set();

  const myBlocks = await ctx.db
    .query("blocks")
    .withIndex("by_blockerId", (q) => q.eq("blockerId", playerId))
    .collect();

  const blockedByOthers = await ctx.db
    .query("blocks")
    .withIndex("by_blockedId", (q) => q.eq("blockedId", playerId))
    .collect();

  return new Set([
    ...myBlocks.map((b) => b.blockedId),
    ...blockedByOthers.map((b) => b.blockerId),
  ]);
}

/**
 * Maps player document and presence details to safe public projection (stripping PII).
 */
function toPublicProjection(
  player: Doc<"players">,
  presence: { isOnline: boolean; lastSeen: number },
) {
  return {
    _id: player._id,
    username: player.username,
    displayName: player.displayName ?? player.username,
    avatarUrl: player.avatarUrl,
    rating: player.rating,
    ratingHuman: player.ratingHuman,
    playerType: (player.playerType ?? "public_player") as "university_student" | "public_player",
    universityName: player.universityName,
    universityId: player.universityId,
    verificationStatus: player.verificationStatus,
    isOnline: presence.isOnline,
    lastSeen: presence.lastSeen,
  };
}

/**
 * Calculates availability/activity score weight based on lastSeen timestamp.
 */
function computeActivityWeight(now: number, lastSeen: number): number {
  if (lastSeen <= 0) return 0.05;
  const elapsed = now - lastSeen;
  if (elapsed <= ONLINE_THRESHOLD_MS) return 1.0;
  if (elapsed <= ONE_HOUR_MS) return 0.6;
  if (elapsed <= ONE_DAY_MS) return 0.3;
  return 0.05;
}

/**
 * Batch retrieves presence for a list of player IDs.
 */
async function getPresenceMap(
  ctx: QueryCtx,
  playerIds: Id<"players">[],
  now: number,
): Promise<Map<string, { isOnline: boolean; lastSeen: number }>> {
  const map = new Map<string, { isOnline: boolean; lastSeen: number }>();
  await Promise.all(
    playerIds.map(async (id) => {
      const row = await ctx.db
        .query("userPresence")
        .withIndex("by_playerId", (q) => q.eq("playerId", id))
        .unique();
      const lastSeen = row?.lastSeen ?? 0;
      const isOnline = now - lastSeen <= ONLINE_THRESHOLD_MS;
      map.set(id, { isOnline, lastSeen });
    }),
  );
  return map;
}

/**
 * 1. getRecommendedPlayers
 * Computes modular composite recommendation score for player candidates.
 */
export const getRecommendedPlayers = query({
  args: {
    limit: v.optional(v.number()),
  },
  returns: v.array(vRecommendedPlayerProjection),
  handler: async (ctx, args) => {
    const caller = await optionalPlayer(ctx);
    const now = Date.now();
    const blockedSet = await getBlockedPlayerIds(ctx, caller?._id);

    // Retrieve caller's accepted friends set if authenticated
    const friendSet = new Set<string>();
    if (caller) {
      const asRequester = await ctx.db
        .query("friendships")
        .withIndex("by_requesterId_and_status", (q) =>
          q.eq("requesterId", caller._id).eq("status", "accepted"),
        )
        .collect();

      const asRecipient = await ctx.db
        .query("friendships")
        .withIndex("by_recipientId_and_status", (q) =>
          q.eq("recipientId", caller._id).eq("status", "accepted"),
        )
        .collect();

      for (const f of asRequester) friendSet.add(f.recipientId);
      for (const f of asRecipient) friendSet.add(f.requesterId);
    }

    // Retrieve all candidates excluding caller, blocked users, and banned accounts
    const allPlayers = await ctx.db.query("players").collect();
    const candidates = allPlayers.filter((p) => {
      if (caller && p._id === caller._id) return false;
      if (blockedSet.has(p._id)) return false;
      if (p.isFairPlayBanned) return false;
      return true;
    });

    const presenceMap = await getPresenceMap(
      ctx,
      candidates.map((p) => p._id),
      now,
    );

    const callerRating = caller ? caller.ratingHuman : 1200;
    const currentHour = new Date(now).getUTCHours();

    const scored = candidates.map((candidate) => {
      const presence = presenceMap.get(candidate._id) ?? { isOnline: false, lastSeen: 0 };

      // 1. Rating proximity (35% weight)
      const ratingDiff = Math.abs(candidate.ratingHuman - callerRating);
      const ratingProximity = Math.max(0, 1 - ratingDiff / 500) * 0.35;

      // 2. Availability/Activity (30% weight)
      const activityWeight = computeActivityWeight(now, presence.lastSeen);
      const availability = activityWeight * 0.30;

      // 3. Community/University (15% weight)
      let communityScore = 0.3;
      if (
        caller?.universityId &&
        candidate.universityId &&
        caller.universityId === candidate.universityId
      ) {
        communityScore = 1.0;
      } else if (
        caller?.playerType === "university_student" &&
        candidate.playerType === "university_student"
      ) {
        communityScore = 0.7;
      }
      const community = communityScore * 0.15;

      // 4. Social relevance (10% weight)
      const isFriend = friendSet.has(candidate._id);
      const socialScore = isFriend ? 0.8 : 0.4;
      const social = socialScore * 0.10;

      // 5. Diversity jitter (10% weight)
      const charCode = candidate._id.charCodeAt(0) || 0;
      const jitter = (((charCode + currentHour) % 10) / 10) * 0.10;

      const recommendationScore = ratingProximity + availability + community + social + jitter;

      return {
        ...toPublicProjection(candidate, presence),
        recommendationScore,
      };
    });

    scored.sort((a, b) => b.recommendationScore - a.recommendationScore);
    const limit = args.limit ?? 6;
    return scored.slice(0, limit);
  },
});

/**
 * 2. getOnlinePlayers
 * Returns players currently online (lastSeen within 60s), sorted by rating proximity to caller.
 */
export const getOnlinePlayers = query({
  args: {
    limit: v.optional(v.number()),
  },
  returns: v.array(vPublicPlayerProjection),
  handler: async (ctx, args) => {
    const caller = await optionalPlayer(ctx);
    const now = Date.now();
    const threshold = now - ONLINE_THRESHOLD_MS;
    const blockedSet = await getBlockedPlayerIds(ctx, caller?._id);

    const presenceRows = await ctx.db
      .query("userPresence")
      .withIndex("by_lastSeen", (q) => q.gte("lastSeen", threshold))
      .collect();

    // Map unique presence rows
    const presenceMap = new Map<string, number>();
    for (const row of presenceRows) {
      if (caller && row.playerId === caller._id) continue;
      if (blockedSet.has(row.playerId)) continue;
      presenceMap.set(row.playerId, row.lastSeen);
    }

    const playerDocs = (
      await Promise.all(Array.from(presenceMap.keys()).map((id) => ctx.db.get(id as Id<"players">)))
    ).filter((p): p is Doc<"players"> => p !== null && !p.isFairPlayBanned);

    const callerRating = caller ? caller.ratingHuman : 1200;

    playerDocs.sort((a, b) => {
      const diffA = Math.abs(a.ratingHuman - callerRating);
      const diffB = Math.abs(b.ratingHuman - callerRating);
      return diffA - diffB;
    });

    const limit = args.limit ?? 10;
    return playerDocs.slice(0, limit).map((p) => {
      const lastSeen = presenceMap.get(p._id) ?? now;
      return toPublicProjection(p, { isOnline: true, lastSeen });
    });
  },
});

/**
 * 3. searchPlayers
 * Searches players matching username or displayName, applies filters, and returns safe public projection.
 */
export const searchPlayers = query({
  args: {
    query: v.string(),
    minRating: v.optional(v.number()),
    maxRating: v.optional(v.number()),
    onlineOnly: v.optional(v.boolean()),
    universityId: v.optional(v.id("universities")),
    playerType: v.optional(v.union(v.literal("university_student"), v.literal("public_player"))),
    limit: v.optional(v.number()),
  },
  returns: v.array(vPublicPlayerProjection),
  handler: async (ctx, args) => {
    const caller = await optionalPlayer(ctx);
    const blockedSet = await getBlockedPlayerIds(ctx, caller?._id);
    const search = args.query.trim().toLowerCase();
    const now = Date.now();

    const allPlayers = await ctx.db.query("players").collect();

    const matched = allPlayers.filter((p) => {
      if (caller && p._id === caller._id) return false;
      if (blockedSet.has(p._id)) return false;
      if (p.isFairPlayBanned) return false;

      // Substring match on username or displayName
      if (search.length > 0) {
        const matchUsername =
          p.usernameLower.includes(search) || p.username.toLowerCase().includes(search);
        const matchDisplayName = p.displayName ? p.displayName.toLowerCase().includes(search) : false;
        if (!matchUsername && !matchDisplayName) return false;
      }

      // Rating filters
      const rating = p.ratingHuman ?? p.rating;
      if (args.minRating !== undefined && rating < args.minRating) return false;
      if (args.maxRating !== undefined && rating > args.maxRating) return false;

      // University filter
      if (args.universityId !== undefined && p.universityId !== args.universityId) return false;

      // PlayerType filter
      if (
        args.playerType !== undefined &&
        (p.playerType ?? "public_player") !== args.playerType
      ) {
        return false;
      }

      return true;
    });

    const presenceMap = await getPresenceMap(
      ctx,
      matched.map((p) => p._id),
      now,
    );

    const filtered = matched.filter((p) => {
      if (args.onlineOnly) {
        const presence = presenceMap.get(p._id);
        if (!presence || !presence.isOnline) return false;
      }
      return true;
    });

    const limit = args.limit ?? 20;
    return filtered.slice(0, limit).map((p) => {
      const presence = presenceMap.get(p._id) ?? { isOnline: false, lastSeen: 0 };
      return toPublicProjection(p, presence);
    });
  },
});
