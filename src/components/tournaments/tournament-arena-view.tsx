// src/components/tournaments/tournament-arena-view.tsx
"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import {
  Trophy,
  Flame,
  Clock,
  Zap,
  Swords,
  Pause,
  Play,
  LogOut,
  Medal,
  Sparkles,
  Users,
  Eye,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { cn } from "@/lib/ui";

function formatCountdown(targetMs: number) {
  const diff = Math.max(0, targetMs - Date.now());
  const totalSecs = Math.floor(diff / 1000);
  const hours = Math.floor(totalSecs / 3600);
  const minutes = Math.floor((totalSecs % 3600) / 60);
  const seconds = totalSecs % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

export function TournamentArenaView({ tournamentId }: { tournamentId: Id<"tournaments"> }) {
  const router = useRouter();
  const tournament = useQuery(api.tournaments.getTournament, { tournamentId });
  const joinMutation = useMutation(api.tournaments.joinTournament);
  const leaveMutation = useMutation(api.tournaments.leaveTournament);
  const setPausedMutation = useMutation(api.tournaments.setPaused);
  const pairNextMatchMutation = useMutation(api.tournaments.pairNextMatch);

  const [timeLeft, setTimeLeft] = useState<string>("");
  const [isPairing, setIsPairing] = useState<boolean>(false);

  // Live countdown clock ticker
  useEffect(() => {
    if (!tournament) return;
    const target = tournament.status === "upcoming" ? tournament.startsAt : tournament.endsAt;
    const update = () => setTimeLeft(formatCountdown(target));
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [tournament]);

  const isJoined = Boolean(tournament?.myParticipant);
  const isPaused = Boolean(tournament?.myParticipant?.isPaused);
  const activeGameId = tournament?.myParticipant?.activeGameId;

  const handleJoin = async () => {
    try {
      await joinMutation({ tournamentId });
      toast.success("Joined tournament arena! You are ready to play.", { icon: "⚔️" });
    } catch (err: any) {
      toast.error(err.message || "Failed to join tournament");
    }
  };

  const handleLeave = async () => {
    try {
      await leaveMutation({ tournamentId });
      toast.info("Left tournament");
    } catch (err: any) {
      toast.error(err.message || "Failed to leave");
    }
  };

  const handleTogglePause = async () => {
    try {
      await setPausedMutation({ tournamentId, paused: !isPaused });
      toast.info(isPaused ? "Resumed! You are ready for matches." : "Paused — take a break!");
    } catch (err: any) {
      toast.error(err.message || "Failed to toggle pause");
    }
  };

  const handlePair = async () => {
    setIsPairing(true);
    try {
      const res = await pairNextMatchMutation({ tournamentId });
      if (res.gameId) {
        toast.success("Match found! Entering arena game...", { icon: "🔥" });
        router.push(`/game?id=${res.gameId}`);
      } else {
        toast.info(res.message || "Looking for available opponent in the arena...", { icon: "⏳" });
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to find match");
    } finally {
      setIsPairing(false);
    }
  };

  if (!tournament) {
    return (
      <div className="space-y-4">
        <div className="h-40 rounded-2xl bg-card border border-border animate-pulse" />
        <div className="h-96 rounded-2xl bg-card border border-border animate-pulse" />
      </div>
    );
  }

  const isActive = tournament.status === "active";
  const isUpcoming = tournament.status === "upcoming";
  const isCompleted = tournament.status === "completed";

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="rounded-2xl bg-card border border-border/80 p-5 sm:p-7 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
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
              <span className="rounded-full bg-primary/10 text-primary border border-primary/20 px-2.5 py-0.5 text-[10px] font-bold">
                {tournament.timeControlKey}
              </span>
            </div>
            <h1 className="text-xl sm:text-3xl font-black text-foreground tracking-tight">
              {tournament.title}
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground max-w-2xl">
              {tournament.description}
            </p>
          </div>

          {/* Time Countdown & Prize Pool */}
          <div className="flex items-center gap-4 flex-wrap">
            <div className="rounded-xl bg-muted/60 border border-border/60 px-4 py-2.5 text-center">
              <div className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider flex items-center justify-center gap-1">
                <Clock className="size-3" />
                {isActive ? "Time Remaining" : isUpcoming ? "Starts In" : "Status"}
              </div>
              <div className="text-lg sm:text-xl font-black font-mono text-foreground mt-0.5">
                {isCompleted ? "Finished" : timeLeft}
              </div>
            </div>

            {tournament.prizePool && (
              <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 px-4 py-2.5 text-center">
                <div className="text-[10px] uppercase font-semibold text-amber-500 tracking-wider flex items-center justify-center gap-1">
                  <Sparkles className="size-3" />
                  Prize Pool
                </div>
                <div className="text-lg sm:text-xl font-black text-amber-500 mt-0.5">
                  {tournament.prizePool} ETB
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Action Center Bar */}
        <div className="pt-4 border-t border-border/60 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Users className="size-4 text-muted-foreground" />
            <span className="text-xs sm:text-sm font-bold text-foreground">
              {tournament.participantCount} Players Enrolled
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {!isJoined ? (
              <Button
                onClick={handleJoin}
                disabled={isCompleted}
                className="rounded-xl font-bold flex items-center gap-2"
              >
                <Zap className="size-4 text-amber-300" />
                Join Tournament
              </Button>
            ) : (
              <>
                {activeGameId ? (
                  <Link href={`/game?id=${activeGameId}`}>
                    <Button className="rounded-xl font-black bg-emerald-600 hover:bg-emerald-500 text-white animate-pulse flex items-center gap-2">
                      <Swords className="size-4" />
                      Return to Game
                    </Button>
                  </Link>
                ) : (
                  <Button
                    onClick={handlePair}
                    disabled={!isActive || isPaused || isPairing}
                    className="rounded-xl font-black bg-primary text-primary-foreground flex items-center gap-2 shadow-md shadow-primary/20"
                  >
                    <Swords className="size-4" />
                    {isPairing ? "Finding Match..." : "Play Next Match"}
                  </Button>
                )}

                <Button
                  variant="outline"
                  onClick={handleTogglePause}
                  className="rounded-xl text-xs font-bold flex items-center gap-1.5"
                >
                  {isPaused ? <Play className="size-3.5" /> : <Pause className="size-3.5" />}
                  {isPaused ? "Resume" : "Pause"}
                </Button>

                <Button
                  variant="ghost"
                  onClick={handleLeave}
                  className="rounded-xl text-xs text-muted-foreground hover:text-red-500 flex items-center gap-1.5"
                >
                  <LogOut className="size-3.5" />
                  Leave
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Main Grid: Standings Leaderboard & Recent Matches */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Live Standings (Left 8 cols) */}
        <div className="lg:col-span-8 rounded-2xl bg-card border border-border/80 overflow-hidden shadow-sm">
          <div className="p-4 sm:p-5 border-b border-border/60 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Trophy className="size-5 text-amber-500" />
              <h2 className="text-base sm:text-lg font-bold">Arena Leaderboard</h2>
            </div>
            <span className="text-xs text-muted-foreground">
              Win: 2 pts • Streak (2+): 3 pts • Draw: 1 pt
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-muted/40 text-muted-foreground uppercase text-[10px] font-bold tracking-wider border-b border-border/60">
                <tr>
                  <th className="py-3 px-4 w-12 text-center">#</th>
                  <th className="py-3 px-4">Player</th>
                  <th className="py-3 px-4 text-center">Score</th>
                  <th className="py-3 px-4 text-center">Streak</th>
                  <th className="py-3 px-4 text-center">Record (W-D-L)</th>
                  <th className="py-3 px-4 text-right">Games</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {tournament.standings.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-muted-foreground">
                      No participants yet. Be the first to join!
                    </td>
                  </tr>
                ) : (
                  tournament.standings.map((p, idx) => {
                    const rank = idx + 1;
                    const isMe = p.playerId === tournament.myParticipant?.playerId;
                    const hasFlame = p.streak >= 2;

                    return (
                      <tr
                        key={p._id}
                        className={cn(
                          "transition-colors hover:bg-muted/30",
                          isMe && "bg-primary/5 font-semibold",
                        )}
                      >
                        <td className="py-3 px-4 text-center font-bold">
                          {rank === 1 ? (
                            <span className="text-amber-500 font-black text-sm">🥇 1</span>
                          ) : rank === 2 ? (
                            <span className="text-zinc-400 font-black text-sm">🥈 2</span>
                          ) : rank === 3 ? (
                            <span className="text-amber-700 font-black text-sm">🥉 3</span>
                          ) : (
                            <span className="text-muted-foreground">{rank}</span>
                          )}
                        </td>

                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
                            <Avatar className="size-7 border border-border/60">
                              <AvatarImage src={p.avatarUrl} />
                              <AvatarFallback>{p.username[0]?.toUpperCase()}</AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="font-bold text-foreground flex items-center gap-1.5">
                                {p.username}
                                {isMe && (
                                  <span className="text-[10px] bg-primary/20 text-primary px-1.5 py-0.2 rounded font-normal">
                                    You
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-muted-foreground">
                                {p.rating} Elo
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="py-3 px-4 text-center">
                          <span className="inline-block rounded-lg bg-primary/10 text-primary px-2.5 py-0.5 font-black text-sm sm:text-base">
                            {p.score}
                          </span>
                        </td>

                        <td className="py-3 px-4 text-center">
                          {hasFlame ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-orange-500/15 text-orange-500 px-2 py-0.5 text-xs font-black animate-pulse">
                              <Flame className="size-3.5" />
                              {p.streak}
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-xs">{p.streak}</span>
                          )}
                        </td>

                        <td className="py-3 px-4 text-center font-medium text-xs">
                          <span className="text-emerald-500 font-bold">{p.wins}</span> -{" "}
                          <span className="text-muted-foreground">{p.draws}</span> -{" "}
                          <span className="text-red-500 font-bold">{p.losses}</span>
                        </td>

                        <td className="py-3 px-4 text-right font-medium text-muted-foreground">
                          {p.gamesPlayed}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Live & Recent Matches (Right 4 cols) */}
        <div className="lg:col-span-4 rounded-2xl bg-card border border-border/80 p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-border/60">
            <Swords className="size-4 text-primary" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">
              Arena Matches
            </h3>
          </div>

          {tournament.recentMatches.length === 0 ? (
            <p className="text-xs text-muted-foreground py-6 text-center">
              No matches played yet in this arena. Pair up to start the action!
            </p>
          ) : (
            <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
              {tournament.recentMatches.map((m) => {
                const isLive = m.status === "active";
                return (
                  <div
                    key={m._id}
                    className="p-3 rounded-xl bg-muted/40 border border-border/60 space-y-1.5"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span
                        className={cn(
                          "px-2 py-0.5 rounded text-[10px] font-bold uppercase",
                          isLive
                            ? "bg-emerald-500/15 text-emerald-500 animate-pulse"
                            : "bg-muted text-muted-foreground",
                        )}
                      >
                        {isLive ? "● In Progress" : "Completed"}
                      </span>

                      <Link
                        href={`/game?id=${m.gameId}`}
                        className="text-[11px] font-semibold text-primary hover:underline flex items-center gap-1"
                      >
                        <Eye className="size-3" />
                        {isLive ? "Spectate" : "Review"}
                      </Link>
                    </div>

                    <div className="text-xs font-semibold text-foreground flex items-center justify-between">
                      <span>Match #{m.gameId.slice(-6)}</span>
                      {m.winnerId && (
                        <span className="text-[11px] text-amber-500 font-bold">
                          Winner decided
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
