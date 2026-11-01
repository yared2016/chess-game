// convex/financial/ownerPayouts.ts
// Canonical Owner Payout & Distribution Governance (Abay Chess v4.2.7-PROD Phase 7)

import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { requireOwner, requireAdmin } from "../lib/auth";
import { calculateSolvencyMetrics } from "./solvency";
import { postJournalTransaction } from "./ledger";
import { assertChannelActive } from "./channels";

/**
 * TSK-704: Authoritative Owner Payout Request Mutation.
 * Restricts withdrawals strictly to Distributable Cap and enforces 105% post-payout solvency.
 * Owner-only authentication verified strictly via Clerk Subject ID (RB-29).
 */
export const requestOwnerPayoutCanonical = mutation({
  args: {
    requestedAmountSantims: v.int64(),
    destinationAccount: v.string(),
  },
  handler: async (ctx, args) => {
    const { identity } = await requireOwner(ctx);
    const now = Date.now();

    if (args.requestedAmountSantims <= BigInt(0)) {
      throw new Error(`ERR_INVALID_AMOUNT: Requested payout amount must be greater than zero santims.`);
    }

    // 1. Calculate live solvency metrics
    const metrics = await calculateSolvencyMetrics(ctx);

    // 2. Active suspense discrepancy circuit breaker (Section 8.5)
    if (metrics.suspenseDiscrepancyAbsSantims > BigInt(0)) {
      throw new Error(
        `ERR_ACTIVE_SUSPENSE_DISCREPANCY: Active suspense discrepancy in Account 3999 (${metrics.suspenseDiscrepancySantims} santims) blocks all Owner distributions until reconciled.`
      );
    }

    // 3. Solvency ratio 105% threshold (RB-21)
    if (metrics.solvencyRatioBps < 10500) {
      throw new Error(
        `ERR_SOLVENCY_WARNING: Owner payouts are 100% blocked when solvency ratio is below 105% (current: ${(metrics.solvencyRatioBps / 100).toFixed(2)}%).`
      );
    }

    // 4. Distributable Cash Cap enforcement (RB-22)
    if (args.requestedAmountSantims > metrics.distributableCapSantims) {
      throw new Error(
        `ERR_DISTRIBUTABLE_CAP_EXCEEDED: Requested payout (${args.requestedAmountSantims} santims) exceeds allowable Distributable Cash Cap (${metrics.distributableCapSantims} santims).`
      );
    }

    // 5. Projected Post-Payout Solvency Verification
    const postEligibleCash = metrics.eligibleCashSantims - args.requestedAmountSantims;
    const postRequired105 = metrics.required105CoverageSantims;

    if (metrics.totalObligationsSantims > BigInt(0) && postEligibleCash < postRequired105) {
      throw new Error(
        `ERR_POST_PAYOUT_INSOLVENCY: Post-payout solvency would drop below the mandatory 105% coverage requirement.`
      );
    }

    const postPayoutSolvencyBps =
      metrics.totalObligationsSantims > BigInt(0)
        ? Number((postEligibleCash * BigInt(10000)) / metrics.totalObligationsSantims)
        : 999999;

    const payoutId = `payout_${now}_${Math.random().toString(36).substring(2, 9)}`;
    const idempotencyKey = `owner_payout_reserve_${payoutId}`;

    // 6. Post double-entry reservation:
    // Debit 3020 (Owner Capital Distributions: Contra-Equity) -> decreases book equity
    // Credit 2090 (Owner Payouts Payable: Liability) -> establishes payout obligation
    const journalResult = await postJournalTransaction(ctx, {
      idempotencyKey,
      transactionType: "owner_payout_reserve",
      referenceType: "owner_payout",
      referenceId: payoutId,
      description: `Owner profit distribution reservation for ${payoutId}`,
      postings: [
        {
          accountNumber: "3020",
          direction: "debit",
          amountSantims: args.requestedAmountSantims,
        },
        {
          accountNumber: "2090",
          direction: "credit",
          amountSantims: args.requestedAmountSantims,
        },
      ],
      postedBy: `owner:${identity.subject}`,
      now,
    });

    // 7. Insert owner payout request record
    await ctx.db.insert("ownerPayoutRequests", {
      payoutId,
      requestedAmountSantims: args.requestedAmountSantims,
      distributableCapSantims: metrics.distributableCapSantims,
      prePayoutSolvencyBps: metrics.solvencyRatioBps,
      postPayoutSolvencyBps,
      destinationAccount: args.destinationAccount,
      status: "requested",
      createdAt: now,
    });

    return {
      success: true,
      payoutId,
      txId: journalResult.txId,
      reservedSantims: args.requestedAmountSantims,
      postPayoutSolvencyBps,
    };
  },
});

/**
 * Execute settled disbursement of an authorized Owner Payout.
 * Requires independent CBS bank statement reference (RB-24).
 */
export const executeOwnerPayoutCanonical = mutation({
  args: {
    payoutId: v.string(),
    paymentChannel: v.union(v.literal("telebirr"), v.literal("cbe_a2a")),
    bankStatementReference: v.string(),
  },
  handler: async (ctx, args) => {
    const { identity } = await requireOwner(ctx);
    const now = Date.now();

    await assertChannelActive(ctx, args.paymentChannel, "outflow");

    const payout = await ctx.db
      .query("ownerPayoutRequests")
      .withIndex("by_payoutId", (q) => q.eq("payoutId", args.payoutId))
      .unique();

    if (!payout) {
      throw new Error(`ERR_PAYOUT_NOT_FOUND: Owner payout request ${args.payoutId} not found.`);
    }

    if (payout.status === "settled") {
      return { success: true, alreadySettled: true };
    }

    // RB-24: Independent CBS bank statement reference is mandatory
    if (!args.bankStatementReference?.trim()) {
      throw new Error(
        `ERR_MISSING_CBS_VOUCHER: Independent CBS bank statement reference is mandatory for owner payout execution (RB-24).`
      );
    }

    // OD-13: High-Value Owner Payout Timelock (Option A: > 50,000.00 ETB / 5,000,000 santims requires 24h timelock)
    const isHighValue = payout.requestedAmountSantims > BigInt(5000000);
    const timelockDurationMs = 24 * 60 * 60 * 1000;
    if (isHighValue && now - payout.createdAt < timelockDurationMs) {
      throw new Error(
        `ERR_TIMELOCK_ACTIVE: High-value owner payouts exceeding 50,000.00 ETB require a mandatory 24-hour timelock before settlement (OD-13 Option A).`
      );
    }

    const P = payout.requestedAmountSantims;
    const destinationAccount = args.paymentChannel === "telebirr" ? "1020" : "1010";
    const idempotencyKey = `owner_payout_execute_${args.payoutId}`;

    // Post double-entry execution:
    // Debit 2090 (Owner Payouts Payable) -> clears obligation
    // Credit 1010/1020 (Operating Cash) -> clears bank disbursement
    const journalResult = await postJournalTransaction(ctx, {
      idempotencyKey,
      transactionType: "owner_payout_execute",
      referenceType: "owner_payout",
      referenceId: args.payoutId,
      description: `Owner distribution bank disbursement settlement: ${args.bankStatementReference}`,
      postings: [
        {
          accountNumber: "2090",
          direction: "debit",
          amountSantims: P,
        },
        {
          accountNumber: destinationAccount,
          direction: "credit",
          amountSantims: P,
        },
      ],
      postedBy: `owner:${identity.subject}`,
      now,
    });

    // Mark payout settled
    await ctx.db.patch(payout._id, {
      status: "settled",
      executedAt: now,
    });

    return {
      success: true,
      payoutId: args.payoutId,
      txId: journalResult.txId,
      settledSantims: P,
    };
  },
});

/**
 * Cancel or reject an authorized Owner Payout before bank disbursement.
 * Unwinds reservation: Debit 2090, Credit 3020.
 */
export const cancelOwnerPayoutCanonical = mutation({
  args: {
    payoutId: v.string(),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const { identity } = await requireOwner(ctx);
    const now = Date.now();

    const payout = await ctx.db
      .query("ownerPayoutRequests")
      .withIndex("by_payoutId", (q) => q.eq("payoutId", args.payoutId))
      .unique();

    if (!payout) {
      throw new Error(`ERR_PAYOUT_NOT_FOUND: Owner payout request ${args.payoutId} not found.`);
    }

    if (payout.status === "settled") {
      throw new Error(`ERR_CANNOT_CANCEL_SETTLED_PAYOUT: Settled owner payout cannot be cancelled.`);
    }

    const P = payout.requestedAmountSantims;
    const idempotencyKey = `owner_payout_cancel_${args.payoutId}`;

    // Unwind reservation: Debit 2090, Credit 3020
    const journalResult = await postJournalTransaction(ctx, {
      idempotencyKey,
      transactionType: "owner_payout_reversal",
      referenceType: "owner_payout",
      referenceId: args.payoutId,
      description: `Cancelled owner payout reservation unwound: ${args.reason}`,
      postings: [
        {
          accountNumber: "2090",
          direction: "debit",
          amountSantims: P,
        },
        {
          accountNumber: "3020",
          direction: "credit",
          amountSantims: P,
        },
      ],
      postedBy: `owner:${identity.subject}`,
      now,
    });

    await ctx.db.patch(payout._id, {
      status: "rejected",
    });

    return {
      success: true,
      payoutId: args.payoutId,
      txId: journalResult.txId,
      unwoundSantims: P,
    };
  },
});
