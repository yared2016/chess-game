// @vitest-environment node
import { describe, expect, it } from "vitest";
import { Chess } from "chess.js";
import type { Premove, SquareId } from "@/lib/types";

describe("Pre-move mechanics", () => {
  it("validates a legal queued premove when the opponent move arrives", () => {
    // Initial position: White to move
    const chess = new Chess();
    // Black queues e7 -> e5 as premove while White is thinking
    const blackPremove: Premove = { from: "e7", to: "e5" };

    // White plays e2 -> e4
    chess.move({ from: "e2", to: "e4" });

    // Now it is Black's turn: validate and apply queued premove
    const executed = chess.move({
      from: blackPremove.from,
      to: blackPremove.to,
      promotion: blackPremove.promotion ?? "q",
    });

    expect(executed).not.toBeNull();
    expect(executed.san).toBe("e5");
    expect(chess.turn()).toBe("w");
  });

  it("gracefully catches and discards an illegal premove without crashing", () => {
    const chess = new Chess();
    // Black queues Nf6, but White plays e4 and then imagine Black queued an impossible move like e7 -> e4 (occupied by White pawn)
    const impossiblePremove: Premove = { from: "e7", to: "e4" };

    // White plays e4
    chess.move({ from: "e2", to: "e4" });

    // Black's premove should fail to execute because e4 is occupied by White's pawn
    let executed = null;
    let failed = false;
    try {
      executed = chess.move({
        from: impossiblePremove.from,
        to: impossiblePremove.to,
        promotion: impossiblePremove.promotion ?? "q",
      });
    } catch {
      failed = true;
    }

    expect(executed === null || failed).toBe(true);
    // The board state remains untouched on Black's turn
    expect(chess.turn()).toBe("b");
  });

  it("handles pawn promotion premove with default queen promotion", () => {
    // Position where White pawn is on e7 and Black is to move
    const chess = new Chess("8/4P3/8/8/8/8/k6K/8 b - - 0 1");
    // White queues e7 -> e8
    const whitePremove: Premove = { from: "e7", to: "e8", promotion: "q" };

    // Black makes a king move
    chess.move("Ka3");

    // White's turn arrives: execute premove
    const executed = chess.move({
      from: whitePremove.from,
      to: whitePremove.to,
      promotion: whitePremove.promotion ?? "q",
    });

    expect(executed).not.toBeNull();
    expect(executed.promotion).toBe("q");
    expect(executed.piece).toBe("p");
    expect(chess.get("e8" as SquareId)?.type).toBe("q");
  });

  it("correctly identifies pseudo-legal moves for premove target guidance", () => {
    // White to move, Black wants guidance for their pawn on c7
    const fen = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1";
    // We flip the active color to check Black's pseudo-legal moves
    const parts = fen.split(" ");
    parts[1] = "b";
    parts[3] = "-";
    const pseudoFen = parts.join(" ");

    const chess = new Chess(pseudoFen);
    const c7Moves = chess.moves({ square: "c7" as SquareId, verbose: true });
    const targetSquares = c7Moves.map((m) => m.to);

    expect(targetSquares).toContain("c6");
    expect(targetSquares).toContain("c5");
  });
});
