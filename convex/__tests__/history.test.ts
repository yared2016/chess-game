import { describe, expect, test } from "vitest";
import { api } from "../_generated/api";
import { as, makeTest, signUp } from "./harness.setup";

describe("games history & stats", () => {
  test("returns player history and stats correctly", async () => {
    const t = makeTest();
    const alice = await signUp(t, "alice");
    const bob = await signUp(t, "bob");

    // Create a finished game between Alice and Bob
    await t.run(async (ctx) => {
      await ctx.db.insert("games", {
        whiteId: alice.id,
        blackId: bob.id,
        mode: "online",
        fen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1",
        moves: ["e4"],
        pgn: "1. e4",
        turn: "b",
        status: "checkmate",
        winner: "w",
        endReason: "checkmate",
        rated: true,
        undoCount: 0,
        hintsUsed: 0,
        createdAt: 2000,
        lastMoveAt: 2100,
        endedAt: 2100,
        timeControlKey: "blitz_3_0",
        stake: 50,
      });
    });

    // Query history as Alice
    const games = await as(t, alice).query(api.games.getPlayerGames, { limit: 10 });
    expect(games.length).toBe(1);
    expect(games[0].opponentName).toBe("bob");
    expect(games[0].winner).toBe("w");
    expect(games[0].myColour).toBe("w");
    expect(games[0].stake).toBe(50);
    expect(games[0].timeControlKey).toBe("blitz_3_0");

    // Query stats as Alice
    const stats = await as(t, alice).query(api.games.getPlayerHistoryStats, {});
    expect(stats.totalGames).toBe(0); // Alice hasn't finalized through applyResult in this mock insert
    expect(stats.currentStreak).toBe(1); // but current streak counts recent games
    expect(stats.stakedGames).toBe(1);

    // Filter by result: loss should return empty
    const losses = await as(t, alice).query(api.games.getPlayerGames, { result: "loss" });
    expect(losses.length).toBe(0);

    // Filter by result: win should return the game
    const wins = await as(t, alice).query(api.games.getPlayerGames, { result: "win" });
    expect(wins.length).toBe(1);

    // Filter by mode: ai should return empty
    const aiGames = await as(t, alice).query(api.games.getPlayerGames, { mode: "ai" });
    expect(aiGames.length).toBe(0);
  });
});
