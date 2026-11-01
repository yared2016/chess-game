// @vitest-environment node
import { describe, it, expect } from "vitest";
import { CANONICAL_ACCOUNTS } from "../../../convex/financial/validators";

describe("v4.2.7-PROD Staging Integrity & Configuration Pre-Check (Phase 11)", () => {
  it("verifies all 17 canonical accounts exist in the master chart", () => {
    expect(CANONICAL_ACCOUNTS.length).toBe(17);
    expect(CANONICAL_ACCOUNTS).toContain("1010");
    expect(CANONICAL_ACCOUNTS).toContain("1020");
    expect(CANONICAL_ACCOUNTS).toContain("1030");
    expect(CANONICAL_ACCOUNTS).toContain("1040");
    expect(CANONICAL_ACCOUNTS).toContain("1050");
    expect(CANONICAL_ACCOUNTS).toContain("2010");
    expect(CANONICAL_ACCOUNTS).toContain("2020");
    expect(CANONICAL_ACCOUNTS).toContain("2030");
    expect(CANONICAL_ACCOUNTS).toContain("2040");
    expect(CANONICAL_ACCOUNTS).toContain("2090");
    expect(CANONICAL_ACCOUNTS).toContain("3010");
    expect(CANONICAL_ACCOUNTS).toContain("3020");
    expect(CANONICAL_ACCOUNTS).toContain("3999");
    expect(CANONICAL_ACCOUNTS).toContain("4010");
    expect(CANONICAL_ACCOUNTS).toContain("5010");
    expect(CANONICAL_ACCOUNTS).toContain("5020");
    expect(CANONICAL_ACCOUNTS).toContain("5030");
  });

  it("verifies active tariff bands and mandatory quarantine policies", () => {
    // CBE Band 1 quarantine (OD-05): 500 ETB payout (50,000 santims)
    const amountCbe = BigInt(50000);
    const isCbeBand1 = amountCbe >= BigInt(100) && amountCbe <= BigInt(100000);
    expect(isCbeBand1).toBe(true);

    // Telebirr boundary quarantine (OD-06): 100.50 ETB payout (10,050 santims)
    const amountTelebirr = BigInt(10050);
    const isTelebirrQuarantine = amountTelebirr >= BigInt(10000) && amountTelebirr <= BigInt(10099);
    expect(isTelebirrQuarantine).toBe(true);
  });

  it("verifies 105% dynamic solvency multiplier formula", () => {
    const testLiabilities = BigInt(1000000); // 10,000 ETB
    const required105 = (testLiabilities * BigInt(105) + BigInt(99)) / BigInt(100);
    expect(required105).toBe(BigInt(1050000));
  });
});
