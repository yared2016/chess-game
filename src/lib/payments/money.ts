// src/lib/payments/money.ts — Centralized integer minor-unit financial math
// Invariant: 1 ETB = 100 santims. No floating-point financial arithmetic permitted.

export type FeeMode = "additive" | "deduct_from_gross";

export interface DepositFeeCalculation {
  walletCreditSantims: number;
  providerFeeSantims: number;
  grossPaymentSantims: number;
  feeMode: FeeMode;
  feeRateBasisPoints: number;
}

export interface WithdrawalFeeCalculation {
  userReceivesSantims: number;
  providerFeeSantims: number;
  totalDeductionSantims: number;
  feeMode: FeeMode;
  feeRateBasisPoints: number;
}

export interface MatchSettlementCalculation {
  grossPotSantims: number;
  commissionSantims: number;
  payoutSantims: number;
  commissionRateBasisPoints: number;
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
 * Calculate deposit fee based on provider rate (e.g. 250 basis points = 2.5%).
 * Under "additive" model, user specifies desired wallet credit and pays fee on top.
 */
export function calculateDepositFee(
  creditSantims: number,
  feeRateBasisPoints = 250,
  feeMode: FeeMode = "additive"
): DepositFeeCalculation {
  if (!Number.isInteger(creditSantims) || creditSantims <= 0) {
    throw new Error("Credit amount must be a positive integer in santims");
  }

  if (feeMode === "additive") {
    const providerFeeSantims = Math.round((creditSantims * feeRateBasisPoints) / 10000);
    const grossPaymentSantims = creditSantims + providerFeeSantims;
    return {
      walletCreditSantims: creditSantims,
      providerFeeSantims,
      grossPaymentSantims,
      feeMode,
      feeRateBasisPoints,
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
    };
  }
}

/**
 * Calculate withdrawal deduction.
 * Under "additive" model, user requests amount to receive, and the fee is added to the wallet deduction.
 */
export function calculateWithdrawalFee(
  receiveSantims: number,
  feeRateBasisPoints = 250,
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
