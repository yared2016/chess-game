// convex/tournaments.ts
// Real-time Arena & Swiss tournament engine with live matchmaking, standings, and streak bonuses.

import { Chess } from "chess.js";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { optionalPlayer, requirePlayer } from "./lib/auth";
import { DEFAULT_FEN } from "./lib/constants";
import { parseTimeControlKey, classifyOnline } from "./lib/timeControl";

export const listTournaments = query({
  args: {
    status: v.optional(v.string()), // "all" | "active" | "upcoming" | "completed"
  },
  handler: async (ctx, args) => {
    let q = ctx.db.query("tournaments");
    const all = await q.order("desc").collect();

    // Auto-update statuses based on timestamps
    const now = Date.now();
    const updated = all.map((t) => {
      let currentStatus = t.status;
      if (now >= t.endsAt) {
        currentStatus = "completed";
      } else if (now >= t.startsAt) {
        currentStatus = "active";
      } else {
        currentStatus = "upcoming";
      }
      return { ...t, status: currentStatus };
    });

    if (!args.status || args.status === "all") {
      return updated;
    }
    return updated.filter((t) => t.status === args.status);
  },
});

export const getTournament = query({
  args: { tournamentId: v.id("tournaments") },
  handler: async (ctx, args) => {
    const tournament = await ctx.db.get("tournaments", args.tournamentId);
    if (!tournament) return null;

    const now = Date.now();
    let currentStatus = tournament.status;
    if (now >= tournament.endsAt) {
      currentStatus = "completed";
    } else if (now >= tournament.startsAt) {
      currentStatus = "active";
    } else {
      currentStatus = "upcoming";
    }

    // Fetch participants sorted by score descending
    const participants = await ctx.db
      .query("tournamentParticipants")
      .withIndex("by_tournamentId_and_score", (q) => q.eq("tournamentId", args.tournamentId))
      .order("desc")
      .collect();

    // Fetch active and recent matches
    const matches = await ctx.db
      .query("tournamentMatches")
      .withIndex("by_tournamentId_and_status", (q) => q.eq("tournamentId", args.tournamentId))
      .order("desc")
      .take(20);

    // Enrich matches: if underlying game has completed, derive status as completed
    const enrichedMatches = await Promise.all(
      matches.map(async (m) => {
        if (m.status === "active") {
          const g = await ctx.db.get("games", m.gameId);
          if (g && g.status !== "active") {
            const whiteWon = g.winner === "w";
            const blackWon = g.winner === "b";
            const winnerId = whiteWon ? m.whiteId : blackWon ? m.blackId : null;
            return {
              ...m,
              status: "completed" as const,
              winnerId,
            };
          }
        }
        return m;
      })
    );

    const player = await optionalPlayer(ctx);
    let myParticipant = player
      ? participants.find((p) => p.playerId === player._id) ?? null
      : null;

    // Clear stale activeGameId if game ended or tournament completed
    if (myParticipant?.activeGameId) {
      const g = await ctx.db.get("games", myParticipant.activeGameId);
      if (!g || g.status !== "active" || currentStatus === "completed") {
        myParticipant = { ...myParticipant, activeGameId: undefined };
      }
    }

    return {
      ...tournament,
      status: currentStatus,
      participantCount: participants.length,
      standings: participants,
      recentMatches: enrichedMatches,
      myParticipant,
    };
  },
});

export const joinTournament = mutation({
  args: { tournamentId: v.id("tournaments") },
  handler: async (ctx, args) => {
    const player = await requirePlayer(ctx);
    const tournament = await ctx.db.get("tournaments", args.tournamentId);
    if (!tournament) throw new Error("tournament-not-found");
    if (tournament.status === "completed") throw new Error("tournament-completed");

    const existing = await ctx.db
      .query("tournamentParticipants")
      .withIndex("by_tournamentId_and_playerId", (q) =>
        q.eq("tournamentId", args.tournamentId).eq("playerId", player._id),
      )
      .first();

    if (existing) {
      if (existing.isPaused) {
        await ctx.db.patch(existing._id, { isPaused: false });
      }
      return existing._id;
    }

    const participantId = await ctx.db.insert("tournamentParticipants", {
      tournamentId: args.tournamentId,
      playerId: player._id,
      username: player.username,
      avatarUrl: player.avatarUrl,
      rating: player.ratingHuman,
      score: 0,
      gamesPlayed: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      streak: 0,
      isPaused: false,
      joinedAt: Date.now(),
    });

    return participantId;
  },
});

export const leaveTournament = mutation({
  args: { tournamentId: v.id("tournaments") },
  handler: async (ctx, args) => {
    const player = await requirePlayer(ctx);
    const participant = await ctx.db
      .query("tournamentParticipants")
      .withIndex("by_tournamentId_and_playerId", (q) =>
        q.eq("tournamentId", args.tournamentId).eq("playerId", player._id),
      )
      .first();

    if (!participant) return null;

    const tournament = await ctx.db.get("tournaments", args.tournamentId);
    if (tournament?.status === "upcoming") {
      await ctx.db.delete("tournamentParticipants", participant._id);
    } else {
      // Pause in active arena
      await ctx.db.patch(participant._id, { isPaused: true });
    }

    return null;
  },
});

export const setPaused = mutation({
  args: {
    tournamentId: v.id("tournaments"),
    paused: v.boolean(),
  },
  handler: async (ctx, args) => {
    const player = await requirePlayer(ctx);
    const participant = await ctx.db
      .query("tournamentParticipants")
      .withIndex("by_tournamentId_and_playerId", (q) =>
        q.eq("tournamentId", args.tournamentId).eq("playerId", player._id),
      )
      .first();

    if (!participant) throw new Error("not-tournament-participant");

    await ctx.db.patch(participant._id, { isPaused: args.paused });
    return null;
  },
});

export const pairNextMatch = mutation({
  args: { tournamentId: v.id("tournaments") },
  handler: async (ctx, args) => {
    const player = await requirePlayer(ctx);
    const tournament = await ctx.db.get("tournaments", args.tournamentId);
    if (!tournament) throw new Error("tournament-not-found");

    const me = await ctx.db
      .query("tournamentParticipants")
      .withIndex("by_tournamentId_and_playerId", (q) =>
        q.eq("tournamentId", args.tournamentId).eq("playerId", player._id),
      )
      .first();

    if (!me) throw new Error("tournament-not-joined");
    if (me.isPaused) throw new Error("tournament-paused");

    // If player already in active tournament match, return it
    if (me.activeGameId) {
      const activeGame = await ctx.db.get("games", me.activeGameId);
      if (activeGame && activeGame.status === "active") {
        return { gameId: me.activeGameId, isNew: false };
      }
      // Stale reference, clear it
      await ctx.db.patch(me._id, { activeGameId: undefined });
    }

    // Find available opponents in this tournament: unpaused and without activeGameId
    const candidates = await ctx.db
      .query("tournamentParticipants")
      .withIndex("by_tournamentId_and_score", (q) => q.eq("tournamentId", args.tournamentId))
      .collect();

    const opponent = candidates.find(
      (c) =>
        c.playerId !== player._id &&
        !c.isPaused &&
        !c.activeGameId,
    );

    if (!opponent) {
      return { gameId: null, isNew: false, message: "Waiting for an opponent..." };
    }

    // Pair me and opponent!
    const now = Date.now();
    const meIsWhite = Math.random() < 0.5;
    const whiteId = meIsWhite ? me.playerId : opponent.playerId;
    const blackId = meIsWhite ? opponent.playerId : me.playerId;

    const tc = parseTimeControlKey(tournament.timeControlKey);
    const startPgn = new Chess().pgn();

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
      timeControlKey: tournament.timeControlKey,
      baseTimeMs: tc.baseTimeMs,
      incrementMs: tc.incrementMs,
      delayMs: tc.delayMs,
      timeCategory: classifyOnline(tc) as any,
      clockMode: "fischer",
      whiteTimeMs: tc.baseTimeMs,
      blackTimeMs: tc.baseTimeMs,
      lastTickAt: now,
      clockVersion: 0,
      firstMoveDeadlineAt: now + 60000,
    });

    // Record match
    await ctx.db.insert("tournamentMatches", {
      tournamentId: args.tournamentId,
      gameId,
      whiteId,
      blackId,
      status: "active",
      createdAt: now,
    });

    // Link activeGameId on both participants
    await ctx.db.patch(me._id, { activeGameId: gameId });
    await ctx.db.patch(opponent._id, { activeGameId: gameId });

    return { gameId, isNew: true };
  },
});

export const recordMatchResult = mutation({
  args: {
    tournamentId: v.id("tournaments"),
    gameId: v.id("games"),
  },
  handler: async (ctx, args) => {
    const game = await ctx.db.get("games", args.gameId);
    if (!game || game.status === "active") return null;

    const match = await ctx.db
      .query("tournamentMatches")
      .withIndex("by_gameId", (q) => q.eq("gameId", args.gameId))
      .first();

    if (!match || match.status === "completed") return null;

    const whitePart = await ctx.db
      .query("tournamentParticipants")
      .withIndex("by_tournamentId_and_playerId", (q) =>
        q.eq("tournamentId", args.tournamentId).eq("playerId", match.whiteId),
      )
      .first();

    const blackPart = await ctx.db
      .query("tournamentParticipants")
      .withIndex("by_tournamentId_and_playerId", (q) =>
        q.eq("tournamentId", args.tournamentId).eq("playerId", match.blackId),
      )
      .first();

    const isDraw =
      game.winner === "draw" ||
      game.endReason === "stalemate" ||
      game.endReason === "threefold" ||
      game.endReason === "fifty-move" ||
      game.endReason === "insufficient" ||
      game.endReason === "agreement";
    const whiteWon = game.winner === "w";
    const blackWon = game.winner === "b";

    let pointsWhite = 0;
    let pointsBlack = 0;

    // Arena scoring: 2 pts win (3 on streak >= 2), 1 pt draw, 0 pt loss
    if (whitePart) {
      if (whiteWon) {
        pointsWhite = (whitePart.streak >= 2) ? 3 : 2;
        await ctx.db.patch(whitePart._id, {
          score: whitePart.score + pointsWhite,
          gamesPlayed: whitePart.gamesPlayed + 1,
          wins: whitePart.wins + 1,
          streak: whitePart.streak + 1,
          activeGameId: undefined,
        });
      } else if (isDraw) {
        pointsWhite = 1;
        await ctx.db.patch(whitePart._id, {
          score: whitePart.score + 1,
          gamesPlayed: whitePart.gamesPlayed + 1,
          draws: whitePart.draws + 1,
          streak: 0,
          activeGameId: undefined,
        });
      } else {
        await ctx.db.patch(whitePart._id, {
          gamesPlayed: whitePart.gamesPlayed + 1,
          losses: whitePart.losses + 1,
          streak: 0,
          activeGameId: undefined,
        });
      }
    }

    if (blackPart) {
      if (blackWon) {
        pointsBlack = (blackPart.streak >= 2) ? 3 : 2;
        await ctx.db.patch(blackPart._id, {
          score: blackPart.score + pointsBlack,
          gamesPlayed: blackPart.gamesPlayed + 1,
          wins: blackPart.wins + 1,
          streak: blackPart.streak + 1,
          activeGameId: undefined,
        });
      } else if (isDraw) {
        pointsBlack = 1;
        await ctx.db.patch(blackPart._id, {
          score: blackPart.score + 1,
          gamesPlayed: blackPart.gamesPlayed + 1,
          draws: blackPart.draws + 1,
          streak: 0,
          activeGameId: undefined,
        });
      } else {
        await ctx.db.patch(blackPart._id, {
          gamesPlayed: blackPart.gamesPlayed + 1,
          losses: blackPart.losses + 1,
          streak: 0,
          activeGameId: undefined,
        });
      }
    }

    const winnerId = whiteWon ? match.whiteId : blackWon ? match.blackId : null;

    await ctx.db.patch(match._id, {
      status: "completed",
      winnerId,
      pointsWhite,
      pointsBlack,
      completedAt: Date.now(),
    });

    return { pointsWhite, pointsBlack };
  },
});

export const seedTournaments = mutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const hour = 3600 * 1000;

    // 1. Live 3+0 Blitz Arena (Currently Active with 40 mins remaining)
    const activeId = await ctx.db.insert("tournaments", {
      title: "Hourly Blitz Arena ⚡",
      description: "Fast-paced 3+0 Blitz arena! Win back-to-back games to activate streak bonuses.",
      format: "arena",
      status: "active",
      timeControlKey: "3+0",
      baseTimeMs: 180000,
      incrementMs: 0,
      durationMinutes: 45,
      startsAt: now - 5 * 60 * 1000, // started 5 mins ago
      endsAt: now + 40 * 60 * 1000, // 40 mins remaining
      prizePool: 500, // ETB
      createdAt: now - 10 * 60 * 1000,
    });

    // 2. Upcoming 1+0 Bullet Arena
    await ctx.db.insert("tournaments", {
      title: "Midnight Bullet Brawl 🔥",
      description: "Ultra-fast 1+0 bullet arena for speed demons. No increments, pure speed.",
      format: "arena",
      status: "upcoming",
      timeControlKey: "1+0",
      baseTimeMs: 60000,
      incrementMs: 0,
      durationMinutes: 30,
      startsAt: now + 2 * hour,
      endsAt: now + 2.5 * hour,
      prizePool: 250,
      createdAt: now,
    });

    // 3. Upcoming 5+3 Rapid Championship
    await ctx.db.insert("tournaments", {
      title: "Castle Rapid Open 🏆",
      description: "Deep calculation 5+3 Fischer increment arena with guaranteed prizes.",
      format: "arena",
      status: "upcoming",
      timeControlKey: "5+3",
      baseTimeMs: 300000,
      incrementMs: 3000,
      durationMinutes: 60,
      startsAt: now + 24 * hour,
      endsAt: now + 25 * hour,
      prizePool: 1000,
      createdAt: now,
    });

    return { inserted: 3, activeId };
  },
});
