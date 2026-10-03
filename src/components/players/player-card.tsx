"use client";

import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { initials, cn } from "@/lib/ui";
import { formatPresenceLastSeen } from "@/lib/format";
import {
  SwordsIcon,
  GraduationCap,
  User,
  ExternalLink,
  CheckCircle2,
  Zap,
} from "lucide-react";

export interface PlayerSummaryData {
  _id: any;
  username: string;
  displayName: string;
  avatarUrl?: string;
  rating?: number;
  ratingHuman: number;
  playerType?: "university_student" | "public_player";
  universityName?: string;
  verificationStatus?: "none" | "pending" | "verified";
  isOnline: boolean;
  lastSeen: number;
}

interface PlayerCardProps {
  player: PlayerSummaryData;
  onChallenge: (player: PlayerSummaryData) => void;
  className?: string;
}

export function PlayerCard({ player, onChallenge, className }: PlayerCardProps) {
  const isStudent = player.playerType === "university_student";

  return (
    <div
      className={cn(
        "group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-border/80 bg-gradient-to-b from-card/95 via-card/75 to-card/90 p-4 transition-all duration-200 hover:-translate-y-1 hover:border-primary/50 hover:shadow-xl hover:shadow-black/25",
        className
      )}
    >
      {/* Top ambient highlight line */}
      <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-primary/40 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100 pointer-events-none" />

      <div className="space-y-3.5">
        {/* Top: Avatar, Name, Rating Plaque */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {/* Avatar with dynamic ring and online pulse */}
            <div className="relative shrink-0">
              <Avatar className="size-12 rounded-2xl border border-border/80 ring-2 ring-transparent group-hover:ring-primary/40 transition-all shadow-sm">
                <AvatarImage src={player.avatarUrl} alt={player.displayName} className="rounded-2xl object-cover" />
                <AvatarFallback className="rounded-2xl bg-gradient-to-br from-primary/20 via-primary/10 to-transparent font-bold text-sm text-primary">
                  {initials(player.displayName || player.username)}
                </AvatarFallback>
              </Avatar>
              {player.isOnline ? (
                <span
                  className="absolute -bottom-0.5 -right-0.5 size-3.5 rounded-full border-2 border-card bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.85)] animate-pulse"
                  title="Online now"
                />
              ) : (
                <span
                  className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-card bg-muted-foreground/40"
                  title="Offline"
                />
              )}
            </div>

            {/* Display name & username */}
            <div className="min-w-0 flex-1">
              <Link
                href={`/profile/${player.username}`}
                className="font-bold text-foreground text-sm truncate hover:text-primary transition-colors flex items-center gap-1.5"
                title={player.displayName}
              >
                <span className="truncate">{player.displayName}</span>
                {player.verificationStatus === "verified" && (
                  <CheckCircle2 className="size-3.5 text-emerald-400 shrink-0" />
                )}
              </Link>
              <span className="text-xs text-muted-foreground truncate block font-medium">
                @{player.username}
              </span>
            </div>
          </div>

          {/* Rating Plaque */}
          <div className="flex flex-col items-end shrink-0 pl-1">
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-primary/10 border border-primary/25 text-primary font-mono font-bold text-xs shadow-2xs group-hover:bg-primary/20 group-hover:border-primary/40 transition-colors">
              <Zap className="size-3 text-primary shrink-0" />
              <span>{player.ratingHuman}</span>
            </div>
            <span className="text-[9px] uppercase tracking-wider text-muted-foreground font-bold mt-0.5">Rating</span>
          </div>
        </div>

        {/* Middle: Badges & Live Status */}
        <div className="space-y-2 pt-0.5">
          <div className="flex flex-wrap items-center gap-1.5">
            {isStudent && player.universityName ? (
              <Badge
                variant="secondary"
                className="flex items-center gap-1.5 truncate text-[0.7rem] px-2 py-0.5 border-primary/25 bg-primary/10 text-primary font-semibold rounded-lg max-w-full"
                title={player.universityName}
              >
                <GraduationCap className="size-3 shrink-0" />
                <span className="truncate">{player.universityName}</span>
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="flex items-center gap-1.5 text-[0.7rem] px-2 py-0.5 border-border/70 bg-muted/40 text-muted-foreground font-medium rounded-lg"
              >
                <User className="size-3 shrink-0" />
                <span>Public Player</span>
              </Badge>
            )}

            {player.verificationStatus === "verified" && (
              <Badge variant="outline" className="text-[0.65rem] px-1.5 py-0.5 rounded-lg border-emerald-500/30 bg-emerald-500/10 text-emerald-400 font-semibold">
                Verified
              </Badge>
            )}
          </div>

          {/* Live presence indicator */}
          <div className="flex items-center gap-1.5 text-[0.75rem] font-medium">
            <span
              className={cn(
                "size-2 rounded-full shrink-0",
                player.isOnline ? "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.8)] animate-pulse" : "bg-muted-foreground/40"
              )}
            />
            <span className={player.isOnline ? "text-emerald-400 font-semibold" : "text-muted-foreground"}>
              {player.isOnline ? "Online" : formatPresenceLastSeen(player.lastSeen)}
            </span>
          </div>
        </div>
      </div>

      {/* Bottom: Modern Action Row */}
      <div className="mt-4 flex gap-2 border-t border-border/60 pt-3">
        <Button
          size="sm"
          variant="default"
          onClick={() => onChallenge(player)}
          className="flex-1 h-9 rounded-xl font-bold text-xs gap-1.5 shadow-sm active:scale-[0.98] transition-all bg-primary text-primary-foreground hover:brightness-110 cursor-pointer"
        >
          <SwordsIcon className="size-3.5 transition-transform duration-200 group-hover:rotate-12" />
          <span>Challenge</span>
        </Button>
        <Link
          href={`/profile/${player.username}`}
          aria-label={`View profile of ${player.displayName}`}
          className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-border/80 bg-background/60 px-3 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground hover:border-border transition-colors shadow-2xs cursor-pointer"
        >
          <ExternalLink className="size-3.5" />
          <span className="hidden sm:inline">Profile</span>
        </Link>
      </div>
    </div>
  );
}
