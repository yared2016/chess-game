// src/components/tournaments/tournament-list.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import {
  Trophy,
  Clock,
  Zap,
  ArrowRight,
  Sparkles,
  Swords,
  Radio,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/ui";

export function TournamentList() {
  const [filter, setFilter] = useState<"all" | "active" | "upcoming" | "completed">("all");
  const [isGenerating, setIsGenerating] = useState(false);

  const tournaments = useQuery(api.tournaments.listTournaments, {
    status: filter === "all" ? undefined : filter,
  });
  const seedMutation = useMutation(api.tournaments.seedTournaments);

  // Auto seed if empty
  useEffect(() => {
    if (tournaments && tournaments.length === 0 && filter === "all") {
      seedMutation({ force: false }).catch(console.error);
    }
  }, [tournaments, filter, seedMutation]);

  const handleGenerateTournaments = async () => {
    setIsGenerating(true);
    try {
      await seedMutation({ force: true });
      toast.success("Live arena tournament launched! Ready to play.", { icon: "⚔️" });
    } catch (err: any) {
      toast.error(err.message || "Failed to generate tournaments");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl sm:rounded-3xl bg-card border border-border/80 p-4 sm:p-7 shadow-sm">
        <div className="space-y-1 sm:space-y-1.5">
          <div className="flex items-center gap-2.5">
            <div className="size-9 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0">
              <Trophy className="size-5 text-amber-500" />
            </div>
            <h1 className="text-lg sm:text-2xl font-black tracking-tight text-foreground">
              Castle Tournaments & Arenas
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground max-w-xl">
            Compete in fast-paced Arena tournaments, earn streak bonuses, and battle for the prize pool.
          </p>
        </div>

        {/* Action & Filter Controls */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
          {/* Quick Generator Button */}
          <Button
            size="sm"
            onClick={handleGenerateTournaments}
            disabled={isGenerating}
            className="rounded-xl font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Zap className="size-3.5 text-amber-300" />
            <span>{isGenerating ? "Launching..." : "Launch Live Arena"}</span>
          </Button>

          {/* Filter Tabs: Responsive 4-Column Grid on Mobile (Zero Horizontal Scrolling) & Flex on Desktop */}
          <div className="grid grid-cols-4 gap-1 p-1 rounded-xl bg-muted/40 border border-border/60 w-full sm:w-auto sm:flex sm:items-center">
            {(["all", "active", "upcoming", "completed"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setFilter(tab)}
                className={cn(
                  "px-2 sm:px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-all cursor-pointer text-center",
                  filter === tab
                    ? "bg-primary text-primary-foreground shadow-xs font-bold"
                    : "text-muted-foreground hover:text-foreground active:scale-[0.98]",
                )}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tournaments Grid */}
      {tournaments === undefined ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-52 rounded-2xl bg-card/50 border border-border/50 animate-pulse" />
          ))}
        </div>
      ) : tournaments.length === 0 ? (
        <div className="rounded-2xl sm:rounded-3xl border border-dashed border-border/80 p-8 sm:p-12 text-center space-y-3 bg-card/40">
          <Trophy className="size-10 text-muted-foreground mx-auto opacity-50" />
          <h3 className="text-base font-bold text-foreground">
            No {filter !== "all" ? `${filter} ` : ""}Tournaments Found
          </h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            {filter === "active"
              ? "There is no live arena tournament currently active. Click below to launch a new live 3+0 Blitz Arena immediately!"
              : "Check back soon for upcoming arena tournaments or launch a fresh live competitive arena."}
          </p>
          <Button
            size="sm"
            disabled={isGenerating}
            onClick={handleGenerateTournaments}
            className="rounded-xl mt-2 font-bold cursor-pointer"
          >
            <Zap className="size-3.5 text-amber-300 mr-1.5" />
            <span>{isGenerating ? "Launching Arena..." : "Launch Live Arena"}</span>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {tournaments.map((t) => {
            const isActive = t.status === "active";
            const isUpcoming = t.status === "upcoming";

            return (
              <div
                key={t._id}
                className={cn(
                  "flex flex-col justify-between rounded-2xl sm:rounded-3xl border bg-card p-4 sm:p-5 transition-all shadow-sm hover:shadow-md hover:border-primary/40",
                  isActive && "border-amber-500/40 bg-gradient-to-br from-card to-amber-500/5",
                )}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider",
                        isActive && "bg-amber-500/15 text-amber-500 border border-amber-500/30",
                        isUpcoming && "bg-blue-500/15 text-blue-500 border border-blue-500/30",
                        !isActive && !isUpcoming && "bg-muted text-muted-foreground",
                      )}
                    >
                      {isActive && <Radio className="size-2.5 text-amber-500 animate-pulse" />}
                      {isActive ? "Live Arena" : isUpcoming ? "Upcoming" : "Completed"}
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

                <div className="pt-4 mt-4 border-t border-border/60 space-y-3">
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
                      className={cn(
                        "w-full rounded-xl flex items-center justify-center gap-2 text-xs font-bold cursor-pointer transition-all",
                        isActive && "bg-primary text-primary-foreground shadow-sm shadow-primary/20",
                      )}
                      variant={isActive ? "default" : "secondary"}
                    >
                      {isActive && <Swords className="size-3.5" />}
                      <span>
                        {isActive ? "Enter Arena" : isUpcoming ? "View & Register" : "View Standings"}
                      </span>
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
