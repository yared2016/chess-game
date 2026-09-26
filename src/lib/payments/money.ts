// src/lib/payments/money.ts — Centralized integer minor-unit financial math
// Invariant: 1 ETB = 100 santims. No floating-point financial arithmetic permitted.

export type FeeMode = "additive" | "deduct_from_gross";

export interface DepositFeeCalculation {
  walletCreditSantims: number;
  providerFeeSantims: number;
  grossPaymentSantims: number;
  feeMode: FeeMode;
  feeRateBasisPoints: number;
  feeRateBps: number;
  feeRatePercent: number;
  // Historical / compatibility fields (2.6% fee is inclusive of VAT)
  chapaServiceFeeSantims: number;
  chapaVatSantims: number;
  vatRatePercent: number;
}

export interface WithdrawalFeeCalculation {
  userReceivesSantims: number;
  providerFeeSantims: number;
  totalDeductionSantims: number;
  feeMode: FeeMode;
  feeRateBasisPoints: number;
  feeRateBps: number;
  feeRatePercent: number;
  // Historical / compatibility fields (2.6% fee is inclusive of VAT)
  chapaServiceFeeSantims: number;
  chapaVatSantims: number;
  vatRatePercent: number;
}

export interface MatchSettlementCalculation {
  grossPotSantims: number;
  commissionSantims: number;
  payoutSantims: number;
  commissionRateBasisPoints: number;
}

/**
 * Default Chapa Transaction Fee Rate: 2.6% (260 basis points).
 * The 2.6% is the Chapa transaction fee INCLUDING VAT.
 * Do NOT add an extra VAT on top.
 */
export const DEFAULT_CHAPA_FEE_BPS = 260; // 2.6%

/**
 * Get the configured Chapa fee rate in basis points (1 bps = 0.01%).
 * Priority:
 * 1. CHAPA_FEE_RATE (e.g. "0.026" or "2.6" or "2.6%")
 * 2. CHAPA_FEE_BPS (e.g. "260")
 * 3. Fallbacks: CHAPA_DEPOSIT_FEE_BPS / CHAPA_EFFECTIVE_FEE_RATE
 * 4. Default: 260 (2.6%)
 */
export function getChapaFeeRateBps(): number {
  if (typeof process !== "undefined" && process?.env) {
    const rawRate = process.env.CHAPA_FEE_RATE || process.env.CHAPA_EFFECTIVE_FEE_RATE;
    if (rawRate) {
      const cleaned = String(rawRate).replace("%", "").trim();
      const parsed = parseFloat(cleaned);
      if (!isNaN(parsed) && parsed > 0) {
        // e.g. 0.026 -> 260, 2.6 -> 260
        return parsed < 1 ? Math.round(parsed * 10000) : Math.round(parsed * 100);
      }
    }
    const rawBps = process.env.CHAPA_FEE_BPS || process.env.CHAPA_DEPOSIT_FEE_BPS;
    if (rawBps) {
      const parsedBps = parseInt(String(rawBps), 10);
      if (!isNaN(parsedBps) && parsedBps > 0) return parsedBps;
    }
  }
  return DEFAULT_CHAPA_FEE_BPS;
}

/**
 * Get the configured Chapa fee rate as percentage number, e.g. 2.6.
 */
export function getChapaFeeRatePercent(): number {
  return getChapaFeeRateBps() / 100;
}

// Aliases for provider compatibility
export const getDepositFeeRateBps = getChapaFeeRateBps;
export const getWithdrawalFeeRateBps = getChapaFeeRateBps;

/** Convert ETB to integer santims (minor units). Safely rounds. */
export function toSantims(etb: number): number {
  if (!Number.isFinite(etb)) throw new Error("Invalid financial number");
  return Math.round(etb * 100);
}

/** Convert integer santims to ETB major units. */
export function toEtb(santims: number): number {
  if (!Number.isInteger(santims)) throw new Error("Santims must be an integer");
  return santims / 100;
}

/** Format santims into localized currency string, e.g. "1,026.00 ETB". */
export function formatEtb(santims: number): string {
  const etb = toEtb(santims);
  return `${etb.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ETB`;
}

/**
 * Format ETB major units into localized currency string, e.g. "1,000.00 ETB".
 */
export function formatEtbAmount(etb: number): string {
  return `${etb.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ETB`;
}

/**
 * Calculate deposit fee.
 * Under "additive" model:
 * User requests 1,000 ETB credit -> 26 ETB fee (2.6%) -> User pays 1,026 ETB -> Wallet receives exactly 1,000 ETB.
 * 2.6% includes VAT.
 */
export function calculateDepositFee(
  creditSantims: number,
  feeRateBasisPoints = getChapaFeeRateBps(),
  feeMode: FeeMode = "additive"
): DepositFeeCalculation {
  if (!Number.isInteger(creditSantims) || creditSantims <= 0) {
    throw new Error("Credit amount must be a positive integer in santims");
  }

  if (feeMode === "additive") {
    // Total provider fee added on top of requested credit
    const providerFeeSantims = Math.round((creditSantims * feeRateBasisPoints) / 10000);
    const grossPaymentSantims = creditSantims + providerFeeSantims;

    return {
      walletCreditSantims: creditSantims,
      providerFeeSantims,
      grossPaymentSantims,
      feeMode,
      feeRateBasisPoints,
      feeRateBps: feeRateBasisPoints,
      feeRatePercent: feeRateBasisPoints / 100,
      chapaServiceFeeSantims: providerFeeSantims,
      chapaVatSantims: 0,
      vatRatePercent: 0,
    };
  } else {
    // DEDUCT_FROM_GROSS: Gross paid is input, fee is subtracted
    const providerFeeSantims = Math.round((creditSantims * feeRateBasisPoints) / 10000);
    const walletCreditSantims = Math.max(0, creditSantims - providerFeeSantims);

    return {
      walletCreditSantims,
      providerFeeSantims,
      grossPaymentSantims: creditSantims,
      feeMode,
      feeRateBasisPoints,
      feeRateBps: feeRateBasisPoints,
      feeRatePercent: feeRateBasisPoints / 100,
      chapaServiceFeeSantims: providerFeeSantims,
      chapaVatSantims: 0,
      vatRatePercent: 0,
    };
  }
}

/**
 * Calculate withdrawal deduction.
 * Under "additive" model:
 * User requests 500 ETB payout -> 13 ETB fee (2.6%) -> Total wallet deduction is 513 ETB -> User receives 500 ETB.
 * 2.6% includes VAT.
 */
export function calculateWithdrawalFee(
  receiveSantims: number,
  feeRateBasisPoints = getChapaFeeRateBps(),
  feeMode: FeeMode = "additive"
): WithdrawalFeeCalculation {
  if (!Number.isInteger(receiveSantims) || receiveSantims <= 0) {
    throw new Error("Withdrawal amount must be a positive integer in santims");
  }

  if (feeMode === "additive") {
    const providerFeeSantims = Math.round((receiveSantims * feeRateBasisPoints) / 10000);
    const totalDeductionSantims = receiveSantims + providerFeeSantims;

    return {
      userReceivesSantims: receiveSantims,
      providerFeeSantims,
      totalDeductionSantims,
      feeMode,
      feeRateBasisPoints,
      feeRateBps: feeRateBasisPoints,
      feeRatePercent: feeRateBasisPoints / 100,
      chapaServiceFeeSantims: providerFeeSantims,
      chapaVatSantims: 0,
      vatRatePercent: 0,
    };
  } else {
    const providerFeeSantims = Math.round((receiveSantims * feeRateBasisPoints) / 10000);
    const userReceivesSantims = Math.max(0, receiveSantims - providerFeeSantims);

    return {
      userReceivesSantims,
      providerFeeSantims,
      totalDeductionSantims: receiveSantims,
      feeMode,
      feeRateBasisPoints,
      feeRateBps: feeRateBasisPoints,
      feeRatePercent: feeRateBasisPoints / 100,
      chapaServiceFeeSantims: providerFeeSantims,
      chapaVatSantims: 0,
      vatRatePercent: 0,
    };
  }
}

/**
 * Calculate match settlement pot, platform commission, and winner payout.
 */
export function calculateMatchSettlement(
  stakePerPlayerSantims: number,
  commissionRateBasisPoints = 1000 // 10%
): MatchSettlementCalculation {
  const grossPotSantims = stakePerPlayerSantims * 2;
  const commissionSantims = Math.floor((grossPotSantims * commissionRateBasisPoints) / 10000);
  const payoutSantims = grossPotSantims - commissionSantims;

  return {
    grossPotSantims,
    commissionSantims,
    payoutSantims,
    commissionRateBasisPoints,
  };
}
