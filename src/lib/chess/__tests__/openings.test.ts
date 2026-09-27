// src/lib/chess/__tests__/openings.test.ts
import { describe, expect, it } from "vitest";
import { detectOpening, OPENINGS } from "../openings";

describe("chess openings detection", () => {
  it("detects basic King's Pawn opening", () => {
    const match = detectOpening(["e4"]);
    expect(match).not.toBeNull();
    expect(match?.name).toBe("King's Pawn Opening");
    expect(match?.eco).toBe("B00");
  });

  it("detects Sicilian Defense", () => {
    const match = detectOpening(["e4", "c5"]);
    expect(match).not.toBeNull();
    expect(match?.name).toBe("Sicilian Defense");
    expect(match?.eco).toBe("B20");
  });

  it("detects Sicilian Defense: Najdorf Variation with deep moves", () => {
    const moves = ["e4", "c5", "Nf3", "d6", "d4", "cxd4", "Nxd4", "Nf6", "Nc3", "a6"];
    const match = detectOpening(moves);
    expect(match).not.toBeNull();
    expect(match?.name).toBe("Sicilian Defense");
    expect(match?.variation).toBe("Najdorf Variation");
    expect(match?.eco).toBe("B90");
    expect(match?.fullName).toBe("Sicilian Defense: Najdorf Variation");
    expect(match?.plyCount).toBe(10);
  });

  it("detects Ruy Lopez Berlin Defense", () => {
    const moves = ["e4", "e5", "Nf3", "Nc6", "Bb5", "Nf6"];
    const match = detectOpening(moves);
    expect(match).not.toBeNull();
    expect(match?.name).toBe("Ruy Lopez");
    expect(match?.variation).toBe("Berlin Defense");
    expect(match?.eco).toBe("C65");
  });

  it("detects Queen's Gambit Declined Exchange Variation", () => {
    const moves = ["d4", "d5", "c4", "e6", "Nc3", "Nf6", "cxd5", "exd5"];
    const match = detectOpening(moves);
    expect(match).not.toBeNull();
    expect(match?.name).toBe("Queen's Gambit Declined");
    expect(match?.variation).toBe("Exchange Variation");
    expect(match?.eco).toBe("D35");
  });

  it("detects London System", () => {
    const moves = ["d4", "d5", "Bf4"];
    const match = detectOpening(moves);
    expect(match).not.toBeNull();
    expect(match?.name).toBe("London System");
  });

  it("handles string format input e.g. from PGN", () => {
    const pgnMoves = "1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. c3";
    const match = detectOpening(pgnMoves);
    expect(match).not.toBeNull();
    expect(match?.name).toBe("Italian Game");
    expect(match?.variation).toBe("Giuoco Piano");
  });

  it("tolerates check/checkmate suffixes in move list", () => {
    const moves = ["e4", "c5", "Nf3", "d6", "Bb5+"];
    const match = detectOpening(moves);
    expect(match).not.toBeNull();
    expect(match?.name).toBe("Sicilian Defense");
    expect(match?.variation).toBe("Canal-Sokolsky Attack");
  });

  it("returns null for empty moves", () => {
    expect(detectOpening([])).toBeNull();
    expect(detectOpening("")).toBeNull();
  });

  it("contains more than 50 standard openings in database", () => {
    expect(OPENINGS.length).toBeGreaterThan(50);
  });
});
