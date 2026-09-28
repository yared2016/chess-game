// convex/__tests__/achievements.test.ts
import { describe, it, expect } from "vitest";
import { ACHIEVEMENTS_CATALOG } from "../achievements";

describe("Achievements Catalog & Logic", () => {
  it("contains all required core achievements", () => {
    const keys = ACHIEVEMENTS_CATALOG.map((a) => a.key);
    expect(keys).toContain("first_win");
    expect(keys).toContain("streak_3");
    expect(keys).toContain("streak_5");
    expect(keys).toContain("puzzle_10");
    expect(keys).toContain("elo_1400");
    expect(keys).toContain("elo_1600");
  });

  it("calculates progress percentages bounded between 0 and 100", () => {
    const wins = 2;
    const targetWins = 5;
    const progress = Math.min(100, Math.max(0, (wins / targetWins) * 100));
    expect(progress).toBe(40);

    const excessWins = 10;
    const boundedProgress = Math.min(100, Math.max(0, (excessWins / targetWins) * 100));
    expect(boundedProgress).toBe(100);
  });

  it("categorizes achievements appropriately", () => {
    const combat = ACHIEVEMENTS_CATALOG.filter((a) => a.category === "combat");
    const tactics = ACHIEVEMENTS_CATALOG.filter((a) => a.category === "tactics");
    const mastery = ACHIEVEMENTS_CATALOG.filter((a) => a.category === "mastery");

    expect(combat.length).toBeGreaterThanOrEqual(2);
    expect(tactics.length).toBeGreaterThanOrEqual(2);
    expect(mastery.length).toBeGreaterThanOrEqual(2);
  });
});
