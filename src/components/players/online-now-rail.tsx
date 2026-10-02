"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { initials } from "@/lib/ui";
import { FindOpponentModal, type OpponentSummary } from "./find-opponent-modal";
import { Users, ChevronRight, SwordsIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export function OnlineNowRail() {
  const onlinePlayers = useQuery(api.discovery.getOnlinePlayers, { limit: 12 });
  const [selectedOpponent, setSelectedOpponent] = useState<OpponentSummary | null>(null);

  if (onlinePlayers === undefined) {
    return (
      <div className="space-y-3 rounded-2xl border border-border/60 bg-card/40 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Online Now
            </span>
          </div>
        </div>
        <div className="flex gap-3 overflow-hidden">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex flex-col items-center gap-2">
              <Skeleton className="size-12 rounded-full" />
              <Skeleton className="h-3 w-14 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (onlinePlayers.length === 0) {
    return (
      <div className="flex items-center justify-between rounded-xl border border-border/50 bg-card/30 px-4 py-3 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <span className="size-2 rounded-full bg-emerald-500/60" />
          <span>No other players currently active in the lobby.</span>
        </div>
        <Link href="/players" className="font-medium text-primary hover:underline">
          Browse Directory →
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3 rounded-2xl border border-border/70 bg-card/40 p-4 backdrop-blur-sm">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="relative flex size-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex size-2.5 rounded-full bg-emerald-500" />
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-foreground">
              Online Now
            </span>
            <Badge variant="secondary" className="px-1.5 py-0 text-[0.65rem] font-bold">
              {onlinePlayers.length}
            </Badge>
          </div>
          <Link
            href="/players"
            className="flex items-center gap-1 text-xs font-medium text-primary transition-colors hover:text-primary/80"
          >
            All Players
            <ChevronRight className="size-3" />
          </Link>
        </div>

        {/* Scrollable Rail */}
        <div className="flex gap-3 overflow-x-auto pb-1 pt-1 scrollbar-none">
          {onlinePlayers.map((player) => (
            <button
              key={player._id}
              type="button"
              onClick={() => setSelectedOpponent(player as OpponentSummary)}
              className="group flex flex-col items-center gap-1.5 rounded-xl border border-transparent p-2 text-center transition-all hover:border-primary/40 hover:bg-muted/40"
            >
              <div className="relative">
                <Avatar className="size-12 border-2 border-emerald-500/80 ring-2 ring-emerald-500/20 transition-transform group-hover:scale-105">
                  <AvatarImage src={player.avatarUrl} alt={player.displayName} />
                  <AvatarFallback>{initials(player.displayName || player.username)}</AvatarFallback>
                </Avatar>
                <span className="absolute bottom-0 right-0 size-3 rounded-full border-2 border-background bg-emerald-500" />
              </div>
              <span className="max-w-[70px] truncate text-xs font-medium text-foreground">
                {player.displayName || player.username}
              </span>
              <span className="text-[0.65rem] font-semibold text-primary">
                {player.ratingHuman}
              </span>
            </button>
          ))}
        </div>
      </div>

      <FindOpponentModal
        isOpen={!!selectedOpponent}
        onClose={() => setSelectedOpponent(null)}
        opponent={selectedOpponent}
      />
    </>
  );
}
