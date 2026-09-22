"use client";

import { Award, CheckCircle2, Lock, ShieldCheck, Sparkles, Trophy, Zap, Swords, Bot, Coins } from "lucide-react";
import type { ProfileSummary } from "./profile-header";

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: any;
  isUnlocked: (p: ProfileSummary) => boolean;
  category: "rating" | "matches" | "special";
}

export const ACHIEVEMENTS: Achievement[] = [
  {
    id: "first_win",
    title: "First Blood",
    description: "Secure your first checkmate or resignation victory.",
    icon: Trophy,
    category: "matches",
    isUnlocked: (p) => p.wins >= 1,
  },
  {
    id: "veteran_10",
    title: "Battle Tested",
    description: "Complete 10 or more matches on Castle Chess.",
    icon: Swords,
    category: "matches",
    isUnlocked: (p) => (p.wins + p.losses + p.draws) >= 10,
  },
  {
    id: "centurion_50",
    title: "Centurion Tactician",
    description: "Complete 50 or more online or AI matches.",
    icon: Award,
    category: "matches",
    isUnlocked: (p) => (p.wins + p.losses + p.draws) >= 50,
  },
  {
    id: "rating_1400",
    title: "Rising Master",
    description: "Cross 1,400 Elo rating threshold.",
    icon: Zap,
    category: "rating",
    isUnlocked: (p) => p.rating >= 1400,
  },
  {
    id: "rating_1600",
    title: "Chess Champion",
    description: "Reach an elite 1,600+ Elo rating.",
    icon: Sparkles,
    category: "rating",
    isUnlocked: (p) => p.rating >= 1600,
  },
  {
    id: "human_slayer",
    title: "PvP Specialist",
    description: "Reach 1,300+ Elo in multiplayer online matches.",
    icon: ShieldCheck,
    category: "rating",
    isUnlocked: (p) => p.ratingHuman >= 1300,
  },
  {
    id: "ai_slayer",
    title: "Machine Conqueror",
    description: "Reach 1,300+ Elo playing against AI engines.",
    icon: Bot,
    category: "special",
    isUnlocked: (p) => p.ratingAi >= 1300,
  },
  {
    id: "sharp_mind",
    title: "Dominant Force",
    description: "Maintain a win rate of 60% or higher with at least 5 games.",
    icon: Coins,
    category: "special",
    isUnlocked: (p) => {
      const total = p.wins + p.losses + p.draws;
      return total >= 5 && (p.wins / total) >= 0.6;
    },
  },
];

export function PlayerAchievements({ profile }: { profile: ProfileSummary }) {
  const total = ACHIEVEMENTS.length;
  const unlockedCount = ACHIEVEMENTS.filter((a) => a.isUnlocked(profile)).length;
  const percent = Math.round((unlockedCount / total) * 100);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div>
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <Trophy className="size-5 text-amber-500" />
            Player Achievements
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Milestones and badges earned on Castle Chess.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className="text-xs font-semibold text-muted-foreground block">
              Unlocked: {unlockedCount} / {total}
            </span>
            <div className="w-32 h-2 rounded-full bg-muted mt-1 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-amber-500 to-primary rounded-full transition-all duration-500"
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>
          <span className="text-sm font-extrabold text-primary font-mono">{percent}%</span>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {ACHIEVEMENTS.map((item) => {
          const unlocked = item.isUnlocked(profile);
          const Icon = item.icon;

          return (
            <div
              key={item.id}
              className={`relative rounded-2xl border p-4.5 transition-all flex flex-col justify-between gap-3 ${
                unlocked
                  ? "border-amber-500/30 bg-gradient-to-br from-card via-card to-amber-500/5 shadow-sm"
                  : "border-border/60 bg-muted/20 opacity-70"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div
                  className={`rounded-xl p-2.5 ${
                    unlocked
                      ? "bg-amber-500/10 text-amber-500 ring-4 ring-amber-500/5"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  <Icon className="size-5" />
                </div>
                {unlocked ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-[10px] font-bold text-green-500 uppercase tracking-wider">
                    <CheckCircle2 className="size-3" />
                    Unlocked
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                    <Lock className="size-3" />
                    Locked
                  </span>
                )}
              </div>

              <div>
                <h4 className="text-sm font-bold text-foreground">{item.title}</h4>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  {item.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
