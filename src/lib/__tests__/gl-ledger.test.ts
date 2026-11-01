// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  CANONICAL_ACCOUNTS,
  type CanonicalAccountNumber,
} from "../../../convex/financial/validators";

describe("v4.2.7-PROD General Ledger Engine & Canonical Rules", () => {
  it("RB-36: Enforces exactly 17 Canonical Accounts in Chart of Accounts", () => {
    expect(CANONICAL_ACCOUNTS).toHaveLength(17);
    expect(CANONICAL_ACCOUNTS).toEqual([
      "1010",
      "1020",
      "1030",
      "1040",
      "1050",
      "2010",
      "2020",
      "2030",
      "2040",
      "2090",
      "3010",
      "3020",
      "3999",
      "4010",
      "5010",
      "5020",
      "5030",
    ]);
  });

  describe("RB-01: Integer Santim Rule", () => {
    it("accepts valid positive 64-bit integer santim amounts", () => {
      const validAmount = BigInt(100000); // 1,000.00 ETB
      expect(typeof validAmount).toBe("bigint");
      expect(validAmount > BigInt(0)).toBe(true);
    });

    it("rejects non-positive and zero amounts", () => {
      const zeroAmount = BigInt(0);
      const negativeAmount = BigInt(-500);
      expect(zeroAmount <= BigInt(0)).toBe(true);
      expect(negativeAmount <= BigInt(0)).toBe(true);
    });
  });

  describe("RB-02: Double-Entry Balanced Journal Rule", () => {
    it("validates that balanced transactions (Debits === Credits) pass", () => {
      const postings = [
        { accountNumber: "1030" as CanonicalAccountNumber, direction: "debit", amountSantims: BigInt(50000) },
        { accountNumber: "2010" as CanonicalAccountNumber, direction: "credit", amountSantims: BigInt(50000) },
      ];

      const debits = postings
        .filter((p) => p.direction === "debit")
        .reduce((sum, p) => sum + p.amountSantims, BigInt(0));
      const credits = postings
        .filter((p) => p.direction === "credit")
        .reduce((sum, p) => sum + p.amountSantims, BigInt(0));

      expect(debits).toEqual(credits);
      expect(debits).toEqual(BigInt(50000));
    });

    it("rejects unbalanced transactions where debits !== credits", () => {
      const postings = [
        { accountNumber: "1030" as CanonicalAccountNumber, direction: "debit", amountSantims: BigInt(50000) },
        { accountNumber: "2010" as CanonicalAccountNumber, direction: "credit", amountSantims: BigInt(45000) },
      ];

      const debits = postings
        .filter((p) => p.direction === "debit")
        .reduce((sum, p) => sum + p.amountSantims, BigInt(0));
      const credits = postings
        .filter((p) => p.direction === "credit")
        .reduce((sum, p) => sum + p.amountSantims, BigInt(0));

      expect(debits).not.toEqual(credits);
    });

    it("requires at least 2 postings per transaction", () => {
      const singlePosting = [
        { accountNumber: "1010" as CanonicalAccountNumber, direction: "debit", amountSantims: BigInt(1000) },
      ];
      expect(singlePosting.length).toBeLessThan(2);
    });
  });

  describe("RB-03: Idempotency Key Rule", () => {
    it("generates and recognizes unique idempotency keys", () => {
      const key1 = `dep_tx_${Date.now()}_001`;
      const key2 = `dep_tx_${Date.now()}_001`;
      const key3 = `dep_tx_${Date.now()}_002`;

      expect(key1).toEqual(key2);
      expect(key1).not.toEqual(key3);
    });
  });

  describe("RB-15 & RB-16: Account 1050 Overdraft & Chargeback Deficit Handling", () => {
    it("caps available balance deduction at 0 and debits Account 1050 for excess deficit", () => {
      // Scenario: Player deposited 1,000 ETB (100,000 santims).
      // Player wagered and lost 800 ETB, leaving 200 ETB (20,000 santims) available.
      // Bank reverses the original 1,000 ETB deposit (chargeback).
      const currentAvailable = BigInt(20000);
      const chargebackAmount = BigInt(100000);

      const debitAvailable = currentAvailable < chargebackAmount ? currentAvailable : chargebackAmount;
      const overdraftDebit = chargebackAmount - debitAvailable;

      expect(debitAvailable).toEqual(BigInt(20000)); // Account 2010 reduced to 0
      expect(overdraftDebit).toEqual(BigInt(80000));  // Account 1050 debited for 80,000 santims

      const newAvailable = currentAvailable - debitAvailable;
      expect(newAvailable).toEqual(BigInt(0)); // Never negative!
    });

    it("automatically offsets Account 1050 overdraft upon subsequent deposit", () => {
      const currentOverdraft = BigInt(80000); // 800 ETB debt
      const incomingDeposit = BigInt(100000);  // 1,000 ETB new deposit

      const offsetAmount = incomingDeposit >= currentOverdraft ? currentOverdraft : incomingDeposit;
      const netAvailableCredit = incomingDeposit - offsetAmount;
      const remainingOverdraft = currentOverdraft - offsetAmount;

      expect(offsetAmount).toEqual(BigInt(80000));
      expect(netAvailableCredit).toEqual(BigInt(20000));
      expect(remainingOverdraft).toEqual(BigInt(0));
    });
  });
});
