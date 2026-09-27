"use client";

import { useMemo } from "react";
import { cn } from "@/lib/ui";

export interface EvalBarProps {
  /** Centipawn evaluation from White's perspective (positive = white advantage). */
  scoreCp: number | null;
  /** Mate in N from White's perspective (positive = white mates, negative = black mates). */
  mateIn: number | null;
  /** Board orientation: 'w' (White at bottom) or 'b' (Black at bottom). */
  orientation?: "w" | "b";
  /** Optional custom class name. */
  className?: string;
  /** Vertical or horizontal layout. Default vertical. */
  layout?: "vertical" | "horizontal";
}

/**
 * Modern chess evaluation bar with smooth CSS transitions and numeric readout.
 */
export function EvalBar({
  scoreCp,
  mateIn,
  orientation = "w",
  className,
  layout = "vertical",
}: EvalBarProps) {
  const { whitePercentage, label } = useMemo(() => {
    if (mateIn !== null) {
      if (mateIn > 0) {
        return { whitePercentage: 100, label: `M${mateIn}` };
      } else {
        return { whitePercentage: 0, label: `-M${Math.abs(mateIn)}` };
      }
    }

    if (scoreCp === null) {
      return { whitePercentage: 50, label: "0.0" };
    }

    // Convert centipawns to win percentage using a sigmoid formula
    // 0 cp -> 50%, +400 cp (+4 pawns) -> ~85%, +1000 cp -> ~95%
    const pawns = scoreCp / 100;
    const clampedPawns = Math.max(-15, Math.min(15, pawns));
    const percentage = 50 + 50 * (2 / (1 + Math.exp(-0.35 * clampedPawns)) - 1);
    const clampedPercentage = Math.max(4, Math.min(96, percentage));

    const sign = pawns > 0 ? "+" : "";
    const formattedScore = `${sign}${pawns.toFixed(1)}`;

    return {
      whitePercentage: clampedPercentage,
      label: formattedScore === "+0.0" || formattedScore === "-0.0" ? "0.0" : formattedScore,
    };
  }, [scoreCp, mateIn]);

  // Adjust for orientation: if viewing as Black, flip the fill
  const fillPercentage = orientation === "w" ? whitePercentage : 100 - whitePercentage;

  if (layout === "horizontal") {
    return (
      <div className={cn("flex flex-col gap-1 w-full", className)}>
        <div className="flex items-center justify-between text-[11px] font-mono font-bold text-muted-foreground px-1">
          <span>{orientation === "w" ? "White" : "Black"}</span>
          <span className="text-foreground">{label}</span>
          <span>{orientation === "w" ? "Black" : "White"}</span>
        </div>
        <div className="relative h-2.5 w-full rounded-full bg-zinc-900 border border-border/80 overflow-hidden shadow-inner flex">
          <div
            style={{ width: `${fillPercentage}%` }}
            className="h-full bg-zinc-100 transition-all duration-300 ease-out"
          />
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative flex flex-col justify-between w-7 rounded-xl overflow-hidden border border-border/80 shadow-md select-none bg-zinc-900 text-[10px] font-mono font-black",
        className
      )}
      style={{ height: "100%", minHeight: "160px" }}
      aria-label={`Evaluation: ${label}`}
    >
      {/* Black's section is the background (bg-zinc-900) */}
      {/* White's section is the bottom fill */}
      <div
        style={{ height: `${fillPercentage}%` }}
        className="absolute bottom-0 left-0 right-0 bg-zinc-100 transition-all duration-300 ease-out z-0"
      />

      {/* Numerical label placed in the winning player's section */}
      <div
        className={cn(
          "relative z-10 w-full text-center py-1 transition-colors duration-200",
          fillPercentage >= 50
            ? "mt-auto text-zinc-900"
            : "mb-auto text-zinc-100"
        )}
      >
        {label}
      </div>
    </div>
  );
}
