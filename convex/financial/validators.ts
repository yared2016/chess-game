// convex/financial/validators.ts
// Comprehensive validators and types for Abay Chess v4.2.7-PROD General Ledger & Financial Engine

import { v } from "convex/values";

/** 17 Canonical Chart of Accounts numbers */
export const CANONICAL_ACCOUNTS = [
  "1010", // Operating Cash (Bank / CBE)
  "1020", // Mobile Money Clearing (Telebirr)
  "1030", // Payment Provider Clearing (Verify.et Settlement Float)
  "1040", // Settlement Escrow Receivable (Pending Bank / Provider Inflows)
  "1050", // Player Overdrafts Receivable (Uncollectible Negative Balances / Chargeback Deficits)
  "2010", // Player Deposit Liabilities (Available Player Funds)
  "2020", // Active Match Escrow (In-Game Wager Stakes)
  "2030", // Withdrawal Settlement Clearing (Player-Facing Payout Reservations)
  "2040", // Provider Fee Clearing (Quoted Provider Fees Collected from Players)
  "2090", // Stale / Unclaimed Balances (Dormant & Abandoned Funds)
  "3010", // Retained Earnings (Accumulated Net Platform Profit)
  "3020", // Owner Capital & Contributed Surplus
  "3999", // System Clearing / Suspense (Audit Discrepancy & Holding)
  "4010", // Platform Gaming Commission (10% Rake on Non-Draw Matches)
  "5010", // Provider Settlement Expense (Transaction Processing Fees & Under-Collection Variance)
  "5020", // Promotion & Bonus Expense (Deposit Matches, Welcome Bonuses, Subsidies)
  "5030", // Dispute & Chargeback Loss Expense (Uncollectible Overdraft Write-Offs)
] as const;

export type CanonicalAccountNumber = typeof CANONICAL_ACCOUNTS[number];

export const vCanonicalAccountNumber = v.union(
  v.literal("1010"),
  v.literal("1020"),
  v.literal("1030"),
  v.literal("1040"),
  v.literal("1050"),
  v.literal("2010"),
  v.literal("2020"),
  v.literal("2030"),
  v.literal("2040"),
  v.literal("2090"),
  v.literal("3010"),
  v.literal("3020"),
  v.literal("3999"),
  v.literal("4010"),
  v.literal("5010"),
  v.literal("5020"),
  v.literal("5030"),
);

export const vAccountCategory = v.union(
  v.literal("asset"),
  v.literal("liability"),
  v.literal("equity"),
  v.literal("revenue"),
  v.literal("expense"),
);

export const vNormalBalance = v.union(v.literal("debit"), v.literal("credit"));

export const vPostingDirection = v.union(v.literal("debit"), v.literal("credit"));

export const vTransactionType = v.union(
  v.literal("deposit_tier2"),
  v.literal("deposit_tier3"),
  v.literal("deposit_reversal"),
  v.literal("deposit_chargeback_1050"),
  v.literal("overdraft_repayment_offset"),
  v.literal("overdraft_writeoff_5030"),
  v.literal("withdrawal_reservation"),
  v.literal("withdrawal_settlement"),
  v.literal("withdrawal_rejection"),
  v.literal("withdrawal_cancellation"),
  v.literal("withdrawal_returned_recredit"),
  v.literal("match_escrow_lock"),
  v.literal("match_win_payout"),
  v.literal("match_draw_refund"),
  v.literal("owner_dividend_payout"),
  v.literal("system_suspense_adjustment"),
);

export const vJournalPostingInput = v.object({
  accountNumber: vCanonicalAccountNumber,
  direction: vPostingDirection,
  amountSantims: v.int64(),
  playerId: v.optional(v.id("players")),
});

export const vDepositTier = v.union(
  v.literal("tier1_initiated"),
  v.literal("tier2_verified_clearing"),
  v.literal("tier3_bank_settled"),
  v.literal("tier4_reconciled"),
);

export const vCanonicalDepositStatus = v.union(
  v.literal("pending_verification"),
  v.literal("verified_clearing"),
  v.literal("bank_settled"),
  v.literal("rejected"),
  v.literal("charged_back"),
  v.literal("disputed"),
);

export const vCanonicalWithdrawalStatus = v.union(
  v.literal("requested"),
  v.literal("reserved"),
  v.literal("review_pending"),
  v.literal("dispatched"),
  v.literal("settled"),
  v.literal("failed"),
  v.literal("cancelled"),
  v.literal("returned"),
  v.literal("quarantined"),
);

export const vPaymentChannelKey = v.union(
  v.literal("telebirr"),
  v.literal("cbe_a2a"),
  v.literal("cbe_birr"),
);

export const vChannelStatus = v.union(
  v.literal("active"),
  v.literal("maintenance"),
  v.literal("disabled"),
);

export const vTariffRoute = v.union(
  v.literal("telebirr_p2p"),
  v.literal("cbe_a2a"),
  v.literal("cbe_to_telebirr"),
);

export const vTariffPayer = v.union(
  v.literal("sender"),
  v.literal("receiver"),
  v.literal("platform"),
);

export const vQueueTaskStatus = v.union(
  v.literal("pending"),
  v.literal("processing"),
  v.literal("completed"),
  v.literal("failed"),
  v.literal("dead_letter"),
);

export const vOwnerPayoutStatus = v.union(
  v.literal("requested"),
  v.literal("approved"),
  v.literal("settled"),
  v.literal("rejected"),
);

export const vPlayerBalanceStatus = v.union(
  v.literal("active"),
  v.literal("frozen"),
  v.literal("frozen_overdraft"),
  v.literal("restricted"),
);
