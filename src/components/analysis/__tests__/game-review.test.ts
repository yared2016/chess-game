// src/components/analysis/__tests__/game-review.test.ts
import { describe, it, expect } from "vitest";
import { generateGameReview } from "../game-review-panel";

describe("Game Review & Evaluation Curve Generator", () => {
  it("generates review data with valid accuracies for empty moves", () => {
    const review = generateGameReview([]);
    expect(review.whiteAccuracy).toBeGreaterThanOrEqual(65);
    expect(review.blackAccuracy).toBeGreaterThanOrEqual(65);
    expect(review.moves.length).toBe(0);
  });

  it("classifies opening moves as book moves", () => {
    const moves = ["e4", "e5", "Nf3", "Nc6", "Bc4", "Bc5", "c3", "Nf6"];
    const review = generateGameReview(moves);
    expect(review.moves.length).toBe(8);

    // First 6 plies should be classified as book
    const firstSix = review.moves.slice(0, 6);
    firstSix.forEach((pt) => {
      expect(pt.classification).toBe("book");
    });
  });

  it("calculates accuracy percentages bounded between 0 and 100", () => {
    const sampleMoves = [
      "e4", "c5", "Nf3", "d6", "d4", "cxd4", "Nxd4", "Nf6", "Nc3", "a6",
      "Be3", "e5", "Nb3", "Be6", "f3", "Be7", "Qd2", "O-O", "O-O-O", "Nbd7"
    ];
    const review = generateGameReview(sampleMoves);

    expect(review.whiteAccuracy).toBeGreaterThanOrEqual(60);
    expect(review.whiteAccuracy).toBeLessThanOrEqual(100);
    expect(review.blackAccuracy).toBeGreaterThanOrEqual(60);
    expect(review.blackAccuracy).toBeLessThanOrEqual(100);
  });
});
