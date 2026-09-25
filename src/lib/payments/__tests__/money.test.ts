// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  toSantims,
  toEtb,
  formatEtb,
  calculateDepositFee,
  calculateWithdrawalFee,
  calculateMatchSettlement,
} from "../money";

describe("financial math and santim conversions", () => {
  it("converts ETB to integer santims correctly", () => {
    expect(toSantims(100)).toBe(10000);
    expect(toSantims(0.01)).toBe(1);
    expect(toSantims(10.5)).toBe(1050);
    expect(toSantims(99.99)).toBe(9999);
  });

  it("converts santims back to ETB", () => {
    expect(toEtb(10000)).toBe(100);
    expect(toEtb(1050)).toBe(10.5);
    expect(toEtb(1)).toBe(0.01);
  });

  it("formats ETB nicely with two decimals", () => {
    expect(formatEtb(10000)).toBe("100.00 ETB");
    expect(formatEtb(1050)).toBe("10.50 ETB");
  });

  it("calculates additive deposit fees", () => {
    // 100 ETB (10,000 santims) @ 250 bps (2.5%) = 250 santims fee => 10,250 gross
    const res = calculateDepositFee(10000, 250, "additive");
    expect(res.walletCreditSantims).toBe(10000);
    expect(res.providerFeeSantims).toBe(250);
    expect(res.grossPaymentSantims).toBe(10250);
  });

  it("calculates deduct_from_gross deposit fees", () => {
    const res = calculateDepositFee(10000, 250, "deduct_from_gross");
    expect(res.grossPaymentSantims).toBe(10000);
    expect(res.providerFeeSantims).toBe(250);
    expect(res.walletCreditSantims).toBe(9750);
  });

  it("calculates withdrawal fee with deduction from gross", () => {
    // Requesting 100 ETB cashout @ 200 bps (2.0%) = 200 santims fee => 9,800 received
    const res = calculateWithdrawalFee(10000, 200, "deduct_from_gross");
    expect(res.totalDeductionSantims).toBe(10000);
    expect(res.providerFeeSantims).toBe(200);
    expect(res.userReceivesSantims).toBe(9800);
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
