"use client";

import { useState } from "react";
import { Info } from "lucide-react";

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

  // If no activity in period, provide demo timeline so user can understand the visualization
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

  // Chart dimensions
  const height = 220;
  const paddingLeft = 40;
  const paddingRight = 20;
  const paddingTop = 25;
  const paddingBottom = 35;
  const plotWidth = 500;
  const plotHeight = height - paddingTop - paddingBottom;

  // Calculate value ranges
  const allValues = displayData.flatMap((d) => [d.netResult, d.winnings, -d.entries]);
  const maxVal = Math.max(100, ...allValues.map((v) => Math.abs(v)));
  const yZero = paddingTop + plotHeight / 2;

  const getX = (idx: number) => {
    if (displayData.length <= 1) return paddingLeft + plotWidth / 2;
    return paddingLeft + (idx / (displayData.length - 1)) * (plotWidth - paddingLeft - paddingRight);
  };

  const getY = (val: number) => {
    const scale = (plotHeight / 2) / maxVal;
    return yZero - val * scale;
  };

  // Build SVG path for net result line
  const linePath = displayData.reduce((acc, curr, idx) => {
    const x = getX(idx);
    const y = getY(curr.netResult);
    return idx === 0 ? `M ${x} ${y}` : `${acc} L ${x} ${y}`;
  }, "");

  return (
    <div className="relative flex flex-col justify-between rounded-3xl border border-border/80 bg-card p-5 shadow-sm dark:border-border/60 dark:bg-zinc-950">
      {/* Header */}
      <div className="flex items-center justify-between pb-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-black tracking-tight text-foreground">
            Earnings Over Time
          </h3>
          <span
            title="Shows your Net Gaming Result (Match Winnings minus Match Entries) across the selected period."
            className="cursor-pointer text-muted-foreground hover:text-foreground"
          >
            <Info className="size-3.5" />
          </span>
          {isDemo && (
            <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-500">
              Sample Preview
            </span>
          )}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 text-xs font-semibold text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-emerald-500" />
            <span>Net Result</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="size-2 rounded-sm bg-cyan-400" />
            <span>Winnings</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="size-2 rounded-sm bg-rose-400" />
            <span>Entries</span>
          </div>
        </div>
      </div>

      {/* SVG Visualization */}
      <div className="relative w-full overflow-hidden">
        <svg
          viewBox={`0 0 ${plotWidth} ${height}`}
          className="h-52 w-full overflow-visible"
          preserveAspectRatio="none"
        >
          {/* Zero baseline */}
          <line
            x1={paddingLeft}
            y1={yZero}
            x2={plotWidth - paddingRight}
            y2={yZero}
            stroke="currentColor"
            strokeOpacity="0.15"
            strokeDasharray="4 4"
          />

          {/* Grid lines and labels */}
          <text
            x={paddingLeft - 8}
            y={getY(maxVal) + 4}
            textAnchor="end"
            className="text-[10px] fill-muted-foreground font-mono"
          >
            +{Math.round(maxVal)}
          </text>
          <text
            x={paddingLeft - 8}
            y={yZero + 3}
            textAnchor="end"
            className="text-[10px] fill-muted-foreground font-mono"
          >
            0
          </text>
          <text
            x={paddingLeft - 8}
            y={getY(-maxVal) + 4}
            textAnchor="end"
            className="text-[10px] fill-muted-foreground font-mono"
          >
            -{Math.round(maxVal)}
          </text>

          {/* Bars for Winnings (above zero) & Entries (below zero) */}
          {displayData.map((d, idx) => {
            const x = getX(idx);
            const barWidth = 14;
            const winHeight = (d.winnings / maxVal) * (plotHeight / 2);
            const entryHeight = (d.entries / maxVal) * (plotHeight / 2);

            return (
              <g key={`bar-${idx}`}>
                {/* Winnings bar */}
                {d.winnings > 0 && (
                  <rect
                    x={x - barWidth - 1}
                    y={yZero - winHeight}
                    width={barWidth}
                    height={winHeight}
                    rx="3"
                    className="fill-cyan-400/40 hover:fill-cyan-400 transition-colors"
                  />
                )}
                {/* Entries bar */}
                {d.entries > 0 && (
                  <rect
                    x={x + 1}
                    y={yZero}
                    width={barWidth}
                    height={entryHeight}
                    rx="3"
                    className="fill-rose-400/40 hover:fill-rose-400 transition-colors"
                  />
                )}
              </g>
            );
          })}

          {/* Net Result Line */}
          <path
            d={linePath}
            fill="none"
            stroke="#10b981"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="drop-shadow-sm"
          />

          {/* Net Result Points */}
          {displayData.map((d, idx) => {
            const x = getX(idx);
            const y = getY(d.netResult);
            const isHovered = hoveredIndex === idx;

            return (
              <g
                key={`point-${idx}`}
                onMouseEnter={() => setHoveredIndex(idx)}
                onMouseLeave={() => setHoveredIndex(null)}
                className="cursor-pointer"
              >
                <circle
                  cx={x}
                  cy={y}
                  r={isHovered ? 6 : 4}
                  fill={d.netResult >= 0 ? "#10b981" : "#ef4444"}
                  stroke="#ffffff"
                  strokeWidth="2"
                  className="transition-all"
                />
                {/* X axis date label */}
                <text
                  x={x}
                  y={height - 10}
                  textAnchor="middle"
                  className="text-[10px] fill-muted-foreground font-semibold"
                >
                  {d.dateLabel}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Hover Tooltip Card */}
        {hoveredIndex !== null && displayData[hoveredIndex] && (
          <div
            className="pointer-events-none absolute z-20 rounded-xl border border-border/80 bg-zinc-950/95 p-2.5 text-xs shadow-xl backdrop-blur-md dark:border-zinc-800"
            style={{
              left: `${Math.min(75, Math.max(15, (getX(hoveredIndex) / plotWidth) * 100))}%`,
              top: "10%",
              transform: "translateX(-50%)",
            }}
          >
            <p className="font-bold text-zinc-100 border-b border-zinc-800 pb-1 mb-1.5">
              {displayData[hoveredIndex].dateLabel}
            </p>
            <div className="space-y-1">
              <div className="flex items-center justify-between gap-4 text-cyan-400">
                <span>Match Winnings:</span>
                <span className="font-mono font-bold">+{displayData[hoveredIndex].winnings.toFixed(2)} ETB</span>
              </div>
              <div className="flex items-center justify-between gap-4 text-rose-400">
                <span>Match Entries:</span>
                <span className="font-mono font-bold">-{displayData[hoveredIndex].entries.toFixed(2)} ETB</span>
              </div>
              <div
                className={`flex items-center justify-between gap-4 pt-1 border-t border-zinc-800 font-bold ${
                  displayData[hoveredIndex].netResult >= 0 ? "text-emerald-400" : "text-rose-500"
                }`}
              >
                <span>Net Result:</span>
                <span className="font-mono">
                  {displayData[hoveredIndex].netResult >= 0 ? "+" : ""}
                  {displayData[hoveredIndex].netResult.toFixed(2)} ETB
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
