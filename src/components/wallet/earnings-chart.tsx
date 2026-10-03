"use client";

import { useState } from "react";
import { TrendingUp, Coins, BarChart3, HelpCircle } from "lucide-react";

export interface ChartDataPoint {
  dateLabel: string;
  timestamp: number;
  netResult: number;
  winnings: number;
  entries: number;
}

interface EarningsChartProps {
  data: ChartDataPoint[];
}

export function EarningsChart({ data }: EarningsChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<"activity" | "net">("activity");

  // Fallback demo data if no activity in selected date period
  const displayData =
    data && data.length > 0
      ? data
      : [
          { dateLabel: "Mon", timestamp: Date.now() - 5 * 86400000, netResult: 120, winnings: 200, entries: 80 },
          { dateLabel: "Tue", timestamp: Date.now() - 4 * 86400000, netResult: -50, winnings: 50, entries: 100 },
          { dateLabel: "Wed", timestamp: Date.now() - 3 * 86400000, netResult: 300, winnings: 400, entries: 100 },
          { dateLabel: "Thu", timestamp: Date.now() - 2 * 86400000, netResult: 180, winnings: 280, entries: 100 },
          { dateLabel: "Fri", timestamp: Date.now() - 1 * 86400000, netResult: -100, winnings: 0, entries: 100 },
          { dateLabel: "Today", timestamp: Date.now(), netResult: 350, winnings: 850, entries: 500 },
        ];

  const isDemo = !data || data.length === 0;

  // Aggregate totals for the period
  const totalWinnings = displayData.reduce((acc, d) => acc + (d.winnings || 0), 0);
  const totalEntries = displayData.reduce((acc, d) => acc + (d.entries || 0), 0);
  const totalNet = totalWinnings - totalEntries;

  // Chart layout dimensions
  const height = 210;
  const paddingLeft = 40;
  const paddingRight = 16;
  const paddingTop = 25;
  const paddingBottom = 35;
  const plotWidth = 480;
  const plotHeight = height - paddingTop - paddingBottom;

  // Activity Mode: Y-axis goes from 0 up to max(winnings, entries)
  const maxActivityRaw = Math.max(100, ...displayData.flatMap((d) => [d.winnings || 0, d.entries || 0]));
  const maxActivity = Math.ceil(maxActivityRaw / 100) * 100;

  // Net Mode: Y-axis centered at 0, going to maxAbsNet
  const maxNetRaw = Math.max(50, ...displayData.map((d) => Math.abs(d.netResult || 0)));
  const maxNet = Math.ceil(maxNetRaw / 50) * 50;

  const yZeroNet = paddingTop + plotHeight / 2;

  const getColX = (idx: number) => {
    const usableWidth = plotWidth - paddingLeft - paddingRight;
    const step = usableWidth / Math.max(1, displayData.length);
    return paddingLeft + idx * step + step / 2;
  };

  const activePoint = hoveredIndex !== null ? displayData[hoveredIndex] : null;

  return (
    <div className="relative flex flex-col justify-between rounded-3xl border border-border/80 bg-card p-4 sm:p-5 shadow-xs transition-colors space-y-3">
      {/* Top Header: Title, Toggle, Legend */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <BarChart3 className="size-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold tracking-tight text-foreground flex items-center gap-1.5">
              <span>Gaming Performance</span>
              {isDemo && (
                <span className="rounded-full bg-muted/70 px-2 py-0.5 text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Sample
                </span>
              )}
            </h3>
            <p className="text-[11px] text-muted-foreground">
              {viewMode === "activity" ? "Daily Match Winnings vs Entry Stakes" : "Daily Net Profit / Loss"}
            </p>
          </div>
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-xl border border-border/60">
          <button
            type="button"
            onClick={() => setViewMode("activity")}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
              viewMode === "activity"
                ? "bg-card text-foreground shadow-2xs font-extrabold border border-border/70"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Activity
          </button>
          <button
            type="button"
            onClick={() => setViewMode("net")}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
              viewMode === "net"
                ? "bg-card text-foreground shadow-2xs font-extrabold border border-border/70"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Net Profit
          </button>
        </div>
      </div>

      {/* Summary KPI Strip */}
      <div className="grid grid-cols-3 gap-2 rounded-2xl bg-muted/30 p-2.5 border border-border/40 text-center">
        <div>
          <span className="text-[10px] font-bold uppercase text-muted-foreground">Won</span>
          <p className="font-mono text-xs sm:text-sm font-bold text-emerald-600 dark:text-emerald-400">
            +{totalWinnings.toFixed(2)} ETB
          </p>
        </div>
        <div className="border-x border-border/40">
          <span className="text-[10px] font-bold uppercase text-muted-foreground">Stakes</span>
          <p className="font-mono text-xs sm:text-sm font-bold text-rose-600 dark:text-rose-400">
            -{totalEntries.toFixed(2)} ETB
          </p>
        </div>
        <div>
          <span className="text-[10px] font-bold uppercase text-muted-foreground">Net Result</span>
          <p
            className={`font-mono text-xs sm:text-sm font-bold ${
              totalNet >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
            }`}
          >
            {totalNet >= 0 ? "+" : ""}
            {totalNet.toFixed(2)} ETB
          </p>
        </div>
      </div>

      {/* SVG Chart Visualization */}
      <div className="relative w-full pt-1">
        <svg
          viewBox={`0 0 ${plotWidth} ${height}`}
          className="h-44 sm:h-52 w-full overflow-visible select-none"
          preserveAspectRatio="none"
        >
          {viewMode === "activity" ? (
            /* =========================================================
               MODE 1: ACTIVITY BARS (EASY & INTUITIVE FROM 0 BASELINE)
               ========================================================= */
            <>
              {/* Horizontal Grid lines */}
              {[0, 0.5, 1].map((ratio) => {
                const y = height - paddingBottom - ratio * plotHeight;
                const val = Math.round(ratio * maxActivity);
                return (
                  <g key={`grid-${ratio}`}>
                    <line
                      x1={paddingLeft}
                      y1={y}
                      x2={plotWidth - paddingRight}
                      y2={y}
                      stroke="currentColor"
                      className="text-border/60"
                      strokeWidth="1"
                      strokeDasharray={ratio === 0 ? "0" : "3 3"}
                    />
                    <text
                      x={paddingLeft - 6}
                      y={y + 3}
                      textAnchor="end"
                      className="text-[9px] fill-muted-foreground font-mono font-medium"
                    >
                      {val}
                    </text>
                  </g>
                );
              })}

              {/* Side-by-side bars for each day */}
              {displayData.map((d, idx) => {
                const centerX = getColX(idx);
                const barWidth = Math.min(14, (plotWidth - paddingLeft - paddingRight) / (displayData.length * 2.8));
                const winH = (d.winnings / maxActivity) * plotHeight;
                const entH = (d.entries / maxActivity) * plotHeight;
                const baseY = height - paddingBottom;
                const isHovered = hoveredIndex === idx;

                return (
                  <g
                    key={`act-${idx}`}
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredIndex(idx)}
                    onMouseLeave={() => setHoveredIndex(null)}
                    onClick={() => setHoveredIndex(hoveredIndex === idx ? null : idx)}
                  >
                    {/* Background tap hitbox */}
                    <rect
                      x={centerX - barWidth * 2}
                      y={paddingTop}
                      width={barWidth * 4}
                      height={plotHeight}
                      fill="transparent"
                    />

                    {/* Column hover background highlight */}
                    {isHovered && (
                      <rect
                        x={centerX - barWidth * 1.5}
                        y={paddingTop}
                        width={barWidth * 3}
                        height={plotHeight}
                        className="fill-muted/30"
                        rx="4"
                      />
                    )}

                    {/* Winnings Bar (Green) */}
                    <rect
                      x={centerX - barWidth - 1}
                      y={baseY - winH}
                      width={barWidth}
                      height={Math.max(winH > 0 ? 3 : 0, winH)}
                      rx="3"
                      className={`transition-all duration-150 ${
                        isHovered ? "fill-emerald-500" : "fill-emerald-500/80"
                      }`}
                    />

                    {/* Entries Bar (Rose) */}
                    <rect
                      x={centerX + 1}
                      y={baseY - entH}
                      width={barWidth}
                      height={Math.max(entH > 0 ? 3 : 0, entH)}
                      rx="3"
                      className={`transition-all duration-150 ${
                        isHovered ? "fill-rose-500" : "fill-rose-500/75"
                      }`}
                    />

                    {/* X axis date label */}
                    <text
                      x={centerX}
                      y={height - 10}
                      textAnchor="middle"
                      className={`text-[10px] font-mono transition-colors ${
                        isHovered ? "fill-foreground font-bold" : "fill-muted-foreground font-medium"
                      }`}
                    >
                      {d.dateLabel}
                    </text>
                  </g>
                );
              })}
            </>
          ) : (
            /* =========================================================
               MODE 2: NET PROFIT BARS (CLEAN GREEN UP / RED DOWN)
               ========================================================= */
            <>
              {/* Center Zero Baseline */}
              <line
                x1={paddingLeft}
                y1={yZeroNet}
                x2={plotWidth - paddingRight}
                y2={yZeroNet}
                stroke="currentColor"
                className="text-border"
                strokeWidth="1.5"
              />

              {/* Grid labels */}
              <text
                x={paddingLeft - 6}
                y={paddingTop + 4}
                textAnchor="end"
                className="text-[9px] fill-muted-foreground font-mono font-medium"
              >
                +{maxNet}
              </text>
              <text
                x={paddingLeft - 6}
                y={yZeroNet + 3}
                textAnchor="end"
                className="text-[9px] fill-muted-foreground font-mono font-bold"
              >
                0
              </text>
              <text
                x={paddingLeft - 6}
                y={height - paddingBottom + 2}
                textAnchor="end"
                className="text-[9px] fill-muted-foreground font-mono font-medium"
              >
                -{maxNet}
              </text>

              {/* Net Result Bar for each day */}
              {displayData.map((d, idx) => {
                const centerX = getColX(idx);
                const barWidth = Math.min(18, (plotWidth - paddingLeft - paddingRight) / (displayData.length * 2));
                const barHeight = (Math.abs(d.netResult) / maxNet) * (plotHeight / 2);
                const isPositive = d.netResult >= 0;
                const barY = isPositive ? yZeroNet - barHeight : yZeroNet;
                const isHovered = hoveredIndex === idx;

                return (
                  <g
                    key={`net-${idx}`}
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredIndex(idx)}
                    onMouseLeave={() => setHoveredIndex(null)}
                    onClick={() => setHoveredIndex(hoveredIndex === idx ? null : idx)}
                  >
                    {/* Hitbox */}
                    <rect
                      x={centerX - barWidth}
                      y={paddingTop}
                      width={barWidth * 2}
                      height={plotHeight}
                      fill="transparent"
                    />

                    {/* Bar */}
                    <rect
                      x={centerX - barWidth / 2}
                      y={barY}
                      width={barWidth}
                      height={Math.max(barHeight > 0 ? 3 : 0, barHeight)}
                      rx="3"
                      className={`transition-all duration-150 ${
                        isPositive
                          ? isHovered
                            ? "fill-emerald-500"
                            : "fill-emerald-500/80"
                          : isHovered
                          ? "fill-rose-500"
                          : "fill-rose-500/80"
                      }`}
                    />

                    {/* X axis date label */}
                    <text
                      x={centerX}
                      y={height - 10}
                      textAnchor="middle"
                      className={`text-[10px] font-mono transition-colors ${
                        isHovered ? "fill-foreground font-bold" : "fill-muted-foreground font-medium"
                      }`}
                    >
                      {d.dateLabel}
                    </text>
                  </g>
                );
              })}
            </>
          )}
        </svg>

        {/* Floating Tooltip Card */}
        {activePoint && hoveredIndex !== null && (
          <div
            className="pointer-events-none absolute z-30 rounded-2xl border border-border/80 bg-popover/95 p-3 text-xs text-popover-foreground shadow-xl backdrop-blur-md transition-all animate-in fade-in duration-100"
            style={{
              left: `${Math.min(75, Math.max(25, (getColX(hoveredIndex) / plotWidth) * 100))}%`,
              top: "5%",
              transform: "translateX(-50%)",
            }}
          >
            <div className="flex items-center justify-between gap-3 border-b border-border/50 pb-1.5 mb-1.5 font-bold">
              <span>{activePoint.dateLabel}</span>
              <span
                className={`font-mono ${
                  activePoint.netResult >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                }`}
              >
                {activePoint.netResult >= 0 ? "+" : ""}
                {activePoint.netResult.toFixed(2)} ETB
              </span>
            </div>
            <div className="space-y-1 text-[11px]">
              <div className="flex items-center justify-between gap-4 text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-emerald-500" />
                  <span>Winnings:</span>
                </span>
                <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                  +{activePoint.winnings.toFixed(2)} ETB
                </span>
              </div>
              <div className="flex items-center justify-between gap-4 text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-rose-500" />
                  <span>Entry Stakes:</span>
                </span>
                <span className="font-mono font-semibold text-rose-600 dark:text-rose-400">
                  -{activePoint.entries.toFixed(2)} ETB
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Legend & Hint */}
      <div className="flex flex-wrap items-center justify-between text-[11px] text-muted-foreground border-t border-border/40 pt-2">
        <div className="flex items-center gap-3 font-medium">
          {viewMode === "activity" ? (
            <>
              <div className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-sm bg-emerald-500" />
                <span>Winnings (Won)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-sm bg-rose-500" />
                <span>Entry Stakes (Paid)</span>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-sm bg-emerald-500" />
                <span>Net Gain</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-sm bg-rose-500" />
                <span>Net Loss</span>
              </div>
            </>
          )}
        </div>
        <span className="text-[10px] text-muted-foreground">Tap any bar to inspect day details</span>
      </div>
    </div>
  );
}
