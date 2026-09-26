// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  toSantims,
  toEtb,
  formatEtb,
  calculateDepositFee,
  calculateWithdrawalFee,
  calculateMatchSettlement,
  getChapaFeeRateBps,
  getChapaFeeRatePercent,
  DEFAULT_CHAPA_FEE_BPS,
} from "../money";

describe("financial math and santim conversions", () => {
  it("converts ETB to integer santims correctly", () => {
    expect(toSantims(100)).toBe(10000);
    expect(toSantims(0.01)).toBe(1);
    expect(toSantims(10.5)).toBe(1050);
    expect(toSantims(99.99)).toBe(9999);
    expect(toSantims(1000)).toBe(100000);
    expect(toSantims(500)).toBe(50000);
  });

  it("converts santims back to ETB", () => {
    expect(toEtb(10000)).toBe(100);
    expect(toEtb(1050)).toBe(10.5);
    expect(toEtb(1)).toBe(0.01);
    expect(toEtb(102600)).toBe(1026);
    expect(toEtb(51300)).toBe(513);
  });

  it("formats ETB nicely with two decimals", () => {
    expect(formatEtb(10000)).toBe("100.00 ETB");
    expect(formatEtb(1050)).toBe("10.50 ETB");
    expect(formatEtb(102600)).toBe("1,026.00 ETB");
    expect(formatEtb(51300)).toBe("513.00 ETB");
  });

  it("verifies default 2.6% Chapa fee configuration", () => {
    expect(DEFAULT_CHAPA_FEE_BPS).toBe(260);
    expect(getChapaFeeRateBps()).toBe(260);
    expect(getChapaFeeRatePercent()).toBe(2.6);
  });

  it("calculates additive deposit fee under 2.6% fee rule", () => {
    // 1,000 ETB (100,000 santims) @ 260 bps (2.6%) = 2,600 santims (26 ETB) => 1,026 ETB gross payment
    const res = calculateDepositFee(100000);
    expect(res.walletCreditSantims).toBe(100000);
    expect(res.providerFeeSantims).toBe(2600);
    expect(res.grossPaymentSantims).toBe(102600);
    expect(res.feeRateBps).toBe(260);
    expect(res.feeRatePercent).toBe(2.6);
  });

  it("calculates additive withdrawal fee under 2.6% fee rule", () => {
    // 500 ETB (50,000 santims) @ 260 bps (2.6%) = 1,300 santims (13 ETB) => 51,300 santims (513 ETB) total deduction
    const res = calculateWithdrawalFee(50000);
    expect(res.userReceivesSantims).toBe(50000);
    expect(res.providerFeeSantims).toBe(1300);
    expect(res.totalDeductionSantims).toBe(51300);
    expect(res.feeRateBps).toBe(260);
    expect(res.feeRatePercent).toBe(2.6);
  });

  it("calculates deduct_from_gross deposit fees", () => {
    const res = calculateDepositFee(10000, 250, "deduct_from_gross");
    expect(res.grossPaymentSantims).toBe(10000);
    expect(res.providerFeeSantims).toBe(250);
    expect(res.walletCreditSantims).toBe(9750);
  });

  it("calculates match escrow and 10% platform commission", () => {
    // 50 ETB stake per player (5,000 santims each) -> 10,000 gross pot
    // 10% commission (1000 bps) = 1,000 santims (10 ETB)
    // Winner payout = 9,000 santims (90 ETB)
    const res = calculateMatchSettlement(5000, 1000);
    expect(res.grossPotSantims).toBe(10000);
    expect(res.commissionSantims).toBe(1000);
    expect(res.payoutSantims).toBe(9000);
  });

  it("preserves zero rounding loss invariant across settlement", () => {
    const res = calculateMatchSettlement(2500, 1000);
    expect(res.commissionSantims + res.payoutSantims).toBe(res.grossPotSantims);
  });
});
