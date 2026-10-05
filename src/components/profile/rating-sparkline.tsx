"use client";
// src/components/profile/rating-sparkline.tsx  [U4]
// The rating card of UI_REDESIGN §6. FR-53: hand-rolled inline SVG — no chart
// library, no extra dependency.
import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Skeleton } from "@/components/ui/skeleton";
import { Eyebrow } from "@/components/ui-kit";
import { formatRating, formatRatingDelta } from "@/lib/format";
import type { RatingPool } from "@/lib/types";
import { cn, focusRing } from "@/lib/ui";
import { Trophy, TrendingUp, TrendingDown } from "lucide-react";

const HISTORY_LIMIT = 60;

type Pool = RatingPool | "all";

const POOLS: ReadonlyArray<{ value: Pool; label: string }> = [
  { value: "all", label: "All" },
  { value: "human", label: "vs Humans" },
  { value: "ai", label: "vs AI" },
];

/**
 * Builds a smooth cubic Bézier spline string through coordinates.
 */
function buildSmoothPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
  if (points.length === 2) {
    return `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)} L ${points[1].x.toFixed(2)} ${points[1].y.toFixed(2)}`;
  }

  let d = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i === 0 ? 0 : i - 1];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2 < points.length ? i + 2 : i + 1];

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    d += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }
  return d;
}

export function Sparkline({
  values,
  width = 360,
  height = 80,
  strokeWidth = 2.5,
  className,
}: {
  values: number[];
  width?: number;
  height?: number;
  strokeWidth?: number;
  className?: string;
}) {
  if (values.length === 0) return null;

  const padX = strokeWidth * 2;
  const padY = strokeWidth * 2.5;
  const n = values.length;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min;

  const coords = values.map((value, i) => {
    const x = n > 1 ? padX + (i * (width - 2 * padX)) / (n - 1) : width / 2;
    const y = span === 0 ? height / 2 : padY + (1 - (value - min) / span) * (height - 2 * padY);
    return { x, y };
  });

  const first = values[0];
  const last = values[n - 1];
  const isUp = last > first;
  const isDown = last < first;

  // Modern emerald for gain, warm rose for drop, refined violet for neutral
  const strokeColor = isUp ? "#10b981" : isDown ? "#f43f5e" : "#8b5cf6";
  const linePath = buildSmoothPath(coords);
  const areaPath =
    coords.length > 1
      ? `${linePath} L ${coords[coords.length - 1].x.toFixed(2)} ${height} L ${coords[0].x.toFixed(2)} ${height} Z`
      : "";

  const lastCoord = coords[coords.length - 1];
  const firstCoord = coords[0];

  // Baseline Y position (start rating baseline)
  const baselineY =
    span === 0 ? height / 2 : padY + (1 - (first - min) / span) * (height - 2 * padY);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={cn("h-24 w-full min-w-0 overflow-visible", className)}
      role="img"
      aria-label={`Rating history from ${formatRating(first)} to ${formatRating(last)}`}
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id="ratingGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={strokeColor} stopOpacity={0.25} />
          <stop offset="65%" stopColor={strokeColor} stopOpacity={0.05} />
          <stop offset="100%" stopColor={strokeColor} stopOpacity={0} />
        </linearGradient>
      </defs>

      {/* Dotted horizontal baseline guide */}
      <line
        x1={padX}
        y1={baselineY}
        x2={width - padX}
        y2={baselineY}
        stroke="currentColor"
        strokeOpacity={0.12}
        strokeDasharray="4 4"
        strokeWidth={1}
      />

      {/* Smooth Gradient Area */}
      {areaPath && <path d={areaPath} fill="url(#ratingGradient)" />}

      {/* Smooth Bézier Stroke Line */}
      <path
        d={linePath}
        fill="none"
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* First Point Node */}
      <circle cx={firstCoord.x} cy={firstCoord.y} r={strokeWidth} fill="currentColor" opacity={0.35} />

      {/* Current/Last Point Outer Glowing Marker */}
      <circle
        cx={lastCoord.x}
        cy={lastCoord.y}
        r={strokeWidth * 2.2}
        fill={strokeColor}
        opacity={0.25}
      />
      <circle cx={lastCoord.x} cy={lastCoord.y} r={strokeWidth * 1.3} fill={strokeColor} />
    </svg>
  );
}

export interface RatingSparklineViewProps {
  pool: Pool;
  onPoolChange(pool: Pool): void;
  /** undefined = still loading. */
  values?: number[];
  gameCount: number;
}

/** Pure — the /dev/pages harness renders this with a fixed series. */
export function RatingSparklineView({
  pool,
  onPoolChange,
  values,
  gameCount,
}: RatingSparklineViewProps) {
  const currentRating = values && values.length > 0 ? values[values.length - 1] : 0;
  const startRating = values && values.length > 0 ? values[0] : 0;
  const peakRating = values && values.length > 0 ? Math.max(...values) : 0;
  const lowestRating = values && values.length > 0 ? Math.min(...values) : 0;
  const net =
    values !== undefined && values.length > 1 ? currentRating - startRating : 0;
  const isPositive = net >= 0;

  return (
    <section
      aria-label="Rating history"
      className="grid gap-4 rounded-2xl border border-border/80 bg-card p-4 sm:p-5 shadow-sm"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Eyebrow as="span">Rating History</Eyebrow>
        <div role="group" aria-label="Rating pool" className="flex flex-wrap gap-1.5">
          {POOLS.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={option.value === pool}
              onClick={() => onPoolChange(option.value)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-semibold leading-none transition-colors cursor-pointer",
                focusRing,
                option.value === pool
                  ? "border-primary bg-primary/15 text-primary shadow-xs"
                  : "border-border/70 text-muted-foreground hover:text-foreground hover:bg-muted/40",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {values === undefined ? (
        <Skeleton className="h-32 w-full rounded-xl" />
      ) : values.length < 2 ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-xs sm:text-sm text-muted-foreground">
          Not enough rated games in this pool yet to draw a line.
        </p>
      ) : (
        <div className="space-y-4">
          {/* 4-KPI Executive Metric Chips */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
            {/* 1. Current Elo */}
            <div className="rounded-xl bg-card border border-border/70 p-2.5 space-y-0.5">
              <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Current Elo
              </span>
              <div className="text-base sm:text-lg font-black font-mono text-foreground">
                {formatRating(currentRating)}
              </div>
            </div>

            {/* 2. Peak Elo */}
            <div className="rounded-xl bg-amber-500/5 border border-amber-500/20 p-2.5 space-y-0.5">
              <span className="text-[10px] uppercase font-bold tracking-wider text-amber-500 flex items-center gap-1">
                <Trophy className="size-3" />
                Peak Elo
              </span>
              <div className="text-base sm:text-lg font-black font-mono text-amber-500">
                {formatRating(peakRating)}
              </div>
            </div>

            {/* 3. Lowest Elo */}
            <div className="rounded-xl bg-card border border-border/70 p-2.5 space-y-0.5">
              <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground flex items-center gap-1">
                <TrendingDown className="size-3" />
                Lowest Elo
              </span>
              <div className="text-base sm:text-lg font-black font-mono text-muted-foreground">
                {formatRating(lowestRating)}
              </div>
            </div>

            {/* 4. Season Net Change */}
            <div
              className={cn(
                "rounded-xl p-2.5 space-y-0.5 border",
                isPositive
                  ? "bg-emerald-500/5 border-emerald-500/20 text-emerald-500"
                  : "bg-rose-500/5 border-rose-500/20 text-rose-500"
              )}
            >
              <span className="text-[10px] uppercase font-bold tracking-wider flex items-center gap-1">
                {isPositive ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
                Net Change
              </span>
              <div className="text-base sm:text-lg font-black font-mono">
                {formatRatingDelta(net)}
              </div>
            </div>
          </div>

          {/* Modern Bézier Sparkline with Gradient Glow */}
          <div className="pt-2">
            <Sparkline values={values} />
          </div>

          {/* Footer Detail */}
          <div className="flex flex-wrap items-center justify-between text-xs text-muted-foreground pt-2 border-t border-border/40">
            <span className="font-mono text-[11px]">
              Start: <strong className="text-foreground">{formatRating(startRating)}</strong> &rarr; Current:{" "}
              <strong className="text-foreground">{formatRating(currentRating)}</strong> ({formatRatingDelta(net)})
            </span>
            <span className="font-mono text-[11px]">
              {gameCount} rated {gameCount === 1 ? "game" : "games"} recorded
            </span>
          </div>
        </div>
      )}
    </section>
  );
}

export function RatingSparkline({ username }: { username: string }) {
  const [pool, setPool] = useState<Pool>("all");
  const history = useQuery(api.ratingHistory.forPlayer, {
    username,
    pool,
    limit: HISTORY_LIMIT,
  });

  // Rows arrive oldest-first, so prefixing the first row's `before` gives the
  // starting rating and n+1 points for n rated games.
  const values =
    history === undefined
      ? undefined
      : history.length === 0
        ? []
        : [history[0].before, ...history.map((row) => row.after)];

  return (
    <RatingSparklineView
      pool={pool}
      onPoolChange={setPool}
      values={values}
      gameCount={history?.length ?? 0}
    />
  );
}
