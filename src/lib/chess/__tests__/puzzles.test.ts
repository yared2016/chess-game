// src/lib/chess/__tests__/puzzles.test.ts
import { describe, it, expect } from "vitest";
import { Chess } from "chess.js";
import { TACTICAL_PUZZLES, getDailyPuzzle, getFilteredPuzzles } from "../puzzles-data";

describe("Tactical Puzzles Database", () => {
  it("contains at least 15 verified tactical puzzles", () => {
    expect(TACTICAL_PUZZLES.length).toBeGreaterThanOrEqual(15);
  });

  it("has unique puzzle IDs", () => {
    const ids = new Set(TACTICAL_PUZZLES.map((p) => p.puzzleId));
    expect(ids.size).toBe(TACTICAL_PUZZLES.length);
  });

  it("verifies every single puzzle has legal FEN and executable solution moves", () => {
    for (const puzzle of TACTICAL_PUZZLES) {
      const chess = new Chess(puzzle.fen);
      expect(chess.fen()).toBeDefined();

      for (let i = 0; i < puzzle.moves.length; i++) {
        const moveSan = puzzle.moves[i];
        const moveResult = chess.move(moveSan);
        expect(
          moveResult,
          `Puzzle ${puzzle.puzzleId} (${puzzle.title}): move ${i + 1} "${moveSan}" must be legal in FEN ${chess.fen()}`
        ).not.toBeNull();
      }

      // If themes include mateIn1 / mateIn2 / mateIn3, verify position ended in checkmate
      const isMateTheme = puzzle.themes.some((t) => t.startsWith("mateIn"));
      if (isMateTheme && puzzle.moves.length % 2 === 1) {
        expect(
          chess.isCheckmate(),
          `Puzzle ${puzzle.puzzleId} ending with player move should be checkmate`
        ).toBe(true);
      }
    }
  });

  it("returns deterministic daily puzzles based on date", () => {
    const d1 = new Date("2026-09-27T12:00:00Z");
    const d2 = new Date("2026-09-27T23:59:59Z");
    const d3 = new Date("2026-09-28T00:01:00Z");

    const p1 = getDailyPuzzle(d1);
    const p2 = getDailyPuzzle(d2);
    expect(p1.puzzleId).toBe(p2.puzzleId);

    const p3 = getDailyPuzzle(d3);
    expect(p3).toBeDefined();
  });

  it("filters puzzles by theme and rating", () => {
    const forks = getFilteredPuzzles({ theme: "fork" });
    expect(forks.length).toBeGreaterThan(0);
    expect(forks.every((p) => p.themes.includes("fork"))).toBe(true);

    const beginner = getFilteredPuzzles({ maxRating: 1000 });
    expect(beginner.length).toBeGreaterThan(0);
    expect(beginner.every((p) => p.rating <= 1000)).toBe(true);
  });
});
