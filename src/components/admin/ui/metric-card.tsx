"use client";

import React from "react";
import { type LucideIcon, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

export interface MetricCardProps {
  label: string;
  value: string | number;
  sublabel?: string;
  icon?: LucideIcon;
  currency?: string;
  trend?: string;
  trendDirection?: "up" | "down" | "neutral";
  isLoading?: boolean;
  onClick?: () => void;
  className?: string;
}

export function MetricCard({
  label,
  value,
  sublabel,
  icon: Icon,
  currency,
  trend,
  trendDirection,
  isLoading = false,
  onClick,
  className,
}: MetricCardProps) {
  if (isLoading) {
    return (
      <div
        className={cn(
          "rounded-2xl sm:rounded-3xl border border-border/80 bg-card p-4 sm:p-5 shadow-xs flex flex-col justify-between space-y-3 animate-pulse",
          className
        )}
      >
        <div className="flex items-center justify-between">
          <div className="h-3 w-20 rounded bg-muted/70" />
          {Icon && <div className="size-7 rounded-lg bg-muted/70" />}
        </div>
        <div className="space-y-1.5">
          <div className="h-6 w-24 rounded bg-muted/70" />
          <div className="h-3 w-32 rounded bg-muted/70" />
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
        "rounded-2xl sm:rounded-3xl border border-border/80 bg-card p-4 sm:p-5 shadow-xs flex flex-col justify-between space-y-2.5 transition-colors",
        onClick && "cursor-pointer hover:border-border hover:bg-muted/30",
        className
      )}
    >
      {/* Top Header: Label & Icon */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-muted-foreground truncate">
          {label}
        </span>
        {Icon && (
          <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20 shrink-0">
            <Icon className="size-3.5" />
          </div>
        )}
      </div>

      {/* Main Metric Value */}
      <div className="space-y-1">
        <div className="flex items-baseline gap-1.5 flex-wrap">
          <span className="text-lg sm:text-xl font-mono font-bold tracking-tight text-foreground tabular-nums">
            {formattedValue}
          </span>
          {currency && (
            <span className="text-xs font-mono font-bold text-primary">
              {currency}
            </span>
          )}
        </div>

        {/* Sublabel and optional trend */}
        <div className="flex items-center justify-between gap-2">
          {sublabel && (
            <p className="text-[11px] text-muted-foreground line-clamp-1">
              {sublabel}
            </p>
          )}
          {trend && (
            <span
              className={cn(
                "inline-flex items-center gap-0.5 text-[10px] font-semibold shrink-0",
                resolvedDirection === "up" &&
                  "text-emerald-600 dark:text-emerald-400",
                resolvedDirection === "down" &&
                  "text-rose-600 dark:text-rose-400",
                resolvedDirection === "neutral" && "text-muted-foreground"
              )}
            >
              {resolvedDirection === "up" && (
                <TrendingUp className="size-2.5 shrink-0" />
              )}
              {resolvedDirection === "down" && (
                <TrendingDown className="size-2.5 shrink-0" />
              )}
              {resolvedDirection === "neutral" && (
                <Minus className="size-2.5 shrink-0" />
              )}
              <span>{trend}</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
