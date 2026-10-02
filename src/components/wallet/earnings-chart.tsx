"use client";

import { useState } from "react";
import { Info, TrendingUp, TrendingDown } from "lucide-react";

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
  const height = 200;
  const paddingLeft = 38;
  const paddingRight = 16;
  const paddingTop = 20;
  const paddingBottom = 30;
  const plotWidth = 500;
  const plotHeight = height - paddingTop - paddingBottom;

  // Calculate value ranges
  const allValues = displayData.flatMap((d) => [d.netResult, d.winnings, -d.entries]);
  const rawMax = Math.max(100, ...allValues.map((v) => Math.abs(v)));
  const maxVal = Math.ceil(rawMax / 50) * 50; // round to nearest 50 for clean axis
  const yZero = paddingTop + plotHeight / 2;

  const getX = (idx: number) => {
    if (displayData.length <= 1) return paddingLeft + (plotWidth - paddingLeft - paddingRight) / 2;
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

  // Area path for gradient fill below line down to baseline
  const areaPath = `${linePath} L ${getX(displayData.length - 1)} ${yZero} L ${getX(0)} ${yZero} Z`;

  const activePoint = hoveredIndex !== null ? displayData[hoveredIndex] : null;

  return (
    <div className="relative flex flex-col justify-between rounded-3xl border border-border/70 bg-card p-4 sm:p-5 shadow-xs transition-colors">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-border/50">
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <TrendingUp className="size-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold tracking-tight text-foreground flex items-center gap-1.5">
              <span>Earnings Trend</span>
              {isDemo && (
                <span className="rounded-full bg-muted px-2 py-0.5 text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Sample
                </span>
              )}
            </h3>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 text-[11px] font-medium text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-emerald-500" />
            <span>Net Profit</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="size-2 rounded-sm bg-primary/70" />
            <span>Winnings</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="size-2 rounded-sm bg-rose-500/70" />
            <span>Entries</span>
          </div>
        </div>
      </div>

      {/* SVG Visualization */}
      <div className="relative w-full pt-2">
        <svg
          viewBox={`0 0 ${plotWidth} ${height}`}
          className="h-44 sm:h-52 w-full overflow-visible select-none"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="earnings-area-gradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
            </linearGradient>
            <linearGradient id="winnings-bar-gradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent, #c9a24a)" stopOpacity="0.6" />
              <stop offset="100%" stopColor="var(--accent, #c9a24a)" stopOpacity="0.2" />
            </linearGradient>
          </defs>

          {/* Zero baseline */}
          <line
            x1={paddingLeft}
            y1={yZero}
            x2={plotWidth - paddingRight}
            y2={yZero}
            stroke="currentColor"
            className="text-border"
            strokeWidth="1"
            strokeDasharray="3 3"
          />

          {/* Grid lines and labels */}
          <text
            x={paddingLeft - 8}
            y={getY(maxVal) + 4}
            textAnchor="end"
            className="text-[10px] fill-muted-foreground font-mono font-medium"
          >
            +{maxVal}
          </text>
          <text
            x={paddingLeft - 8}
            y={yZero + 3}
            textAnchor="end"
            className="text-[10px] fill-muted-foreground font-mono font-medium"
          >
            0
          </text>
          <text
            x={paddingLeft - 8}
            y={getY(-maxVal) + 4}
            textAnchor="end"
            className="text-[10px] fill-muted-foreground font-mono font-medium"
          >
            -{maxVal}
          </text>

          {/* Bars for Winnings & Entries */}
          {displayData.map((d, idx) => {
            const x = getX(idx);
            const barWidth = 10;
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
                    rx="2"
                    fill="url(#winnings-bar-gradient)"
                  />
                )}
                {/* Entries bar */}
                {d.entries > 0 && (
                  <rect
                    x={x + 1}
                    y={yZero}
                    width={barWidth}
                    height={entryHeight}
                    rx="2"
                    className="fill-rose-500/30"
                  />
                )}
              </g>
            );
          })}

          {/* Area fill under net result curve */}
          <path d={areaPath} fill="url(#earnings-area-gradient)" />

          {/* Net Result Line */}
          <path
            d={linePath}
            fill="none"
            stroke="#10b981"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="drop-shadow-xs"
          />

          {/* Interactive vertical touch zones and points */}
          {displayData.map((d, idx) => {
            const x = getX(idx);
            const y = getY(d.netResult);
            const isHovered = hoveredIndex === idx;

            return (
              <g
                key={`point-${idx}`}
                className="cursor-pointer"
                onMouseEnter={() => setHoveredIndex(idx)}
                onMouseLeave={() => setHoveredIndex(null)}
                onClick={() => setHoveredIndex(hoveredIndex === idx ? null : idx)}
              >
                {/* Wide invisible hitbox for easy tapping on mobile */}
                <rect
                  x={x - 20}
                  y={paddingTop}
                  width={40}
                  height={plotHeight}
                  fill="transparent"
                />

                {/* Vertical indicator line when active */}
                {isHovered && (
                  <line
                    x1={x}
                    y1={paddingTop}
                    x2={x}
                    y2={height - paddingBottom}
                    stroke="currentColor"
                    className="text-primary/60"
                    strokeWidth="1.5"
                    strokeDasharray="2 2"
                  />
                )}

                {/* Point circle */}
                <circle
                  cx={x}
                  cy={y}
                  r={isHovered ? 5.5 : 3.5}
                  className={`transition-all duration-150 ${
                    d.netResult >= 0 ? "fill-emerald-500" : "fill-rose-500"
                  }`}
                  stroke="var(--bg-elevated, #ffffff)"
                  strokeWidth="2"
                />

                {/* X axis date label */}
                <text
                  x={x}
                  y={height - 8}
                  textAnchor="middle"
                  className={`text-[10px] font-mono transition-colors ${
                    isHovered
                      ? "fill-foreground font-bold"
                      : "fill-muted-foreground font-medium"
                  }`}
                >
                  {d.dateLabel}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Hover / Tap Tooltip */}
        {activePoint && hoveredIndex !== null && (
          <div
            className="pointer-events-none absolute z-30 rounded-2xl border border-border/80 bg-popover/95 p-3 text-xs text-popover-foreground shadow-xl backdrop-blur-md transition-all animate-in fade-in duration-100"
            style={{
              left: `${Math.min(75, Math.max(25, (getX(hoveredIndex) / plotWidth) * 100))}%`,
              top: "10%",
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
                <span>Winnings:</span>
                <span className="font-mono font-semibold text-foreground">
                  +{activePoint.winnings.toFixed(2)} ETB
                </span>
              </div>
              <div className="flex items-center justify-between gap-4 text-muted-foreground">
                <span>Entries:</span>
                <span className="font-mono font-semibold text-rose-600 dark:text-rose-400">
                  -{activePoint.entries.toFixed(2)} ETB
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="pt-2 text-center text-[10px] text-muted-foreground sm:text-left">
        Tap or hover any day to view detailed match revenue vs fees.
      </div>
    </div>
  );
}
