// src/lib/chess/__tests__/profile-openings.test.ts
import { describe, it, expect } from "vitest";
import { detectOpening } from "../openings";

describe("Profile Opening Analytics Processing", () => {
  it("correctly identifies Italian Game and updates win/loss stats", () => {
    const mockGames = [
      { moves: ["e4", "e5", "Nf3", "Nc6", "Bc4"], outcome: "win" as const, color: "w" as const },
      { moves: ["e4", "e5", "Nf3", "Nc6", "Bc4", "Bc5"], outcome: "win" as const, color: "w" as const },
      { moves: ["e4", "e5", "Nf3", "Nc6", "Bc4", "Nf6"], outcome: "loss" as const, color: "w" as const },
      { moves: ["e4", "c5"], outcome: "win" as const, color: "b" as const }, // Sicilian as Black
    ];

    const whiteOpenings: Record<string, { total: number; wins: number; losses: number; draws: number }> = {};
    const blackOpenings: Record<string, { total: number; wins: number; losses: number; draws: number }> = {};

    for (const g of mockGames) {
      const match = detectOpening(g.moves);
      expect(match).not.toBeNull();
      const target = g.color === "w" ? whiteOpenings : blackOpenings;
      const key = match!.name;
      if (!target[key]) {
        target[key] = { total: 0, wins: 0, losses: 0, draws: 0 };
      }
      target[key].total += 1;
      if (g.outcome === "win") target[key].wins += 1;
      else if (g.outcome === "loss") target[key].losses += 1;
      else target[key].draws += 1;
    }

    // Italian Game
    const italianKey = "Italian Game";
    const italianStat = Object.entries(whiteOpenings).find(([k]) => k.startsWith(italianKey))?.[1];
    expect(italianStat).toBeDefined();
    expect(italianStat!.total).toBe(3);
    expect(italianStat!.wins).toBe(2);
    expect(italianStat!.losses).toBe(1);

    // Sicilian Defense as Black
    const sicilianKey = "Sicilian Defense";
    const sicilianStat = Object.entries(blackOpenings).find(([k]) => k.startsWith(sicilianKey))?.[1];
    expect(sicilianStat).toBeDefined();
    expect(sicilianStat!.total).toBe(1);
    expect(sicilianStat!.wins).toBe(1);
  });

  it("handles Scandinavian Defense as White and Black", () => {
    const scandiMoves = ["e4", "d5"];
    const match = detectOpening(scandiMoves);
    expect(match).toBeDefined();
    expect(match?.name).toBe("Scandinavian Defense");
    expect(match?.eco).toBe("B01");
  });
});
