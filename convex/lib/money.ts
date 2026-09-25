// convex/lib/money.ts — Server-side minor-unit financial math for Convex functions
// Invariant: 1 ETB = 100 santims. No floating-point math permitted.

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

export function toSantims(etb: number): number {
  if (!Number.isFinite(etb)) throw new TypeError("Invalid financial number");
  return Math.round(etb * 100);
}

export function toEtb(santims: number): number {
  if (!Number.isInteger(santims)) throw new TypeError("Santims must be an integer");
  return santims / 100;
}

export function formatEtb(santims: number): string {
  const etb = toEtb(santims);
  return `${etb.toFixed(2)} ETB`;
}

export function calculateDepositFee(
  creditSantims: number,
  feeRateBasisPoints = 250,
  feeMode: FeeMode = "additive"
): DepositFeeCalculation {
  if (!Number.isInteger(creditSantims) || creditSantims <= 0) {
    throw new RangeError("Credit amount must be a positive integer in santims");
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

export function calculateWithdrawalFee(
  receiveSantims: number,
  feeRateBasisPoints = 250,
  feeMode: FeeMode = "additive"
): WithdrawalFeeCalculation {
  if (!Number.isInteger(receiveSantims) || receiveSantims <= 0) {
    throw new RangeError("Withdrawal amount must be a positive integer in santims");
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

export function calculateMatchSettlement(
  stakePerPlayerSantims: number,
  commissionRateBasisPoints = 1000
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
