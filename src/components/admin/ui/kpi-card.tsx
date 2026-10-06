"use client";

import React from "react";
import { type LucideIcon, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

export interface KpiCardProps {
  title: string;
  value: string | number;
  currency?: string;
  trend?: string;
  trendDirection?: "up" | "down" | "neutral";
  icon: LucideIcon;
  isLoading?: boolean;
  sparklineData?: number[];
  onClick?: () => void;
  className?: string;
  subtitle?: string;
}

function Sparkline({
  data,
  trendDirection,
}: {
  data: number[];
  trendDirection?: "up" | "down" | "neutral";
}) {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const width = 80;
  const height = 28;
  const padding = 3;

  const points = data.map((val, idx) => {
    const x = padding + (idx / (data.length - 1)) * (width - 2 * padding);
    const y = height - padding - ((val - min) / range) * (height - 2 * padding);
    return { x, y };
  });

  let pathD = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    const mx = (p0.x + p1.x) / 2;
    pathD += ` Q ${p0.x.toFixed(1)} ${p0.y.toFixed(1)}, ${mx.toFixed(1)} ${((p0.y + p1.y) / 2).toFixed(1)} T ${p1.x.toFixed(1)} ${p1.y.toFixed(1)}`;
  }

  const strokeColor =
    trendDirection === "down"
      ? "text-rose-500"
      : trendDirection === "neutral"
      ? "text-muted-foreground"
      : "text-emerald-500";

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={cn("w-20 h-7 overflow-visible shrink-0", strokeColor)}
      aria-hidden="true"
    >
      <path
        d={pathD}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function KpiCard({
  title,
  value,
  currency,
  trend,
  trendDirection,
  icon: Icon,
  isLoading = false,
  sparklineData,
  onClick,
  className,
  subtitle,
}: KpiCardProps) {
  if (isLoading) {
    return (
      <div
        className={cn(
          "rounded-3xl border border-border/80 bg-card p-4 sm:p-5 shadow-xs relative overflow-hidden flex flex-col justify-between animate-pulse space-y-4",
          className
        )}
      >
        <div className="flex items-center justify-between">
          <div className="h-3 w-24 rounded bg-muted/70" />
          <div className="size-8 rounded-xl bg-muted/70" />
        </div>
        <div className="space-y-2">
          <div className="h-7 w-32 rounded bg-muted/70" />
          <div className="h-4 w-16 rounded-full bg-muted/70" />
        </div>
      </div>
    );
  }

  const resolvedDirection: "up" | "down" | "neutral" =
    trendDirection ??
    (trend?.startsWith("+")
      ? "up"
      : trend?.startsWith("-")
      ? "down"
      : "neutral");

  const formattedValue =
    typeof value === "number"
      ? value.toLocaleString("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })
      : value;

  return (
    <div
      onClick={onClick}
      onKeyDown={(e) => {
        if (onClick && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onClick();
        }
      }}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      className={cn(
        "rounded-3xl border border-border/80 bg-card p-4 sm:p-5 shadow-xs relative overflow-hidden flex flex-col justify-between space-y-4",
        onClick && "cursor-pointer hover:border-border hover:bg-muted/30 transition-all",
        className
      )}
    >
      {/* Top Bar: Title & Icon Badge */}
      <div className="flex items-center justify-between gap-2 relative z-10">
        <div className="space-y-0.5">
          <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            {title}
          </p>
          {subtitle && (
            <p className="text-[11px] text-muted-foreground">{subtitle}</p>
          )}
        </div>
        <div className="flex size-8 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20 shrink-0">
          <Icon className="size-4" />
        </div>
      </div>

      {/* Main Content: Value & Currency */}
      <div className="space-y-2 relative z-10">
        <div className="flex items-baseline gap-1.5 flex-wrap">
          <span className="text-xl sm:text-2xl font-mono font-bold tracking-tight text-foreground tabular-nums">
            {formattedValue}
          </span>
          {currency && (
            <span className="text-xs sm:text-sm font-mono font-bold text-primary">
              {currency}
            </span>
          )}
        </div>

        {/* Footer: Trend Pill & Optional Micro-Sparkline */}
        {(trend || (sparklineData && sparklineData.length > 1)) && (
          <div className="flex items-center justify-between gap-2 pt-0.5">
            {trend && (
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold border",
                  resolvedDirection === "up" &&
                    "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
                  resolvedDirection === "down" &&
                    "text-rose-600 dark:text-rose-400 bg-rose-500/10 border-rose-500/20",
                  resolvedDirection === "neutral" &&
                    "text-muted-foreground bg-muted/60 border-border/60"
                )}
              >
                {resolvedDirection === "up" && (
                  <TrendingUp className="size-3 shrink-0" />
                )}
                {resolvedDirection === "down" && (
                  <TrendingDown className="size-3 shrink-0" />
                )}
                {resolvedDirection === "neutral" && (
                  <Minus className="size-3 shrink-0" />
                )}
                <span>{trend}</span>
              </span>
            )}
            {sparklineData && sparklineData.length > 1 && (
              <Sparkline
                data={sparklineData}
                trendDirection={resolvedDirection}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
