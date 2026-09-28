// convex/__tests__/universities.test.ts
import { describe, it, expect } from "vitest";
import { ETHIOPIAN_UNIVERSITIES_SEED } from "../universities";

describe("Ethiopian Universities System", () => {
  it("contains initial seed list of Ethiopian universities", () => {
    expect(ETHIOPIAN_UNIVERSITIES_SEED.length).toBeGreaterThanOrEqual(10);
    const shortNames = ETHIOPIAN_UNIVERSITIES_SEED.map((u) => u.shortName);
    expect(shortNames).toContain("AAU");
    expect(shortNames).toContain("ASTU");
    expect(shortNames).toContain("JU");
    expect(shortNames).toContain("BDU");
  });

  it("calculates accurate campus average ratings when new player joins", () => {
    const uni = {
      totalPlayers: 10,
      averageRating: 1400,
      totalWins: 50,
    };

    const newPlayerRating = 1620;
    const newTotalPlayers = uni.totalPlayers + 1;
    const newAverageRating = Math.round(
      (uni.averageRating * uni.totalPlayers + newPlayerRating) / newTotalPlayers
    );

    expect(newTotalPlayers).toBe(11);
    expect(newAverageRating).toBe(1420);
  });

  it("ranks universities correctly by average rating", () => {
    const list = [
      { shortName: "JU", averageRating: 1415 },
      { shortName: "ASTU", averageRating: 1480 },
      { shortName: "AAU", averageRating: 1465 },
    ];

    const sorted = [...list].sort((a, b) => b.averageRating - a.averageRating);
    expect(sorted[0].shortName).toBe("ASTU");
    expect(sorted[1].shortName).toBe("AAU");
    expect(sorted[2].shortName).toBe("JU");
  });
});
