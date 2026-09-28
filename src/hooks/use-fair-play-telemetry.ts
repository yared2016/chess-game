// src/hooks/use-fair-play-telemetry.ts
"use client";

import { useEffect, useRef } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

interface TelemetryOptions {
  gameId: Id<"games">;
  isMyTurn: boolean;
  isOnlineGame: boolean;
  isGameOver: boolean;
  moveCount: number;
}

export function useFairPlayTelemetry({
  gameId,
  isMyTurn,
  isOnlineGame,
  isGameOver,
  moveCount,
}: TelemetryOptions) {
  const recordTelemetry = useMutation(api.fairPlay.recordGameTelemetry);

  const blurCountRef = useRef<number>(0);
  const turnStartTimeRef = useRef<number | null>(null);
  const moveTimesRef = useRef<number[]>([]);
  const prevMoveCountRef = useRef<number>(moveCount);
  const reportedRef = useRef<boolean>(false);

  // Track turn start timestamp and move durations
  useEffect(() => {
    if (!isOnlineGame) return;

    if (isMyTurn) {
      turnStartTimeRef.current = Date.now();
    } else if (turnStartTimeRef.current !== null && moveCount > prevMoveCountRef.current) {
      // Move was just made by me
      const durationMs = Date.now() - turnStartTimeRef.current;
      moveTimesRef.current.push(durationMs);
      turnStartTimeRef.current = null;
    }
    prevMoveCountRef.current = moveCount;
  }, [isMyTurn, isOnlineGame, moveCount]);

  // Track window/tab blur specifically while it is the player's turn
  useEffect(() => {
    if (!isOnlineGame) return;

    const handleBlur = () => {
      if (isMyTurn && !isGameOver) {
        blurCountRef.current += 1;
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden" && isMyTurn && !isGameOver) {
        blurCountRef.current += 1;
      }
    };

    window.addEventListener("blur", handleBlur);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("blur", handleBlur);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [isMyTurn, isOnlineGame, isGameOver]);

  // Report telemetry on game completion
  useEffect(() => {
    if (!isOnlineGame || !isGameOver || reportedRef.current) return;

    const times = moveTimesRef.current;
    const totalMoves = times.length;

    // Calculate mean move time
    const avgMoveTimeMs =
      times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : 3000;

    // Calculate standard deviation / variance
    const variance =
      times.length > 1
        ? Math.sqrt(
            times.map((x) => Math.pow(x - avgMoveTimeMs, 2)).reduce((a, b) => a + b, 0) /
              times.length
          )
        : 2000;

    const tabBlurCount = blurCountRef.current;
    const blursPerMove = totalMoves > 0 ? tabBlurCount / totalMoves : 0;

    reportedRef.current = true;

    recordTelemetry({
      gameId,
      tabBlurCount,
      blursPerMove,
      avgMoveTimeMs,
      moveTimeVariance: variance,
      totalMoves: Math.max(1, totalMoves),
    }).catch(() => {
      // Silent telemetry catch
    });
  }, [isOnlineGame, isGameOver, gameId, recordTelemetry]);
}
