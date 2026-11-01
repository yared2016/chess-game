// convex/financial/deposits.ts — Financial deposits management
import { v } from "convex/values";
import { internalMutation, mutation, query } from "../_generated/server";
import { optionalPlayer, requirePlayer, requireOwner, requireAdminPermission } from "../lib/auth";
import { vFeeMode, vFinancialDepositStatus } from "../lib/validators";
import { postLedgerEntry } from "../ledger";
import { createNotification } from "../notifications";
import { withRateLimit } from "../rateLimit";
import { postJournalTransaction, type JournalPostingInput } from "./ledger";
import { assertChannelActive } from "./channels";
import {
  vDepositTier,
  vCanonicalDepositStatus,
  vPaymentChannelKey,
} from "./validators";

/**
 * Create a pending deposit record. Called by the deposit initialization API route.
 */
export const createPendingDeposit = mutation({
  args: {
    clerkId: v.optional(v.string()),
    internalTxRef: v.string(),
    requestedCreditSantims: v.number(),
    providerFeeSantims: v.number(),
    grossAmountSantims: v.number(),
    chapaServiceFeeSantims: v.optional(v.number()),
    chapaVatSantims: v.optional(v.number()),
    effectiveRateBps: v.optional(v.number()),
    provider: v.string(), // "chapa"
    feeMode: vFeeMode,
    checkoutUrl: v.optional(v.string()),
    email: v.optional(v.string()),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.clerkId) {
      await withRateLimit(ctx, args.clerkId, "deposit", { limit: 5, windowMs: 60000 });
    }
    
    let player = await optionalPlayer(ctx);
    if (!player && args.clerkId) {
      player = await ctx.db
        .query("players")
        .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId!))
        .first();
    }
    if (!player && args.clerkId) {
      const now = Date.now();
      const username = args.firstName
        ? `${args.firstName.toLowerCase()}_${Date.now().toString(36).slice(-4)}`
        : `player_${args.clerkId.slice(-6)}`;
      const playerId = await ctx.db.insert("players", {
        clerkId: args.clerkId,
        tokenIdentifier: args.clerkId,
        username,
        usernameLower: username.toLowerCase(),
        avatarUrl: "",
        rating: 1200,
        ratingHuman: 1200,
        ratingAi: 1200,
        wins: 0,
        losses: 0,
        draws: 0,
        roomPreset: "study",
        boardFlipEnabled: true,
        boardView: "3d",
        qualityTier: "auto",
        postFxEnabled: false,
        email: args.email,
        createdAt: now,
        updatedAt: now,
      });
      player = await ctx.db.get(playerId);
    }
    if (!player) throw new Error("player-not-found");
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
      chapaServiceFeeSantims: args.chapaServiceFeeSantims,
      chapaVatSantims: args.chapaVatSantims,
      effectiveRateBps: args.effectiveRateBps,
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

    // 2. Post DEPOSIT_FEE for accounting audit (2.6% includes VAT)
    if (deposit.providerFeeSantims > 0) {
      const feeRateStr = ((deposit.effectiveRateBps ?? 260) / 100).toFixed(1);
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
        description: `Chapa fee (${feeRateStr}% incl. VAT) for ${deposit.internalTxRef} (${deposit.providerFeeSantims / 100} ETB)`,
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
    const player = await optionalPlayer(ctx);
    if (!player) return [];
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
  args: { internalTxRef: v.string(), clerkId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    let player = await optionalPlayer(ctx);
    if (!player && args.clerkId) {
      player = await ctx.db
        .query("players")
        .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId!))
        .first();
    }
    const deposit = await ctx.db
      .query("financialDeposits")
      .withIndex("by_internalTxRef", (q) => q.eq("internalTxRef", args.internalTxRef))
      .unique();

    if (!deposit) return null;
    if (player && deposit.userId !== player._id) return null;
    return deposit;
  },
});

// =========================================================================
// v4.2.7-PROD CANONICAL 4-TIER DEPOSIT ENGINE (ACCOUNTS 1030, 2010, 1050)
// =========================================================================

/**
 * Tier 1: Initiates a canonical deposit request.
 * Holds state in 'tier1_initiated' and 'pending_verification'.
 */
export const initiateCanonicalDeposit = mutation({
  args: {
    paymentChannel: vPaymentChannelKey,
    paymentMethod: v.string(),
    externalReference: v.string(),
    requestedAmountSantims: v.int64(),
  },
  handler: async (ctx, args) => {
    const player = await requirePlayer(ctx);
    await assertChannelActive(ctx, args.paymentChannel, "inflow");

    if (args.requestedAmountSantims <= BigInt(0)) {
      throw new Error("ERR_INVALID_AMOUNT: Deposit amount must be positive.");
    }

    const now = Date.now();
    const depositId = `dep_${now}_${Math.random().toString(36).substring(2, 9)}`;
    const internalTxRef = `tx_${now}_${Math.random().toString(36).substring(2, 7)}`;

    await ctx.db.insert("depositRequests", {
      depositId,
      playerId: player._id,
      clerkId: player.clerkId,
      paymentChannel: args.paymentChannel,
      paymentMethod: args.paymentMethod,
      internalTxRef,
      externalReference: args.externalReference,
      requestedAmountSantims: args.requestedAmountSantims,
      creditedAmountSantims: args.requestedAmountSantims, // Zero platform markup
      providerFeeSantims: BigInt(0),
      tier: "tier1_initiated",
      status: "pending_verification",
      createdAt: now,
    });

    return { depositId, internalTxRef };
  },
});

/**
 * Tier 2: Verifies deposit via provider confirmation (Verify.et or Staff Admin).
 * Double-entry: Debit 1030 Provider Clearing, Credit 2010 Player Deposit Liabilities.
 * Also performs automatic offset if player has an outstanding Account 1050 Overdraft.
 */
export const creditVerifiedDepositTier2 = mutation({
  args: {
    depositId: v.string(),
    externalReference: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const isWebhook = identity === null && process.env.NODE_ENV !== "production";
    if (!isWebhook) {
      await requireAdminPermission(ctx, "approve_tier2_deposits");
    }

    const deposit = await ctx.db
      .query("depositRequests")
      .withIndex("by_depositId", (q) => q.eq("depositId", args.depositId))
      .unique();

    if (!deposit) {
      throw new Error("ERR_DEPOSIT_NOT_FOUND");
    }

    if (deposit.tier !== "tier1_initiated" || deposit.status !== "pending_verification") {
      return { success: true, alreadyCredited: true };
    }

    const now = Date.now();
    const creditedAmount = deposit.creditedAmountSantims;

    // Check if player has an outstanding Account 1050 Overdraft
    const balanceRecord = await ctx.db
      .query("playerBalances")
      .withIndex("by_playerId", (q) => q.eq("playerId", deposit.playerId))
      .unique();

    const currentOverdraft = balanceRecord?.overdraftSantims ?? BigInt(0);
    const postings: JournalPostingInput[] = [];

    // Debit Account 1030 (Provider Clearing) for the full incoming deposit
    postings.push({
      accountNumber: "1030",
      direction: "debit",
      amountSantims: creditedAmount,
    });

    if (currentOverdraft > BigInt(0)) {
      // Auto-repayment offset (RB-69.2)
      const offsetAmount = creditedAmount >= currentOverdraft ? currentOverdraft : creditedAmount;
      const netAvailableCredit = creditedAmount - offsetAmount;

      if (netAvailableCredit > BigInt(0)) {
        postings.push({
          accountNumber: "2010",
          direction: "credit",
          amountSantims: netAvailableCredit,
          playerId: deposit.playerId,
        });
      }

      postings.push({
        accountNumber: "1050",
        direction: "credit",
        amountSantims: offsetAmount,
        playerId: deposit.playerId,
      });
    } else {
      // Standard: 100% credited to Available Player Deposits (Account 2010)
      postings.push({
        accountNumber: "2010",
        direction: "credit",
        amountSantims: creditedAmount,
        playerId: deposit.playerId,
      });
    }

    // Atomic double-entry journal posting
    await postJournalTransaction(ctx, {
      idempotencyKey: `dep_t2_${deposit.depositId}`,
      transactionType: "deposit_tier2",
      description: `Tier 2 Verified Deposit via ${deposit.paymentChannel}`,
      referenceType: "deposit",
      referenceId: deposit.depositId,
      postings,
      postedBy: identity?.subject ?? "system_verify_et",
      now,
    });

    await ctx.db.patch(deposit._id, {
      tier: "tier2_verified_clearing",
      status: "verified_clearing",
      verifiedAt: now,
      externalReference: args.externalReference ?? deposit.externalReference,
    });

    return { success: true, tier: "tier2_verified_clearing" };
  },
});

/**
 * Tier 3: Bank statement settlement.
 * Double-entry: Debit 1010 Operating Cash (or 1020 Telebirr), Credit 1030 Provider Clearing.
 */
export const settleDepositToBankTier3 = mutation({
  args: {
    depositId: v.string(),
    bankStatementReference: v.string(),
  },
  handler: async (ctx, args) => {
    await requireAdminPermission(ctx, "view_ledger");

    const deposit = await ctx.db
      .query("depositRequests")
      .withIndex("by_depositId", (q) => q.eq("depositId", args.depositId))
      .unique();

    if (!deposit) throw new Error("ERR_DEPOSIT_NOT_FOUND");
    if (deposit.tier !== "tier2_verified_clearing") {
      throw new Error(`ERR_INVALID_TIER: Deposit must be in tier2_verified_clearing to settle to bank.`);
    }

    const now = Date.now();
    const destinationAccount = deposit.paymentChannel === "telebirr" ? "1020" : "1010";

    await postJournalTransaction(ctx, {
      idempotencyKey: `dep_t3_${deposit.depositId}`,
      transactionType: "deposit_tier3",
      description: `Tier 3 Bank Settlement - ${args.bankStatementReference}`,
      referenceType: "deposit",
      referenceId: deposit.depositId,
      postings: [
        {
          accountNumber: destinationAccount,
          direction: "debit",
          amountSantims: deposit.creditedAmountSantims,
        },
        {
          accountNumber: "1030",
          direction: "credit",
          amountSantims: deposit.creditedAmountSantims,
        },
      ],
      postedBy: (await ctx.auth.getUserIdentity())?.subject ?? "admin",
      now,
    });

    await ctx.db.patch(deposit._id, {
      tier: "tier3_bank_settled",
      status: "bank_settled",
      settledAt: now,
    });

    return { success: true, tier: "tier3_bank_settled" };
  },
});

/**
 * Chargeback handling: caps deduction at available balance (Account 2010),
 * and routes remaining deficit to Account 1050 (Player Overdrafts Receivable).
 */
export const processDepositChargeback = mutation({
  args: {
    depositId: v.string(),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    await requireOwner(ctx); // Root authority required for chargeback processing

    const deposit = await ctx.db
      .query("depositRequests")
      .withIndex("by_depositId", (q) => q.eq("depositId", args.depositId))
      .unique();

    if (!deposit) throw new Error("ERR_DEPOSIT_NOT_FOUND");
    if (deposit.status === "charged_back") {
      throw new Error("ERR_ALREADY_CHARGED_BACK");
    }

    const now = Date.now();
    const depositAmount = deposit.creditedAmountSantims;

    const balanceRecord = await ctx.db
      .query("playerBalances")
      .withIndex("by_playerId", (q) => q.eq("playerId", deposit.playerId))
      .unique();

    const available = balanceRecord?.availableSantims ?? BigInt(0);

    // Negative balance prevention: deduct only up to available balance
    const deductAvailable = available >= depositAmount ? depositAmount : available;
    const overdraftDeficit = depositAmount - deductAvailable;

    const sourceAccount = deposit.tier === "tier3_bank_settled"
      ? (deposit.paymentChannel === "telebirr" ? "1020" : "1010")
      : "1030";

    const postings: JournalPostingInput[] = [];

    if (deductAvailable > BigInt(0)) {
      postings.push({
        accountNumber: "2010",
        direction: "debit",
        amountSantims: deductAvailable,
        playerId: deposit.playerId,
      });
    }

    if (overdraftDeficit > BigInt(0)) {
      postings.push({
        accountNumber: "1050",
        direction: "debit",
        amountSantims: overdraftDeficit,
        playerId: deposit.playerId,
      });
    }

    postings.push({
      accountNumber: sourceAccount,
      direction: "credit",
      amountSantims: depositAmount,
    });

    await postJournalTransaction(ctx, {
      idempotencyKey: `dep_cb_${deposit.depositId}_${now}`,
      transactionType: overdraftDeficit > BigInt(0) ? "deposit_chargeback_1050" : "deposit_reversal",
      description: `Deposit Chargeback: ${args.reason}`,
      referenceType: "deposit",
      referenceId: deposit.depositId,
      postings,
      postedBy: (await ctx.auth.getUserIdentity())?.subject ?? "owner",
      now,
    });

    await ctx.db.patch(deposit._id, {
      status: "charged_back",
    });

    return {
      success: true,
      deductedFromAvailable: deductAvailable,
      overdraftIncurred: overdraftDeficit,
    };
  },
});

/**
 * Write off uncollectible player overdraft from Account 1050 to Account 5030.
 * Strictly Owner-only (OD-07).
 */
export const writeOffOverdraft5030 = mutation({
  args: {
    playerId: v.id("players"),
    amountSantims: v.int64(),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    await requireOwner(ctx);

    const balanceRecord = await ctx.db
      .query("playerBalances")
      .withIndex("by_playerId", (q) => q.eq("playerId", args.playerId))
      .unique();

    if (!balanceRecord || balanceRecord.overdraftSantims <= BigInt(0)) {
      throw new Error("ERR_NO_OVERDRAFT_TO_WRITEOFF");
    }

    if (args.amountSantims > balanceRecord.overdraftSantims) {
      throw new Error("ERR_WRITEOFF_EXCEEDS_OVERDRAFT");
    }

    const now = Date.now();

    await postJournalTransaction(ctx, {
      idempotencyKey: `wo_1050_${args.playerId}_${now}`,
      transactionType: "overdraft_writeoff_5030",
      description: `Owner Overdraft Write-Off: ${args.reason}`,
      referenceType: "overdraft_writeoff",
      referenceId: balanceRecord._id,
      postings: [
        {
          accountNumber: "5030",
          direction: "debit",
          amountSantims: args.amountSantims,
        },
        {
          accountNumber: "1050",
          direction: "credit",
          amountSantims: args.amountSantims,
          playerId: args.playerId,
        },
      ],
      postedBy: (await ctx.auth.getUserIdentity())?.subject ?? "owner",
      now,
    });

    return { success: true, writtenOffSantims: args.amountSantims };
  },
});
