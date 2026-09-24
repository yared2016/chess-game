import { createThread, listMessages, saveMessage } from "@convex-dev/agent";
import { v } from "convex/values";
import { components } from "./_generated/api";
import { mutation, query } from "./_generated/server";
import { requirePlayer } from "./lib/auth";
import { requireParticipant } from "./lib/games";

// This component stores human messages only. No model or paid AI call is involved.
const MAX_LENGTH = 1_000;
const PAGE_SIZE = 200;

export const forGame = query({
  args: { gameId: v.id("games") },
  returns: v.array(v.object({
    id: v.string(),
    text: v.string(),
    mine: v.boolean(),
    createdAt: v.number(),
    sequence: v.number(),
    seen: v.optional(v.boolean()),
  })),
  handler: async (ctx, { gameId }) => {
    const player = await requirePlayer(ctx);
    const game = await ctx.db.get("games", gameId);
    if (!game) throw new Error("game-not-found");
    requireParticipant(game, player._id);
    if (game.mode !== "online") throw new Error("online-chat-only");

    let opponentReadAt: number | null = null;
    const opponentId = game.whiteId === player._id ? game.blackId : game.whiteId;
    if (opponentId) {
      const oppPresences = await ctx.db
        .query("presence")
        .withIndex("by_gameId_and_playerId", (q) =>
          q.eq("gameId", game._id).eq("playerId", opponentId),
        )
        .collect();
      for (const opp of oppPresences) {
        if (opp.chatReadAt && (opponentReadAt === null || opp.chatReadAt > opponentReadAt)) {
          opponentReadAt = opp.chatReadAt;
        }
      }
    }

    if (!game.playerChatThreadId) return [];
    const result = await listMessages(ctx, components.agent, {
      threadId: game.playerChatThreadId,
      paginationOpts: { numItems: PAGE_SIZE, cursor: null },
    });
    return result.page.reverse().map((message) => {
      const isMine = message.userId === player._id;
      return {
        id: message._id,
        text: message.text ?? "",
        mine: isMine,
        createdAt: message._creationTime,
        sequence: message.order,
        seen: isMine ? (opponentReadAt !== null && opponentReadAt >= message._creationTime) : undefined,
      };
    });
  },
});

export const markRead = mutation({
  args: { gameId: v.id("games") },
  returns: v.null(),
  handler: async (ctx, { gameId }) => {
    const player = await requirePlayer(ctx);
    const game = await ctx.db.get("games", gameId);
    if (!game || game.mode !== "online") return null;
    requireParticipant(game, player._id);

    const now = Date.now();
    const existing = await ctx.db
      .query("presence")
      .withIndex("by_gameId_and_playerId", (q) =>
        q.eq("gameId", game._id).eq("playerId", player._id),
      )
      .collect();

    if (existing.length > 0) {
      for (const row of existing) {
        await ctx.db.patch("presence", row._id, { chatReadAt: now, lastSeen: now });
      }
    } else {
      const role = game.whiteId === player._id ? "w" : "b";
      await ctx.db.insert("presence", {
        gameId: game._id,
        playerId: player._id,
        role,
        lastSeen: now,
        chatReadAt: now,
      });
    }
    return null;
  },
});

export const send = mutation({
  args: { gameId: v.id("games"), text: v.string() },
  returns: v.null(),
  handler: async (ctx, { gameId, text: raw }) => {
    const player = await requirePlayer(ctx);
    const game = await ctx.db.get("games", gameId);
    if (!game) throw new Error("game-not-found");
    requireParticipant(game, player._id);
    if (game.mode !== "online") throw new Error("online-chat-only");
    const text = raw.trim();
    if (!text || text.length > MAX_LENGTH) throw new Error("invalid-message-length");

    // Created atomically with the first message: concurrent first sends share
    // the same thread after Convex retries the conflicting transaction.
    let threadId = game.playerChatThreadId;
    if (!threadId) {
      threadId = await createThread(ctx, components.agent);
      await ctx.db.patch("games", gameId, { playerChatThreadId: threadId });
    }
    await saveMessage(ctx, components.agent, {
      threadId,
      userId: player._id,
      message: { role: "user", content: text },
    });

    // Mark current player's chat as read
    const existing = await ctx.db
      .query("presence")
      .withIndex("by_gameId_and_playerId", (q) =>
        q.eq("gameId", gameId).eq("playerId", player._id),
      )
      .collect();
    for (const row of existing) {
      await ctx.db.patch("presence", row._id, { chatReadAt: Date.now() });
    }

    return null;
  },
});
