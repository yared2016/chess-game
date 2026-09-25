// src/lib/payments/money.ts — Centralized integer minor-unit financial math
// Invariant: 1 ETB = 100 santims. No floating-point financial arithmetic permitted.

export type FeeMode = "additive" | "deduct_from_gross";

export interface DepositFeeCalculation {
  walletCreditSantims: number;
  chapaServiceFeeSantims: number;
  chapaVatSantims: number;
  providerFeeSantims: number;
  grossPaymentSantims: number;
  feeMode: FeeMode;
  feeRateBasisPoints: number;
  feeRateBps: number;
  feeRatePercent: number;
  vatRatePercent: number;
}

export interface WithdrawalFeeCalculation {
  userReceivesSantims: number;
  chapaServiceFeeSantims: number;
  chapaVatSantims: number;
  providerFeeSantims: number;
  totalDeductionSantims: number;
  feeMode: FeeMode;
  feeRateBasisPoints: number;
  feeRateBps: number;
  feeRatePercent: number;
  vatRatePercent: number;
}

export interface MatchSettlementCalculation {
  grossPotSantims: number;
  commissionSantims: number;
  payoutSantims: number;
  commissionRateBasisPoints: number;
}

/** Standard VAT rate collected on Chapa's service fee (15% per Ethiopian regulations) */
export const CHAPA_SERVICE_FEE_VAT_PERCENT = 15;

/** Default effective Chapa deposit fee rate: 2.51% (251 basis points) */
export const DEFAULT_CHAPA_DEPOSIT_FEE_BPS = 251;

/** Default withdrawal fee rate: 2.5% (250 basis points) — configured separately from deposits */
export const DEFAULT_CHAPA_WITHDRAWAL_FEE_BPS = 250;

/**
 * Get the configured effective Chapa deposit fee in basis points (1 bps = 0.01%).
 * Priority: CHAPA_EFFECTIVE_FEE_RATE (e.g. 0.0251) -> CHAPA_DEPOSIT_FEE_BPS (e.g. 251) -> 251.
 */
export function getDepositFeeRateBps(): number {
  if (typeof process !== "undefined" && process.env) {
    if (process.env.CHAPA_EFFECTIVE_FEE_RATE) {
      const rate = parseFloat(process.env.CHAPA_EFFECTIVE_FEE_RATE);
      if (!isNaN(rate) && rate > 0) {
        return Math.round(rate * 10000);
      }
    }
    if (process.env.CHAPA_DEPOSIT_FEE_BPS) {
      const bps = parseInt(process.env.CHAPA_DEPOSIT_FEE_BPS, 10);
      if (!isNaN(bps) && bps > 0) {
        return bps;
      }
    }
  }
  return DEFAULT_CHAPA_DEPOSIT_FEE_BPS;
}

/**
 * Get the configured Chapa withdrawal fee in basis points.
 * Configured completely independently from deposit fees.
 */
export function getWithdrawalFeeRateBps(): number {
  if (typeof process !== "undefined" && process.env) {
    if (process.env.CHAPA_WITHDRAWAL_FEE_RATE) {
      const rate = parseFloat(process.env.CHAPA_WITHDRAWAL_FEE_RATE);
      if (!isNaN(rate) && rate > 0) {
        return Math.round(rate * 10000);
      }
    }
    if (process.env.CHAPA_WITHDRAWAL_FEE_BPS) {
      const bps = parseInt(process.env.CHAPA_WITHDRAWAL_FEE_BPS, 10);
      if (!isNaN(bps) && bps > 0) {
        return bps;
      }
    }
  }
  return DEFAULT_CHAPA_WITHDRAWAL_FEE_BPS;
}

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

/** Format santims into localized currency string, e.g. "102.50 ETB". */
export function formatEtb(santims: number): string {
  const etb = toEtb(santims);
  return `${etb.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ETB`;
}

/**
 * Calculate deposit fee based on provider rate (default 251 basis points = 2.51%).
 * Under "additive" model, user specifies desired wallet credit and pays fee on top.
 * Wallet receives exactly the requested credit amount.
 * 
 * Separates Chapa service fee from 15% VAT collected on Chapa's service fee.
 */
export function calculateDepositFee(
  creditSantims: number,
  feeRateBasisPoints = DEFAULT_CHAPA_DEPOSIT_FEE_BPS,
  feeMode: FeeMode = "additive"
): DepositFeeCalculation {
  if (!Number.isInteger(creditSantims) || creditSantims <= 0) {
    throw new Error("Credit amount must be a positive integer in santims");
  }

  if (feeMode === "additive") {
    // Total provider fee added on top of requested credit
    const providerFeeSantims = Math.round((creditSantims * feeRateBasisPoints) / 10000);
    const grossPaymentSantims = creditSantims + providerFeeSantims;

    // Separate base service fee from 15% VAT on the service fee (Total = Fee * 1.15)
    const chapaServiceFeeSantims = Math.round(providerFeeSantims / 1.15);
    const chapaVatSantims = providerFeeSantims - chapaServiceFeeSantims;

    return {
      walletCreditSantims: creditSantims,
      chapaServiceFeeSantims,
      chapaVatSantims,
      providerFeeSantims,
      grossPaymentSantims,
      feeMode,
      feeRateBasisPoints,
      feeRateBps: feeRateBasisPoints,
      feeRatePercent: feeRateBasisPoints / 100,
      vatRatePercent: CHAPA_SERVICE_FEE_VAT_PERCENT,
    };
  } else {
    // DEDUCT_FROM_GROSS: Gross paid is input, fee is subtracted
    const providerFeeSantims = Math.round((creditSantims * feeRateBasisPoints) / 10000);
    const walletCreditSantims = Math.max(0, creditSantims - providerFeeSantims);
    const chapaServiceFeeSantims = Math.round(providerFeeSantims / 1.15);
    const chapaVatSantims = providerFeeSantims - chapaServiceFeeSantims;

    return {
      walletCreditSantims,
      chapaServiceFeeSantims,
      chapaVatSantims,
      providerFeeSantims,
      grossPaymentSantims: creditSantims,
      feeMode,
      feeRateBasisPoints,
      feeRateBps: feeRateBasisPoints,
      feeRatePercent: feeRateBasisPoints / 100,
      vatRatePercent: CHAPA_SERVICE_FEE_VAT_PERCENT,
    };
  }
}

/**
 * Calculate withdrawal deduction.
 * Under "additive" model, user requests amount to receive, and the provider fee is added to the wallet deduction.
 * Withdrawal fees are configured independently from deposit fees.
 */
export function calculateWithdrawalFee(
  receiveSantims: number,
  feeRateBasisPoints = DEFAULT_CHAPA_WITHDRAWAL_FEE_BPS,
  feeMode: FeeMode = "additive"
): WithdrawalFeeCalculation {
  if (!Number.isInteger(receiveSantims) || receiveSantims <= 0) {
    throw new Error("Withdrawal amount must be a positive integer in santims");
  }

  if (feeMode === "additive") {
    const providerFeeSantims = Math.round((receiveSantims * feeRateBasisPoints) / 10000);
    const totalDeductionSantims = receiveSantims + providerFeeSantims;
    const chapaServiceFeeSantims = Math.round(providerFeeSantims / 1.15);
    const chapaVatSantims = providerFeeSantims - chapaServiceFeeSantims;

    return {
      userReceivesSantims: receiveSantims,
      chapaServiceFeeSantims,
      chapaVatSantims,
      providerFeeSantims,
      totalDeductionSantims,
      feeMode,
      feeRateBasisPoints,
      feeRateBps: feeRateBasisPoints,
      feeRatePercent: feeRateBasisPoints / 100,
      vatRatePercent: CHAPA_SERVICE_FEE_VAT_PERCENT,
    };
  } else {
    const providerFeeSantims = Math.round((receiveSantims * feeRateBasisPoints) / 10000);
    const userReceivesSantims = Math.max(0, receiveSantims - providerFeeSantims);
    const chapaServiceFeeSantims = Math.round(providerFeeSantims / 1.15);
    const chapaVatSantims = providerFeeSantims - chapaServiceFeeSantims;

    return {
      userReceivesSantims,
      chapaServiceFeeSantims,
      chapaVatSantims,
      providerFeeSantims,
      totalDeductionSantims: receiveSantims,
      feeMode,
      feeRateBasisPoints,
      feeRateBps: feeRateBasisPoints,
      feeRatePercent: feeRateBasisPoints / 100,
      vatRatePercent: CHAPA_SERVICE_FEE_VAT_PERCENT,
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
