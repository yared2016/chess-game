// convex/__tests__/tournaments.test.ts
import { describe, it, expect } from "vitest";

describe("Tournament Arena Scoring Rules", () => {
  function calculateArenaPoints(prevScore: number, prevStreak: number, outcome: "win" | "draw" | "loss") {
    if (outcome === "win") {
      const isStreakBonus = prevStreak >= 2;
      const points = isStreakBonus ? 3 : 2;
      return {
        score: prevScore + points,
        streak: prevStreak + 1,
        pointsAwarded: points,
      };
    }
    if (outcome === "draw") {
      return {
        score: prevScore + 1,
        streak: 0,
        pointsAwarded: 1,
      };
    }
    return {
      score: prevScore,
      streak: 0,
      pointsAwarded: 0,
    };
  }

  it("awards 2 points for a normal first win", () => {
    const res = calculateArenaPoints(0, 0, "win");
    expect(res.pointsAwarded).toBe(2);
    expect(res.score).toBe(2);
    expect(res.streak).toBe(1);
  });

  it("awards 2 points for a second consecutive win", () => {
    const res = calculateArenaPoints(2, 1, "win");
    expect(res.pointsAwarded).toBe(2);
    expect(res.score).toBe(4);
    expect(res.streak).toBe(2);
  });

  it("activates streak bonus and awards 3 points on 3rd consecutive win", () => {
    const res = calculateArenaPoints(4, 2, "win");
    expect(res.pointsAwarded).toBe(3);
    expect(res.score).toBe(7);
    expect(res.streak).toBe(3);
  });

  it("resets win streak to 0 upon a draw and awards 1 point", () => {
    const res = calculateArenaPoints(7, 3, "draw");
    expect(res.pointsAwarded).toBe(1);
    expect(res.score).toBe(8);
    expect(res.streak).toBe(0);
  });

  it("resets win streak to 0 upon a loss and awards 0 points", () => {
    const res = calculateArenaPoints(8, 0, "loss");
    expect(res.pointsAwarded).toBe(0);
    expect(res.score).toBe(8);
    expect(res.streak).toBe(0);
  });
});
