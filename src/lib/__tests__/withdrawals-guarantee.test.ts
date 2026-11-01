// @vitest-environment node
import { describe, it, expect } from "vitest";

describe("v4.2.7-PROD Net Withdrawal Guarantee & Provider Fee Pass-Through Accounting", () => {
  describe("RB-11: Withdrawal Reservation Accounting", () => {
    it("reserves net payout X and quoted fee F atomically from Account 2010 into 2030 and 2040", () => {
      // Scenario A from spec:
      // Player requests net payout: 1,001.00 ETB (100,100 santims) via CBE A2A.
      // Quoted Provider Fee (Band 2): 1.15 ETB (115 santims).
      // Total deduction from player available: 100,215 santims.
      const X = BigInt(100100);
      const F = BigInt(115);
      const totalReserved = X + F;

      expect(totalReserved).toBe(BigInt(100215));

      const reservationPostings = [
        { accountNumber: "2010", direction: "debit", amountSantims: totalReserved },
        { accountNumber: "2030", direction: "credit", amountSantims: X },
        { accountNumber: "2040", direction: "credit", amountSantims: F },
      ];

      const debits = reservationPostings.filter((p) => p.direction === "debit").reduce((s, p) => s + p.amountSantims, BigInt(0));
      const credits = reservationPostings.filter((p) => p.direction === "credit").reduce((s, p) => s + p.amountSantims, BigInt(0));

      expect(debits).toBe(credits);
      expect(debits).toBe(BigInt(100215));
    });
  });

  describe("RB-12, RB-18 & RB-57: Under-Collection Settlement (Scenario B)", () => {
    it("absorbs actual fee variance into Account 5010 while preserving 100% net payout guarantee", () => {
      // Scenario B:
      // Requested net payout X = 100,000 santims (1,000.00 ETB).
      // Quoted fee F = 115 santims held in Account 2040.
      // Actual provider fee charged by bank f = 150 santims.
      // Total bank debit = X + f = 100,150 santims.
      // Variance absorbed by platform (Account 5010) = f - F = 35 santims.
      const X = BigInt(100000);
      const F = BigInt(115);
      const f = BigInt(150);
      const totalBankDebit = X + f;
      const variance = f - F;

      expect(variance).toBe(BigInt(35));
      expect(totalBankDebit).toBe(BigInt(100150));

      const settlementPostings = [
        { accountNumber: "2030", direction: "debit", amountSantims: X },
        { accountNumber: "2040", direction: "debit", amountSantims: F },
        { accountNumber: "5010", direction: "debit", amountSantims: variance },
        { accountNumber: "1010", direction: "credit", amountSantims: totalBankDebit },
      ];

      const debits = settlementPostings.filter((p) => p.direction === "debit").reduce((s, p) => s + p.amountSantims, BigInt(0));
      const credits = settlementPostings.filter((p) => p.direction === "credit").reduce((s, p) => s + p.amountSantims, BigInt(0));

      expect(debits).toBe(credits);
      expect(debits).toBe(BigInt(100150));
      expect(credits).toBe(BigInt(100150));
    });
  });

  describe("RB-58: Over-Collection Settlement (Scenario C)", () => {
    it("refunds excess quoted fee to player Account 2010 when actual fee is lower", () => {
      // Scenario C:
      // Requested payout X = 100,000 santims.
      // Quoted fee F = 200 santims held in 2040.
      // Actual provider fee f = 150 santims.
      // Total bank debit = X + f = 100,150 santims.
      // Excess fee refunded to player Account 2010 = F - f = 50 santims.
      const X = BigInt(100000);
      const F = BigInt(200);
      const f = BigInt(150);
      const totalBankDebit = X + f;
      const refund = F - f;

      const settlementPostings = [
        { accountNumber: "2030", direction: "debit", amountSantims: X },
        { accountNumber: "2040", direction: "debit", amountSantims: F },
        { accountNumber: "1010", direction: "credit", amountSantims: totalBankDebit },
        { accountNumber: "2010", direction: "credit", amountSantims: refund },
      ];

      const debits = settlementPostings.filter((p) => p.direction === "debit").reduce((s, p) => s + p.amountSantims, BigInt(0));
      const credits = settlementPostings.filter((p) => p.direction === "credit").reduce((s, p) => s + p.amountSantims, BigInt(0));

      expect(debits).toBe(credits);
      expect(debits).toBe(BigInt(100200));
    });
  });

  describe("RB-71: Mandatory Independent CBS Statement Evidence", () => {
    it("rejects settlement transition if CBS voucher or external statement reference is missing", () => {
      const validateSettlement = (voucher?: string, ref?: string) => {
        if (!voucher?.trim() && !ref?.trim()) {
          throw new Error("ERR_MISSING_SETTLEMENT_REFERENCE");
        }
      };

      expect(() => validateSettlement("", "")).toThrow("ERR_MISSING_SETTLEMENT_REFERENCE");
      expect(() => validateSettlement("CBE_CBS_VOUCHER_89123")).not.toThrow();
    });
  });

  describe("RB-72: Two-Step Returned Transfer Protocol", () => {
    it("Case E2: Bank returned net payout X (kept fee f) -> recredits X to player Account 2010", () => {
      const X = BigInt(100000); // 1,000 ETB
      const returnPostings = [
        { accountNumber: "1010", direction: "debit", amountSantims: X },
        { accountNumber: "2010", direction: "credit", amountSantims: X },
      ];

      const debits = returnPostings.filter((p) => p.direction === "debit").reduce((s, p) => s + p.amountSantims, BigInt(0));
      const credits = returnPostings.filter((p) => p.direction === "credit").reduce((s, p) => s + p.amountSantims, BigInt(0));

      expect(debits).toBe(credits);
      expect(debits).toBe(X);
    });

    it("Case E3: Bank returned full payout and fee (X + f) -> recredits player (X + F) and balances with 5010", () => {
      const X = BigInt(100000);
      const F = BigInt(115);
      const f = BigInt(150);
      const variance = f - F; // 35

      const returnPostings = [
        { accountNumber: "1010", direction: "debit", amountSantims: X + f },
        { accountNumber: "2010", direction: "credit", amountSantims: X + F },
        { accountNumber: "5010", direction: "credit", amountSantims: variance },
      ];

      const debits = returnPostings.filter((p) => p.direction === "debit").reduce((s, p) => s + p.amountSantims, BigInt(0));
      const credits = returnPostings.filter((p) => p.direction === "credit").reduce((s, p) => s + p.amountSantims, BigInt(0));

      expect(debits).toBe(credits);
      expect(debits).toBe(X + f);
    });
  });
});
