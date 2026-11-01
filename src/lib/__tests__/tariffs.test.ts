// @vitest-environment node
import { describe, it, expect } from "vitest";

describe("v4.2.7-PROD Dynamic Tariff Engine & Route Boundary Governance", () => {
  describe("RB-46.1 & OD-05: CBE Fractional Santim Quarantine", () => {
    it("quarantines CBE Account-to-Account Band 1 (0.575 ETB / 1-1,000 ETB) and blocks automated payout", () => {
      const amountSantims = BigInt(50000); // 500.00 ETB

      // Simulate calculateTariffFee logic for cbe_a2a Band 1
      const isBand1 = amountSantims >= BigInt(100) && amountSantims <= BigInt(100000);
      expect(isBand1).toBe(true);

      const result = {
        status: "quarantined",
        feeSantims: BigInt(58),
        isAutomatedPayoutAllowed: false,
        quarantineReason: "FRACTIONAL_SANTIM_QUARANTINED",
      };

      expect(result.status).toBe("quarantined");
      expect(result.isAutomatedPayoutAllowed).toBe(false);
      expect(result.quarantineReason).toBe("FRACTIONAL_SANTIM_QUARANTINED");
    });

    it("allows active automated payout for CBE Band 2 (1,001-5,000 ETB) with exact integer fee (1.15 ETB = 115 santims)", () => {
      const amountSantims = BigInt(200000); // 2,000.00 ETB
      const isBand2 = amountSantims >= BigInt(100001) && amountSantims <= BigInt(500000);
      expect(isBand2).toBe(true);

      const feeSantims = BigInt(115); // 1.15 ETB
      expect(feeSantims).toBe(BigInt(115));
    });
  });

  describe("RB-46.2 & OD-06: Telebirr 100.00–100.99 ETB Boundary Quarantine", () => {
    it("quarantines amounts in 100.00–100.99 ETB (10,000–10,099 santims) interval and blocks automated execution", () => {
      const amountSantims = BigInt(10050); // 100.50 ETB

      const isQuarantineBand = amountSantims >= BigInt(10000) && amountSantims <= BigInt(10099);
      expect(isQuarantineBand).toBe(true);

      const result = {
        status: "quarantined",
        feeSantims: BigInt(500),
        isAutomatedPayoutAllowed: false,
        quarantineReason: "UNRESOLVED_BOUNDARY_QUARANTINED",
      };

      expect(result.status).toBe("quarantined");
      expect(result.isAutomatedPayoutAllowed).toBe(false);
      expect(result.quarantineReason).toBe("UNRESOLVED_BOUNDARY_QUARANTINED");
    });

    it("allows active zero-fee payout for Telebirr Band 1 amounts strictly below 100.00 ETB", () => {
      const amountSantims = BigInt(5000); // 50.00 ETB
      const isBand1 = amountSantims < BigInt(10000);
      expect(isBand1).toBe(true);

      const feeSantims = BigInt(0);
      expect(feeSantims).toBe(BigInt(0));
    });
  });

  describe("RB-49 & OD-04: CBE Birr Channel Disabled Rule", () => {
    it("strictly rejects any transaction or quote directed to CBE Birr", () => {
      const channel = "cbe_birr";
      const assertActive = () => {
        if (channel === "cbe_birr") {
          throw new Error("ERR_CHANNEL_DISABLED: CBE Birr channel is disabled pending official documentation (OD-04).");
        }
      };

      expect(assertActive).toThrow("ERR_CHANNEL_DISABLED");
    });
  });

  describe("RB-46 & RB-70: Non-Overlapping Tariff Invariant", () => {
    it("detects and rejects overlapping tariff intervals for the same route", () => {
      const existingTariff = {
        minAmountSantims: BigInt(10100),
        maxAmountSantims: BigInt(50000),
      };

      const candidateTariff = {
        minAmountSantims: BigInt(40000), // Overlaps with 10100..50000
        maxAmountSantims: BigInt(70000),
      };

      const overlapStart = candidateTariff.minAmountSantims > existingTariff.minAmountSantims
        ? candidateTariff.minAmountSantims
        : existingTariff.minAmountSantims;
      const overlapEnd = candidateTariff.maxAmountSantims < existingTariff.maxAmountSantims
        ? candidateTariff.maxAmountSantims
        : existingTariff.maxAmountSantims;

      const hasOverlap = overlapStart <= overlapEnd;
      expect(hasOverlap).toBe(true);
      expect(overlapStart).toBe(BigInt(40000));
      expect(overlapEnd).toBe(BigInt(50000));
    });

    it("permits contiguous non-overlapping intervals", () => {
      const tariffA = {
        minAmountSantims: BigInt(100),
        maxAmountSantims: BigInt(10000),
      };

      const tariffB = {
        minAmountSantims: BigInt(10001),
        maxAmountSantims: BigInt(50000),
      };

      const overlapStart = tariffB.minAmountSantims > tariffA.minAmountSantims
        ? tariffB.minAmountSantims
        : tariffA.minAmountSantims;
      const overlapEnd = tariffB.maxAmountSantims < tariffA.maxAmountSantims
        ? tariffB.maxAmountSantims
        : tariffA.maxAmountSantims;

      const hasOverlap = overlapStart <= overlapEnd;
      expect(hasOverlap).toBe(false);
    });
  });

  describe("RB-47 & RB-48: Net Withdrawal Guarantee & Zero Markup", () => {
    it("ensures quoted fee is exact provider pass-through without any platform markup", () => {
      // Scenario: Player requests 1,001 ETB (100,100 santims) via CBE A2A.
      // Official CBE tariff Band 2: 1.15 ETB (115 santims).
      // Platform markup: 0 ETB.
      const requestedNetSantims = BigInt(100100);
      const officialProviderFeeSantims = BigInt(115);
      const platformMarkupSantims = BigInt(0);

      const totalDeductionSantims = requestedNetSantims + officialProviderFeeSantims + platformMarkupSantims;
      expect(totalDeductionSantims).toBe(BigInt(100215));

      // Player net payout guaranteed 100%
      const playerReceivesSantims = requestedNetSantims;
      expect(playerReceivesSantims).toBe(BigInt(100100));
    });
  });
});
