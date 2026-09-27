// convex/openingAnalytics.ts
// Aggregates player games for opening insights, ECO performance breakdown, and repertoire stats.

import { v } from "convex/values";
import { query } from "./_generated/server";

export const getPlayerGamesForAnalytics = query({
  args: { username: v.string() },
  handler: async (ctx, args) => {
    const player = await ctx.db
      .query("players")
      .withIndex("by_usernameLower", (q) => q.eq("usernameLower", args.username.toLowerCase()))
      .first();

    if (!player) return null;

    const limit = 100;
    const asWhite = await ctx.db
      .query("games")
      .withIndex("by_whiteId_and_createdAt", (q) => q.eq("whiteId", player._id))
      .order("desc")
      .take(limit);

    const asBlack = await ctx.db
      .query("games")
      .withIndex("by_blackId_and_createdAt", (q) => q.eq("blackId", player._id))
      .order("desc")
      .take(limit);

    const allGames = [...asWhite, ...asBlack]
      .filter((g) => g.status !== "active" && g.status !== "waiting" && g.status !== "aborted" && g.moves.length > 0)
      .sort((a, b) => b.createdAt - a.createdAt);

    return {
      playerId: player._id,
      username: player.username,
      ratingHuman: player.ratingHuman,
      ratingAi: player.ratingAi,
      ratingPuzzle: player.ratingPuzzle ?? 1200,
      games: allGames.map((g) => {
        const isWhite = g.whiteId === player._id;
        const winner = g.winner;
        let outcome: "win" | "loss" | "draw" = "draw";
        if (winner === "w") outcome = isWhite ? "win" : "loss";
        else if (winner === "b") outcome = isWhite ? "loss" : "win";

        return {
          id: g._id,
          moves: g.moves,
          color: isWhite ? ("w" as const) : ("b" as const),
          outcome,
          timeCategory: g.timeCategory ?? "blitz",
          createdAt: g.createdAt,
          mode: g.mode,
        };
      }),
    };
  },
});
