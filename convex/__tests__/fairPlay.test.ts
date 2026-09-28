// convex/__tests__/fairPlay.test.ts
// Unit tests for Castle Fair Play & Anti-Cheat Engine (CFP-AC).
import { describe, expect, it } from "vitest";
import { computeSuspicionScore } from "../fairPlay";

describe("Castle Fair Play & Anti-Cheat Engine (CFP-AC)", () => {
  it("evaluates clean human play with low suspicion score", () => {
    const cleanHuman = computeSuspicionScore({
      tabBlurCount: 0,
      blursPerMove: 0,
      moveTimeVariance: 3200, // natural human contrast: fast recaptures vs deep thinks
      totalMoves: 28,
      acpl: 45, // realistic amateur centipawn loss
      top1MatchRate: 52,
      playerRating: 1350,
    });

    expect(cleanHuman.score).toBeLessThan(25);
    expect(cleanHuman.isFlagged).toBe(false);
    expect(cleanHuman.reasons).toEqual([]);
  });

  it("flags blatant external tab switching during turns", () => {
    const cheater = computeSuspicionScore({
      tabBlurCount: 12,
      blursPerMove: 0.65, // defocused on 65% of turns
      moveTimeVariance: 650, // mechanically uniform 4s per move
      totalMoves: 20,
      acpl: 12, // engine accuracy
      top1MatchRate: 94,
      playerRating: 1280,
    });

    expect(cheater.score).toBeGreaterThanOrEqual(80);
    expect(cheater.isFlagged).toBe(true);
    expect(cheater.reasons.length).toBeGreaterThan(1);
    expect(cheater.reasons.some((r) => r.includes("defocus"))).toBe(true);
    expect(cheater.reasons.some((r) => r.includes("centipawn") || r.includes("uniform"))).toBe(true);
  });

  it("identifies unnatural timing cadence without human variance", () => {
    const cadenceAnomaly = computeSuspicionScore({
      tabBlurCount: 1,
      blursPerMove: 0.05,
      moveTimeVariance: 500, // robotic ~4s per move even on forced checks
      totalMoves: 22,
      acpl: 14,
      playerRating: 1400,
    });

    expect(cadenceAnomaly.score).toBeGreaterThanOrEqual(70);
    expect(cadenceAnomaly.isFlagged).toBe(true);
    expect(cadenceAnomaly.reasons.some((r) => r.includes("timing"))).toBe(true);
  });
});
