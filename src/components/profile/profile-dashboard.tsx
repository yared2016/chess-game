"use client";

import { useState } from "react";
import { usePreloadedQuery, type Preloaded } from "convex/react";
import type { api } from "../../../convex/_generated/api";
import { ProfileHeaderView, type ProfileSummary } from "./profile-header";
import { RatingSparkline } from "./rating-sparkline";
import { RecentGamesTable } from "./recent-games-table";
import { PlayerAchievements } from "./player-achievements";
import { Award, History, LayoutDashboard } from "lucide-react";

export function ProfileDashboard({
  preloaded,
  username,
}: {
  preloaded: Preloaded<typeof api.players.getByUsername>;
  username: string;
}) {
  const profile = usePreloadedQuery(preloaded);
  const [activeTab, setActiveTab] = useState<"overview" | "history" | "achievements">("overview");

  if (!profile) return null;

  return (
    <div className="space-y-6">
      <ProfileHeaderView profile={profile as ProfileSummary} />

      {/* Modern Dashboard Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-border/70 pb-3 overflow-x-auto">
        <button
          onClick={() => setActiveTab("overview")}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs sm:text-sm font-bold whitespace-nowrap transition-all ${
            activeTab === "overview"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
          }`}
        >
          <LayoutDashboard className="size-4" />
          Overview
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs sm:text-sm font-bold whitespace-nowrap transition-all ${
            activeTab === "history"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
          }`}
        >
          <History className="size-4" />
          Match History
        </button>
        <button
          onClick={() => setActiveTab("achievements")}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs sm:text-sm font-bold whitespace-nowrap transition-all ${
            activeTab === "achievements"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
          }`}
        >
          <Award className="size-4" />
          Achievements & Badges
        </button>
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

      {activeTab === "achievements" && (
        <div className="space-y-6">
          <PlayerAchievements profile={profile as ProfileSummary} />
        </div>
      )}
    </div>
  );
}
