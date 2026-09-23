"use client";

import { usePreloadedQuery, type Preloaded, useQuery, useConvexAuth } from "convex/react";
import type { api } from "../../../convex/_generated/api";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatDate, formatRating } from "@/lib/format";
import { cn, initials } from "@/lib/ui";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import {
  Award,
  Bot,
  Check,
  Crown,
  Flame,
  Globe,
  Link2,
  Settings,
  Shield,
  Sparkles,
  Swords,
  Trophy,
  UserCheck,
  Wallet,
  Zap,
} from "lucide-react";

export interface ProfileSummary {
  username: string;
  avatarUrl: string;
  rating: number;
  ratingHuman: number;
  ratingAi: number;
  wins: number;
  losses: number;
  draws: number;
  createdAt: number;
  proUntil?: number;
}

export function getTier(rating: number) {
  if (rating >= 2000) return { label: "Grandmaster", color: "text-amber-400 bg-amber-400/10 border-amber-400/20", icon: Crown };
  if (rating >= 1800) return { label: "Master", color: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20", icon: Trophy };
  if (rating >= 1600) return { label: "Candidate Master", color: "text-purple-400 bg-purple-400/10 border-purple-400/20", icon: Sparkles };
  if (rating >= 1400) return { label: "Expert", color: "text-blue-400 bg-blue-400/10 border-blue-400/20", icon: Shield };
  if (rating >= 1200) return { label: "Challenger", color: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20", icon: Swords };
  return { label: "Novice", color: "text-muted-foreground bg-muted border-border", icon: Award };
}

export function ProfileHeaderView({ profile }: { profile: ProfileSummary }) {
  const [copied, setCopied] = useState(false);
  const { isAuthenticated } = useConvexAuth();

  const totalGames = profile.wins + profile.losses + profile.draws;
  const winPercent = totalGames > 0 ? Math.round((profile.wins / totalGames) * 100) : 0;
  const drawPercent = totalGames > 0 ? Math.round((profile.draws / totalGames) * 100) : 0;
  const lossPercent = totalGames > 0 ? 100 - winPercent - drawPercent : 0;

  const tier = getTier(profile.rating);
  const TierIcon = tier.icon;

  const handleCopyLink = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      toast.success("Profile link copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <header className="relative overflow-hidden rounded-3xl border border-border/80 bg-gradient-to-b from-card via-card to-card/90 shadow-md">
      {/* Background Decorative Mesh & Chess Watermark */}
      <div className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-primary/5 blur-3xl pointer-events-none" />
      <div className="absolute top-2 right-4 text-7xl font-serif text-muted/10 select-none pointer-events-none sm:text-9xl">
        ♞
      </div>

      <div className="p-5 sm:p-7 relative z-10 space-y-6">
        {/* Top Profile Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
          <div className="flex items-center gap-4 sm:gap-5 min-w-0">
            <div className="relative shrink-0">
              <Avatar className="size-18 sm:size-22 ring-4 ring-primary/20 shadow-md">
                <AvatarImage src={profile.avatarUrl} alt={profile.username} />
                <AvatarFallback className="text-xl sm:text-2xl font-bold bg-primary/10 text-primary">
                  {initials(profile.username)}
                </AvatarFallback>
              </Avatar>
            </div>

            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-2xl sm:text-3xl font-black tracking-tight text-foreground">
                  {profile.username}
                </h1>
                <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${tier.color}`}>
                  <TierIcon className="size-3" />
                  {tier.label}
                </span>
              </div>

              <p className="text-xs sm:text-sm text-muted-foreground flex items-center gap-2">
                <span>Member since {formatDate(profile.createdAt)}</span>
                <span>•</span>
                <span className="text-foreground font-medium">{totalGames} matches</span>
              </p>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex flex-wrap items-center gap-2 self-start sm:self-center">
            <button
              onClick={handleCopyLink}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-border bg-card px-3 text-xs font-medium text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
            >
              {copied ? <Check className="size-3.5 text-green-500" /> : <Link2 className="size-3.5" />}
              {copied ? "Copied" : "Share"}
            </button>

            <Link
              href="/play"
              className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-primary text-primary-foreground px-3.5 text-xs font-bold shadow hover:bg-primary/90 transition-colors"
            >
              <Swords className="size-3.5" />
              Challenge
            </Link>

            <Link
              href="/wallet"
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-green-500/30 bg-green-500/10 text-green-500 px-3 text-xs font-bold hover:bg-green-500/20 transition-colors"
            >
              <Wallet className="size-3.5" />
              Wallet
            </Link>
          </div>
        </div>

        {/* 4 Performance KPI Cards */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {/* 1. Overall Rating */}
          <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Overall Rating
              </span>
              <Trophy className="size-4 text-primary" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="font-mono text-2xl sm:text-3xl font-black text-primary">
                {formatRating(profile.rating)}
              </span>
              <span className="text-xs font-bold text-muted-foreground">ELO</span>
            </div>
            <p className="text-[11px] text-muted-foreground font-medium flex items-center gap-1">
              <Flame className="size-3 text-amber-500" />
              {tier.label} Tier
            </p>
          </div>

          {/* 2. Win Rate & Record */}
          <div className="rounded-2xl border border-border bg-card p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Win Rate
              </span>
              <span className="font-mono text-xs font-bold text-green-500">{winPercent}%</span>
            </div>
            {/* Segmented Visual Progress Bar */}
            <div className="h-2 w-full rounded-full bg-muted/60 overflow-hidden flex">
              {winPercent > 0 && (
                <div style={{ width: `${winPercent}%` }} className="h-full bg-green-500" title={`Wins: ${profile.wins}`} />
              )}
              {drawPercent > 0 && (
                <div style={{ width: `${drawPercent}%` }} className="h-full bg-muted-foreground/40" title={`Draws: ${profile.draws}`} />
              )}
              {lossPercent > 0 && (
                <div style={{ width: `${lossPercent}%` }} className="h-full bg-red-500/80" title={`Losses: ${profile.losses}`} />
              )}
            </div>
            <p className="text-[11px] text-muted-foreground font-mono">
              <span className="text-green-500 font-bold">{profile.wins}W</span> ·{" "}
              <span className="text-muted-foreground font-bold">{profile.draws}D</span> ·{" "}
              <span className="text-red-500 font-bold">{profile.losses}L</span>
            </p>
          </div>

          {/* 3. Online PvP Humans */}
          <div className="rounded-2xl border border-border bg-card p-4 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                vs Humans
              </span>
              <Globe className="size-4 text-blue-400" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="font-mono text-2xl sm:text-3xl font-black text-foreground">
                {formatRating(profile.ratingHuman)}
              </span>
              <span className="text-xs font-bold text-muted-foreground">ELO</span>
            </div>
            <p className="text-[11px] text-muted-foreground">Multiplayer Ranked</p>
          </div>

          {/* 4. vs AI / Eve */}
          <div className="rounded-2xl border border-border bg-card p-4 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                vs AI Engine
              </span>
              <Bot className="size-4 text-purple-400" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="font-mono text-2xl sm:text-3xl font-black text-foreground">
                {formatRating(profile.ratingAi)}
              </span>
              <span className="text-xs font-bold text-muted-foreground">ELO</span>
            </div>
            <p className="text-[11px] text-muted-foreground">Stockfish & Eve</p>
          </div>
        </div>
      </div>
    </header>
  );
}

export function ProfileHeader({
  preloaded,
}: {
  preloaded: Preloaded<typeof api.players.getByUsername>;
}) {
  const profile = usePreloadedQuery(preloaded);
  if (profile === null) return null;
  return <ProfileHeaderView profile={profile as any} />;
}
