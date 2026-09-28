// src/components/analysis/game-review-panel.tsx
"use client";

import { useState, useMemo } from "react";
import { Download, Copy, Check, TrendingUp, Sparkles, AlertTriangle, AlertCircle, XCircle, BookOpen, Star, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/ui";

export interface MoveReviewPoint {
  ply: number;
  moveNumber: number;
  turn: "w" | "b";
  san: string;
  evalCp: number; // in centipawns, positive for White, negative for Black
  classification?: "book" | "best" | "good" | "inaccuracy" | "mistake" | "blunder";
}

export interface GameReviewData {
  whiteAccuracy: number;
  blackAccuracy: number;
  moves: MoveReviewPoint[];
  counts: {
    white: { best: number; book: number; inaccuracies: number; mistakes: number; blunders: number };
    black: { best: number; book: number; inaccuracies: number; mistakes: number; blunders: number };
  };
}

/**
 * Generate simulated evaluation curve and accuracy points from move list/PGN
 */
export function generateGameReview(moves: string[] = []): GameReviewData {
  let currentEval = 15; // slight white opening advantage
  const reviewPoints: MoveReviewPoint[] = [];

  let whiteLossSum = 0;
  let blackLossSum = 0;

  const counts = {
    white: { best: 0, book: 0, inaccuracies: 0, mistakes: 0, blunders: 0 },
    black: { best: 0, book: 0, inaccuracies: 0, mistakes: 0, blunders: 0 },
  };

  moves.forEach((san, index) => {
    const isWhite = index % 2 === 0;
    const moveNum = Math.floor(index / 2) + 1;

    // Opening book for first 6 plies
    let classification: "book" | "best" | "good" | "inaccuracy" | "mistake" | "blunder" = "good";

    // Random walk with chess variance
    const delta = (Math.sin(index * 1.3) * 60 + Math.cos(index * 0.7) * 40);
    const prevEval = currentEval;
    currentEval = Math.max(-1000, Math.min(1000, currentEval + (isWhite ? delta : -delta)));

    const cpl = Math.abs(currentEval - prevEval);

    if (index < 6) {
      classification = "book";
      if (isWhite) counts.white.book++;
      else counts.black.book++;
    } else if (cpl < 15) {
      classification = "best";
      if (isWhite) counts.white.best++;
      else counts.black.best++;
    } else if (cpl < 60) {
      classification = "good";
    } else if (cpl < 150) {
      classification = "inaccuracy";
      if (isWhite) counts.white.inaccuracies++;
      else counts.black.inaccuracies++;
    } else if (cpl < 300) {
      classification = "mistake";
      if (isWhite) counts.white.mistakes++;
      else counts.black.mistakes++;
    } else {
      classification = "blunder";
      if (isWhite) counts.white.blunders++;
      else counts.black.blunders++;
    }

    if (isWhite) whiteLossSum += Math.min(150, cpl);
    else blackLossSum += Math.min(150, cpl);

    reviewPoints.push({
      ply: index + 1,
      moveNumber: moveNum,
      turn: isWhite ? "w" : "b",
      san,
      evalCp: currentEval,
      classification,
    });
  });

  const whiteMovesCount = Math.max(1, Math.ceil(moves.length / 2));
  const blackMovesCount = Math.max(1, Math.floor(moves.length / 2));

  const whiteAccuracy = Math.max(65, Math.round(100 - (whiteLossSum / whiteMovesCount) * 0.45));
  const blackAccuracy = Math.max(65, Math.round(100 - (blackLossSum / blackMovesCount) * 0.45));

  return {
    whiteAccuracy,
    blackAccuracy,
    moves: reviewPoints,
    counts,
  };
}

export function GameReviewPanel({
  pgn,
  moves = [],
  whitePlayerName = "White",
  blackPlayerName = "Black",
  onSelectMove,
}: {
  pgn?: string;
  moves?: string[];
  whitePlayerName?: string;
  blackPlayerName?: string;
  onSelectMove?: (plyIndex: number) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [hoveredPoint, setHoveredPoint] = useState<MoveReviewPoint | null>(null);

  const review = useMemo(() => generateGameReview(moves), [moves]);

  const handleCopyPgn = () => {
    if (!pgn) {
      toast.error("No PGN available for this match");
      return;
    }
    navigator.clipboard.writeText(pgn);
    setCopied(true);
    toast.success("PGN copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadPgn = () => {
    if (!pgn) {
      toast.error("No PGN available");
      return;
    }
    const blob = new Blob([pgn], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `castle_game_${Date.now()}.pgn`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("PGN file downloaded!");
  };

  // SVG Chart Dimensions
  const width = 600;
  const height = 140;
  const paddingY = 15;
  const points = review.moves;

  const maxCp = 600;
  const scaleY = (cp: number) => {
    const clamped = Math.max(-maxCp, Math.min(maxCp, cp));
    // cp = maxCp -> y = paddingY (top)
    // cp = 0 -> y = height / 2 (center)
    // cp = -maxCp -> y = height - paddingY (bottom)
    return height / 2 - (clamped / maxCp) * (height / 2 - paddingY);
  };

  const polylineCoords = points
    .map((pt, i) => {
      const x = points.length <= 1 ? width / 2 : (i / (points.length - 1)) * width;
      const y = scaleY(pt.evalCp);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <div className="rounded-3xl border border-border bg-card p-5 sm:p-6 shadow-sm space-y-6">
      {/* 1. Header with Accuracy Comparison */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border/80 pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <BarChart3 className="size-4" />
            </span>
            <h3 className="text-base sm:text-lg font-black text-foreground">Post-Game Evaluation &amp; Accuracy</h3>
          </div>
          <p className="text-xs text-muted-foreground">
            Move-by-move evaluation graph and accuracy performance scores.
          </p>
        </div>

        {/* PGN Actions */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button
            size="sm"
            variant="outline"
            onClick={handleCopyPgn}
            className="flex-1 sm:flex-initial h-8 rounded-xl text-xs font-bold gap-1.5"
          >
            {copied ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
            <span>{copied ? "Copied" : "Copy PGN"}</span>
          </Button>

          <Button
            size="sm"
            variant="secondary"
            onClick={handleDownloadPgn}
            className="flex-1 sm:flex-initial h-8 rounded-xl text-xs font-bold gap-1.5"
          >
            <Download className="size-3.5" />
            <span>Download</span>
          </Button>
        </div>
      </div>

      {/* 2. Accuracy Comparison Cards */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        {/* White Player */}
        <div className="rounded-2xl border border-border bg-muted/30 p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-foreground truncate max-w-[120px]">
              {whitePlayerName} (White)
            </span>
            <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Accuracy</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-2xl sm:text-3xl font-black text-foreground">
              {review.whiteAccuracy}%
            </span>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground pt-1">
            <span className="text-emerald-500 font-bold">{review.counts.white.best} best</span>
            <span>•</span>
            <span className="text-amber-500 font-bold">{review.counts.white.inaccuracies} inacc</span>
            <span>•</span>
            <span className="text-destructive font-bold">{review.counts.white.blunders} blunders</span>
          </div>
        </div>

        {/* Black Player */}
        <div className="rounded-2xl border border-border bg-muted/30 p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-foreground truncate max-w-[120px]">
              {blackPlayerName} (Black)
            </span>
            <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Accuracy</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-2xl sm:text-3xl font-black text-foreground">
              {review.blackAccuracy}%
            </span>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground pt-1">
            <span className="text-emerald-500 font-bold">{review.counts.black.best} best</span>
            <span>•</span>
            <span className="text-amber-500 font-bold">{review.counts.black.inaccuracies} inacc</span>
            <span>•</span>
            <span className="text-destructive font-bold">{review.counts.black.blunders} blunders</span>
          </div>
        </div>
      </div>

      {/* 3. Evaluation Advantage Chart */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-muted-foreground flex items-center gap-1.5">
            <TrendingUp className="size-3.5 text-primary" />
            Advantage Curve
          </span>
          {hoveredPoint ? (
            <span className="font-mono font-bold text-xs text-foreground bg-muted px-2 py-0.5 rounded-lg">
              Move {hoveredPoint.moveNumber}{hoveredPoint.turn === "w" ? "." : "..."} {hoveredPoint.san} (
              {hoveredPoint.evalCp > 0 ? `+${(hoveredPoint.evalCp / 100).toFixed(1)}` : (hoveredPoint.evalCp / 100).toFixed(1)})
            </span>
          ) : (
            <span className="text-[11px] text-muted-foreground">Hover graph to view evaluation per ply</span>
          )}
        </div>

        <div className="relative rounded-2xl border border-border bg-background p-3 overflow-hidden shadow-inner">
          {/* Zero baseline */}
          <div
            className="absolute left-0 right-0 border-b border-border/60 pointer-events-none"
            style={{ top: `${height / 2}px` }}
          />

          <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-28 sm:h-36 overflow-visible">
            {/* Gradient definition */}
            <defs>
              <linearGradient id="evalGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity="0.3" />
                <stop offset="50%" stopColor="#10b981" stopOpacity="0.0" />
                <stop offset="50%" stopColor="#ef4444" stopOpacity="0.0" />
                <stop offset="100%" stopColor="#ef4444" stopOpacity="0.3" />
              </linearGradient>
            </defs>

            {/* Polyline line */}
            {points.length > 1 && (
              <polyline
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                className="text-primary transition-all duration-200"
                points={polylineCoords}
              />
            )}

            {/* Interactive Points */}
            {points.map((pt, i) => {
              const x = points.length <= 1 ? width / 2 : (i / (points.length - 1)) * width;
              const y = scaleY(pt.evalCp);
              return (
                <circle
                  key={i}
                  cx={x}
                  cy={y}
                  r="3.5"
                  onMouseEnter={() => setHoveredPoint(pt)}
                  onMouseLeave={() => setHoveredPoint(null)}
                  onClick={() => onSelectMove?.(i)}
                  className="fill-card stroke-primary stroke-2 hover:r-6 hover:fill-primary transition-all cursor-pointer"
                />
              );
            })}
          </svg>

          {/* Labels */}
          <div className="flex justify-between text-[10px] text-muted-foreground pt-1 px-1">
            <span>Move 1</span>
            <span>White Advantage ↑</span>
            <span>Black Advantage ↓</span>
            <span>Move {Math.ceil(points.length / 2)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
