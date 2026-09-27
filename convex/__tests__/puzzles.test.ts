// convex/__tests__/puzzles.test.ts
import { describe, it, expect } from "vitest";
import { puzzleRatingDelta } from "../puzzles";

describe("Puzzle Rating Delta", () => {
  it("awards +12 when solving an equally rated puzzle", () => {
    const delta = puzzleRatingDelta(1200, 1200, true);
    expect(delta).toBe(12);
  });

  it("penalizes -12 when failing an equally rated puzzle", () => {
    const delta = puzzleRatingDelta(1200, 1200, false);
    expect(delta).toBe(-12);
  });

  it("awards large points when solving a much harder puzzle", () => {
    const delta = puzzleRatingDelta(1200, 1600, true);
    expect(delta).toBeGreaterThan(20);
  });

  it("penalizes very few points when failing a much harder puzzle", () => {
    const delta = puzzleRatingDelta(1200, 1600, false);
    expect(delta).toBeLessThanOrEqual(0);
    expect(delta).toBeGreaterThanOrEqual(-5);
  });

  it("awards few points when solving a much easier puzzle", () => {
    const delta = puzzleRatingDelta(1600, 1000, true);
    expect(delta).toBeLessThanOrEqual(3);
    expect(delta).toBeGreaterThan(0);
  });
});
