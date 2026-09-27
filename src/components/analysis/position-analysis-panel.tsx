"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { acquireEngine, releaseEngine, type StockfishEngine, type SearchResult } from "@/lib/engine/stockfish-client";
import { linesToCandidates, formatPvContinuation, uciToSan } from "@/lib/engine/candidates";
import { EvalBar } from "./eval-bar";
import { classifyMove, type MoveClassification } from "./move-classification";
import { Cpu, RotateCcw, Copy, Check, Sparkles, ChevronRight, Zap } from "lucide-react";
import { cn } from "@/lib/ui";
import { toast } from "sonner";

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
  const [targetDepth, setTargetDepth] = useState<13 | 18>(13);
  const [scoreCp, setScoreCp] = useState<number | null>(null);
  const [mateIn, setMateIn] = useState<number | null>(null);
  const [depth, setDepth] = useState<number>(0);
  const [bestMoveSan, setBestMoveSan] = useState<string | null>(null);
  const [copiedLineIdx, setCopiedLineIdx] = useState<number | null>(null);
  const [candidates, setCandidates] = useState<
    Array<{
      leadSan: string;
      continuationText: string;
      scoreText: string;
      isPositive: boolean;
      isNeutral: boolean;
      fullPgn: string;
    }>
  >([]);
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

  // Run search when fen or targetDepth changes
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
          depth: targetDepth,
          multiPv: 3,
          timeoutMs: targetDepth === 18 ? 5000 : 3000,
          signal: abortController.signal,
        });

        if (aborted) return;

        const parsedCandidates = linesToCandidates(fen, result.lines);
        const top = result.lines[0];

        if (top) {
          // Normalize score to White's POV:
          // Stockfish score is from side-to-move's perspective
          const currentCp =
            top.scoreCp !== null
              ? isWhiteTurn
                ? top.scoreCp
                : -top.scoreCp
              : null;
          const currentMate =
            top.mateIn !== null
              ? isWhiteTurn
                ? top.mateIn
                : -top.mateIn
              : null;

          setScoreCp(currentCp);
          setMateIn(currentMate);
          setDepth(top.depth);

          const topSan = top.pv[0] ? uciToSan(fen, top.pv[0]) : null;
          setBestMoveSan(topSan);

          // Build clean, formatted candidate variations
          const linesList = parsedCandidates.slice(0, 3).map((c) => {
            const { leadSan, continuationText } = formatPvContinuation(fen, c.pv, 6);

            // Normalized score to White's perspective so all candidate lines match top score
            const normCp = c.scoreCp !== null ? (isWhiteTurn ? c.scoreCp : -c.scoreCp) : null;
            const normMate = c.mateIn !== null ? (isWhiteTurn ? c.mateIn : -c.mateIn) : null;

            let scoreText = "0.0";
            let isPositive = false;
            let isNeutral = true;

            if (normMate !== null) {
              isPositive = normMate > 0;
              isNeutral = false;
              scoreText = isPositive ? `+M${normMate}` : `-M${Math.abs(normMate)}`;
            } else if (normCp !== null) {
              const pawns = normCp / 100;
              isPositive = pawns > 0;
              isNeutral = Math.abs(pawns) < 0.2;
              scoreText = `${isPositive ? "+" : ""}${pawns.toFixed(1)}`;
            }

            const fullPgn = [leadSan, continuationText].filter(Boolean).join(" ");

            return {
              leadSan,
              continuationText,
              scoreText,
              isPositive,
              isNeutral,
              fullPgn,
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
  }, [engine, fen, targetDepth, reviewSan, lastMoveMover]);

  // Derived win probabilities
  const { whiteWinPct, blackWinPct } = useMemo(() => {
    if (mateIn !== null) {
      return mateIn > 0
        ? { whiteWinPct: 100, blackWinPct: 0 }
        : { whiteWinPct: 0, blackWinPct: 100 };
    }
    if (scoreCp === null) return { whiteWinPct: 50, blackWinPct: 50 };
    const pawns = scoreCp / 100;
    const clampedPawns = Math.max(-15, Math.min(15, pawns));
    const percentage = 50 + 50 * (2 / (1 + Math.exp(-0.35 * clampedPawns)) - 1);
    const white = Math.round(Math.max(2, Math.min(98, percentage)));
    return { whiteWinPct: white, blackWinPct: 100 - white };
  }, [scoreCp, mateIn]);

  // Advantage description text
  const advantageInfo = useMemo(() => {
    if (mateIn !== null) {
      if (mateIn > 0) return { text: `White has Mate in ${mateIn}`, color: "text-emerald-400" };
      return { text: `Black has Mate in ${Math.abs(mateIn)}`, color: "text-rose-400" };
    }
    if (scoreCp === null) return { text: "Evaluating position...", color: "text-muted-foreground" };
    const pawns = scoreCp / 100;
    if (pawns >= 3.0) return { text: "Decisive White advantage", color: "text-emerald-400" };
    if (pawns >= 1.2) return { text: "Clear White advantage", color: "text-emerald-400" };
    if (pawns >= 0.4) return { text: "Slight White advantage", color: "text-emerald-300" };
    if (pawns <= -3.0) return { text: "Decisive Black advantage", color: "text-rose-400" };
    if (pawns <= -1.2) return { text: "Clear Black advantage", color: "text-rose-400" };
    if (pawns <= -0.4) return { text: "Slight Black advantage", color: "text-rose-300" };
    return { text: "Equal position", color: "text-zinc-400" };
  }, [scoreCp, mateIn]);

  const handleCopyLine = (fullPgn: string, idx: number) => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(fullPgn);
      setCopiedLineIdx(idx);
      toast.success("Line copied to clipboard!");
      setTimeout(() => setCopiedLineIdx(null), 2000);
    }
  };

  return (
    <div className={cn("flex flex-col gap-3 p-3 sm:p-4 overflow-y-auto min-h-0 flex-1", className)}>
      {/* 1. Header Toolbar: Engine & Depth Controls */}
      <div className="flex items-center justify-between pb-1">
        <div className="flex items-center gap-2">
          <div className="size-7 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-xs">
            <Cpu className="size-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-foreground">Stockfish 18</span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-md bg-muted text-muted-foreground border border-border/60">
                WASM
              </span>
            </div>
            <p className="text-[10px] font-mono text-muted-foreground">
              {isSearching ? (
                <span className="inline-flex items-center gap-1 text-primary">
                  <span className="size-1.5 rounded-full bg-primary animate-pulse" />
                  Calculating...
                </span>
              ) : (
                `Depth ${depth}`
              )}
            </p>
          </div>
        </div>

        {/* Depth Selector Pills */}
        <div className="flex items-center gap-1 p-0.5 rounded-xl bg-muted/50 border border-border/60 text-[11px] font-semibold">
          <button
            type="button"
            onClick={() => setTargetDepth(13)}
            className={cn(
              "px-2.5 py-1 rounded-lg transition-all font-mono",
              targetDepth === 13
                ? "bg-card text-foreground shadow-xs font-bold border border-border/80"
                : "text-muted-foreground hover:text-foreground"
            )}
            title="Fast search (Depth 13)"
          >
            D13
          </button>
          <button
            type="button"
            onClick={() => setTargetDepth(18)}
            className={cn(
              "px-2.5 py-1 rounded-lg transition-all font-mono",
              targetDepth === 18
                ? "bg-card text-foreground shadow-xs font-bold border border-border/80"
                : "text-muted-foreground hover:text-foreground"
            )}
            title="Deep search (Depth 18)"
          >
            D18
          </button>
        </div>
      </div>

      {/* 2. Eval Bar & Advantage Card */}
      <div className="rounded-2xl border border-border/80 bg-card/70 backdrop-blur-sm p-3 sm:p-3.5 shadow-sm space-y-3">
        <div className="flex items-center gap-3">
          {/* Vertical Eval Bar with Strictly Bounded Dimensions */}
          <div className="h-28 w-8 sm:w-8.5 shrink-0 overflow-hidden rounded-xl border border-border/80 bg-zinc-900 shadow-inner">
            <EvalBar
              scoreCp={scoreCp}
              mateIn={mateIn}
              orientation={orientation}
              className="w-full h-full"
            />
          </div>

          {/* Numerical Readout & Best Move */}
          <div className="flex-1 min-w-0 space-y-1.5">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-mono font-black text-foreground tracking-tight">
                {mateIn !== null
                  ? `M${Math.abs(mateIn)}`
                  : scoreCp !== null
                  ? `${scoreCp > 0 ? "+" : ""}${(scoreCp / 100).toFixed(2)}`
                  : "0.00"}
              </span>
              <span className={cn("text-xs font-bold truncate", advantageInfo.color)}>
                {advantageInfo.text}
              </span>
            </div>

            {/* Best Move Continuation Banner */}
            {bestMoveSan && (
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-xs text-foreground font-semibold">
                <span className="text-[11px] text-emerald-400 font-medium">Best Move:</span>
                <strong className="font-mono font-bold text-emerald-400">{bestMoveSan}</strong>
              </div>
            )}
          </div>
        </div>

        {/* Win Rate Probability Gauge */}
        <div className="pt-2 border-t border-border/60 space-y-1">
          <div className="flex items-center justify-between text-[10px] font-mono font-bold text-muted-foreground">
            <span className="text-foreground">White {whiteWinPct}%</span>
            <span>Win Probability</span>
            <span className="text-foreground">Black {blackWinPct}%</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-zinc-900 border border-border/60 overflow-hidden flex">
            <div
              style={{ width: `${whiteWinPct}%` }}
              className="h-full bg-zinc-100 transition-all duration-300"
            />
            <div
              style={{ width: `${blackWinPct}%` }}
              className="h-full bg-zinc-800 transition-all duration-300"
            />
          </div>
        </div>
      </div>

      {/* 3. Move Quality Classification (if reviewing a move) */}
      {classification && reviewSan && (
        <div
          className={cn(
            "p-3 rounded-2xl border flex items-center gap-2.5 shadow-xs transition-all animate-in fade-in",
            classification.bgClass,
            classification.borderClass
          )}
        >
          <div
            className={cn(
              "size-9 rounded-xl flex items-center justify-center font-bold text-base shrink-0 shadow-xs",
              classification.colorClass
            )}
          >
            {classification.badge}
          </div>
          <div className="min-w-0 flex-1">
            <p className={cn("text-xs font-bold flex items-center gap-1.5", classification.colorClass)}>
              <span>{reviewSan} was {classification.label}</span>
            </p>
            <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">
              {classification.description}
            </p>
            {bestMoveSan && classification.quality !== "best" && classification.quality !== "brilliant" && (
              <p className="text-[10px] text-muted-foreground mt-1">
                Engine preferred: <strong className="text-foreground font-mono">{bestMoveSan}</strong>
              </p>
            )}
          </div>
        </div>
      )}

      {/* 4. Top Candidate Variations */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
            <Sparkles className="size-3 text-primary" />
            Candidate Variations
          </span>
          <span className="text-[10px] font-mono text-muted-foreground">Top 3 MultiPV</span>
        </div>

        {candidates.length === 0 ? (
          <div className="p-4 text-center text-xs text-muted-foreground rounded-2xl border border-dashed border-border/80 bg-muted/10 space-y-1">
            <Cpu className="size-5 mx-auto text-muted-foreground/60 animate-pulse" />
            <p className="font-semibold text-foreground">
              {isSearching ? "Calculating optimal variations..." : "No variations found."}
            </p>
            <p className="text-[11px]">Depth {targetDepth} analysis with Stockfish 18</p>
          </div>
        ) : (
          candidates.map((cand, idx) => {
            const isCopied = copiedLineIdx === idx;
            return (
              <div
                key={idx}
                className={cn(
                  "p-2.5 rounded-2xl border transition-all shadow-xs space-y-1.5 group relative",
                  idx === 0
                    ? "border-primary/40 bg-card hover:border-primary/60 hover:bg-muted/30"
                    : "border-border/60 bg-card/60 hover:border-border hover:bg-muted/20"
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={cn(
                        "size-5 rounded-lg flex items-center justify-center text-[10px] font-mono font-black shrink-0",
                        idx === 0
                          ? "bg-amber-500/15 text-amber-500 border border-amber-500/30"
                          : "bg-muted text-muted-foreground border border-border/60"
                      )}
                    >
                      {idx + 1}
                    </span>

                    <span className="font-mono text-xs font-black text-foreground shrink-0">
                      {cand.leadSan}
                    </span>

                    {idx === 0 && (
                      <span className="text-[9px] font-bold uppercase px-1.5 py-0.2 rounded-md bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 shrink-0">
                        Top Line
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <span
                      className={cn(
                        "font-mono text-[11px] font-extrabold px-2 py-0.5 rounded-lg border",
                        cand.isPositive
                          ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                          : cand.isNeutral
                          ? "bg-muted border-border/80 text-foreground"
                          : "bg-rose-500/10 border-rose-500/30 text-rose-400"
                      )}
                    >
                      {cand.scoreText}
                    </span>

                    <button
                      type="button"
                      onClick={() => handleCopyLine(cand.fullPgn, idx)}
                      className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors opacity-70 group-hover:opacity-100"
                      title="Copy full variation"
                    >
                      {isCopied ? (
                        <Check className="size-3.5 text-emerald-500" />
                      ) : (
                        <Copy className="size-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Continuation Line */}
                {cand.continuationText && (
                  <p className="text-[11px] text-muted-foreground font-mono leading-relaxed pl-7 truncate">
                    {cand.continuationText}
                  </p>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
