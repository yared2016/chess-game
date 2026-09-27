"use client";
// src/hooks/use-board-evaluation.ts
// Background position evaluation hook using browser Stockfish for live EvalBar and position review.

import { useEffect, useState, useRef } from "react";
import { acquireEngine, releaseEngine, type StockfishEngine } from "@/lib/engine/stockfish-client";

export interface BoardEvaluation {
  /** Centipawn evaluation from White's perspective (positive = White is winning). */
  scoreCp: number | null;
  /** Mate in N from White's perspective (positive = White mates, negative = Black mates). */
  mateIn: number | null;
  depth: number;
  isSearching: boolean;
}

export function useBoardEvaluation(
  fen: string,
  enabled = true
): BoardEvaluation {
  const [engine, setEngine] = useState<StockfishEngine | null>(null);
  const [scoreCp, setScoreCp] = useState<number | null>(null);
  const [mateIn, setMateIn] = useState<number | null>(null);
  const [depth, setDepth] = useState<number>(0);
  const [isSearching, setIsSearching] = useState(false);

  // Engine lifecycle management
  useEffect(() => {
    if (!enabled) return;

    let active = true;
    let engineInstance: StockfishEngine | null = null;

    try {
      engineInstance = acquireEngine();
      if (active) setEngine(engineInstance);
    } catch {}

    return () => {
      active = false;
      if (engineInstance) {
        releaseEngine();
      }
    };
  }, [enabled]);

  // Evaluate position whenever FEN changes
  useEffect(() => {
    if (!enabled || !engine || !fen) return;

    let cancelled = false;
    const abortController = new AbortController();

    async function evaluate() {
      setIsSearching(true);
      try {
        await engine!.init();
        if (cancelled) return;

        const isWhiteTurn = fen.split(" ")[1] === "w";
        const result = await engine!.search({
          fen,
          depth: 12,
          multiPv: 1,
          timeoutMs: 2500,
          signal: abortController.signal,
        });

        if (cancelled) return;

        const top = result.lines[0];
        if (top) {
          // Normalize score to White's POV:
          // Stockfish score is from side-to-move's perspective
          const normalizedCp =
            top.scoreCp !== null
              ? isWhiteTurn
                ? top.scoreCp
                : -top.scoreCp
              : null;

          const normalizedMate =
            top.mateIn !== null
              ? isWhiteTurn
                ? top.mateIn
                : -top.mateIn
              : null;

          setScoreCp(normalizedCp);
          setMateIn(normalizedMate);
          setDepth(top.depth);
        }
      } catch {
        // Aborted or engine busy
      } finally {
        if (!cancelled) {
          setIsSearching(false);
        }
      }
    }

    void evaluate();

    return () => {
      cancelled = true;
      abortController.abort();
    };
  }, [enabled, engine, fen]);

  return {
    scoreCp,
    mateIn,
    depth,
    isSearching,
  };
}
