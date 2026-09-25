// convex/financial/deposits.ts — Financial deposits management
import { v } from "convex/values";
import { internalMutation, mutation, query } from "../_generated/server";
import { requirePlayer } from "../lib/auth";
import { vFeeMode, vFinancialDepositStatus } from "../lib/validators";
import { postLedgerEntry } from "../ledger";
import { createNotification } from "../notifications";

/**
 * Create a pending deposit record. Called by the deposit initialization API route.
 */
export const createPendingDeposit = mutation({
  args: {
    internalTxRef: v.string(),
    requestedCreditSantims: v.number(),
    providerFeeSantims: v.number(),
    grossAmountSantims: v.number(),
    provider: v.string(), // "chapa"
    feeMode: vFeeMode,
    checkoutUrl: v.optional(v.string()),
    email: v.optional(v.string()),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const player = await requirePlayer(ctx);
    const now = Date.now();

    // Check duplicate internalTxRef
    const existing = await ctx.db
      .query("financialDeposits")
      .withIndex("by_internalTxRef", (q) => q.eq("internalTxRef", args.internalTxRef))
      .unique();

    if (existing) {
      return existing._id;
    }

    // Ensure wallet exists
    let wallet = await ctx.db
      .query("wallets")
      .withIndex("by_userId", (q) => q.eq("userId", player._id))
      .unique();

    if (!wallet) {
      const walletId = await ctx.db.insert("wallets", {
        userId: player._id,
        availableBalance: 0,
        lockedBalance: 0,
        availableSantims: 0,
        lockedSantims: 0,
        status: "active",
        totalDeposited: 0,
        totalWithdrawn: 0,
        totalWon: 0,
        totalLost: 0,
        createdAt: now,
        updatedAt: now,
      });
      wallet = (await ctx.db.get(walletId))!;
    }

    return await ctx.db.insert("financialDeposits", {
      userId: player._id,
      walletId: wallet._id,
      provider: args.provider,
      internalTxRef: args.internalTxRef,
      requestedCreditSantims: args.requestedCreditSantims,
      providerFeeSantims: args.providerFeeSantims,
      grossAmountSantims: args.grossAmountSantims,
      currency: "ETB",
      status: "pending_provider",
      feeMode: args.feeMode,
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
 * Credit a verified deposit to the user's wallet.
 * Idempotent: safe against duplicate webhook deliveries and race conditions.
 */
export const creditVerifiedDeposit = mutation({
  args: {
    internalTxRef: v.string(),
    providerTxId: v.optional(v.string()),
    verifiedAmountSantims: v.number(),
    verifiedCurrency: v.string(),
    webhookSecret: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const deposit = await ctx.db
      .query("financialDeposits")
      .withIndex("by_internalTxRef", (q) => q.eq("internalTxRef", args.internalTxRef))
      .unique();

    if (!deposit) throw new Error("deposit-record-not-found");

    // Idempotency: If already credited, skip further execution
    if (deposit.status === "credited") {
      return { success: true, alreadyCredited: true };
    }

    // Verify gross payment amount matches expected
    if (args.verifiedAmountSantims !== deposit.grossAmountSantims) {
      await ctx.db.patch(deposit._id, {
        status: "failed",
        failureReason: `Amount mismatch: expected ${deposit.grossAmountSantims} santims, got ${args.verifiedAmountSantims}`,
        updatedAt: now,
      });
      throw new Error("deposit-amount-mismatch");
    }

    // Verify currency
    if (args.verifiedCurrency.toUpperCase() !== "ETB") {
      await ctx.db.patch(deposit._id, {
        status: "failed",
        failureReason: `Currency mismatch: expected ETB, got ${args.verifiedCurrency}`,
        updatedAt: now,
      });
      throw new Error("deposit-currency-mismatch");
    }

    const wallet = await ctx.db.get(deposit.walletId);
    if (!wallet) throw new Error("wallet-not-found");

    if (wallet.status === "frozen") {
      await ctx.db.patch(deposit._id, {
        status: "failed",
        failureReason: "Wallet is frozen by administrator",
        updatedAt: now,
      });
      throw new Error("wallet-is-frozen");
    }

    // Derive current santims safely
    const currentAvailableSantims =
      wallet.availableSantims ?? Math.round(wallet.availableBalance * 100);
    const currentLockedSantims =
      wallet.lockedSantims ?? Math.round(wallet.lockedBalance * 100);

    const newAvailableSantims = currentAvailableSantims + deposit.requestedCreditSantims;
    const newAvailableBalance = newAvailableSantims / 100;
    const addedDepositedEtb = deposit.requestedCreditSantims / 100;

    // 1. Post DEPOSIT_CREDIT to ledger
    await postLedgerEntry(ctx, {
      userId: deposit.userId,
      walletId: wallet._id,
      entryType: "deposit_credit",
      amountSantims: deposit.requestedCreditSantims,
      balanceAfterSantims: newAvailableSantims,
      lockedAfterSantims: currentLockedSantims,
      referenceType: "deposit",
      referenceId: deposit.internalTxRef,
      idempotencyKey: `deposit_credit_${deposit.internalTxRef}`,
      description: `Deposit via ${deposit.provider.toUpperCase()} (${deposit.requestedCreditSantims / 100} ETB)`,
      now,
    });

    // 2. Post DEPOSIT_FEE for accounting audit
    if (deposit.providerFeeSantims > 0) {
      await postLedgerEntry(ctx, {
        userId: deposit.userId,
        walletId: wallet._id,
        entryType: "deposit_fee",
        amountSantims: deposit.providerFeeSantims,
        balanceAfterSantims: newAvailableSantims,
        lockedAfterSantims: currentLockedSantims,
        referenceType: "deposit",
        referenceId: deposit.internalTxRef,
        idempotencyKey: `deposit_fee_${deposit.internalTxRef}`,
        description: `Provider fee for ${deposit.internalTxRef} (${deposit.providerFeeSantims / 100} ETB)`,
        now,
      });
    }

    // 3. Atomically patch wallet balance
    await ctx.db.patch(wallet._id, {
      availableSantims: newAvailableSantims,
      availableBalance: newAvailableBalance,
      totalDeposited: wallet.totalDeposited + addedDepositedEtb,
      updatedAt: now,
    });

    // 4. Mark deposit record credited
    await ctx.db.patch(deposit._id, {
      status: "credited",
      providerTxId: args.providerTxId ?? deposit.providerTxId,
      verifiedAt: now,
      updatedAt: now,
    });

    // 5. Trigger notification
    await createNotification(ctx, {
      userId: deposit.userId,
      type: "chapa_payment_verified",
      title: "Deposit Credited! 💳",
      message: `${(deposit.requestedCreditSantims / 100).toFixed(2)} ETB has been credited to your chess wallet.`,
      link: "/wallet",
    });

    return { success: true, alreadyCredited: false };
  },
});

/**
 * User's own deposit history.
 */
export const myDeposits = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const player = await requirePlayer(ctx);
    const limit = args.limit ?? 20;

    return await ctx.db
      .query("financialDeposits")
      .withIndex("by_userId_and_status", (q) => q.eq("userId", player._id))
      .order("desc")
      .take(limit);
  },
});

/**
 * Fetch a single deposit by internalTxRef (for return page display).
 */
export const getByRef = query({
  args: { internalTxRef: v.string() },
  handler: async (ctx, args) => {
    const player = await requirePlayer(ctx);
    const deposit = await ctx.db
      .query("financialDeposits")
      .withIndex("by_internalTxRef", (q) => q.eq("internalTxRef", args.internalTxRef))
      .unique();

    if (!deposit || deposit.userId !== player._id) return null;
    return deposit;
  },
});
