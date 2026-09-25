// convex/chapaPayments.ts — Chapa payment records (server-side only mutations)
import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { optionalPlayer, requirePlayer } from "./lib/auth";
import { vChapaPaymentStatus } from "./lib/validators";

/**
 * Create a pending Chapa payment record. Called from the Next.js API route
 * BEFORE redirecting to Chapa checkout. The txRef, amount, and currency are
 * all server-determined — never client-supplied.
 */
export const createPending = internalMutation({
  args: {
    userId: v.id("players"),
    txRef: v.string(),
    amount: v.number(),
    currency: v.string(),
    checkoutUrl: v.optional(v.string()),
    email: v.optional(v.string()),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("chapaPayments", {
      userId: args.userId,
      txRef: args.txRef,
      amount: args.amount,
      currency: args.currency,
      provider: "chapa",
      status: "pending",
      checkoutUrl: args.checkoutUrl,
      email: args.email,
      firstName: args.firstName,
      lastName: args.lastName,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/**
 * Finalize a payment after server-side verification. Idempotent: if the
 * payment is already `success`, re-processing is a no-op.
 *
 * This is an `internalMutation` — only callable from Convex actions or
 * the scheduler, NEVER from the client.
 */
export const finalize = internalMutation({
  args: {
    txRef: v.string(),
    status: vChapaPaymentStatus,
    chapaRef: v.optional(v.string()),
    verifiedAmount: v.optional(v.number()),
    verifiedCurrency: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const payment = await ctx.db
      .query("chapaPayments")
      .withIndex("by_txRef", (q) => q.eq("txRef", args.txRef))
      .unique();

    if (!payment) throw new Error("chapa-payment-not-found");

    // Idempotency: already finalized — skip
    if (payment.status === "success") return payment._id;
    if (payment.status === "failed") return payment._id;

    const now = Date.now();

    // Amount/currency mismatch guard
    if (args.status === "success") {
      if (
        args.verifiedAmount !== undefined &&
        args.verifiedAmount !== payment.amount
      ) {
        await ctx.db.patch(payment._id, {
          status: "failed",
          metadata: JSON.stringify({
            error: "amount-mismatch",
            expected: payment.amount,
            received: args.verifiedAmount,
          }),
          updatedAt: now,
        });
        return payment._id;
      }
      if (
        args.verifiedCurrency !== undefined &&
        args.verifiedCurrency !== payment.currency
      ) {
        await ctx.db.patch(payment._id, {
          status: "failed",
          metadata: JSON.stringify({
            error: "currency-mismatch",
            expected: payment.currency,
            received: args.verifiedCurrency,
          }),
          updatedAt: now,
        });
        return payment._id;
      }
    }

    await ctx.db.patch(payment._id, {
      status: args.status,
      chapaRef: args.chapaRef ?? payment.chapaRef,
      verifiedAt: args.status === "success" ? now : undefined,
      updatedAt: now,
    });

    // Credit wallet on success
    if (args.status === "success") {
      const wallet = await ctx.db
        .query("wallets")
        .withIndex("by_userId", (q) => q.eq("userId", payment.userId))
        .unique();

      if (wallet) {
        await ctx.db.patch(wallet._id, {
          availableBalance: wallet.availableBalance + payment.amount,
          totalDeposited: wallet.totalDeposited + payment.amount,
          updatedAt: now,
        });
      } else {
        await ctx.db.insert("wallets", {
          userId: payment.userId,
          availableBalance: payment.amount,
          lockedBalance: 0,
          totalDeposited: payment.amount,
          totalWithdrawn: 0,
          totalWon: 0,
          totalLost: 0,
          createdAt: now,
          updatedAt: now,
        });
      }
    }

    return payment._id;
  },
});

/** Get a single payment by txRef (used by verification routes). */
export const getByTxRef = internalMutation({
  args: { txRef: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("chapaPayments")
      .withIndex("by_txRef", (q) => q.eq("txRef", args.txRef))
      .unique();
  },
});

/**
 * Create a pending payment — callable from the Next.js API route via
 * ConvexHttpClient with the user's Convex auth token set.
 * Security: requirePlayer ensures only authenticated users can create payments.
 * The amount/currency are server-controlled by the API route.
 */
export const createPendingFromServer = mutation({
  args: {
    txRef: v.string(),
    amount: v.number(),
    currency: v.string(),
    checkoutUrl: v.optional(v.string()),
    email: v.optional(v.string()),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const player = await requirePlayer(ctx);
    const now = Date.now();

    // Prevent duplicate tx_ref
    const existing = await ctx.db
      .query("chapaPayments")
      .withIndex("by_txRef", (q) => q.eq("txRef", args.txRef))
      .unique();
    if (existing) throw new Error("duplicate-tx-ref");

    return await ctx.db.insert("chapaPayments", {
      userId: player._id,
      txRef: args.txRef,
      amount: args.amount,
      currency: args.currency,
      provider: "chapa",
      status: "pending",
      checkoutUrl: args.checkoutUrl,
      email: args.email,
      firstName: args.firstName,
      lastName: args.lastName,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/**
 * Finalize a payment — callable from the verify API route via
 * ConvexHttpClient with the user's Convex auth token.
 * Security: requirePlayer ensures only authenticated users can trigger,
 * and the handler verifies the payment belongs to that user.
 */
export const finalizeFromServer = mutation({
  args: {
    txRef: v.string(),
    status: vChapaPaymentStatus,
    chapaRef: v.optional(v.string()),
    verifiedAmount: v.optional(v.number()),
    verifiedCurrency: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const player = await requirePlayer(ctx);
    const payment = await ctx.db
      .query("chapaPayments")
      .withIndex("by_txRef", (q) => q.eq("txRef", args.txRef))
      .unique();

    if (!payment) throw new Error("chapa-payment-not-found");
    if (payment.userId !== player._id) throw new Error("unauthorized-payment");

    // Idempotency
    if (payment.status === "success" || payment.status === "failed") {
      return payment._id;
    }

    const now = Date.now();

    if (args.status === "success") {
      if (args.verifiedAmount !== undefined && args.verifiedAmount !== payment.amount) {
        await ctx.db.patch(payment._id, {
          status: "failed",
          metadata: JSON.stringify({ error: "amount-mismatch", expected: payment.amount, received: args.verifiedAmount }),
          updatedAt: now,
        });
        return payment._id;
      }
      if (args.verifiedCurrency !== undefined && args.verifiedCurrency !== payment.currency) {
        await ctx.db.patch(payment._id, {
          status: "failed",
          metadata: JSON.stringify({ error: "currency-mismatch", expected: payment.currency, received: args.verifiedCurrency }),
          updatedAt: now,
        });
        return payment._id;
      }
    }

    await ctx.db.patch(payment._id, {
      status: args.status,
      chapaRef: args.chapaRef ?? payment.chapaRef,
      verifiedAt: args.status === "success" ? now : undefined,
      updatedAt: now,
    });

    // Credit wallet on success
    if (args.status === "success") {
      const wallet = await ctx.db
        .query("wallets")
        .withIndex("by_userId", (q) => q.eq("userId", payment.userId))
        .unique();

      if (wallet) {
        await ctx.db.patch(wallet._id, {
          availableBalance: wallet.availableBalance + payment.amount,
          totalDeposited: wallet.totalDeposited + payment.amount,
          updatedAt: now,
        });
      } else {
        await ctx.db.insert("wallets", {
          userId: payment.userId,
          availableBalance: payment.amount,
          lockedBalance: 0,
          totalDeposited: payment.amount,
          totalWithdrawn: 0,
          totalWon: 0,
          totalLost: 0,
          createdAt: now,
          updatedAt: now,
        });
      }
    }

    return payment._id;
  },
});

/**
 * Finalize a payment from Chapa callback/webhook — no user auth session.
 * Security: validates the CHAPA_WEBHOOK_SECRET env var against the provided
 * webhookSecret argument.
 */
export const finalizeFromCallback = mutation({
  args: {
    txRef: v.string(),
    status: vChapaPaymentStatus,
    chapaRef: v.optional(v.string()),
    verifiedAmount: v.optional(v.number()),
    verifiedCurrency: v.optional(v.string()),
    webhookSecret: v.string(),
  },
  handler: async (ctx, args) => {
    const expectedSecret = process.env.CHAPA_WEBHOOK_SECRET;
    if (!expectedSecret || args.webhookSecret !== expectedSecret) {
      throw new Error("unauthorized-webhook");
    }

    const payment = await ctx.db
      .query("chapaPayments")
      .withIndex("by_txRef", (q) => q.eq("txRef", args.txRef))
      .unique();

    if (!payment) throw new Error("chapa-payment-not-found");

    // Idempotency
    if (payment.status === "success" || payment.status === "failed") {
      return payment._id;
    }

    if (args.status !== "success" && args.status !== "failed") {
      return payment._id;
    }

    const now = Date.now();

    if (args.status === "success") {
      if (args.verifiedAmount !== undefined && args.verifiedAmount !== payment.amount) {
        await ctx.db.patch(payment._id, {
          status: "failed",
          metadata: JSON.stringify({ error: "amount-mismatch", expected: payment.amount, received: args.verifiedAmount }),
          updatedAt: now,
        });
        return payment._id;
      }
      if (args.verifiedCurrency !== undefined && args.verifiedCurrency !== payment.currency) {
        await ctx.db.patch(payment._id, {
          status: "failed",
          metadata: JSON.stringify({ error: "currency-mismatch", expected: payment.currency, received: args.verifiedCurrency }),
          updatedAt: now,
        });
        return payment._id;
      }
    }

    await ctx.db.patch(payment._id, {
      status: args.status,
      chapaRef: args.chapaRef ?? payment.chapaRef,
      verifiedAt: args.status === "success" ? now : undefined,
      updatedAt: now,
    });

    if (args.status === "success") {
      const wallet = await ctx.db
        .query("wallets")
        .withIndex("by_userId", (q) => q.eq("userId", payment.userId))
        .unique();

      if (wallet) {
        await ctx.db.patch(wallet._id, {
          availableBalance: wallet.availableBalance + payment.amount,
          totalDeposited: wallet.totalDeposited + payment.amount,
          updatedAt: now,
        });
      } else {
        await ctx.db.insert("wallets", {
          userId: payment.userId,
          availableBalance: payment.amount,
          lockedBalance: 0,
          totalDeposited: payment.amount,
          totalWithdrawn: 0,
          totalWon: 0,
          totalLost: 0,
          createdAt: now,
          updatedAt: now,
        });
      }
    }

    return payment._id;
  },
});

/** User's own Chapa payment history — safe to expose. */
export const myPayments = query({
  args: {},
  handler: async (ctx) => {
    const player = await optionalPlayer(ctx);
    if (!player) return [];
    return await ctx.db
      .query("chapaPayments")
      .withIndex("by_userId", (q) => q.eq("userId", player._id))
      .order("desc")
      .take(50);
  },
});

/** Get single payment by txRef — for the return page verification display. */
export const getMyPaymentByTxRef = query({
  args: { txRef: v.string() },
  handler: async (ctx, args) => {
    const player = await optionalPlayer(ctx);
    if (!player) return null;
    const payment = await ctx.db
      .query("chapaPayments")
      .withIndex("by_txRef", (q) => q.eq("txRef", args.txRef))
      .first();

    if (!payment) return null;
    // Only return the payment if it belongs to the current user
    if (payment.userId !== player._id) return null;
    return payment;
  },
});
