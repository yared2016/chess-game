"use client";

import { useEffect, useState, useRef } from "react";
import { acquireEngine, releaseEngine, type StockfishEngine, type SearchResult } from "@/lib/engine/stockfish-client";
import { linesToCandidates, uciToSan } from "@/lib/engine/candidates";
import { EvalBar } from "./eval-bar";
import { classifyMove, MOVE_CLASSIFICATIONS, type MoveClassification } from "./move-classification";
import { Sparkles, Cpu, Award, TrendingUp, ChevronRight } from "lucide-react";
import { cn } from "@/lib/ui";

export interface PositionAnalysisPanelProps {
  fen: string;
  orientation?: "w" | "b";
  reviewSan?: string | null;
  lastMoveMover?: "w" | "b" | null;
  className?: string;
}

export function PositionAnalysisPanel({
  fen,
  orientation = "w",
  reviewSan,
  lastMoveMover,
  className,
}: PositionAnalysisPanelProps) {
  const [engine, setEngine] = useState<StockfishEngine | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [scoreCp, setScoreCp] = useState<number | null>(null);
  const [mateIn, setMateIn] = useState<number | null>(null);
  const [depth, setDepth] = useState<number>(0);
  const [bestMoveSan, setBestMoveSan] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<Array<{ san: string; scoreText: string; pvText: string }>>([]);
  const [classification, setClassification] = useState<MoveClassification | null>(null);

  // Engine lifecycle management
  useEffect(() => {
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
  }, []);

  // Run search when fen changes
  useEffect(() => {
    if (!engine || !fen) return;

    let aborted = false;
    const abortController = new AbortController();

    async function evaluate() {
      setIsSearching(true);
      try {
        await engine!.init();
        if (aborted) return;

        const isWhiteTurn = fen.split(" ")[1] === "w";
        const result: SearchResult = await engine!.search({
          fen,
          depth: 13,
          multiPv: 3,
          timeoutMs: 3000,
          signal: abortController.signal,
        });

        if (aborted) return;

        const parsedCandidates = linesToCandidates(fen, result.lines);
        const top = result.lines[0];

        if (top) {
          // Normalise score to White's POV
          const currentCp = top.scoreCp !== null
            ? (isWhiteTurn ? top.scoreCp : -top.scoreCp)
            : null;
          const currentMate = top.mateIn !== null
            ? (isWhiteTurn ? top.mateIn : -top.mateIn)
            : null;

          setScoreCp(currentCp);
          setMateIn(currentMate);
          setDepth(top.depth);

          const topSan = top.pv[0] ? uciToSan(fen, top.pv[0]) : null;
          setBestMoveSan(topSan);

          // Build candidate list
          const linesList = parsedCandidates.slice(0, 3).map((c) => {
            const scoreLabel = c.mateIn !== null
              ? `M${Math.abs(c.mateIn)}`
              : c.scoreCp !== null
              ? `${(c.scoreCp / 100).toFixed(1)}`
              : "0.0";

            const pvSanList = c.pv.slice(0, 4).map((m) => uciToSan(fen, m) ?? m);
            return {
              san: c.san,
              scoreText: scoreLabel,
              pvText: pvSanList.join(" "),
            };
          });
          setCandidates(linesList);

          // If a move was just played, classify it
          if (reviewSan && lastMoveMover) {
            const moveClass = classifyMove(
              reviewSan,
              topSan,
              currentCp,
              currentCp,
              lastMoveMover
            );
            setClassification(moveClass);
          } else {
            setClassification(null);
          }
        }
      } catch (err: any) {
        if (!aborted && err?.name !== "AbortError") {
          // Graceful fallback
        }
      } finally {
        if (!aborted) setIsSearching(false);
      }
    }

    void evaluate();

    return () => {
      aborted = true;
      abortController.abort();
    };
  }, [engine, fen, reviewSan, lastMoveMover]);

  return (
    <div className={cn("flex flex-col gap-3 p-3 overflow-y-auto", className)}>
      {/* 1. Eval Bar & Advantage Card */}
      <div className="flex items-center gap-3 p-3 rounded-2xl border border-border/80 bg-card shadow-xs">
        <div className="h-28 w-8 shrink-0">
          <EvalBar
            scoreCp={scoreCp}
            mateIn={mateIn}
            orientation={orientation}
            className="w-8 h-28"
          />
        </div>

        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <Cpu className="size-3.5 text-primary" />
              Stockfish 18
            </span>
            <span className="text-[10px] font-mono text-muted-foreground">
              {isSearching ? "Thinking..." : `Depth ${depth}`}
            </span>
          </div>

          <div className="flex items-baseline gap-2">
            <span className="text-xl font-mono font-black text-foreground">
              {mateIn !== null
                ? `Mate in ${Math.abs(mateIn)}`
                : scoreCp !== null
                ? `${scoreCp > 0 ? "+" : ""}${(scoreCp / 100).toFixed(2)}`
                : "0.00"}
            </span>
            <span className="text-[11px] font-semibold text-muted-foreground">
              {mateIn !== null
                ? mateIn > 0 ? "White wins" : "Black wins"
                : (scoreCp ?? 0) > 40
                ? "White advantage"
                : (scoreCp ?? 0) < -40
                ? "Black advantage"
                : "Equal position"}
            </span>
          </div>

          {bestMoveSan && (
            <p className="text-[11px] text-muted-foreground flex items-center gap-1">
              <span>Best continuation:</span>
              <strong className="text-emerald-500 font-mono font-bold">{bestMoveSan}</strong>
            </p>
          )}
        </div>
      </div>

      {/* 2. Move Quality Classification (if reviewing a move) */}
      {classification && reviewSan && (
        <div
          className={cn(
            "p-3 rounded-2xl border flex items-center gap-2.5 shadow-xs",
            classification.bgClass,
            classification.borderClass
          )}
        >
          <div
            className={cn(
              "size-8 rounded-xl flex items-center justify-center font-bold text-sm shrink-0",
              classification.colorClass
            )}
          >
            {classification.badge}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className={cn("text-xs font-bold", classification.colorClass)}>
                {reviewSan} was {classification.label}
              </p>
            </div>
            <p className="text-[10px] text-muted-foreground leading-tight">
              {classification.description}
            </p>
          </div>
        </div>
      )}

      {/* 3. Top Candidate Lines */}
      <div className="space-y-1.5">
        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block px-1">
          Candidate Lines
        </span>
        {candidates.length === 0 ? (
          <div className="p-3 text-center text-xs text-muted-foreground rounded-xl border border-dashed border-border">
            {isSearching ? "Calculating optimal variations..." : "No candidate lines found."}
          </div>
        ) : (
          candidates.map((cand, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between p-2 rounded-xl border border-border/60 bg-muted/20 text-xs hover:bg-muted/40 transition-colors"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-mono text-[10px] font-bold text-muted-foreground w-4">
                  {idx + 1}.
                </span>
                <span className="font-mono font-bold text-foreground shrink-0">{cand.san}</span>
                <span className="text-[11px] text-muted-foreground font-mono truncate">
                  {cand.pvText}
                </span>
              </div>
              <span className="font-mono text-[11px] font-bold text-primary shrink-0 pl-2">
                {cand.scoreText}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
