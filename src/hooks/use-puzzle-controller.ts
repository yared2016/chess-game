// src/hooks/use-puzzle-controller.ts
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Chess } from "chess.js";
import type {
  BoardPiece,
  BoardViewProps,
  CapturedPieces,
  Colour,
  LastMove,
  LegalTarget,
  PromotionPiece,
  SquareId,
} from "@/lib/types";
import { checkSquareOf, legalTargetsFor, needsPromotion } from "@/lib/chess";
import { derivePieces, EMPTY_PIECE_TRACKER_STATE, type PieceTrackerState } from "@/lib/piece-tracker";
import type { TacticalPuzzle } from "@/lib/chess/puzzles-data";

export type PuzzleStatus = "idle" | "playing" | "opponent-turn" | "solved" | "failed";

export interface UsePuzzleControllerOptions {
  puzzle: TacticalPuzzle;
  onSolve?: (result: { timeTakenMs: number }) => void;
  onFail?: () => void;
  onNext?: () => void;
}

export function usePuzzleController({
  puzzle,
  onSolve,
  onFail,
  onNext,
}: UsePuzzleControllerOptions) {
  const [fen, setFen] = useState<string>(puzzle.fen);
  const [currentPlyIndex, setCurrentPlyIndex] = useState<number>(0);
  const [status, setStatus] = useState<PuzzleStatus>("playing");
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [selectedSquare, setSelectedSquare] = useState<SquareId | null>(null);
  const [lastMove, setLastMove] = useState<LastMove | null>(null);
  const [promotionPrompt, setPromotionPrompt] = useState<{
    from: SquareId;
    to: SquareId;
    colour: Colour;
  } | null>(null);
  const [hintsRevealed, setHintsRevealed] = useState<number>(0);
  const [trackerState, setTrackerState] = useState<PieceTrackerState>(EMPTY_PIECE_TRACKER_STATE);

  const startTimeRef = useRef<number>(Date.now());
  const chessRef = useRef<Chess>(new Chess(puzzle.fen));
  const opponentTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Determine user orientation based on side to move in starting FEN
  const orientation: Colour = useMemo(() => {
    const c = new Chess(puzzle.fen);
    return c.turn() as Colour;
  }, [puzzle.fen]);

  // Reset state when puzzle changes
  useEffect(() => {
    if (opponentTimerRef.current) {
      clearTimeout(opponentTimerRef.current);
    }
    const c = new Chess(puzzle.fen);
    chessRef.current = c;
    setFen(puzzle.fen);
    setCurrentPlyIndex(0);
    setStatus("playing");
    setSelectedSquare(null);
    setLastMove(null);
    setPromotionPrompt(null);
    setHintsRevealed(0);
    startTimeRef.current = Date.now();

    const turnName = orientation === "w" ? "White" : "Black";
    setStatusMessage(`${turnName} to move — ${puzzle.description}`);

    const initial = derivePieces(EMPTY_PIECE_TRACKER_STATE, puzzle.fen, 0, () => null);
    setTrackerState(initial);

    return () => {
      if (opponentTimerRef.current) {
        clearTimeout(opponentTimerRef.current);
      }
    };
  }, [puzzle.puzzleId, puzzle.fen, puzzle.description, orientation]);

  const turn = useMemo(() => chessRef.current.turn() as Colour, [fen]);
  const checkSquare = useMemo(() => checkSquareOf(fen), [fen]);

  const legalTargets: LegalTarget[] = useMemo(() => {
    if (!selectedSquare || status !== "playing") return [];
    return legalTargetsFor(fen, selectedSquare);
  }, [fen, selectedSquare, status]);

  const captured: CapturedPieces = useMemo(() => {
    // Derive captured pieces
    const current = new Chess(fen).board();
    const counts: Record<string, number> = {
      p: 8, r: 2, n: 2, b: 2, q: 1, k: 1,
      P: 8, R: 2, N: 2, B: 2, Q: 1, K: 1,
    };
    for (const row of current) {
      for (const sq of row) {
        if (sq) {
          const key = sq.color === "w" ? sq.type.toUpperCase() : sq.type.toLowerCase();
          counts[key] = (counts[key] ?? 0) - 1;
        }
      }
    }
    const w: any[] = [];
    const b: any[] = [];
    for (const [k, count] of Object.entries(counts)) {
      for (let i = 0; i < Math.max(0, count); i++) {
        if (k === k.toUpperCase()) b.push(k.toLowerCase());
        else w.push(k);
      }
    }
    return { w, b };
  }, [fen]);

  const applyMove = useCallback(
    (from: SquareId, to: SquareId, promo?: PromotionPiece): boolean => {
      const chess = chessRef.current;
      const expectedSan = puzzle.moves[currentPlyIndex];
      if (!expectedSan) return false;

      let moveResult;
      try {
        moveResult = chess.move({ from, to, promotion: promo ?? "q" });
      } catch {
        return false;
      }

      if (!moveResult) return false;

      const playedSan = moveResult.san;
      const isCorrect = playedSan === expectedSan;

      if (!isCorrect) {
        // Undo incorrect move
        chess.undo();
        setStatus("failed");
        setStatusMessage("Incorrect move! Try again or reveal the solution.");
        setSelectedSquare(null);
        if (onFail) onFail();
        return false;
      }

      // Legal & Correct move!
      const newFen = chess.fen();
      setFen(newFen);
      setSelectedSquare(null);

      const nextPly = currentPlyIndex + 1;
      setCurrentPlyIndex(nextPly);

      const moveObj: LastMove = {
        from,
        to,
        san: playedSan,
        colour: moveResult.color as Colour,
        captured: moveResult.captured as any,
      };
      setLastMove(moveObj);

      setTrackerState((prev) =>
        derivePieces(prev, newFen, nextPly, () => moveObj),
      );

      // Check if puzzle is fully solved
      if (nextPly >= puzzle.moves.length) {
        setStatus("solved");
        setStatusMessage("Brilliant! Puzzle Solved!");
        const timeTakenMs = Date.now() - startTimeRef.current;
        if (onSolve) onSolve({ timeTakenMs });
        return true;
      }

      // Otherwise, opponent makes automated response
      const opponentSan = puzzle.moves[nextPly];
      if (opponentSan) {
        setStatus("opponent-turn");
        setStatusMessage("Opponent is replying...");

        opponentTimerRef.current = setTimeout(() => {
          try {
            const oppMove = chess.move(opponentSan);
            if (oppMove) {
              const oppFen = chess.fen();
              setFen(oppFen);
              const afterOppPly = nextPly + 1;
              setCurrentPlyIndex(afterOppPly);

              const oppLastMove: LastMove = {
                from: oppMove.from as SquareId,
                to: oppMove.to as SquareId,
                san: oppMove.san,
                colour: oppMove.color as Colour,
                captured: oppMove.captured as any,
              };
              setLastMove(oppLastMove);

              setTrackerState((prev) =>
                derivePieces(prev, oppFen, afterOppPly, () => oppLastMove),
              );

              // Check if that completed the puzzle
              if (afterOppPly >= puzzle.moves.length) {
                setStatus("solved");
                setStatusMessage("Puzzle Solved! Great tactic!");
                const timeTakenMs = Date.now() - startTimeRef.current;
                if (onSolve) onSolve({ timeTakenMs });
              } else {
                setStatus("playing");
                setStatusMessage("Your turn — find the next move!");
              }
            }
          } catch (err) {
            console.error("Failed opponent counter move:", err);
          }
        }, 500);
      }

      return true;
    },
    [puzzle.moves, currentPlyIndex, onSolve, onFail],
  );

  const onSquareSelect = useCallback(
    (square: SquareId) => {
      if (status !== "playing") return;

      if (!selectedSquare) {
        const piece = chessRef.current.get(square);
        if (piece && piece.color === chessRef.current.turn()) {
          setSelectedSquare(square);
        }
        return;
      }

      // If clicking same square, deselect
      if (selectedSquare === square) {
        setSelectedSquare(null);
        return;
      }

      // If clicking another piece of our color, switch selection
      const targetPiece = chessRef.current.get(square);
      if (targetPiece && targetPiece.color === chessRef.current.turn()) {
        setSelectedSquare(square);
        return;
      }

      // Check promotion
      if (needsPromotion(fen, selectedSquare, square)) {
        setPromotionPrompt({
          from: selectedSquare,
          to: square,
          colour: orientation,
        });
        return;
      }

      applyMove(selectedSquare, square);
    },
    [status, selectedSquare, fen, orientation, applyMove],
  );

  const onMove = useCallback(
    (from: SquareId, to: SquareId) => {
      if (status !== "playing") return;
      if (needsPromotion(fen, from, to)) {
        setPromotionPrompt({ from, to, colour: orientation });
        return;
      }
      applyMove(from, to);
    },
    [status, fen, orientation, applyMove],
  );

  const onPromotionChoice = useCallback(
    (piece: PromotionPiece | null) => {
      if (!promotionPrompt) return;
      if (piece) {
        applyMove(promotionPrompt.from, promotionPrompt.to, piece);
      }
      setPromotionPrompt(null);
    },
    [promotionPrompt, applyMove],
  );

  const onDeselect = useCallback(() => {
    setSelectedSquare(null);
  }, []);

  const retry = useCallback(() => {
    if (opponentTimerRef.current) {
      clearTimeout(opponentTimerRef.current);
    }
    const c = new Chess(puzzle.fen);
    chessRef.current = c;
    setFen(puzzle.fen);
    setCurrentPlyIndex(0);
    setStatus("playing");
    setSelectedSquare(null);
    setLastMove(null);
    setPromotionPrompt(null);
    startTimeRef.current = Date.now();
    const turnName = orientation === "w" ? "White" : "Black";
    setStatusMessage(`${turnName} to move — ${puzzle.description}`);

    const initial = derivePieces(EMPTY_PIECE_TRACKER_STATE, puzzle.fen, 0, () => null);
    setTrackerState(initial);
  }, [puzzle.fen, puzzle.description, orientation]);

  const showHint = useCallback(() => {
    const nextSan = puzzle.moves[currentPlyIndex];
    if (!nextSan) return;

    // Decode source square from next move
    const moves = chessRef.current.moves({ verbose: true });
    const match = moves.find((m) => m.san === nextSan);
    if (match) {
      setSelectedSquare(match.from as SquareId);
      setHintsRevealed((h) => h + 1);
      setStatusMessage(`Hint: Move piece from ${match.from.toUpperCase()}`);
    }
  }, [puzzle.moves, currentPlyIndex]);

  const revealSolution = useCallback(() => {
    if (opponentTimerRef.current) {
      clearTimeout(opponentTimerRef.current);
    }
    const chess = new Chess(puzzle.fen);
    for (const m of puzzle.moves) {
      chess.move(m);
    }
    chessRef.current = chess;
    setFen(chess.fen());
    setCurrentPlyIndex(puzzle.moves.length);
    setStatus("failed");
    setStatusMessage(`Solution: ${puzzle.moves.join(" ")}`);
    setSelectedSquare(null);

    const finalPieces = derivePieces(
      EMPTY_PIECE_TRACKER_STATE,
      chess.fen(),
      puzzle.moves.length,
      () => null,
    );
    setTrackerState(finalPieces);
  }, [puzzle.fen, puzzle.moves]);

  const boardProps: BoardViewProps = {
    fen,
    position: trackerState.pieces,
    orientation,
    turn,
    interactive: status === "playing",
    animate: true,
    selectedSquare,
    legalTargets,
    lastMove,
    checkSquare,
    captured,
    promotion: promotionPrompt,
    reviewPly: null,
    onSquareSelect,
    onMove,
    onPromotionChoice,
    onDeselect,
  };

  return {
    boardProps,
    status,
    statusMessage,
    hintsRevealed,
    currentPlyIndex,
    totalPlies: puzzle.moves.length,
    retry,
    showHint,
    revealSolution,
    onNext,
  };
}
