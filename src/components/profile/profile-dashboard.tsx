"use client";

import { useState } from "react";
import { usePreloadedQuery, type Preloaded } from "convex/react";
import type { api } from "../../../convex/_generated/api";
import { ProfileHeaderView, type ProfileSummary } from "./profile-header";
import { RatingSparkline } from "./rating-sparkline";
import { RecentGamesTable } from "./recent-games-table";
import { PlayerAchievements } from "./player-achievements";
import { Award, BookOpen, History, LayoutDashboard } from "lucide-react";
import { ProfileOpenings } from "./profile-openings";
import { cn } from "@/lib/ui";

const DASHBOARD_TABS = [
  {
    id: "overview" as const,
    label: "Overview",
    subtitle: "Rating & Recent",
    icon: LayoutDashboard,
  },
  {
    id: "history" as const,
    label: "Match History",
    subtitle: "Replays & PGNs",
    icon: History,
  },
  {
    id: "openings" as const,
    label: "Analytics & Openings",
    subtitle: "Win Rates & Prep",
    icon: BookOpen,
  },
  {
    id: "achievements" as const,
    label: "Achievements & Badges",
    subtitle: "Trophies & Badges",
    icon: Award,
  },
] as const;

export function ProfileDashboard({
  preloaded,
  username,
}: {
  preloaded: Preloaded<typeof api.players.getByUsername>;
  username: string;
}) {
  const profile = usePreloadedQuery(preloaded);
  const [activeTab, setActiveTab] = useState<"overview" | "history" | "openings" | "achievements">("overview");

  if (!profile) return null;

  return (
    <div className="space-y-6">
      <ProfileHeaderView profile={profile as ProfileSummary} />

      {/* Mobile Tab Navigation: Modern 2x2 Segmented Dashboard Deck (Zero Horizontal Scrolling) */}
      <div className="grid grid-cols-2 gap-2 p-1.5 rounded-2xl bg-card/60 border border-border/80 shadow-xs sm:hidden">
        {DASHBOARD_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-2.5 rounded-xl p-2.5 text-left transition-all relative overflow-hidden",
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm ring-1 ring-primary/40 font-bold"
                  : "bg-muted/40 text-muted-foreground hover:bg-muted/70 hover:text-foreground active:scale-[0.98] border border-border/40"
              )}
            >
              <div
                className={cn(
                  "size-8 rounded-lg flex items-center justify-center shrink-0 transition-colors",
                  isActive
                    ? "bg-primary-foreground/15 text-primary-foreground"
                    : "bg-card text-muted-foreground border border-border/50"
                )}
              >
                <Icon className="size-4 shrink-0" />
              </div>
              <div className="min-w-0 flex-1">
                <span
                  className={cn(
                    "text-xs font-bold leading-tight block truncate",
                    isActive ? "text-primary-foreground" : "text-foreground"
                  )}
                >
                  {tab.label}
                </span>
                <span
                  className={cn(
                    "text-[10px] leading-tight block truncate font-medium",
                    isActive ? "text-primary-foreground/75" : "text-muted-foreground"
                  )}
                >
                  {tab.subtitle}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Desktop Tab Navigation: Classic Horizontal Tabs */}
      <div className="hidden sm:flex items-center gap-2 border-b border-border/70 pb-3">
        {DASHBOARD_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs sm:text-sm font-bold whitespace-nowrap transition-all ${
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              }`}
            >
              <Icon className="size-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === "overview" && (
        <div className="space-y-6">
          <RatingSparkline username={username} />
          <RecentGamesTable username={username} />
        </div>
      )}

      {activeTab === "history" && (
        <div className="space-y-6">
          <RecentGamesTable username={username} />
        </div>
      )}

      {activeTab === "openings" && (
        <div className="space-y-6">
          <ProfileOpenings username={username} />
        </div>
      )}

      {activeTab === "achievements" && (
        <div className="space-y-6">
          <PlayerAchievements profile={profile as ProfileSummary} />
        </div>
      )}
    </div>
  );
}
