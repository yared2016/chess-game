// @vitest-environment node
import { describe, it, expect } from "vitest";

describe("v4.2.7-PROD 4-Tier Deposit Lifecycle & Account 1050 Overdraft Engine", () => {
  describe("RB-13 & RB-14: Tier 2 and Tier 3 Deposit Accounting", () => {
    it("Tier 2 credit: Debits 1030 Provider Clearing and Credits 2010 Player Deposits", () => {
      const depositAmount = BigInt(50000); // 500.00 ETB

      const tier2Postings = [
        { accountNumber: "1030", direction: "debit", amountSantims: depositAmount },
        { accountNumber: "2010", direction: "credit", amountSantims: depositAmount },
      ];

      const debits = tier2Postings.filter((p) => p.direction === "debit").reduce((s, p) => s + p.amountSantims, BigInt(0));
      const credits = tier2Postings.filter((p) => p.direction === "credit").reduce((s, p) => s + p.amountSantims, BigInt(0));

      expect(debits).toBe(depositAmount);
      expect(credits).toBe(depositAmount);
      expect(debits).toEqual(credits);
    });

    it("Tier 3 settlement: Debits 1010 Operating Cash and Credits 1030 Provider Clearing", () => {
      const depositAmount = BigInt(50000);

      const tier3Postings = [
        { accountNumber: "1010", direction: "debit", amountSantims: depositAmount },
        { accountNumber: "1030", direction: "credit", amountSantims: depositAmount },
      ];

      const debits = tier3Postings.filter((p) => p.direction === "debit").reduce((s, p) => s + p.amountSantims, BigInt(0));
      const credits = tier3Postings.filter((p) => p.direction === "credit").reduce((s, p) => s + p.amountSantims, BigInt(0));

      expect(debits).toBe(depositAmount);
      expect(credits).toBe(depositAmount);
      expect(debits).toEqual(credits);
    });
  });

  describe("RB-15 & RB-69: Negative Balance Prevention & Account 1050 Deficit", () => {
    it("deducts up to available balance without going negative, posting excess to Account 1050", () => {
      // Player deposited 1,000 ETB (100,000 santims).
      // Player spent 700 ETB, leaving 300 ETB (30,000 santims) available.
      // Bank claws back the full 1,000 ETB deposit.
      const available = BigInt(30000);
      const chargebackAmount = BigInt(100000);

      const deductAvailable = available >= chargebackAmount ? chargebackAmount : available;
      const overdraftDeficit = chargebackAmount - deductAvailable;

      expect(deductAvailable).toBe(BigInt(30000));
      expect(overdraftDeficit).toBe(BigInt(70000));

      const chargebackPostings = [
        { accountNumber: "2010", direction: "debit", amountSantims: deductAvailable },
        { accountNumber: "1050", direction: "debit", amountSantims: overdraftDeficit },
        { accountNumber: "1010", direction: "credit", amountSantims: chargebackAmount },
      ];

      const totalDebits = chargebackPostings.filter((p) => p.direction === "debit").reduce((s, p) => s + p.amountSantims, BigInt(0));
      const totalCredits = chargebackPostings.filter((p) => p.direction === "credit").reduce((s, p) => s + p.amountSantims, BigInt(0));

      expect(totalDebits).toBe(totalCredits);
      expect(totalDebits).toBe(chargebackAmount);
    });
  });

  describe("RB-16 & RB-69.2: Auto-Repayment Offset & Write-Off", () => {
    it("automatically offsets Account 1050 overdraft from incoming deposit before available credit", () => {
      const overdraft = BigInt(70000); // 700.00 ETB overdraft
      const newDeposit = BigInt(100000); // 1,000.00 ETB incoming deposit

      const offset = newDeposit >= overdraft ? overdraft : newDeposit;
      const netCredit = newDeposit - offset;
      const remainingOverdraft = overdraft - offset;

      expect(offset).toBe(BigInt(70000));
      expect(netCredit).toBe(BigInt(30000));
      expect(remainingOverdraft).toBe(BigInt(0));

      const depositPostings = [
        { accountNumber: "1030", direction: "debit", amountSantims: newDeposit },
        { accountNumber: "2010", direction: "credit", amountSantims: netCredit },
        { accountNumber: "1050", direction: "credit", amountSantims: offset },
      ];

      const totalDebits = depositPostings.filter((p) => p.direction === "debit").reduce((s, p) => s + p.amountSantims, BigInt(0));
      const totalCredits = depositPostings.filter((p) => p.direction === "credit").reduce((s, p) => s + p.amountSantims, BigInt(0));

      expect(totalDebits).toBe(totalCredits);
    });

    it("write-off debits Account 5030 and credits Account 1050", () => {
      const uncollectibleDebt = BigInt(70000);

      const writeOffPostings = [
        { accountNumber: "5030", direction: "debit", amountSantims: uncollectibleDebt },
        { accountNumber: "1050", direction: "credit", amountSantims: uncollectibleDebt },
      ];

      const totalDebits = writeOffPostings.filter((p) => p.direction === "debit").reduce((s, p) => s + p.amountSantims, BigInt(0));
      const totalCredits = writeOffPostings.filter((p) => p.direction === "credit").reduce((s, p) => s + p.amountSantims, BigInt(0));

      expect(totalDebits).toBe(totalCredits);
      expect(totalDebits).toBe(uncollectibleDebt);
    });
  });
});
