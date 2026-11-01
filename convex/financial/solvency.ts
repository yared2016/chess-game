// convex/financial/solvency.ts
// Dynamic Solvency Governance & Distributable Cash Cap Engine (Abay Chess v4.2.7-PROD Phase 7)

import { v } from "convex/values";
import { query, internalQuery, MutationCtx, QueryCtx } from "../_generated/server";
import { requireOwner, requireAdmin, AnyCtx } from "../lib/auth";
import { CANONICAL_ACCOUNTS, CanonicalAccountNumber } from "./validators";

export interface SolvencyMetricsResult {
  // Cleared Operating Cash (Assets)
  cbeCashSantims: bigint; // 1010
  telebirrCashSantims: bigint; // 1020
  eligibleCashSantims: bigint; // 1010 + 1020
  providerClearingFloatSantims: bigint; // 1030 (Excluded from eligible)
  quarantinedCbeBirrSantims: bigint; // 1040 (Excluded from eligible)
  playerOverdraftsSantims: bigint; // 1050 (Excluded from eligible)

  // Dynamic Obligations (Liabilities)
  playerDepositsSantims: bigint; // 2010
  matchEscrowSantims: bigint; // 2020
  withdrawalPayableSantims: bigint; // 2030
  providerFeesPayableSantims: bigint; // 2040
  ownerPayoutsPayableSantims: bigint; // 2090
  pendingQueueCommitmentsSantims: bigint; // durableQueue unposted tasks
  totalPostedLiabilitiesSantims: bigint; // 2010..2090
  totalObligationsSantims: bigint; // Posted + Pending Queue

  // Solvency Coverage
  required105CoverageSantims: bigint; // ceil(1.05 * totalObligations)
  operatingBufferSantims: bigint; // Mandatory 1,000 ETB (100,000 santims)
  eligibleCashSurplusSantims: bigint; // max(0, eligible - 105% obligations - buffer)

  // Equity & Distributable Cap
  retainedEarningsSantims: bigint; // 3010
  ownerDistributionsSantims: bigint; // 3020
  suspenseDiscrepancySantims: bigint; // 3999
  suspenseDiscrepancyAbsSantims: bigint; // |3999|
  capitalReserveSantims: bigint; // Mandatory 1,000 ETB (100,000 santims)
  bookEquitySantims: bigint; // max(0, 3010 - 3020 - CapitalReserve - |3999|)
  distributableCapSantims: bigint; // max(0, min(bookEquity, eligibleCashSurplus))

  // Solvency Ratio & Status
  solvencyRatioBps: number; // Ratio in basis points (10500 = 105%)
  status: "compliant" | "warning" | "critical_insolvency";
  payoutBlockedReason: string | null;
}

/**
 * Calculates authoritative real-time solvency metrics across the General Ledger and durable queue.
 * Implements Section 8.1 - 8.5 of v4.2.7-PROD Master Architectural & Financial Specification.
 */
export async function calculateSolvencyMetrics(ctx: AnyCtx): Promise<SolvencyMetricsResult> {
  // 1. Fetch all journal postings to construct exact canonical balances
  const postings = await ctx.db.query("journalPostings").collect();

  // Initialize account totals
  const debitSums: Record<string, bigint> = {};
  const creditSums: Record<string, bigint> = {};

  for (const acct of CANONICAL_ACCOUNTS) {
    debitSums[acct] = BigInt(0);
    creditSums[acct] = BigInt(0);
  }

  for (const p of postings) {
    if (p.direction === "debit") {
      debitSums[p.accountNumber] = (debitSums[p.accountNumber] ?? BigInt(0)) + p.amountSantims;
    } else if (p.direction === "credit") {
      creditSums[p.accountNumber] = (creditSums[p.accountNumber] ?? BigInt(0)) + p.amountSantims;
    }
  }

  // Helper balance calculators
  // Assets normal balance = Debit (Debit - Credit)
  const assetBalance = (code: string): bigint => {
    const bal = (debitSums[code] ?? BigInt(0)) - (creditSums[code] ?? BigInt(0));
    return bal >= BigInt(0) ? bal : BigInt(0);
  };

  // Liabilities normal balance = Credit (Credit - Debit)
  const liabilityBalance = (code: string): bigint => {
    const bal = (creditSums[code] ?? BigInt(0)) - (debitSums[code] ?? BigInt(0));
    return bal >= BigInt(0) ? bal : BigInt(0);
  };

  // Equity normal balance = Credit for 3010, Debit for 3020
  const retainedProfit = (creditSums["3010"] ?? BigInt(0)) - (debitSums["3010"] ?? BigInt(0));
  const ownerDistributions = (debitSums["3020"] ?? BigInt(0)) - (creditSums["3020"] ?? BigInt(0));
  // Suspense 3999 signed balance (Debit = shortage > 0, Credit = surplus < 0)
  const suspenseBalance = (debitSums["3999"] ?? BigInt(0)) - (creditSums["3999"] ?? BigInt(0));
  const suspenseAbs = suspenseBalance >= BigInt(0) ? suspenseBalance : -suspenseBalance;

  // 2. Cleared operating cash (Assets)
  const cbeCash = assetBalance("1010");
  const telebirrCash = assetBalance("1020");
  const providerClearing = assetBalance("1030");
  const quarantinedCbeBirr = assetBalance("1040");
  const playerOverdrafts = assetBalance("1050");

  // Eligible Cash C_eligible = 1010 + 1020 (Strict exclusion: 1030, 1040, 1050)
  const eligibleCash = cbeCash + telebirrCash;

  // 3. Dynamic Obligations (Liabilities)
  const playerDeposits = liabilityBalance("2010");
  const matchEscrow = liabilityBalance("2020");
  const withdrawalPayable = liabilityBalance("2030");
  const providerFeesPayable = liabilityBalance("2040");
  const ownerPayoutsPayable = liabilityBalance("2090");

  const totalPostedLiabilities =
    playerDeposits + matchEscrow + withdrawalPayable + providerFeesPayable + ownerPayoutsPayable;

  // 4. Directive #9: PendingCommitments from unposted tasks in durableQueue
  // Only tasks where status is "pending" or "processing" AND postedTransactionId is null/undefined
  const queueTasks = await ctx.db.query("durableQueue").collect();
  let pendingQueueCommitments = BigInt(0);

  for (const task of queueTasks) {
    if (
      (task.status === "pending" || task.status === "processing") &&
      !task.postedTransactionId
    ) {
      try {
        const payloadObj = JSON.parse(task.payload);
        if (payloadObj && typeof payloadObj.amountSantims === "string") {
          pendingQueueCommitments += BigInt(payloadObj.amountSantims);
        } else if (payloadObj && typeof payloadObj.stakeSantims === "string") {
          pendingQueueCommitments += BigInt(payloadObj.stakeSantims);
        }
      } catch {
        // Skip unparseable payload
      }
    }
  }

  const totalObligations = totalPostedLiabilities + pendingQueueCommitments;

  // 5. Mandatory 105% Coverage Multiplier (ceil(1.05 * totalObligations))
  const required105Coverage =
    totalObligations > BigInt(0)
      ? (totalObligations * BigInt(105) + BigInt(99)) / BigInt(100)
      : BigInt(0);

  // 6. Configurable Buffers & Capital Reserve (OD-01: 1,000 ETB = 100,000 santims)
  const capitalReserve = BigInt(100000);
  const operatingBuffer = BigInt(100000);

  // 7. Authoritative EligibleCashSurplus
  const surplusCalc = eligibleCash - required105Coverage - operatingBuffer;
  const eligibleCashSurplus = surplusCalc > BigInt(0) ? surplusCalc : BigInt(0);

  // 8. Authoritative BookEquity
  // BookEquity = max(0, 3010 - 3020 - CapitalReserve - |3999|)
  const equityCalc = retainedProfit - ownerDistributions - capitalReserve - suspenseAbs;
  const bookEquity = equityCalc > BigInt(0) ? equityCalc : BigInt(0);

  // 9. Authoritative Non-Negative DistributableCap
  // DistributableCap = max(0, min(BookEquity, EligibleCashSurplus))
  const distributableCap =
    bookEquity < eligibleCashSurplus ? bookEquity : eligibleCashSurplus;

  // 10. Solvency Ratio & Status
  let solvencyRatioBps: number;
  let status: "compliant" | "warning" | "critical_insolvency";
  let payoutBlockedReason: string | null = null;

  if (totalObligations === BigInt(0)) {
    solvencyRatioBps = 999999; // Infinite coverage
    status = "compliant";
  } else {
    solvencyRatioBps = Number((eligibleCash * BigInt(10000)) / totalObligations);
    if (solvencyRatioBps >= 10500) {
      status = "compliant";
    } else if (solvencyRatioBps >= 10000) {
      status = "warning";
      payoutBlockedReason = "SOLVENCY_BELOW_105_PERCENT";
    } else {
      status = "critical_insolvency";
      payoutBlockedReason = "CRITICAL_INSOLVENCY_CIRCUIT_BREAKER";
    }
  }

  // Active suspense discrepancy check (RB-66, Section 8.5)
  if (suspenseAbs > BigInt(0)) {
    payoutBlockedReason = "ACTIVE_SUSPENSE_DISCREPANCY";
  } else if (distributableCap <= BigInt(0) && !payoutBlockedReason) {
    payoutBlockedReason = "ZERO_DISTRIBUTABLE_CAP";
  }

  return {
    cbeCashSantims: cbeCash,
    telebirrCashSantims: telebirrCash,
    eligibleCashSantims: eligibleCash,
    providerClearingFloatSantims: providerClearing,
    quarantinedCbeBirrSantims: quarantinedCbeBirr,
    playerOverdraftsSantims: playerOverdrafts,
    playerDepositsSantims: playerDeposits,
    matchEscrowSantims: matchEscrow,
    withdrawalPayableSantims: withdrawalPayable,
    providerFeesPayableSantims: providerFeesPayable,
    ownerPayoutsPayableSantims: ownerPayoutsPayable,
    pendingQueueCommitmentsSantims: pendingQueueCommitments,
    totalPostedLiabilitiesSantims: totalPostedLiabilities,
    totalObligationsSantims: totalObligations,
    required105CoverageSantims: required105Coverage,
    operatingBufferSantims: operatingBuffer,
    eligibleCashSurplusSantims: eligibleCashSurplus,
    retainedEarningsSantims: retainedProfit > BigInt(0) ? retainedProfit : BigInt(0),
    ownerDistributionsSantims: ownerDistributions > BigInt(0) ? ownerDistributions : BigInt(0),
    suspenseDiscrepancySantims: suspenseBalance,
    suspenseDiscrepancyAbsSantims: suspenseAbs,
    capitalReserveSantims: capitalReserve,
    bookEquitySantims: bookEquity,
    distributableCapSantims: distributableCap,
    solvencyRatioBps,
    status,
    payoutBlockedReason,
  };
}

/**
 * Public query for Owner Command Center and Staff Admin to inspect live solvency state.
 */
export const getSolvencyMetrics = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const metrics = await calculateSolvencyMetrics(ctx);

    return {
      cbeCashETB: Number(metrics.cbeCashSantims) / 100,
      telebirrCashETB: Number(metrics.telebirrCashSantims) / 100,
      eligibleCashETB: Number(metrics.eligibleCashSantims) / 100,
      providerClearingFloatETB: Number(metrics.providerClearingFloatSantims) / 100,
      quarantinedCbeBirrETB: Number(metrics.quarantinedCbeBirrSantims) / 100,
      playerOverdraftsETB: Number(metrics.playerOverdraftsSantims) / 100,
      totalObligationsETB: Number(metrics.totalObligationsSantims) / 100,
      required105CoverageETB: Number(metrics.required105CoverageSantims) / 100,
      eligibleCashSurplusETB: Number(metrics.eligibleCashSurplusSantims) / 100,
      bookEquityETB: Number(metrics.bookEquitySantims) / 100,
      distributableCapETB: Number(metrics.distributableCapSantims) / 100,
      solvencyRatioBps: metrics.solvencyRatioBps,
      solvencyRatioPercent: (metrics.solvencyRatioBps / 100).toFixed(2) + "%",
      status: metrics.status,
      payoutBlockedReason: metrics.payoutBlockedReason,
      suspenseDiscrepancySantims: Number(metrics.suspenseDiscrepancySantims),
    };
  },
});
