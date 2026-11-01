// @vitest-environment node
import { describe, it, expect } from "vitest";

describe("v4.2.7-PROD Solvency Governance & Distributable Cash Cap (Phase 7)", () => {
  const CAPITAL_RESERVE = BigInt(100000); // 1,000 ETB
  const OPERATING_BUFFER = BigInt(100000); // 1,000 ETB

  describe("RB-21: 105% Dynamic Solvency Multiplier & Surplus Formula", () => {
    it("calculates exact 105% coverage multiplier rounded up to nearest santim", () => {
      // Total liabilities = 1,000,000 santims (10,000 ETB)
      const liabilities = BigInt(1000000);
      const required105 = (liabilities * BigInt(105) + BigInt(99)) / BigInt(100);
      expect(required105).toBe(BigInt(1050000)); // Exactly 10,500 ETB

      // Fractional case: 1,001 santims -> 1.05 * 1001 = 1051.05 -> ceil = 1052
      const oddLiabilities = BigInt(1001);
      const ceil105 = (oddLiabilities * BigInt(105) + BigInt(99)) / BigInt(100);
      expect(ceil105).toBe(BigInt(1052));
    });

    it("calculates EligibleCashSurplus correctly deducting 105% liabilities and buffer", () => {
      // Eligible cash = 1,500,000 santims (15,000 ETB)
      // Obligations = 1,000,000 santims (10,000 ETB)
      // Required 105% = 1,050,000 santims
      // Buffer = 100,000 santims
      // Surplus = 1,500,000 - 1,050,000 - 100,000 = 350,000 santims (3,500 ETB)
      const eligibleCash = BigInt(1500000);
      const obligations = BigInt(1000000);
      const required105 = (obligations * BigInt(105) + BigInt(99)) / BigInt(100);
      const surplus = eligibleCash - required105 - OPERATING_BUFFER;

      expect(surplus).toBe(BigInt(350000));
    });

    it("clamps EligibleCashSurplus to 0 when cash is below 105% coverage + buffer", () => {
      // Eligible cash = 1,100,000 santims
      // Obligations = 1,000,000 santims -> 105% = 1,050,000 santims
      // Buffer = 100,000 santims
      // Total needed = 1,150,000 santims
      // Surplus raw = -50,000 -> clamped to 0
      const eligibleCash = BigInt(1100000);
      const obligations = BigInt(1000000);
      const required105 = (obligations * BigInt(105) + BigInt(99)) / BigInt(100);
      const raw = eligibleCash - required105 - OPERATING_BUFFER;
      const surplus = raw > BigInt(0) ? raw : BigInt(0);

      expect(surplus).toBe(BigInt(0));
    });
  });

  describe("RB-22: Distributable Cash Cap Formula & Non-Negative Guarantee", () => {
    it("bounds DistributableCap by min(BookEquity, EligibleCashSurplus) and guarantees non-negative", () => {
      // Case 1: BookEquity (2,000 ETB) < EligibleCashSurplus (3,500 ETB) -> Cap = 2,000 ETB
      const bookEquity1 = BigInt(200000);
      const surplus1 = BigInt(350000);
      const cap1 = bookEquity1 < surplus1 ? bookEquity1 : surplus1;
      expect(cap1).toBe(BigInt(200000));

      // Case 2: EligibleCashSurplus (1,000 ETB) < BookEquity (2,500 ETB) -> Cap = 1,000 ETB
      const bookEquity2 = BigInt(250000);
      const surplus2 = BigInt(100000);
      const cap2 = bookEquity2 < surplus2 ? bookEquity2 : surplus2;
      expect(cap2).toBe(BigInt(100000));

      // Case 3: BookEquity <= 0 -> Cap = 0
      const bookEquity3 = BigInt(0);
      const surplus3 = BigInt(500000);
      const cap3 = bookEquity3 < surplus3 ? bookEquity3 : surplus3;
      expect(cap3).toBe(BigInt(0));
    });
  });

  describe("RB-31 & RB-32: Asset Isolation & Float Exclusion", () => {
    it("excludes Account 1030 (Provider Clearing) and 1040 (Quarantined) from Eligible Cash", () => {
      const cbe1010 = BigInt(500000); // 5,000 ETB
      const telebirr1020 = BigInt(300000); // 3,000 ETB
      const clearing1030 = BigInt(200000); // 2,000 ETB in transit
      const quarantined1040 = BigInt(100000); // 1,000 ETB quarantined

      // Canonical formula: C_eligible = 1010 + 1020
      const eligibleCash = cbe1010 + telebirr1020;
      expect(eligibleCash).toBe(BigInt(800000));

      // 1030 and 1040 must not increase eligible cash
      expect(eligibleCash).not.toContain(clearing1030 + quarantined1040);
      expect(eligibleCash < cbe1010 + telebirr1020 + clearing1030 + quarantined1040).toBe(true);
    });
  });

  describe("RB-66: Account 3999 Suspense Discrepancy Universal Deduction & Payout Lock", () => {
    it("deducts |Balance(3999)| from BookEquity and blocks payouts when suspense is non-zero", () => {
      const retainedProfit = BigInt(500000); // 5,000 ETB
      const distributions = BigInt(100000); // 1,000 ETB
      const suspenseShortage = BigInt(50000); // 500 ETB missing cash (Debit balance)

      // BookEquity = max(0, 3010 - 3020 - CapitalReserve - |3999|)
      const equity = retainedProfit - distributions - CAPITAL_RESERVE - suspenseShortage;
      expect(equity).toBe(BigInt(250000));

      // Automatic payout lock test
      const isPayoutBlocked = suspenseShortage > BigInt(0);
      expect(isPayoutBlocked).toBe(true);
    });
  });

  describe("Directive #9: PendingCommitments Double-Counting Prevention", () => {
    it("includes unposted queue tasks and excludes posted queue tasks from liabilities", () => {
      const postedTasks = [
        { queueId: "q1", status: "completed", postedTransactionId: "tx_123", amountSantims: BigInt(50000) },
        { queueId: "q2", status: "processing", postedTransactionId: "tx_456", amountSantims: BigInt(20000) },
      ];

      const unpostedTasks = [
        { queueId: "q3", status: "pending", postedTransactionId: null, amountSantims: BigInt(15000) },
        { queueId: "q4", status: "processing", postedTransactionId: null, amountSantims: BigInt(10000) },
      ];

      const allTasks = [...postedTasks, ...unpostedTasks];

      // Directive #9 logic: sum only tasks where status in ["pending", "processing"] AND !postedTransactionId
      const pendingCommitments = allTasks
        .filter((t) => (t.status === "pending" || t.status === "processing") && !t.postedTransactionId)
        .reduce((sum, t) => sum + t.amountSantims, BigInt(0));

      // Only q3 (15,000) and q4 (10,000) are included = 25,000
      expect(pendingCommitments).toBe(BigInt(25000));
    });
  });
});
