// src/components/tournaments/tournament-arena-view.tsx
"use client";

import { useEffect, useState } from "react";
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
  Sparkles,
  Users,
  Eye,
  ArrowLeft,
  Radio,
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
        router.push(`/game/${res.gameId}`);
      } else {
        toast.info(res.message || "Looking for available opponent in the arena...", { icon: "⏳" });
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to find match");
    } finally {
      setIsPairing(false);
    }
  };

  if (tournament === undefined) {
    return (
      <div className="space-y-4">
        <div className="h-40 rounded-2xl bg-card border border-border animate-pulse" />
        <div className="h-96 rounded-2xl bg-card border border-border animate-pulse" />
      </div>
    );
  }

  if (tournament === null) {
    return (
      <div className="rounded-2xl sm:rounded-3xl bg-card border border-border p-8 text-center space-y-4">
        <h2 className="text-xl font-bold">Tournament Not Found</h2>
        <p className="text-sm text-muted-foreground">
          The tournament arena you are looking for does not exist or has concluded.
        </p>
        <Link href="/tournaments">
          <Button variant="default" className="rounded-xl font-bold">
            Back to Tournaments
          </Button>
        </Link>
      </div>
    );
  }

  const isActive = tournament.status === "active";
  const isUpcoming = tournament.status === "upcoming";
  const isCompleted = tournament.status === "completed";

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Navigation Back Link */}
      <div>
        <Link
          href="/tournaments"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors group cursor-pointer"
        >
          <ArrowLeft className="size-3.5 group-hover:-translate-x-0.5 transition-transform" />
          <span>All Tournaments</span>
        </Link>
      </div>

      {/* Header Banner */}
      <div className="rounded-2xl sm:rounded-3xl bg-card border border-border/80 p-4 sm:p-7 shadow-sm space-y-4 sm:space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider",
                  isActive && "bg-amber-500/15 text-amber-500 border border-amber-500/30",
                  isUpcoming && "bg-blue-500/15 text-blue-500 border border-blue-500/30",
                  isCompleted && "bg-muted text-muted-foreground",
                )}
              >
                {isActive && <Radio className="size-2.5 text-amber-500 animate-pulse" />}
                {isActive ? "Live Arena" : isUpcoming ? "Upcoming" : "Completed"}
              </span>
              <span className="rounded-full bg-primary/10 text-primary border border-primary/20 px-2.5 py-0.5 text-[10px] font-bold">
                {tournament.timeControlKey}
              </span>
            </div>

            <h1 className="text-xl sm:text-3xl font-black text-foreground tracking-tight">
              {tournament.title}
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground max-w-2xl leading-relaxed">
              {tournament.description}
            </p>
          </div>

          {/* Time Countdown & Prize Pool Badges */}
          <div className="grid grid-cols-2 xs:grid-cols-3 sm:flex sm:items-center gap-2 sm:gap-3 shrink-0">
            {/* Countdown Clock */}
            <div className="rounded-xl sm:rounded-2xl bg-muted/50 border border-border/70 p-2.5 sm:px-4 sm:py-2.5 text-center min-w-[100px]">
              <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider flex items-center justify-center gap-1">
                <Clock className="size-3" />
                <span>{isActive ? "Remaining" : isUpcoming ? "Starts In" : "Status"}</span>
              </div>
              <div className="text-base sm:text-xl font-black font-mono text-foreground mt-0.5">
                {isCompleted ? "Finished" : timeLeft}
              </div>
            </div>

            {/* Prize Pool */}
            {tournament.prizePool && (
              <div className="rounded-xl sm:rounded-2xl bg-amber-500/10 border border-amber-500/20 p-2.5 sm:px-4 sm:py-2.5 text-center min-w-[100px]">
                <div className="text-[10px] uppercase font-bold text-amber-500 tracking-wider flex items-center justify-center gap-1">
                  <Sparkles className="size-3" />
                  <span>Prize Pool</span>
                </div>
                <div className="text-base sm:text-xl font-black text-amber-500 mt-0.5">
                  {tournament.prizePool} ETB
                </div>
              </div>
            )}

            {/* Players Enrolled (Compact on Mobile) */}
            <div className="rounded-xl sm:rounded-2xl bg-muted/50 border border-border/70 p-2.5 sm:px-4 sm:py-2.5 text-center col-span-2 xs:col-span-1 sm:hidden">
              <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider flex items-center justify-center gap-1">
                <Users className="size-3" />
                <span>Enrolled</span>
              </div>
              <div className="text-base font-black text-foreground mt-0.5">
                {tournament.participantCount} {tournament.participantCount === 1 ? "Player" : "Players"}
              </div>
            </div>
          </div>
        </div>

        {/* Action Center Bar */}
        <div className="pt-3 sm:pt-4 border-t border-border/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="hidden sm:flex items-center gap-2">
            <Users className="size-4 text-muted-foreground" />
            <span className="text-xs sm:text-sm font-bold text-foreground">
              {tournament.participantCount} {tournament.participantCount === 1 ? "Player" : "Players"} Enrolled
            </span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {!isJoined ? (
              <Button
                onClick={handleJoin}
                disabled={isCompleted}
                className="w-full sm:w-auto rounded-xl font-black flex items-center justify-center gap-2 cursor-pointer shadow-sm shadow-primary/20"
              >
                <Zap className="size-4 text-amber-300" />
                <span>Join Tournament</span>
              </Button>
            ) : (
              <div className="flex items-center gap-2 w-full sm:w-auto">
                {activeGameId ? (
                  <Link href={`/game/${activeGameId}`} className="flex-1 sm:flex-initial">
                    <Button className="w-full rounded-xl font-black bg-emerald-600 hover:bg-emerald-500 text-white animate-pulse flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-emerald-600/30">
                      <Swords className="size-4" />
                      <span>Return to Game</span>
                    </Button>
                  </Link>
                ) : (
                  <Button
                    onClick={handlePair}
                    disabled={!isActive || isPaused || isPairing}
                    className="flex-1 sm:flex-initial rounded-xl font-black bg-primary text-primary-foreground flex items-center justify-center gap-2 shadow-md shadow-primary/20 cursor-pointer"
                  >
                    <Swords className="size-4" />
                    <span>{isPairing ? "Finding Match..." : "Play Next Match"}</span>
                  </Button>
                )}

                <Button
                  variant="outline"
                  onClick={handleTogglePause}
                  className="rounded-xl text-xs font-bold flex items-center gap-1.5 shrink-0 cursor-pointer border-border/80"
                >
                  {isPaused ? <Play className="size-3.5 text-emerald-500" /> : <Pause className="size-3.5" />}
                  <span>{isPaused ? "Resume" : "Pause"}</span>
                </Button>

                <Button
                  variant="ghost"
                  onClick={handleLeave}
                  className="rounded-xl text-xs text-muted-foreground hover:text-red-500 flex items-center gap-1.5 shrink-0 cursor-pointer"
                >
                  <LogOut className="size-3.5" />
                  <span>Leave</span>
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Grid: Standings Leaderboard & Recent Matches */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 items-start">
        {/* Arena Leaderboard (Left 8 cols on Desktop) */}
        <div className="lg:col-span-8 rounded-2xl sm:rounded-3xl bg-card border border-border/80 overflow-hidden shadow-sm">
          {/* Leaderboard Header */}
          <div className="p-3.5 sm:p-5 border-b border-border/60 flex flex-col xs:flex-row xs:items-center justify-between gap-1.5 sm:gap-2">
            <div className="flex items-center gap-2">
              <Trophy className="size-5 text-amber-500 shrink-0" />
              <h2 className="text-base sm:text-lg font-bold text-foreground">Arena Leaderboard</h2>
            </div>
            <span className="text-[11px] sm:text-xs text-muted-foreground font-medium">
              Win: 2 pts • Streak (2+): 3 pts • Draw: 1 pt
            </span>
          </div>

          {/* 1. Mobile Leaderboard Deck (sm:hidden) - ZERO Horizontal Scrolling */}
          <div className="sm:hidden divide-y divide-border/40">
            {tournament.standings.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground">
                No participants yet. Be the first to join!
              </div>
            ) : (
              tournament.standings.map((p, idx) => {
                const rank = idx + 1;
                const isMe = p.playerId === tournament.myParticipant?.playerId;
                const hasFlame = p.streak >= 2;

                return (
                  <div
                    key={p._id}
                    className={cn(
                      "p-3 flex items-center justify-between gap-2.5 transition-colors",
                      isMe ? "bg-primary/10 font-medium" : "hover:bg-muted/30",
                    )}
                  >
                    {/* Left Side: Rank Medal + Avatar + Username + Elo & Record */}
                    <div className="flex items-center gap-2.5 min-w-0">
                      {/* Rank Indicator */}
                      <div className="size-7 rounded-lg flex items-center justify-center font-black text-xs shrink-0 bg-muted/60 border border-border/60">
                        {rank === 1 ? (
                          <span className="text-amber-500 font-black">🥇</span>
                        ) : rank === 2 ? (
                          <span className="text-zinc-400 font-black">🥈</span>
                        ) : rank === 3 ? (
                          <span className="text-amber-700 font-black">🥉</span>
                        ) : (
                          <span className="text-muted-foreground">{rank}</span>
                        )}
                      </div>

                      {/* Avatar */}
                      <Avatar className="size-8 border border-border/70 shrink-0">
                        <AvatarImage src={p.avatarUrl} />
                        <AvatarFallback>{p.username[0]?.toUpperCase()}</AvatarFallback>
                      </Avatar>

                      {/* Name, Elo, and W-D-L Record */}
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-xs text-foreground truncate">
                            {p.username}
                          </span>
                          {isMe && (
                            <span className="text-[9px] bg-primary/20 text-primary px-1.5 py-0.2 rounded font-bold">
                              You
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 font-medium mt-0.5">
                          <span>{p.rating} Elo</span>
                          <span className="text-muted-foreground/40">•</span>
                          <span>
                            <strong className="text-emerald-500 font-bold">{p.wins}W</strong>{" "}
                            <span className="text-muted-foreground">{p.draws}D</span>{" "}
                            <strong className="text-red-500 font-bold">{p.losses}L</strong>
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Right Side: Flame Streak, Points Badge & Total Games */}
                    <div className="flex items-center gap-2 shrink-0">
                      {hasFlame && (
                        <div className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-orange-500/15 text-orange-500 text-[10px] font-black animate-pulse">
                          <Flame className="size-3" />
                          <span>{p.streak}</span>
                        </div>
                      )}

                      <div className="flex flex-col items-end">
                        <div className="px-2 py-0.5 rounded-lg bg-primary/15 text-primary font-black text-xs">
                          {p.score} <span className="text-[9px] font-semibold text-primary/70">pts</span>
                        </div>
                        <span className="text-[10px] text-muted-foreground font-mono mt-0.5">
                          {p.gamesPlayed} {p.gamesPlayed === 1 ? "gm" : "gms"}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* 2. Desktop Leaderboard Table (hidden sm:block) */}
          <div className="hidden sm:block overflow-x-auto">
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

        {/* Live & Recent Matches (Right 4 cols on Desktop) */}
        <div className="lg:col-span-4 rounded-2xl sm:rounded-3xl bg-card border border-border/80 p-4 sm:p-5 shadow-sm space-y-3.5 sm:space-y-4">
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
                        href={`/game/${m.gameId}`}
                        className="text-[11px] font-semibold text-primary hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <Eye className="size-3" />
                        <span>{isLive ? "Spectate" : "Review"}</span>
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
