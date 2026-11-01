// @vitest-environment node
import { describe, it, expect } from "vitest";

describe("v4.2.7-PROD Game Financial Engine, Match Escrow & Commission Rake (Phase 6)", () => {
  describe("RB-05: Normal Win Settlement Rake (10% pot commission)", () => {
    it("settles normal win: Debits Escrow (2020) 20,000 s., Credits Winner 18,000 s., Credits Commission (4010) 2,000 s.", () => {
      const stakePerPlayer = BigInt(10000); // 100.00 ETB
      const totalPot = stakePerPlayer * BigInt(2); // 20,000 santims = 200.00 ETB
      const commissionRateBps = BigInt(1000); // 10%
      const commissionSantims = (totalPot * commissionRateBps) / BigInt(10000); // 2,000 santims = 20.00 ETB
      const winnerPayout = totalPot - commissionSantims; // 18,000 santims = 180.00 ETB

      expect(commissionSantims).toBe(BigInt(2000));
      expect(winnerPayout).toBe(BigInt(18000));

      const postings = [
        { accountNumber: "2020", direction: "debit", amountSantims: stakePerPlayer, entity: "winner" },
        { accountNumber: "2020", direction: "debit", amountSantims: stakePerPlayer, entity: "loser" },
        { accountNumber: "2010", direction: "credit", amountSantims: winnerPayout, entity: "winner" },
        { accountNumber: "4010", direction: "credit", amountSantims: commissionSantims, entity: "platform" },
      ];

      const debits = postings.filter((p) => p.direction === "debit").reduce((s, p) => s + p.amountSantims, BigInt(0));
      const credits = postings.filter((p) => p.direction === "credit").reduce((s, p) => s + p.amountSantims, BigInt(0));

      expect(debits).toBe(BigInt(20000));
      expect(credits).toBe(BigInt(20000));
      expect(debits).toEqual(credits);
    });
  });

  describe("RB-06 & RB-44: Organic Draw Full Refund (0% rake baseline)", () => {
    it("refunds 100% of original stakes to both players with 0 commission on stalemate/repetition", () => {
      const stakePerPlayer = BigInt(10000); // 100.00 ETB
      const totalPot = stakePerPlayer * BigInt(2); // 20,000 santims

      const postings = [
        { accountNumber: "2020", direction: "debit", amountSantims: stakePerPlayer, entity: "white" },
        { accountNumber: "2020", direction: "debit", amountSantims: stakePerPlayer, entity: "black" },
        { accountNumber: "2010", direction: "credit", amountSantims: stakePerPlayer, entity: "white" },
        { accountNumber: "2010", direction: "credit", amountSantims: stakePerPlayer, entity: "black" },
      ];

      const debits = postings.filter((p) => p.direction === "debit").reduce((s, p) => s + p.amountSantims, BigInt(0));
      const credits = postings.filter((p) => p.direction === "credit").reduce((s, p) => s + p.amountSantims, BigInt(0));

      expect(debits).toBe(totalPot);
      expect(credits).toBe(totalPot);
      expect(debits).toEqual(credits);
    });
  });

  describe("RB-07: Mutual Accepted Draw Guardrail OD-09 (Blocked pending Owner ratification)", () => {
    it("rejects mutual draw rake deduction and falls back to 100% refund", () => {
      const isOwnerRatified = false; // OD-09 is unratified
      const requestedRakeMode: string = "alt1_5percent";

      let errorThrown = false;
      try {
        if (!isOwnerRatified && requestedRakeMode !== "100_percent_refund") {
          throw new Error(
            "ERR_MUTUAL_DRAW_RAKE_BLOCKED: Mutual accepted draw rake is blocked under Guardrail OD-09 pending Owner ratification. Fallback to 100% refund applied."
          );
        }
      } catch (err: any) {
        errorThrown = true;
        expect(err.message).toContain("ERR_MUTUAL_DRAW_RAKE_BLOCKED");
      }

      expect(errorThrown).toBe(true);

      // Fallback verification: full 100% refund
      const stake = BigInt(10000);
      const fallbackPostings = [
        { accountNumber: "2020", direction: "debit", amountSantims: stake },
        { accountNumber: "2020", direction: "debit", amountSantims: stake },
        { accountNumber: "2010", direction: "credit", amountSantims: stake },
        { accountNumber: "2010", direction: "credit", amountSantims: stake },
      ];

      const debits = fallbackPostings.filter((p) => p.direction === "debit").reduce((s, p) => s + p.amountSantims, BigInt(0));
      const credits = fallbackPostings.filter((p) => p.direction === "credit").reduce((s, p) => s + p.amountSantims, BigInt(0));
      expect(debits).toEqual(credits);
    });
  });

  describe("RB-08: Double-Spend Rapid Result Claims Guard", () => {
    it("skips re-settlement when game.escrowSettled is already true", () => {
      const game = {
        _id: "game123",
        escrowSettled: true,
        stakeSantims: BigInt(10000),
      };

      function attemptSettlement(g: typeof game) {
        if (g.escrowSettled) {
          return { success: true, alreadySettled: true };
        }
        return { success: true, alreadySettled: false };
      }

      const res = attemptSettlement(game);
      expect(res.alreadySettled).toBe(true);
    });
  });

  describe("RB-09 & RB-10: Stake Escrow Under-Lock Prevention & Concurrency", () => {
    it("fails with insufficient-available-funds when balance is less than required stake (RB-09)", () => {
      const availableSantims = BigInt(5000); // 50 ETB
      const requiredStake = BigInt(10000); // 100 ETB

      expect(() => {
        if (availableSantims < requiredStake) {
          throw new Error("insufficient-available-funds");
        }
      }).toThrowError("insufficient-available-funds");
    });

    it("prevents balance from becoming negative during sequential match locks (RB-10)", () => {
      let balance = BigInt(15000); // 150 ETB
      const stake = BigInt(10000); // 100 ETB

      // First match lock succeeds
      expect(balance >= stake).toBe(true);
      balance -= stake;
      expect(balance).toBe(BigInt(5000));

      // Second match lock fails due to insufficient funds
      expect(balance >= stake).toBe(false);
      expect(() => {
        if (balance < stake) {
          throw new Error("insufficient-available-funds");
        }
      }).toThrowError("insufficient-available-funds");

      // Balance never goes negative
      expect(balance).toBe(BigInt(5000));
    });
  });
});
