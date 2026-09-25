// convex/challenges.ts — Direct player search & challenge matchmaking
import { Chess } from "chess.js";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requirePlayer } from "./lib/auth";
import { COMMISSION_RATE, DEFAULT_FEN } from "./lib/constants";
import { createNotification } from "./notifications";
import { postLedgerEntry } from "./ledger";
import type { Id } from "./_generated/dataModel";

export const CHALLENGE_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes timeout

export const searchPlayers = query({
  args: { query: v.string() },
  handler: async (ctx, args) => {
    const player = await requirePlayer(ctx);
    const search = args.query.trim().toLowerCase();
    if (search.length < 2) return [];

    const all = await ctx.db.query("players").take(100);
    const matched = all
      .filter((p) => {
        if (p._id === player._id) return false;
        const matchesUsername = p.usernameLower.includes(search) || p.username.toLowerCase().includes(search);
        const matchesEmail = p.email ? p.email.toLowerCase().includes(search) : false;
        return matchesUsername || matchesEmail;
      })
      .slice(0, 8);

    return matched.map((p) => ({
      _id: p._id,
      username: p.username,
      avatarUrl: p.avatarUrl,
      ratingHuman: p.ratingHuman,
      email: p.email,
    }));
  },
});

export const createChallenge = mutation({
  args: {
    toPlayerId: v.id("players"),
    stake: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const player = await requirePlayer(ctx);
    if (player._id === args.toPlayerId) {
      throw new Error("cannot-challenge-self");
    }

    const toPlayer = await ctx.db.get(args.toPlayerId);
    if (!toPlayer) throw new Error("player-not-found");

    const stake = args.stake ?? 0;
    if (stake > 0) {
      if (stake < 10 || !Number.isInteger(stake)) {
        throw new Error("invalid-stake");
      }

      let wallet = await ctx.db
        .query("wallets")
        .withIndex("by_userId", (q) => q.eq("userId", player._id))
        .unique();

      if (!wallet) throw new Error("wallet-not-found");
      if (wallet.status === "frozen") throw new Error("wallet-is-frozen");

      const stakeSantims = stake * 100;
      const currentAvail = wallet.availableSantims ?? Math.round(wallet.availableBalance * 100);
      const currentLocked = wallet.lockedSantims ?? Math.round(wallet.lockedBalance * 100);

      if (currentAvail < stakeSantims) {
        throw new Error("insufficient-funds");
      }

      const newAvail = currentAvail - stakeSantims;
      const newLocked = currentLocked + stakeSantims;

      await postLedgerEntry(ctx, {
        userId: player._id,
        walletId: wallet._id,
        entryType: "match_lock",
        amountSantims: stakeSantims,
        balanceAfterSantims: newAvail,
        lockedAfterSantims: newLocked,
        referenceType: "match",
        referenceId: `challenge_out_${player._id}`,
        idempotencyKey: `challenge_lock_${player._id}_${Date.now()}`,
        description: `Direct challenge stake lock (${stake} ETB)`,
      });

      await ctx.db.patch(wallet._id, {
        availableSantims: newAvail,
        availableBalance: newAvail / 100,
        lockedSantims: newLocked,
        lockedBalance: newLocked / 100,
        updatedAt: Date.now(),
      });
    }

    const challengeId = await ctx.db.insert("challenges", {
      fromId: player._id,
      toId: args.toPlayerId,
      stake: stake > 0 ? stake : undefined,
      status: "pending",
      createdAt: Date.now(),
    });

    await createNotification(ctx, {
      userId: args.toPlayerId,
      type: "challenge_received",
      title: "New Match Challenge! ⚔️",
      message: `${player.username} challenged you to a ${stake > 0 ? `${stake} ETB match` : "casual game"}!`,
      link: "/play",
    });

    return { challengeId };
  },
});

export const myIncomingChallenges = query({
  args: {},
  handler: async (ctx) => {
    const player = await requirePlayer(ctx);
    const now = Date.now();
    const challenges = await ctx.db
      .query("challenges")
      .withIndex("by_toId_and_status", (q) => q.eq("toId", player._id).eq("status", "pending"))
      .order("desc")
      .take(10);

    const activeChallenges = challenges.filter(
      (c) => now - c.createdAt <= CHALLENGE_TIMEOUT_MS
    );

    return await Promise.all(
      activeChallenges.map(async (c) => {
        const fromPlayer = await ctx.db.get(c.fromId);
        return {
          ...c,
          remainingMs: Math.max(0, CHALLENGE_TIMEOUT_MS - (now - c.createdAt)),
          fromPlayer: fromPlayer
            ? {
                _id: fromPlayer._id,
                username: fromPlayer.username,
                avatarUrl: fromPlayer.avatarUrl,
                ratingHuman: fromPlayer.ratingHuman,
              }
            : null,
        };
      })
    );
  },
});

export const myOutgoingChallenges = query({
  args: {},
  handler: async (ctx) => {
    const player = await requirePlayer(ctx);
    const now = Date.now();
    const challenges = await ctx.db
      .query("challenges")
      .withIndex("by_fromId_and_status", (q) => q.eq("fromId", player._id))
      .order("desc")
      .take(10);

    return await Promise.all(
      challenges.map(async (c) => {
        const toPlayer = await ctx.db.get(c.toId);
        let gameStatus: string | null = null;
        if (c.gameId) {
          const game = await ctx.db.get(c.gameId);
          gameStatus = game?.status ?? null;
        }
        const isExpired = c.status === "pending" && now - c.createdAt > CHALLENGE_TIMEOUT_MS;
        return {
          ...c,
          isExpired,
          remainingMs: Math.max(0, CHALLENGE_TIMEOUT_MS - (now - c.createdAt)),
          gameStatus,
          toPlayer: toPlayer
            ? {
                _id: toPlayer._id,
                username: toPlayer.username,
                avatarUrl: toPlayer.avatarUrl,
                ratingHuman: toPlayer.ratingHuman,
              }
            : null,
        };
      })
    );
  },
});

export const respond = mutation({
  args: {
    challengeId: v.id("challenges"),
    accept: v.boolean(),
  },
  handler: async (ctx, args) => {
    const player = await requirePlayer(ctx);
    const challenge = await ctx.db.get(args.challengeId);
    if (!challenge) throw new Error("challenge-not-found");
    if (challenge.toId !== player._id) throw new Error("unauthorized-challenge");
    if (challenge.status !== "pending") throw new Error("challenge-not-pending");

    const now = Date.now();
    const stake = challenge.stake ?? 0;

    // Reject and refund if challenge expired (>10 minutes)
    if (now - challenge.createdAt > CHALLENGE_TIMEOUT_MS) {
      if (stake > 0) {
        const fromWallet = await ctx.db
          .query("wallets")
          .withIndex("by_userId", (q) => q.eq("userId", challenge.fromId))
          .unique();
        if (fromWallet) {
          const stakeSantims = stake * 100;
          const avail = fromWallet.availableSantims ?? Math.round(fromWallet.availableBalance * 100);
          const locked = fromWallet.lockedSantims ?? Math.round(fromWallet.lockedBalance * 100);
          const refundSantims = Math.min(locked, stakeSantims);
          const newAvail = avail + refundSantims;
          const newLocked = Math.max(0, locked - refundSantims);

          await postLedgerEntry(ctx, {
            userId: challenge.fromId,
            walletId: fromWallet._id,
            entryType: "match_unlock",
            amountSantims: refundSantims,
            balanceAfterSantims: newAvail,
            lockedAfterSantims: newLocked,
            referenceType: "match",
            referenceId: `challenge_${challenge._id}`,
            idempotencyKey: `challenge_expire_refund_${challenge._id}`,
            description: `Challenge expired stake refund (${stake} ETB)`,
            now,
          });

          await ctx.db.patch(fromWallet._id, {
            availableSantims: newAvail,
            availableBalance: newAvail / 100,
            lockedSantims: newLocked,
            lockedBalance: newLocked / 100,
            updatedAt: now,
          });
        }
      }

      await ctx.db.patch(challenge._id, {
        status: "expired",
        respondedAt: now,
      });

      throw new Error("challenge-expired");
    }

    if (!args.accept) {
      // Refund sender if stake was locked
      if (stake > 0) {
        const fromWallet = await ctx.db
          .query("wallets")
          .withIndex("by_userId", (q) => q.eq("userId", challenge.fromId))
          .unique();
        if (fromWallet) {
          const stakeSantims = stake * 100;
          const avail = fromWallet.availableSantims ?? Math.round(fromWallet.availableBalance * 100);
          const locked = fromWallet.lockedSantims ?? Math.round(fromWallet.lockedBalance * 100);
          const refundSantims = Math.min(locked, stakeSantims);
          const newAvail = avail + refundSantims;
          const newLocked = Math.max(0, locked - refundSantims);

          await postLedgerEntry(ctx, {
            userId: challenge.fromId,
            walletId: fromWallet._id,
            entryType: "match_unlock",
            amountSantims: refundSantims,
            balanceAfterSantims: newAvail,
            lockedAfterSantims: newLocked,
            referenceType: "match",
            referenceId: `challenge_${challenge._id}`,
            idempotencyKey: `challenge_decline_refund_${challenge._id}`,
            description: `Challenge declined stake refund (${stake} ETB)`,
            now,
          });

          await ctx.db.patch(fromWallet._id, {
            availableSantims: newAvail,
            availableBalance: newAvail / 100,
            lockedSantims: newLocked,
            lockedBalance: newLocked / 100,
            updatedAt: now,
          });
        }
      }

      await ctx.db.patch(challenge._id, {
        status: "declined",
        respondedAt: now,
      });

      await createNotification(ctx, {
        userId: challenge.fromId,
        type: "challenge_declined",
        title: "Challenge Declined",
        message: `${player.username} declined your challenge.${stake > 0 ? ` Your stake of ${stake} ETB has been refunded to your wallet.` : ""}`,
        link: "/play",
      });

      return { status: "declined" };
    }

    // Accepting challenge
    if (stake > 0) {
      let receiverWallet = await ctx.db
        .query("wallets")
        .withIndex("by_userId", (q) => q.eq("userId", player._id))
        .unique();

      if (!receiverWallet) throw new Error("wallet-not-found");
      if (receiverWallet.status === "frozen") throw new Error("wallet-is-frozen");

      const stakeSantims = stake * 100;
      const currentAvail = receiverWallet.availableSantims ?? Math.round(receiverWallet.availableBalance * 100);
      const currentLocked = receiverWallet.lockedSantims ?? Math.round(receiverWallet.lockedBalance * 100);

      if (currentAvail < stakeSantims) {
        throw new Error("insufficient-funds");
      }

      const newAvail = currentAvail - stakeSantims;
      const newLocked = currentLocked + stakeSantims;

      await postLedgerEntry(ctx, {
        userId: player._id,
        walletId: receiverWallet._id,
        entryType: "match_lock",
        amountSantims: stakeSantims,
        balanceAfterSantims: newAvail,
        lockedAfterSantims: newLocked,
        referenceType: "match",
        referenceId: `challenge_in_${challenge._id}`,
        idempotencyKey: `challenge_accept_lock_${player._id}_${challenge._id}`,
        description: `Challenge accepted stake lock (${stake} ETB)`,
        now,
      });

      await ctx.db.patch(receiverWallet._id, {
        availableSantims: newAvail,
        availableBalance: newAvail / 100,
        lockedSantims: newLocked,
        lockedBalance: newLocked / 100,
        updatedAt: now,
      });
    }

    // Determine colours randomly
    const callerIsWhite = Math.random() < 0.5;
    const whiteId: Id<"players"> = callerIsWhite ? player._id : challenge.fromId;
    const blackId: Id<"players"> = callerIsWhite ? challenge.fromId : player._id;

    const escrowFields =
      stake > 0
        ? {
            stake,
            escrowTotal: stake * 2,
            commission: Math.round(stake * 2 * COMMISSION_RATE),
            payout: Math.round(stake * 2 * (1 - COMMISSION_RATE)),
            escrowSettled: false,
          }
        : {};

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
      ...escrowFields,
    });

    // Seed presence
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

    await ctx.db.patch(challenge._id, {
      status: "accepted",
      gameId,
      respondedAt: now,
    });

    await createNotification(ctx, {
      userId: challenge.fromId,
      type: "challenge_accepted",
      title: "Challenge Accepted! ⚔️",
      message: `${player.username} accepted your challenge! Game is starting.`,
      link: `/game/${gameId}`,
    });

    return { gameId, status: "accepted" };
  },
});

export const cancel = mutation({
  args: { challengeId: v.id("challenges") },
  handler: async (ctx, args) => {
    const player = await requirePlayer(ctx);
    const challenge = await ctx.db.get(args.challengeId);
    if (!challenge) throw new Error("challenge-not-found");
    if (challenge.fromId !== player._id) throw new Error("unauthorized-challenge");
    if (challenge.status !== "pending") return;

    const now = Date.now();
    const isExpired = now - challenge.createdAt > CHALLENGE_TIMEOUT_MS;
    const stake = challenge.stake ?? 0;
    if (stake > 0) {
      const wallet = await ctx.db
        .query("wallets")
        .withIndex("by_userId", (q) => q.eq("userId", challenge.fromId))
        .unique();
      if (wallet) {
        const stakeSantims = stake * 100;
        const avail = wallet.availableSantims ?? Math.round(wallet.availableBalance * 100);
        const locked = wallet.lockedSantims ?? Math.round(wallet.lockedBalance * 100);
        const refundSantims = Math.min(locked, stakeSantims);
        const newAvail = avail + refundSantims;
        const newLocked = Math.max(0, locked - refundSantims);

        await postLedgerEntry(ctx, {
          userId: challenge.fromId,
          walletId: wallet._id,
          entryType: "match_unlock",
          amountSantims: refundSantims,
          balanceAfterSantims: newAvail,
          lockedAfterSantims: newLocked,
          referenceType: "match",
          referenceId: `challenge_${challenge._id}`,
          idempotencyKey: `challenge_cancel_refund_${challenge._id}`,
          description: `Challenge cancelled stake refund (${stake} ETB)`,
          now,
        });

        await ctx.db.patch(wallet._id, {
          availableSantims: newAvail,
          availableBalance: newAvail / 100,
          lockedSantims: newLocked,
          lockedBalance: newLocked / 100,
          updatedAt: now,
        });
      }
    }

    await ctx.db.patch(challenge._id, {
      status: isExpired ? "expired" : "cancelled",
      respondedAt: now,
    });
  },
});
