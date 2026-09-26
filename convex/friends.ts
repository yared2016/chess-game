// convex/friends.ts — Social friends system (Phase 3)
//
// Supports: friend requests, accept/reject/cancel/remove, block/unblock,
// friends list, and online status. Every mutation verifies ownership.
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requirePlayer } from "./lib/auth";
import { createNotification } from "./notifications";

// ---------------------------------------------------------------- send request
export const sendRequest = mutation({
  args: { toPlayerId: v.id("players") },
  returns: v.id("friendships"),
  handler: async (ctx, args) => {
    const player = await requirePlayer(ctx);
    if (player._id === args.toPlayerId) throw new Error("cannot-friend-self");

    const target = await ctx.db.get(args.toPlayerId);
    if (!target) throw new Error("player-not-found");

    // Check if blocked
    const blocked = await ctx.db
      .query("blocks")
      .withIndex("by_blockerId_and_blockedId", (q) =>
        q.eq("blockerId", args.toPlayerId).eq("blockedId", player._id)
      )
      .first();
    if (blocked) throw new Error("player-blocked-you");

    const iBlockedThem = await ctx.db
      .query("blocks")
      .withIndex("by_blockerId_and_blockedId", (q) =>
        q.eq("blockerId", player._id).eq("blockedId", args.toPlayerId)
      )
      .first();
    if (iBlockedThem) throw new Error("you-blocked-this-player");

    // Check existing friendship or pending request
    const existing = await findFriendship(ctx, player._id, args.toPlayerId);
    if (existing) {
      if (existing.status === "accepted") throw new Error("already-friends");
      if (existing.status === "pending") throw new Error("request-already-sent");
      if (existing.status === "rejected") {
        // Allow re-sending if previously rejected
        await ctx.db.patch(existing._id, {
          requesterId: player._id,
          status: "pending",
          updatedAt: Date.now(),
        });
        return existing._id;
      }
    }

    const friendshipId = await ctx.db.insert("friendships", {
      requesterId: player._id,
      recipientId: args.toPlayerId,
      status: "pending",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    await createNotification(ctx, {
      userId: args.toPlayerId,
      type: "friend_request" as any,
      title: "Friend Request",
      message: `${player.username} sent you a friend request`,
      link: `/profile/${encodeURIComponent(player.username)}`,
    });

    return friendshipId;
  },
});

// ---------------------------------------------------------------- respond
export const respond = mutation({
  args: {
    friendshipId: v.id("friendships"),
    accept: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const player = await requirePlayer(ctx);
    const friendship = await ctx.db.get(args.friendshipId);
    if (!friendship) throw new Error("friendship-not-found");
    if (friendship.recipientId !== player._id) throw new Error("not-your-request");
    if (friendship.status !== "pending") throw new Error("request-not-pending");

    const now = Date.now();

    if (args.accept) {
      await ctx.db.patch(args.friendshipId, {
        status: "accepted",
        updatedAt: now,
      });

      await createNotification(ctx, {
        userId: friendship.requesterId,
        type: "friend_accepted" as any,
        title: "Friend Request Accepted",
        message: `${player.username} accepted your friend request`,
        link: `/profile/${encodeURIComponent(player.username)}`,
      });
    } else {
      await ctx.db.patch(args.friendshipId, {
        status: "rejected",
        updatedAt: now,
      });
    }
    return null;
  },
});

// ---------------------------------------------------------------- cancel request
export const cancelRequest = mutation({
  args: { friendshipId: v.id("friendships") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const player = await requirePlayer(ctx);
    const friendship = await ctx.db.get(args.friendshipId);
    if (!friendship) throw new Error("friendship-not-found");
    if (friendship.requesterId !== player._id) throw new Error("not-your-request");
    if (friendship.status !== "pending") throw new Error("request-not-pending");

    await ctx.db.delete(args.friendshipId);
    return null;
  },
});

// ---------------------------------------------------------------- remove friend
export const removeFriend = mutation({
  args: { friendshipId: v.id("friendships") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const player = await requirePlayer(ctx);
    const friendship = await ctx.db.get(args.friendshipId);
    if (!friendship) throw new Error("friendship-not-found");
    if (friendship.requesterId !== player._id && friendship.recipientId !== player._id) {
      throw new Error("not-your-friendship");
    }
    if (friendship.status !== "accepted") throw new Error("not-friends");

    await ctx.db.delete(args.friendshipId);
    return null;
  },
});

// ---------------------------------------------------------------- block
export const blockPlayer = mutation({
  args: { blockedId: v.id("players") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const player = await requirePlayer(ctx);
    if (player._id === args.blockedId) throw new Error("cannot-block-self");

    // Check if already blocked
    const existing = await ctx.db
      .query("blocks")
      .withIndex("by_blockerId_and_blockedId", (q) =>
        q.eq("blockerId", player._id).eq("blockedId", args.blockedId)
      )
      .first();
    if (existing) return null; // Already blocked

    // Remove any existing friendship
    const friendship = await findFriendship(ctx, player._id, args.blockedId);
    if (friendship) await ctx.db.delete(friendship._id);

    await ctx.db.insert("blocks", {
      blockerId: player._id,
      blockedId: args.blockedId,
      createdAt: Date.now(),
    });
    return null;
  },
});

// ---------------------------------------------------------------- unblock
export const unblockPlayer = mutation({
  args: { blockedId: v.id("players") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const player = await requirePlayer(ctx);
    const block = await ctx.db
      .query("blocks")
      .withIndex("by_blockerId_and_blockedId", (q) =>
        q.eq("blockerId", player._id).eq("blockedId", args.blockedId)
      )
      .first();
    if (block) await ctx.db.delete(block._id);
    return null;
  },
});

// ---------------------------------------------------------------- queries
export const myFriends = query({
  args: {},
  handler: async (ctx) => {
    const player = await requirePlayer(ctx);

    // Get all accepted friendships where user is either requester or recipient
    const asRequester = await ctx.db
      .query("friendships")
      .withIndex("by_requesterId_and_status", (q) =>
        q.eq("requesterId", player._id).eq("status", "accepted")
      )
      .collect();

    const asRecipient = await ctx.db
      .query("friendships")
      .withIndex("by_recipientId_and_status", (q) =>
        q.eq("recipientId", player._id).eq("status", "accepted")
      )
      .collect();

    const friendships = [...asRequester, ...asRecipient];
    const friends = [];

    for (const f of friendships) {
      const friendId = f.requesterId === player._id ? f.recipientId : f.requesterId;
      const friend = await ctx.db.get(friendId);
      if (!friend) continue;
      friends.push({
        friendshipId: f._id,
        _id: friend._id,
        username: friend.username,
        avatarUrl: friend.avatarUrl,
        rating: friend.rating,
        ratingHuman: friend.ratingHuman,
        since: f.updatedAt,
      });
    }

    return friends.sort((a, b) => b.since - a.since);
  },
});

export const myIncomingRequests = query({
  args: {},
  handler: async (ctx) => {
    const player = await requirePlayer(ctx);
    const pending = await ctx.db
      .query("friendships")
      .withIndex("by_recipientId_and_status", (q) =>
        q.eq("recipientId", player._id).eq("status", "pending")
      )
      .collect();

    const requests = [];
    for (const f of pending) {
      const requester = await ctx.db.get(f.requesterId);
      if (!requester) continue;
      requests.push({
        friendshipId: f._id,
        _id: requester._id,
        username: requester.username,
        avatarUrl: requester.avatarUrl,
        rating: requester.rating,
        createdAt: f.createdAt,
      });
    }
    return requests;
  },
});

export const myOutgoingRequests = query({
  args: {},
  handler: async (ctx) => {
    const player = await requirePlayer(ctx);
    const pending = await ctx.db
      .query("friendships")
      .withIndex("by_requesterId_and_status", (q) =>
        q.eq("requesterId", player._id).eq("status", "pending")
      )
      .collect();

    const requests = [];
    for (const f of pending) {
      const recipient = await ctx.db.get(f.recipientId);
      if (!recipient) continue;
      requests.push({
        friendshipId: f._id,
        _id: recipient._id,
        username: recipient.username,
        avatarUrl: recipient.avatarUrl,
        rating: recipient.rating,
        createdAt: f.createdAt,
      });
    }
    return requests;
  },
});

export const myBlocks = query({
  args: {},
  handler: async (ctx) => {
    const player = await requirePlayer(ctx);
    const blocks = await ctx.db
      .query("blocks")
      .withIndex("by_blockerId", (q) => q.eq("blockerId", player._id))
      .collect();

    const blockedPlayers = [];
    for (const b of blocks) {
      const blocked = await ctx.db.get(b.blockedId);
      if (!blocked) continue;
      blockedPlayers.push({
        blockId: b._id,
        _id: blocked._id,
        username: blocked.username,
        avatarUrl: blocked.avatarUrl,
        blockedAt: b.createdAt,
      });
    }
    return blockedPlayers;
  },
});

export const isFriend = query({
  args: { playerId: v.id("players") },
  handler: async (ctx, args) => {
    const player = await requirePlayer(ctx);
    if (player._id === args.playerId) return { status: "self" as const };

    const friendship = await findFriendship(ctx, player._id, args.playerId);
    if (!friendship) {
      // Check if blocked
      const blocked = await ctx.db
        .query("blocks")
        .withIndex("by_blockerId_and_blockedId", (q) =>
          q.eq("blockerId", player._id).eq("blockedId", args.playerId)
        )
        .first();
      if (blocked) return { status: "blocked" as const };

      const blockedBy = await ctx.db
        .query("blocks")
        .withIndex("by_blockerId_and_blockedId", (q) =>
          q.eq("blockerId", args.playerId).eq("blockedId", player._id)
        )
        .first();
      if (blockedBy) return { status: "blocked_by" as const };

      return { status: "none" as const };
    }

    if (friendship.status === "accepted") return { status: "friends" as const, friendshipId: friendship._id };
    if (friendship.status === "pending") {
      if (friendship.requesterId === player._id) {
        return { status: "request_sent" as const, friendshipId: friendship._id };
      }
      return { status: "request_received" as const, friendshipId: friendship._id };
    }
    return { status: "none" as const };
  },
});

// ---------------------------------------------------------------- helpers
async function findFriendship(
  ctx: { db: any },
  playerA: any,
  playerB: any,
) {
  // Check both directions since either could be requester
  const aToB = await ctx.db
    .query("friendships")
    .withIndex("by_requesterId_and_recipientId", (q: any) =>
      q.eq("requesterId", playerA).eq("recipientId", playerB)
    )
    .first();
  if (aToB) return aToB;

  const bToA = await ctx.db
    .query("friendships")
    .withIndex("by_requesterId_and_recipientId", (q: any) =>
      q.eq("requesterId", playerB).eq("recipientId", playerA)
    )
    .first();
  return bToA ?? null;
}
