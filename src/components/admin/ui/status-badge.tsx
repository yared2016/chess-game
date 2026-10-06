"use client";

import React from "react";
import { cn } from "@/lib/utils";

export interface StatusBadgeProps {
  status: string;
  size?: "sm" | "md";
  className?: string;
  showDot?: boolean;
}

export type StatusTone = "emerald" | "amber" | "rose" | "purple" | "slate";

export function getStatusBadgeConfig(status: string): {
  tone: StatusTone;
  containerClass: string;
  dotClass: string;
} {
  const normalized = (status || "").trim().toLowerCase().replace(/[-_\s]+/g, " ");

  // Emerald: Completed, Approved, Credited, Healthy, Active, Clean, Success
  if (
    normalized === "completed" ||
    normalized === "approved" ||
    normalized === "credited" ||
    normalized === "healthy" ||
    normalized === "active" ||
    normalized === "clean" ||
    normalized === "success"
  ) {
    return {
      tone: "emerald",
      containerClass:
        "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20",
      dotClass: "bg-emerald-500",
    };
  }

  // Amber: Processing, Pending, Locked, Warning, Under Review, In Review, New
  if (
    normalized === "processing" ||
    normalized === "pending" ||
    normalized === "locked" ||
    normalized === "warning" ||
    normalized === "under review" ||
    normalized === "in review" ||
    normalized === "new"
  ) {
    return {
      tone: "amber",
      containerClass:
        "bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20",
      dotClass: "bg-amber-500 animate-pulse",
    };
  }

  // Rose: Failed, Rejected, Banned, Critical, Restricted, Suspended
  if (
    normalized === "failed" ||
    normalized === "rejected" ||
    normalized === "banned" ||
    normalized === "critical" ||
    normalized === "restricted" ||
    normalized === "suspended"
  ) {
    return {
      tone: "rose",
      containerClass:
        "bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20",
      dotClass: "bg-rose-500",
    };
  }

  // Purple: Reversed, Refunded
  if (normalized === "reversed" || normalized === "refunded") {
    return {
      tone: "purple",
      containerClass:
        "bg-purple-500/10 text-purple-700 dark:text-purple-400 border border-purple-500/20",
      dotClass: "bg-purple-500",
    };
  }

  // Slate / Neutral fallback: Closed, Resolved, Unknown, or other
  return {
    tone: "slate",
    containerClass:
      "bg-muted/70 text-muted-foreground border border-border/70",
    dotClass: "bg-muted-foreground/80",
  };
}

export function StatusBadge({
  status,
  size = "md",
  className,
  showDot = true,
}: StatusBadgeProps) {
  const config = getStatusBadgeConfig(status);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-bold uppercase tracking-wider whitespace-nowrap transition-colors",
        config.containerClass,
        size === "sm" ? "text-[9px] px-2 py-0.5" : "text-[10px] px-2.5 py-0.5",
        className
      )}
    >
      {showDot && (
        <span
          className={cn(
            "size-1.5 rounded-full shrink-0",
            config.dotClass
          )}
          aria-hidden="true"
        />
      )}
      <span>{status}</span>
    </span>
  );
}
