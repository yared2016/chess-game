import { describe, it, expect } from "vitest";
import { classifyMove, MOVE_CLASSIFICATIONS } from "../move-classification";

describe("move-classification", () => {
  it("classifies matching best move as best", () => {
    const result = classifyMove("Nf3", "Nf3", 50, 55, "w");
    expect(result.quality).toBe("best");
    expect(result.badge).toBe("★");
  });

  it("classifies sacrifice matching best move as brilliant", () => {
    const result = classifyMove("Rxf7+", "Rxf7+", 100, 350, "w", true);
    expect(result.quality).toBe("brilliant");
    expect(result.badge).toBe("!!");
  });

  it("classifies small centipawn loss as excellent or good", () => {
    // Loss of 10 cp
    const excellent = classifyMove("d4", "e4", 30, 20, "w");
    expect(excellent.quality).toBe("excellent");

    // Loss of 30 cp
    const good = classifyMove("c4", "e4", 30, 0, "w");
    expect(good.quality).toBe("good");
  });

  it("classifies larger loss as inaccuracy, mistake, or blunder", () => {
    // Inaccuracy: loss of 80 cp
    const inaccuracy = classifyMove("h3", "e4", 50, -30, "w");
    expect(inaccuracy.quality).toBe("inaccuracy");
    expect(inaccuracy.badge).toBe("?!");

    // Mistake: loss of 180 cp
    const mistake = classifyMove("g4", "e4", 50, -130, "w");
    expect(mistake.quality).toBe("mistake");
    expect(mistake.badge).toBe("?");

    // Blunder: loss of 350 cp
    const blunder = classifyMove("f3", "e4", 50, -300, "w");
    expect(blunder.quality).toBe("blunder");
    expect(blunder.badge).toBe("??");
  });

  it("correctly handles Black's perspective", () => {
    // Before move: White was +100 (Black was -100).
    // After Black's move: White is now +500 (Black is -500).
    // Centipawn loss for Black = -100 - (-500) = 400 cp loss -> Blunder!
    const blackBlunder = classifyMove("Qe7??", "Nf6", 100, 500, "b");
    expect(blackBlunder.quality).toBe("blunder");

    // Black plays best move: White was +100, after move White is +90 (Black gained 10 cp)
    const blackBest = classifyMove("c5", "c5", 100, 90, "b");
    expect(blackBest.quality).toBe("best");
  });
});
