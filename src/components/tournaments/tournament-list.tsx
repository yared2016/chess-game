// src/components/tournaments/tournament-list.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import {
  Trophy,
  Flame,
  Clock,
  Users,
  Zap,
  ArrowRight,
  ShieldAlert,
  Sparkles,
  Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/ui";

export function TournamentList() {
  const [filter, setFilter] = useState<"all" | "active" | "upcoming" | "completed">("all");
  const tournaments = useQuery(api.tournaments.listTournaments, {
    status: filter === "all" ? undefined : filter,
  });
  const seedMutation = useMutation(api.tournaments.seedTournaments);

  // Auto seed if empty
  useEffect(() => {
    if (tournaments && tournaments.length === 0 && filter === "all") {
      seedMutation().catch(console.error);
    }
  }, [tournaments, filter, seedMutation]);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-card border border-border/80 p-5 sm:p-7 shadow-sm">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2.5">
            <Trophy className="size-6 text-amber-500" />
            <h1 className="text-xl sm:text-2xl font-black tracking-tight">Castle Tournaments & Arenas</h1>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Compete in fast-paced Arena tournaments, earn streak bonuses, and battle for the prize pool.
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 bg-muted/60 p-1 rounded-xl border border-border/60 overflow-x-auto no-scrollbar w-full sm:w-auto">
          {(["all", "active", "upcoming", "completed"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-colors",
                filter === tab
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Tournaments Grid */}
      {tournaments === undefined ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-48 rounded-2xl bg-card/50 border border-border/50 animate-pulse" />
          ))}
        </div>
      ) : tournaments.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/80 p-12 text-center space-y-3">
          <Trophy className="size-10 text-muted-foreground mx-auto opacity-50" />
          <h3 className="text-base font-bold">No Tournaments Found</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Check back soon for upcoming arena tournaments or create your own custom event.
          </p>
          <Button
            size="sm"
            onClick={() => seedMutation().catch(console.error)}
            className="rounded-xl mt-2"
          >
            Generate Tournaments
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {tournaments.map((t) => {
            const isActive = t.status === "active";
            const isUpcoming = t.status === "upcoming";
            const isCompleted = t.status === "completed";

            return (
              <div
                key={t._id}
                className={cn(
                  "flex flex-col justify-between rounded-2xl border bg-card p-5 transition-all shadow-sm hover:shadow-md hover:border-primary/40",
                  isActive && "border-amber-500/40 bg-gradient-to-br from-card to-amber-500/5",
                )}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider",
                        isActive && "bg-amber-500/15 text-amber-500 border border-amber-500/30 animate-pulse",
                        isUpcoming && "bg-blue-500/15 text-blue-500 border border-blue-500/30",
                        isCompleted && "bg-muted text-muted-foreground",
                      )}
                    >
                      {isActive ? "● Live Arena" : isUpcoming ? "Upcoming" : "Completed"}
                    </span>

                    <span className="flex items-center gap-1 text-xs font-bold text-muted-foreground">
                      <Clock className="size-3.5" />
                      {t.timeControlKey}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-base sm:text-lg font-black text-foreground tracking-tight">
                      {t.title}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                      {t.description}
                    </p>
                  </div>
                </div>

                <div className="pt-5 mt-4 border-t border-border/60 space-y-4">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5 font-bold text-foreground">
                      <Sparkles className="size-3.5 text-amber-400" />
                      <span>{t.prizePool ? `${t.prizePool} ETB Prize` : "Open Trophy"}</span>
                    </div>

                    <div className="flex items-center gap-1 text-muted-foreground font-medium">
                      <Zap className="size-3.5 text-primary" />
                      <span>{t.durationMinutes} min format</span>
                    </div>
                  </div>

                  <Link href={`/tournaments/${t._id}`} className="block">
                    <Button
                      className="w-full rounded-xl flex items-center justify-center gap-2 text-xs font-bold"
                      variant={isActive ? "default" : "secondary"}
                    >
                      <span>{isActive ? "Enter Arena" : isUpcoming ? "View & Register" : "View Standings"}</span>
                      <ArrowRight className="size-3.5" />
                    </Button>
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
