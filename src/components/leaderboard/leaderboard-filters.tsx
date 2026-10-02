"use client";
// src/components/leaderboard/leaderboard-filters.tsx  [U4]
import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { LeaderboardFilter } from "@/lib/types";
import { Trophy, Swords, Bot } from "lucide-react";

export interface PoolTab {
  value: LeaderboardFilter;
  label: string;
  hint: string;
}

export const POOL_TABS: readonly PoolTab[] = [
  { value: "all", label: "All Modes", hint: "Overall rating across every competitive mode" },
  { value: "human", label: "vs Humans", hint: "Rating from real-time online PvP matches" },
  { value: "ai", label: "vs AI", hint: "Rating from games against Castle Chess engine" },
];

export const FILTER_HINTS: Record<LeaderboardFilter, string> = {
  all: POOL_TABS[0].hint,
  human: POOL_TABS[1].hint,
  ai: POOL_TABS[2].hint,
};

/** Modern segmented pill tab strip with responsive icons and crisp active state */
export function LeaderboardFilters() {
  return (
    <TabsList
      className="h-10 sm:h-11 p-1 bg-muted/60 border border-border/70 rounded-2xl gap-1 w-full sm:w-auto shadow-2xs"
      aria-label="Rating pool"
    >
      {POOL_TABS.map((tab) => {
        const Icon =
          tab.value === "all" ? Trophy : tab.value === "human" ? Swords : Bot;

        return (
          <TabsTrigger
            key={tab.value}
            value={tab.value}
            className="flex-1 sm:flex-initial px-3 sm:px-4 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-all data-active:bg-card data-active:text-foreground data-active:shadow-sm flex items-center gap-1.5"
          >
            <Icon className="size-3.5 sm:size-4 shrink-0" />
            <span>{tab.label}</span>
          </TabsTrigger>
        );
      })}
    </TabsList>
  );
}
