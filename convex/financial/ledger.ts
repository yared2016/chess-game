// convex/financial/ledger.ts
// Authoritative Double-Entry General Ledger Engine for Abay Chess v4.2.7-PROD
// Enforces 17 Canonical Accounts, ACID Posting, Integer Santims, and Strict Balance (Debits == Credits)

import { v } from "convex/values";
import { mutation, query, internalMutation } from "../_generated/server";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { requireAdmin, requireOwner, requirePlayer, optionalPlayer } from "../lib/auth";
import {
  CANONICAL_ACCOUNTS,
  type CanonicalAccountNumber,
  vCanonicalAccountNumber,
  vPostingDirection,
  vTransactionType,
  vJournalPostingInput,
} from "./validators";

export interface JournalPostingInput {
  accountNumber: CanonicalAccountNumber;
  direction: "debit" | "credit";
  amountSantims: bigint;
  playerId?: Id<"players">;
}

export interface PostJournalArgs {
  idempotencyKey: string;
  transactionType:
    | "deposit_tier2"
    | "deposit_tier3"
    | "deposit_reversal"
    | "deposit_chargeback_1050"
    | "overdraft_repayment_offset"
    | "overdraft_writeoff_5030"
    | "withdrawal_reservation"
    | "withdrawal_settlement"
    | "withdrawal_rejection"
    | "withdrawal_cancellation"
    | "withdrawal_returned_recredit"
    | "match_escrow_lock"
    | "match_win_payout"
    | "match_draw_refund"
    | "owner_dividend_payout"
    | "system_suspense_adjustment";
  description: string;
  referenceType: string;
  referenceId: string;
  postings: JournalPostingInput[];
  postedBy: string;
  now?: number;
}

export interface PostJournalResult {
  txId: string;
  status: "posted" | "already_posted";
  amountSantims: bigint;
  postedAt: number;
}

/**
 * Core atomic double-entry posting function.
 * Enforces:
 * 1. Idempotency via journalTransactions.by_idempotencyKey
 * 2. Minimum 2 postings (at least one debit and one credit)
 * 3. 64-bit integer santims (> 0n)
 * 4. Exact balance: sum(Debits) === sum(Credits)
 * 5. Valid Canonical Chart of Accounts (17 accounts)
 * 6. Immutability (no updates or deletes permitted)
 * 7. Real-time player balance ledger synchronization
 */
export async function postJournalTransaction(
  ctx: MutationCtx,
  args: PostJournalArgs
): Promise<PostJournalResult> {
  const { idempotencyKey, transactionType, description, referenceType, referenceId, postings, postedBy } = args;
  const now = args.now ?? Date.now();

  // 1. Idempotency Check (RB-03)
  const existing = await ctx.db
    .query("journalTransactions")
    .withIndex("by_idempotencyKey", (q) => q.eq("idempotencyKey", idempotencyKey))
    .unique();

  if (existing) {
    return {
      txId: existing.txId,
      status: "already_posted",
      amountSantims: existing.amountSantims,
      postedAt: existing.postedAt,
    };
  }

  // 2. Minimum postings validation
  if (!postings || postings.length < 2) {
    throw new Error("ERR_POSTING_COUNT_INVALID: Double-entry requires at least 2 postings.");
  }

  let totalDebits = BigInt(0);
  let totalCredits = BigInt(0);

  // 3. Integer Santim & Account validation (RB-01, RB-02)
  for (const posting of postings) {
    if (!CANONICAL_ACCOUNTS.includes(posting.accountNumber)) {
      throw new Error(`ERR_INVALID_ACCOUNT_NUMBER: ${posting.accountNumber} is not a canonical account.`);
    }

    if (typeof posting.amountSantims !== "bigint") {
      throw new Error(`ERR_INVALID_INTEGER_SANTIMS: amountSantims must be a 64-bit bigint integer.`);
    }

    if (posting.amountSantims <= BigInt(0)) {
      throw new Error(`ERR_NON_POSITIVE_AMOUNT: amountSantims must be greater than zero.`);
    }

    if (posting.direction === "debit") {
      totalDebits += posting.amountSantims;
    } else if (posting.direction === "credit") {
      totalCredits += posting.amountSantims;
    } else {
      throw new Error(`ERR_INVALID_DIRECTION: Invalid posting direction ${(posting as any).direction}`);
    }
  }

  // 4. Exact balance validation (RB-02)
  if (totalDebits !== totalCredits) {
    throw new Error(
      `ERR_UNBALANCED_JOURNAL_TRANSACTION: Total debits (${totalDebits}) do not equal total credits (${totalCredits}).`
    );
  }

  // 5. Generate unique transaction ID
  const txId = `tx_${now}_${Math.random().toString(36).substring(2, 9)}`;

  // 6. Insert transaction header (RB-04 Append-Only)
  await ctx.db.insert("journalTransactions", {
    txId,
    idempotencyKey,
    transactionType,
    description,
    amountSantims: totalDebits,
    referenceType,
    referenceId,
    postedAt: now,
    postedBy,
    status: "posted",
  });

  // 7. Insert all postings atomically
  for (const posting of postings) {
    await ctx.db.insert("journalPostings", {
      txId,
      accountNumber: posting.accountNumber,
      direction: posting.direction,
      amountSantims: posting.amountSantims,
      playerId: posting.playerId,
      postedAt: now,
    });

    // 8. Synchronize real-time player balance if playerId is attached
    if (posting.playerId) {
      await synchronizePlayerBalance(ctx, posting.playerId, posting.accountNumber, posting.direction, posting.amountSantims, now);
    }
  }

  return {
    txId,
    status: "posted",
    amountSantims: totalDebits,
    postedAt: now,
  };
}

/**
 * Synchronizes real-time playerBalances record based on GL postings.
 * - Account 2010 (Player Deposit Liabilities): Credit increases available, Debit decreases available.
 * - Account 2020/2030 (Escrow / Reservation): Credit increases reserved, Debit decreases reserved.
 * - Account 1050 (Overdrafts Receivable): Debit increases overdraft, Credit decreases overdraft.
 */
async function synchronizePlayerBalance(
  ctx: MutationCtx,
  playerId: Id<"players">,
  accountNumber: CanonicalAccountNumber,
  direction: "debit" | "credit",
  amountSantims: bigint,
  now: number
): Promise<void> {
  let balanceRecord = await ctx.db
    .query("playerBalances")
    .withIndex("by_playerId", (q) => q.eq("playerId", playerId))
    .unique();

  if (!balanceRecord) {
    const player = await ctx.db.get(playerId);
    if (!player) return;

    const id = await ctx.db.insert("playerBalances", {
      playerId,
      clerkId: player.clerkId,
      availableSantims: BigInt(0),
      reservedSantims: BigInt(0),
      overdraftSantims: BigInt(0),
      status: "active",
      updatedAt: now,
    });
    balanceRecord = await ctx.db.get(id);
    if (!balanceRecord) return;
  }

  let newAvailable = balanceRecord.availableSantims;
  let newReserved = balanceRecord.reservedSantims;
  let newOverdraft = balanceRecord.overdraftSantims;
  let newStatus = balanceRecord.status;

  if (accountNumber === "2010") {
    if (direction === "credit") {
      newAvailable += amountSantims;
    } else {
      newAvailable -= amountSantims;
      if (newAvailable < BigInt(0)) {
        throw new Error(`ERR_NEGATIVE_BALANCE_PREVENTED: Available balance cannot fall below zero.`);
      }
    }
  } else if (accountNumber === "2020" || accountNumber === "2030") {
    if (direction === "credit") {
      newReserved += amountSantims;
    } else {
      newReserved -= amountSantims;
      if (newReserved < BigInt(0)) {
        newReserved = BigInt(0); // Safety clamp
      }
    }
  } else if (accountNumber === "1050") {
    if (direction === "debit") {
      newOverdraft += amountSantims;
      newStatus = "frozen_overdraft";
    } else {
      newOverdraft -= amountSantims;
      if (newOverdraft <= BigInt(0)) {
        newOverdraft = BigInt(0);
        if (newStatus === "frozen_overdraft") {
          newStatus = "active";
        }
      }
    }
  }

  await ctx.db.patch(balanceRecord._id, {
    availableSantims: newAvailable,
    reservedSantims: newReserved,
    overdraftSantims: newOverdraft,
    status: newStatus,
    updatedAt: now,
  });
}

/** Seed Chart of Accounts master table with 17 canonical definitions. */
export const seedChartOfAccounts = mutation({
  args: {},
  handler: async (ctx) => {
    await requireOwner(ctx);
    const now = Date.now();

    const chartDefinitions: Array<{
      accountNumber: CanonicalAccountNumber;
      name: string;
      category: "asset" | "liability" | "equity" | "revenue" | "expense";
      normalBalance: "debit" | "credit";
      description: string;
    }> = [
      { accountNumber: "1010", name: "Operating Cash (Bank / CBE)", category: "asset", normalBalance: "debit", description: "Direct commercial bank operating account funds." },
      { accountNumber: "1020", name: "Mobile Money Clearing (Telebirr)", category: "asset", normalBalance: "debit", description: "Liquid mobile money wallet balances." },
      { accountNumber: "1030", name: "Payment Provider Clearing (Verify.et Float)", category: "asset", normalBalance: "debit", description: "Verified deposit funds awaiting bank statement clearing." },
      { accountNumber: "1040", name: "Settlement Escrow Receivable", category: "asset", normalBalance: "debit", description: "Pending bank or provider inflows in transit." },
      { accountNumber: "1050", name: "Player Overdrafts Receivable", category: "asset", normalBalance: "debit", description: "Uncollectible deficits arising from chargebacks on spent player funds." },
      { accountNumber: "2010", name: "Player Deposit Liabilities", category: "liability", normalBalance: "credit", description: "Liquid funds owned by players available for wagering or withdrawal." },
      { accountNumber: "2020", name: "Active Match Escrow", category: "liability", normalBalance: "credit", description: "Player stakes locked during live active chess matches." },
      { accountNumber: "2030", name: "Withdrawal Settlement Clearing", category: "liability", normalBalance: "credit", description: "Pending withdrawal funds reserved from player balances." },
      { accountNumber: "2040", name: "Provider Fee Clearing", category: "liability", normalBalance: "credit", description: "Quoted provider fees collected from players awaiting settlement." },
      { accountNumber: "2090", name: "Stale / Unclaimed Balances", category: "liability", normalBalance: "credit", description: "Dormant or unclaimed player funds." },
      { accountNumber: "3010", name: "Retained Earnings", category: "equity", normalBalance: "credit", description: "Cumulative net platform operating surplus." },
      { accountNumber: "3020", name: "Owner Capital & Contributed Surplus", category: "equity", normalBalance: "credit", description: "Contributed capital and retained equity." },
      { accountNumber: "3999", name: "System Clearing / Suspense", category: "equity", normalBalance: "credit", description: "Audit discrepancy holding and suspense account." },
      { accountNumber: "4010", name: "Platform Gaming Commission", category: "revenue", normalBalance: "credit", description: "Platform rake earned on completed competitive matches." },
      { accountNumber: "5010", name: "Provider Settlement Expense", category: "expense", normalBalance: "debit", description: "Bank transaction fees and under-collection variances." },
      { accountNumber: "5020", name: "Promotion & Bonus Expense", category: "expense", normalBalance: "debit", description: "Deposit match promotions, welcome bonuses, and subsidies." },
      { accountNumber: "5030", name: "Dispute & Chargeback Loss Expense", category: "expense", normalBalance: "debit", description: "Written-off player overdrafts from chargeback disputes." },
    ];

    let inserted = 0;
    for (const def of chartDefinitions) {
      const existing = await ctx.db
        .query("accounts")
        .withIndex("by_accountNumber", (q) => q.eq("accountNumber", def.accountNumber))
        .unique();

      if (!existing) {
        await ctx.db.insert("accounts", {
          ...def,
          isActive: true,
          createdAt: now,
        });
        inserted++;
      }
    }

    return { total: chartDefinitions.length, newlyInserted: inserted };
  },
});

/** Query full Trial Balance across all 17 accounts and verify global balance. */
export const getTrialBalance = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);

    const postings = await ctx.db.query("journalPostings").collect();

    const accountTotals: Record<CanonicalAccountNumber, { debits: bigint; credits: bigint }> = {
      "1010": { debits: BigInt(0), credits: BigInt(0) },
      "1020": { debits: BigInt(0), credits: BigInt(0) },
      "1030": { debits: BigInt(0), credits: BigInt(0) },
      "1040": { debits: BigInt(0), credits: BigInt(0) },
      "1050": { debits: BigInt(0), credits: BigInt(0) },
      "2010": { debits: BigInt(0), credits: BigInt(0) },
      "2020": { debits: BigInt(0), credits: BigInt(0) },
      "2030": { debits: BigInt(0), credits: BigInt(0) },
      "2040": { debits: BigInt(0), credits: BigInt(0) },
      "2090": { debits: BigInt(0), credits: BigInt(0) },
      "3010": { debits: BigInt(0), credits: BigInt(0) },
      "3020": { debits: BigInt(0), credits: BigInt(0) },
      "3999": { debits: BigInt(0), credits: BigInt(0) },
      "4010": { debits: BigInt(0), credits: BigInt(0) },
      "5010": { debits: BigInt(0), credits: BigInt(0) },
      "5020": { debits: BigInt(0), credits: BigInt(0) },
      "5030": { debits: BigInt(0), credits: BigInt(0) },
    };

    let totalGlobalDebits = BigInt(0);
    let totalGlobalCredits = BigInt(0);

    for (const p of postings) {
      const acct = p.accountNumber as CanonicalAccountNumber;
      if (accountTotals[acct]) {
        if (p.direction === "debit") {
          accountTotals[acct].debits += p.amountSantims;
          totalGlobalDebits += p.amountSantims;
        } else {
          accountTotals[acct].credits += p.amountSantims;
          totalGlobalCredits += p.amountSantims;
        }
      }
    }

    const isBalanced = totalGlobalDebits === totalGlobalCredits;

    return {
      isBalanced,
      totalGlobalDebitsSantims: totalGlobalDebits,
      totalGlobalCreditsSantims: totalGlobalCredits,
      discrepancySantims: totalGlobalDebits - totalGlobalCredits,
      accounts: accountTotals,
    };
  },
});

/** Query transaction details with all associated postings by txId. */
export const getTransactionDetails = query({
  args: { txId: v.string() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const tx = await ctx.db
      .query("journalTransactions")
      .withIndex("by_txId", (q) => q.eq("txId", args.txId))
      .unique();

    if (!tx) return null;

    const postings = await ctx.db
      .query("journalPostings")
      .withIndex("by_txId", (q) => q.eq("txId", args.txId))
      .collect();

    return {
      transaction: tx,
      postings,
    };
  },
});
