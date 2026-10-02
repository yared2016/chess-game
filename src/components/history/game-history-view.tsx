"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { MiniBoard } from "@/components/ui-kit";
import { DEFAULT_FEN } from "@/lib/constants";
import { formatColour, formatDate, formatMode, formatOutcome, outcomeFor, pluralize, formatEndReason } from "@/lib/format";
import { cn } from "@/lib/ui";
import type { GameMode } from "@/lib/types";
import {
  History,
  Trophy,
  XCircle,
  Minus,
  Coins,
  ChevronRight,
  Download,
  Copy,
  Swords,
  Search,
  Flame,
  Bot,
  Globe,
  Sparkles,
  Clock,
  Check,
  X,
  Shield,
  RotateCcw,
  SlidersHorizontal,
  Calendar,
} from "lucide-react";
import { toast } from "sonner";

export function GameHistoryView() {
  const [resultFilter, setResultFilter] = useState<"all" | "win" | "loss" | "draw">("all");
  const [modeFilter, setModeFilter] = useState<GameMode | "all">("all");
  const [stakedOnly, setStakedOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedPgnGameId, setCopiedPgnGameId] = useState<string | null>(null);

  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();

  // Queries
  const stats = useQuery(api.games.getPlayerHistoryStats, isAuthenticated ? {} : "skip");
  const games = useQuery(
    api.games.getPlayerGames,
    isAuthenticated
      ? {
          limit: 60,
          result: resultFilter === "all" ? undefined : resultFilter,
          mode: modeFilter === "all" ? undefined : modeFilter,
          stakedOnly: stakedOnly ? true : undefined,
        }
      : "skip"
  );

  // Client-side search filter by opponent name
  const filteredGames = useMemo(() => {
    return (games || []).filter((g) => {
      if (!searchQuery.trim()) return true;
      return g.opponentName.toLowerCase().includes(searchQuery.trim().toLowerCase());
    });
  }, [games, searchQuery]);

  const hasActiveFilters = resultFilter !== "all" || modeFilter !== "all" || stakedOnly || searchQuery.trim() !== "";

  const handleResetFilters = () => {
    setResultFilter("all");
    setModeFilter("all");
    setStakedOnly(false);
    setSearchQuery("");
  };

  const handleDownloadPgn = (game: any) => {
    if (!game.pgn) {
      toast.error("No PGN record available for this match");
      return;
    }
    const blob = new Blob([game.pgn], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `match_${game._id}_${game.opponentName}.pgn`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("PGN downloaded successfully!");
  };

  const handleCopyPgn = (gameId: string, pgn?: string) => {
    if (!pgn) {
      toast.error("No PGN available for this match");
      return;
    }
    navigator.clipboard.writeText(pgn);
    setCopiedPgnGameId(gameId);
    toast.success("PGN copied to clipboard!");
    setTimeout(() => setCopiedPgnGameId(null), 2500);
  };

  // Streak calculations
  const streakCount = stats?.currentStreak ?? 0;
  const isPositiveStreak = streakCount > 0;
  const isNegativeStreak = streakCount < 0;

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* 1. Header & Hero Banner */}
      <div className="relative overflow-hidden rounded-3xl border border-border/80 bg-gradient-to-br from-card via-card/95 to-primary/5 p-5 sm:p-7 shadow-sm">
        {/* Soft background ambient accent glow */}
        <div className="pointer-events-none absolute -top-24 -right-24 size-64 rounded-full bg-primary/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-24 size-64 rounded-full bg-emerald-500/5 blur-3xl" />

        <div className="relative z-10 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-primary shadow-xs">
                <Sparkles className="size-3 text-primary" />
                Career Archive & Replays
              </span>
              {stats && stats.totalGames > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-muted/60 px-2.5 py-1 text-[11px] font-bold text-muted-foreground">
                  <History className="size-3" />
                  {stats.totalGames} Matches Recorded
                </span>
              )}
            </div>

            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-foreground flex items-center gap-2.5">
              Match History & Analysis
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground max-w-2xl leading-relaxed">
              Review your past chess matches, inspect critical moves and blunders with Stockfish engine analysis, and download official PGN archives.
            </p>
          </div>

          <Link
            href="/play"
            className="inline-flex h-11 sm:h-12 w-full sm:w-auto items-center justify-center gap-2.5 rounded-2xl bg-primary text-primary-foreground px-5 text-sm font-bold shadow-md hover:bg-primary/90 hover:shadow-primary/25 active:scale-[0.98] transition-all shrink-0"
          >
            <Swords className="size-4.5" />
            <span>Play New Game</span>
          </Link>
        </div>
      </div>

      {/* 2. Overview Performance KPI Cards (Modern, responsive, 100% collision-free) */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {/* Win Rate Card */}
        <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl border border-primary/25 bg-gradient-to-br from-primary/10 via-card to-card p-4 sm:p-5 flex flex-col justify-between shadow-xs hover:border-primary/45 transition-all">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-muted-foreground">
              Win Rate
            </span>
            <div className="size-7 sm:size-8 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0">
              <Trophy className="size-3.5 sm:size-4" />
            </div>
          </div>

          <div className="my-2.5 sm:my-3">
            <div className="flex items-baseline gap-1.5">
              <span className="font-mono text-2xl sm:text-3xl lg:text-4xl font-black text-primary tracking-tight">
                {stats?.winRate ?? 0}%
              </span>
            </div>
            {/* Form indicator tag */}
            <div className="mt-1">
              <span className="inline-flex text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/15 text-primary">
                {stats && stats.totalGames > 0
                  ? stats.winRate >= 50
                    ? "★ Strong Form"
                    : "Competitive"
                  : "No Games"}
              </span>
            </div>
          </div>

          <p className="text-[11px] text-muted-foreground font-medium truncate">
            Across {stats?.totalGames ?? 0} total games
          </p>
        </div>

        {/* Record (W-D-L) Card */}
        <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl border border-border/80 bg-gradient-to-br from-card via-card to-muted/20 p-4 sm:p-5 flex flex-col justify-between shadow-xs hover:border-border transition-all">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-muted-foreground">
              Match Record
            </span>
            <div className="size-7 sm:size-8 rounded-xl bg-muted text-foreground flex items-center justify-center shrink-0">
              <Swords className="size-3.5 sm:size-4" />
            </div>
          </div>

          {/* Clean dedicated record chips line: completely prevents text collisions */}
          <div className="my-2.5 sm:my-3 space-y-2">
            <div className="flex items-center gap-1.5 sm:gap-2 font-mono text-xs sm:text-sm font-bold">
              <span className="inline-flex items-center gap-0.5 rounded-md bg-emerald-500/10 px-1.5 sm:px-2 py-0.5 text-emerald-500 border border-emerald-500/20">
                {stats?.wins ?? 0}W
              </span>
              <span className="text-muted-foreground/50">·</span>
              <span className="inline-flex items-center gap-0.5 rounded-md bg-muted/80 px-1.5 sm:px-2 py-0.5 text-muted-foreground border border-border/60">
                {stats?.draws ?? 0}D
              </span>
              <span className="text-muted-foreground/50">·</span>
              <span className="inline-flex items-center gap-0.5 rounded-md bg-rose-500/10 px-1.5 sm:px-2 py-0.5 text-rose-500 border border-rose-500/20">
                {stats?.losses ?? 0}L
              </span>
            </div>

            {/* Segmented Proportional Progress Bar */}
            <div className="h-2 w-full rounded-full bg-muted/60 overflow-hidden flex gap-0.5">
              {stats && stats.totalGames > 0 ? (
                <>
                  <div
                    style={{ width: `${(stats.wins / stats.totalGames) * 100}%` }}
                    className="h-full bg-emerald-500 rounded-l-full transition-all duration-500"
                    title={`Wins: ${stats.wins}`}
                  />
                  <div
                    style={{ width: `${(stats.draws / stats.totalGames) * 100}%` }}
                    className="h-full bg-muted-foreground/40 transition-all duration-500"
                    title={`Draws: ${stats.draws}`}
                  />
                  <div
                    style={{ width: `${(stats.losses / stats.totalGames) * 100}%` }}
                    className="h-full bg-rose-500 rounded-r-full transition-all duration-500"
                    title={`Losses: ${stats.losses}`}
                  />
                </>
              ) : (
                <div className="h-full w-full bg-muted/40" />
              )}
            </div>
          </div>

          <p className="text-[11px] text-muted-foreground font-medium truncate">
            {stats?.totalGames ?? 0} total finished matches
          </p>
        </div>

        {/* Current Streak Card */}
        <div
          className={cn(
            "relative overflow-hidden rounded-2xl sm:rounded-3xl border p-4 sm:p-5 flex flex-col justify-between shadow-xs transition-all",
            isPositiveStreak
              ? "border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-card to-card hover:border-amber-500/50"
              : isNegativeStreak
              ? "border-rose-500/30 bg-gradient-to-br from-rose-500/10 via-card to-card hover:border-rose-500/50"
              : "border-border/80 bg-gradient-to-br from-card via-card to-muted/20"
          )}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-muted-foreground">
              Current Streak
            </span>
            <div
              className={cn(
                "size-7 sm:size-8 rounded-xl flex items-center justify-center shrink-0",
                isPositiveStreak
                  ? "bg-amber-500/20 text-amber-500"
                  : isNegativeStreak
                  ? "bg-rose-500/20 text-rose-500"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {isPositiveStreak ? (
                <Flame className="size-3.5 sm:size-4 animate-pulse" />
              ) : isNegativeStreak ? (
                <Shield className="size-3.5 sm:size-4" />
              ) : (
                <Minus className="size-3.5 sm:size-4" />
              )}
            </div>
          </div>

          <div className="my-2.5 sm:my-3">
            <div className="flex items-baseline gap-1.5">
              <span
                className={cn(
                  "font-mono text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight",
                  isPositiveStreak
                    ? "text-amber-500"
                    : isNegativeStreak
                    ? "text-rose-500"
                    : "text-foreground"
                )}
              >
                {isPositiveStreak ? `+${streakCount}` : streakCount}
              </span>
              <span className="text-xs font-bold text-muted-foreground">
                {pluralize(Math.abs(streakCount), "game")}
              </span>
            </div>
            <div className="mt-1">
              <span
                className={cn(
                  "inline-flex text-[10px] font-bold px-2 py-0.5 rounded-full",
                  isPositiveStreak
                    ? "bg-amber-500/15 text-amber-500"
                    : isNegativeStreak
                    ? "bg-rose-500/15 text-rose-500"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {isPositiveStreak
                  ? "Winning Run 🔥"
                  : isNegativeStreak
                  ? "Rebound Stage ⚔️"
                  : "Even"}
              </span>
            </div>
          </div>

          <p className="text-[11px] text-muted-foreground font-medium truncate">
            {isPositiveStreak
              ? "Consecutive victories"
              : isNegativeStreak
              ? "Ready to bounce back"
              : "Neutral balance"}
          </p>
        </div>

        {/* Staked ETB Earnings Card */}
        <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl border border-emerald-500/25 bg-gradient-to-br from-emerald-500/10 via-card to-card p-4 sm:p-5 flex flex-col justify-between shadow-xs hover:border-emerald-500/45 transition-all">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-muted-foreground">
              Prizes Won
            </span>
            <div className="size-7 sm:size-8 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0">
              <Coins className="size-3.5 sm:size-4" />
            </div>
          </div>

          <div className="my-2.5 sm:my-3">
            <div className="flex items-baseline gap-1.5 flex-wrap">
              <span className="font-mono text-xl sm:text-2xl lg:text-3xl font-black text-emerald-400 tracking-tight">
                {stats?.totalEarned?.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                }) ?? "0.00"}
              </span>
              <span className="inline-flex text-[10px] font-black text-emerald-400 bg-emerald-500/20 border border-emerald-500/30 px-1.5 py-0.2 rounded">
                ETB
              </span>
            </div>
            <div className="mt-1">
              <span className="inline-flex text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400">
                Staked Rewards
              </span>
            </div>
          </div>

          <p className="text-[11px] text-muted-foreground font-medium truncate">
            {stats?.stakedGames ?? 0} staked {stats?.stakedGames === 1 ? "match" : "matches"} played
          </p>
        </div>
      </div>

      {/* 3. Modern Filter & Search Command Bar */}
      <div className="rounded-2xl sm:rounded-3xl border border-border/80 bg-card/90 backdrop-blur-md p-3.5 sm:p-4 space-y-3 shadow-xs">
        {/* Top Filter Row: Search Input + Staked Filter + Quick Reset */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
          {/* Opponent Search Bar */}
          <div className="relative flex-1">
            <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search opponent or bot name..."
              className="w-full h-10 rounded-xl border border-input/70 bg-background/80 pl-9 pr-9 text-xs sm:text-sm placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all font-medium"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground rounded-lg transition-colors"
                title="Clear search"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>

          {/* Quick Filters cluster */}
          <div className="flex items-center gap-2">
            {/* Game Mode Select */}
            <select
              value={modeFilter}
              onChange={(e) => setModeFilter(e.target.value as any)}
              className="h-10 rounded-xl border border-input/70 bg-background/80 px-3 text-xs font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all cursor-pointer"
            >
              <option value="all">All Game Modes</option>
              <option value="online">Online PvP</option>
              <option value="ai">vs AI Engine</option>
              <option value="local">Local Match</option>
            </select>

            {/* Staked Only Toggle Pill */}
            <button
              type="button"
              onClick={() => setStakedOnly(!stakedOnly)}
              className={cn(
                "inline-flex h-10 items-center gap-1.5 rounded-xl border px-3 text-xs font-bold transition-all whitespace-nowrap",
                stakedOnly
                  ? "border-emerald-500/50 bg-emerald-500/20 text-emerald-400 shadow-xs"
                  : "border-input/70 bg-background/80 text-muted-foreground hover:text-foreground"
              )}
            >
              <Coins className={cn("size-3.5", stakedOnly ? "text-emerald-400" : "text-muted-foreground")} />
              <span>Staked Only</span>
            </button>

            {/* Reset Filters button if active */}
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="inline-flex h-10 items-center justify-center p-2.5 rounded-xl border border-border/80 bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
                title="Reset all filters"
              >
                <RotateCcw className="size-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Bottom Filter Row: Segmented Outcome Pills */}
        <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/40">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setResultFilter("all")}
              className={cn(
                "px-3 py-1.5 text-xs font-bold rounded-xl transition-all whitespace-nowrap",
                resultFilter === "all"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
              )}
            >
              All Matches
            </button>
            <button
              type="button"
              onClick={() => setResultFilter("win")}
              className={cn(
                "px-3 py-1.5 text-xs font-bold rounded-xl transition-all whitespace-nowrap inline-flex items-center gap-1.5",
                resultFilter === "win"
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
              )}
            >
              <Trophy className="size-3" />
              <span>Victories</span>
            </button>
            <button
              type="button"
              onClick={() => setResultFilter("loss")}
              className={cn(
                "px-3 py-1.5 text-xs font-bold rounded-xl transition-all whitespace-nowrap inline-flex items-center gap-1.5",
                resultFilter === "loss"
                  ? "bg-rose-600 text-white shadow-xs"
                  : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
              )}
            >
              <XCircle className="size-3" />
              <span>Defeats</span>
            </button>
            <button
              type="button"
              onClick={() => setResultFilter("draw")}
              className={cn(
                "px-3 py-1.5 text-xs font-bold rounded-xl transition-all whitespace-nowrap inline-flex items-center gap-1.5",
                resultFilter === "draw"
                  ? "bg-muted text-foreground border border-border shadow-xs"
                  : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
              )}
            >
              <Minus className="size-3" />
              <span>Draws</span>
            </button>
          </div>

          {/* Matches Counter */}
          <span className="text-[11px] font-bold text-muted-foreground shrink-0 hidden sm:inline-block">
            Showing {filteredGames.length} {filteredGames.length === 1 ? "match" : "matches"}
          </span>
        </div>
      </div>

      {/* 4. Match List */}
      {authLoading || games === undefined ? (
        <div className="space-y-3 sm:space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-28 w-full animate-pulse rounded-2xl sm:rounded-3xl border border-border/60 bg-muted/20"
            />
          ))}
        </div>
      ) : filteredGames.length === 0 ? (
        <div className="py-16 sm:py-20 text-center space-y-4 rounded-3xl border border-dashed border-border/80 bg-card/40 p-6">
          <div className="size-14 rounded-2xl bg-muted/80 flex items-center justify-center mx-auto text-muted-foreground shadow-inner">
            <History className="size-7" />
          </div>
          <div className="space-y-1">
            <p className="text-base sm:text-lg font-bold text-foreground">No matches found</p>
            <p className="text-xs sm:text-sm text-muted-foreground max-w-sm mx-auto">
              {hasActiveFilters
                ? "No past games match your search filters. Try resetting the filters to view all games."
                : "You haven't played any matches yet. Enter the arena and play your first game!"}
            </p>
          </div>
          {hasActiveFilters ? (
            <button
              type="button"
              onClick={handleResetFilters}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-border/80 bg-background px-4 text-xs font-bold shadow-xs hover:bg-muted transition-colors"
            >
              <RotateCcw className="size-3.5" /> Clear Filters
            </button>
          ) : (
            <Link
              href="/play"
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary text-primary-foreground px-5 text-xs sm:text-sm font-bold shadow hover:bg-primary/90 transition-colors"
            >
              <Swords className="size-4" /> Start Playing
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-3 sm:space-y-4">
          {filteredGames.map((game) => {
            const outcome = outcomeFor(game.status, game.winner, game.myColour);
            const isWinner = outcome === "win";
            const isLoss = outcome === "loss";

            const outcomeCardClass = isWinner
              ? "border-emerald-500/25 bg-gradient-to-r from-emerald-500/[0.04] via-card to-card hover:border-emerald-500/50"
              : isLoss
              ? "border-rose-500/25 bg-gradient-to-r from-rose-500/[0.04] via-card to-card hover:border-rose-500/50"
              : "border-border/80 bg-card hover:border-muted-foreground/40";

            const outcomeBadgeClass = isWinner
              ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
              : isLoss
              ? "bg-rose-500/15 text-rose-400 border-rose-500/30"
              : "bg-muted text-muted-foreground border-border";

            const isAI = game.mode === "ai" || game.opponentName?.toLowerCase().includes("stockfish");

            return (
              <div
                key={game._id}
                className={cn(
                  "group relative overflow-hidden rounded-2xl sm:rounded-3xl border p-3.5 sm:p-4.5 transition-all duration-200 shadow-xs hover:shadow-md",
                  outcomeCardClass
                )}
              >
                {/* Top Meta Header: Outcome Badge + Stakes + Mode + Date + PGN Actions */}
                <div className="flex items-center justify-between gap-2 pb-3 mb-3 border-b border-border/50">
                  <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 min-w-0">
                    {/* Outcome Badge */}
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] font-black uppercase tracking-wider border shadow-xs",
                        outcomeBadgeClass
                      )}
                    >
                      {isWinner ? (
                        <Trophy className="size-3 text-emerald-400" />
                      ) : isLoss ? (
                        <XCircle className="size-3 text-rose-400" />
                      ) : (
                        <Minus className="size-3 text-muted-foreground" />
                      )}
                      <span>{formatOutcome(outcome)}</span>
                    </span>

                    {/* Staked ETB Pool Badge */}
                    {game.stake && game.stake > 0 && (
                      <span className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-black text-amber-400 bg-amber-500/10 border border-amber-500/25 px-2.5 py-0.5 rounded-full shadow-xs whitespace-nowrap">
                        <Coins className="size-3 text-amber-400 shrink-0" />
                        <span>{game.stake * 2} ETB</span>
                        <span className="text-[9px] font-bold text-amber-500/70 uppercase">Pool</span>
                      </span>
                    )}

                    {/* Time Control Badge */}
                    {game.timeControlKey && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-muted-foreground bg-muted/60 border border-border/50 px-2 py-0.5 rounded-full">
                        <Clock className="size-2.5" />
                        {game.timeControlKey.replace("_", " ").toUpperCase()}
                      </span>
                    )}
                  </div>

                  {/* Date & PGN Action Buttons */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[11px] text-muted-foreground font-medium hidden sm:inline-flex items-center gap-1 mr-1">
                      <Calendar className="size-3 text-muted-foreground" />
                      {formatDate(game.createdAt)}
                    </span>

                    {/* Copy PGN Button */}
                    {game.pgn && (
                      <button
                        type="button"
                        onClick={() => handleCopyPgn(game._id, game.pgn)}
                        className="p-1.5 sm:p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
                        title="Copy PGN"
                        aria-label="Copy PGN"
                      >
                        {copiedPgnGameId === game._id ? (
                          <Check className="size-3.5 sm:size-4 text-emerald-500" />
                        ) : (
                          <Copy className="size-3.5 sm:size-4" />
                        )}
                      </button>
                    )}

                    {/* Download PGN Button */}
                    {game.pgn && (
                      <button
                        type="button"
                        onClick={() => handleDownloadPgn(game)}
                        className="p-1.5 sm:p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
                        title="Download PGN"
                        aria-label="Download PGN"
                      >
                        <Download className="size-3.5 sm:size-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Center Content: MiniBoard + Opponent details + Action */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
                  <div className="flex items-center gap-3.5 min-w-0 flex-1">
                    {/* Final Position MiniBoard with side color badge */}
                    <div className="relative shrink-0 rounded-xl overflow-hidden shadow-inner ring-1 ring-border/80 group-hover:ring-primary/40 transition-all bg-card">
                      <MiniBoard
                        fen={game.fen ?? DEFAULT_FEN}
                        size={64}
                        orientation={game.myColour ?? "w"}
                        label={`Final position against ${game.opponentName}`}
                      />
                      {/* Sub-badge indicating player's piece colour */}
                      {game.myColour !== null && (
                        <div className="absolute bottom-1 right-1 rounded bg-black/80 backdrop-blur-xs px-1 py-0.2 text-[8px] font-black text-white uppercase border border-white/20 shadow-xs">
                          {game.myColour === "w" ? "⚪ W" : "⚫ B"}
                        </div>
                      )}
                    </div>

                    {/* Opponent & Match Details */}
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        {isAI ? (
                          <Bot className="size-4 text-primary shrink-0" />
                        ) : (
                          <Globe className="size-4 text-blue-400 shrink-0" />
                        )}
                        <Link
                          href={`/profile/${encodeURIComponent(game.opponentName)}`}
                          className="truncate text-sm sm:text-base font-bold text-foreground hover:text-primary transition-colors"
                        >
                          {game.opponentName}
                        </Link>
                      </div>

                      {/* Match metadata line */}
                      <p className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                        <span className="font-medium">{formatMode(game.mode)}</span>
                        <span>•</span>
                        <span>{pluralize(game.moveCount, "move")}</span>
                        {game.endReason && (
                          <>
                            <span>•</span>
                            <span className="capitalize">{formatEndReason(game.endReason as any).replace(/^by /, "")}</span>
                          </>
                        )}
                        <span className="sm:hidden">• {formatDate(game.createdAt)}</span>
                        {!game.rated && <span className="text-amber-500/90 font-medium">• Unrated</span>}
                      </p>
                    </div>
                  </div>

                  {/* Stockfish Analysis & Replay Action Button */}
                  <div className="flex items-center justify-end shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-border/40">
                    <Link
                      href={`/game/${game._id}`}
                      className="inline-flex h-9 sm:h-9 items-center justify-center gap-1.5 rounded-xl bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground px-4 text-xs font-bold transition-all shadow-xs w-full sm:w-auto active:scale-[0.98]"
                    >
                      <Sparkles className="size-3.5" />
                      <span>Stockfish Analysis</span>
                      <ChevronRight className="size-3.5" />
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
