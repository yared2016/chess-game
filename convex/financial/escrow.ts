// convex/financial/escrow.ts — Match escrow lock, refund, and settlement engine
import { v } from "convex/values";
import { internalMutation, mutation, query } from "../_generated/server";
import { requirePlayer } from "../lib/auth";
import { postLedgerEntry } from "../ledger";
import { calculateMatchSettlement } from "../lib/money";
import type { Id } from "../_generated/dataModel";

/**
 * Atomically reserve a match stake from available to locked balance.
 */
export const lockMatchStake = mutation({
  args: {
    stakeSantims: v.number(),
    referenceId: v.string(), // queue entry or challenge ID
    description: v.string(),
  },
  handler: async (ctx, args) => {
    const player = await requirePlayer(ctx);
    const now = Date.now();

    const wallet = await ctx.db
      .query("wallets")
      .withIndex("by_userId", (q) => q.eq("userId", player._id))
      .unique();

    if (!wallet) throw new Error("wallet-not-found");
    if (wallet.status === "frozen") throw new Error("wallet-is-frozen");

    const currentAvailableSantims =
      wallet.availableSantims ?? Math.round(wallet.availableBalance * 100);
    const currentLockedSantims =
      wallet.lockedSantims ?? Math.round(wallet.lockedBalance * 100);

    if (currentAvailableSantims < args.stakeSantims) {
      throw new Error(
        `Insufficient funds. Available: ${currentAvailableSantims / 100} ETB, Required: ${
          args.stakeSantims / 100
        } ETB`
      );
    }

    const newAvailableSantims = currentAvailableSantims - args.stakeSantims;
    const newLockedSantims = currentLockedSantims + args.stakeSantims;

    // 1. Post MATCH_LOCK to ledger
    await postLedgerEntry(ctx, {
      userId: player._id,
      walletId: wallet._id,
      entryType: "match_lock",
      amountSantims: args.stakeSantims,
      balanceAfterSantims: newAvailableSantims,
      lockedAfterSantims: newLockedSantims,
      referenceType: "match",
      referenceId: args.referenceId,
      idempotencyKey: `match_lock_${player._id}_${args.referenceId}`,
      description: args.description,
      now,
    });

    // 2. Patch wallet balances
    await ctx.db.patch(wallet._id, {
      availableSantims: newAvailableSantims,
      availableBalance: newAvailableSantims / 100,
      lockedSantims: newLockedSantims,
      lockedBalance: newLockedSantims / 100,
      updatedAt: now,
    });

    return { success: true };
  },
});

/**
 * Refund a locked match stake back to available balance (queue leave, challenge decline, draw).
 */
export const refundMatchStake = mutation({
  args: {
    userId: v.id("players"),
    stakeSantims: v.number(),
    referenceId: v.string(),
    description: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const wallet = await ctx.db
      .query("wallets")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .unique();

    if (!wallet) throw new Error("wallet-not-found");

    const currentAvailableSantims =
      wallet.availableSantims ?? Math.round(wallet.availableBalance * 100);
    const currentLockedSantims =
      wallet.lockedSantims ?? Math.round(wallet.lockedBalance * 100);

    const refundAmount = Math.min(currentLockedSantims, args.stakeSantims);
    const newLockedSantims = currentLockedSantims - refundAmount;
    const newAvailableSantims = currentAvailableSantims + refundAmount;

    // 1. Post MATCH_UNLOCK to ledger
    await postLedgerEntry(ctx, {
      userId: args.userId,
      walletId: wallet._id,
      entryType: "match_unlock",
      amountSantims: refundAmount,
      balanceAfterSantims: newAvailableSantims,
      lockedAfterSantims: newLockedSantims,
      referenceType: "match",
      referenceId: args.referenceId,
      idempotencyKey: `match_unlock_${args.userId}_${args.referenceId}`,
      description: args.description,
      now,
    });

    // 2. Patch wallet
    await ctx.db.patch(wallet._id, {
      availableSantims: newAvailableSantims,
      availableBalance: newAvailableSantims / 100,
      lockedSantims: newLockedSantims,
      lockedBalance: newLockedSantims / 100,
      updatedAt: now,
    });

    return { success: true };
  },
});

/**
 * Settle match outcome with immutable ledger recording and platform commission.
 */
export const settleMatchEscrow = internalMutation({
  args: {
    gameId: v.id("games"),
    winnerId: v.optional(v.id("players")),
    loserId: v.optional(v.id("players")),
    isDraw: v.boolean(),
    stakeSantims: v.number(),
    commissionBasisPoints: v.number(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const game = await ctx.db.get(args.gameId);
    if (!game || game.escrowSettled) {
      return { success: true, alreadySettled: true };
    }

    if (args.isDraw) {
      // Draw: Refund both players
      if (game.whiteId) {
        await ctx.db.patch(game._id, { escrowSettled: true });
        // White refund
        const whiteWallet = await ctx.db
          .query("wallets")
          .withIndex("by_userId", (q) => q.eq("userId", game.whiteId!))
          .unique();
        if (whiteWallet) {
          const avail = whiteWallet.availableSantims ?? Math.round(whiteWallet.availableBalance * 100);
          const locked = whiteWallet.lockedSantims ?? Math.round(whiteWallet.lockedBalance * 100);
          const newAvail = avail + args.stakeSantims;
          const newLocked = Math.max(0, locked - args.stakeSantims);

          await postLedgerEntry(ctx, {
            userId: game.whiteId,
            walletId: whiteWallet._id,
            entryType: "match_unlock",
            amountSantims: args.stakeSantims,
            balanceAfterSantims: newAvail,
            lockedAfterSantims: newLocked,
            referenceType: "match",
            referenceId: String(game._id),
            idempotencyKey: `draw_refund_${game.whiteId}_${game._id}`,
            description: "Match draw refund",
            now,
          });

          await ctx.db.patch(whiteWallet._id, {
            availableSantims: newAvail,
            availableBalance: newAvail / 100,
            lockedSantims: newLocked,
            lockedBalance: newLocked / 100,
            updatedAt: now,
          });
        }
      }

      if (game.blackId) {
        const blackWallet = await ctx.db
          .query("wallets")
          .withIndex("by_userId", (q) => q.eq("userId", game.blackId!))
          .unique();
        if (blackWallet) {
          const avail = blackWallet.availableSantims ?? Math.round(blackWallet.availableBalance * 100);
          const locked = blackWallet.lockedSantims ?? Math.round(blackWallet.lockedBalance * 100);
          const newAvail = avail + args.stakeSantims;
          const newLocked = Math.max(0, locked - args.stakeSantims);

          await postLedgerEntry(ctx, {
            userId: game.blackId,
            walletId: blackWallet._id,
            entryType: "match_unlock",
            amountSantims: args.stakeSantims,
            balanceAfterSantims: newAvail,
            lockedAfterSantims: newLocked,
            referenceType: "match",
            referenceId: String(game._id),
            idempotencyKey: `draw_refund_${game.blackId}_${game._id}`,
            description: "Match draw refund",
            now,
          });

          await ctx.db.patch(blackWallet._id, {
            availableSantims: newAvail,
            availableBalance: newAvail / 100,
            lockedSantims: newLocked,
            lockedBalance: newLocked / 100,
            updatedAt: now,
          });
        }
      }

      await ctx.db.patch(game._id, { escrowSettled: true });
      return { success: true };
    }

    // Decisive winner
    if (!args.winnerId || !args.loserId) {
      await ctx.db.patch(game._id, { escrowSettled: true });
      return { success: true };
    }

    const { grossPotSantims, commissionSantims, payoutSantims } =
      calculateMatchSettlement(args.stakeSantims, args.commissionBasisPoints);

    // 1. Settle Loser (clear locked stake)
    const loserWallet = await ctx.db
      .query("wallets")
      .withIndex("by_userId", (q) => q.eq("userId", args.loserId!))
      .unique();

    if (loserWallet) {
      const avail = loserWallet.availableSantims ?? Math.round(loserWallet.availableBalance * 100);
      const locked = loserWallet.lockedSantims ?? Math.round(loserWallet.lockedBalance * 100);
      const newLocked = Math.max(0, locked - args.stakeSantims);

      await postLedgerEntry(ctx, {
        userId: args.loserId,
        walletId: loserWallet._id,
        entryType: "match_loss",
        amountSantims: args.stakeSantims,
        balanceAfterSantims: avail,
        lockedAfterSantims: newLocked,
        referenceType: "match",
        referenceId: String(game._id),
        idempotencyKey: `match_loss_${args.loserId}_${game._id}`,
        description: `Match loss stake deduction (${args.stakeSantims / 100} ETB)`,
        now,
      });

      await ctx.db.patch(loserWallet._id, {
        lockedSantims: newLocked,
        lockedBalance: newLocked / 100,
        totalLost: loserWallet.totalLost + args.stakeSantims / 100,
        updatedAt: now,
      });
    }

    // 2. Settle Winner (unlock stake + credit net payout)
    const winnerWallet = await ctx.db
      .query("wallets")
      .withIndex("by_userId", (q) => q.eq("userId", args.winnerId!))
      .unique();

    if (winnerWallet) {
      const avail = winnerWallet.availableSantims ?? Math.round(winnerWallet.availableBalance * 100);
      const locked = winnerWallet.lockedSantims ?? Math.round(winnerWallet.lockedBalance * 100);
      const newLocked = Math.max(0, locked - args.stakeSantims);
      const newAvail = avail + payoutSantims;

      await postLedgerEntry(ctx, {
        userId: args.winnerId,
        walletId: winnerWallet._id,
        entryType: "match_payout",
        amountSantims: payoutSantims,
        balanceAfterSantims: newAvail,
        lockedAfterSantims: newLocked,
        referenceType: "match",
        referenceId: String(game._id),
        idempotencyKey: `match_payout_${args.winnerId}_${game._id}`,
        description: `Match victory payout (${payoutSantims / 100} ETB net)`,
        now,
      });

      await ctx.db.patch(winnerWallet._id, {
        availableSantims: newAvail,
        availableBalance: newAvail / 100,
        lockedSantims: newLocked,
        lockedBalance: newLocked / 100,
        totalWon: winnerWallet.totalWon + payoutSantims / 100,
        updatedAt: now,
      });
    }

    // 3. Record platform commission
    if (commissionSantims > 0) {
      await ctx.db.insert("commissions", {
        gameId: game._id,
        amount: commissionSantims / 100,
        transferred: false,
        createdAt: now,
      });

      // Find admin to credit commission
      const adminClerkId = process.env.ADMIN_CLERK_ID;
      let adminPlayer = adminClerkId
        ? await ctx.db
            .query("players")
            .withIndex("by_clerkId", (q) => q.eq("clerkId", adminClerkId))
            .unique()
        : null;

      if (!adminPlayer) {
        adminPlayer = await ctx.db.query("players").order("asc").first();
      }

      if (adminPlayer) {
        let adminWallet = await ctx.db
          .query("wallets")
          .withIndex("by_userId", (q) => q.eq("userId", adminPlayer._id))
          .unique();

        if (adminWallet) {
          const avail = adminWallet.availableSantims ?? Math.round(adminWallet.availableBalance * 100);
          const locked = adminWallet.lockedSantims ?? Math.round(adminWallet.lockedBalance * 100);
          const newAvail = avail + commissionSantims;

          await postLedgerEntry(ctx, {
            userId: adminPlayer._id,
            walletId: adminWallet._id,
            entryType: "platform_commission",
            amountSantims: commissionSantims,
            balanceAfterSantims: newAvail,
            lockedAfterSantims: locked,
            referenceType: "match",
            referenceId: String(game._id),
            idempotencyKey: `commission_${game._id}`,
            description: `Platform commission for game ${game._id} (${commissionSantims / 100} ETB)`,
            now,
          });

          await ctx.db.patch(adminWallet._id, {
            availableSantims: newAvail,
            availableBalance: newAvail / 100,
            updatedAt: now,
          });
        }
      }
    }

    await ctx.db.patch(game._id, { escrowSettled: true });
    return { success: true };
  },
});
