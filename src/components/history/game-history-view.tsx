"use client";

import { useState } from "react";
import Link from "next/link";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button, buttonVariants } from "@/components/ui/button";
import { MiniBoard } from "@/components/ui-kit";
import { DEFAULT_FEN } from "@/lib/constants";
import { formatColour, formatDate, formatMode, formatOutcome, outcomeFor, pluralize } from "@/lib/format";
import { cn, initials } from "@/lib/ui";
import type { Colour, GameMode, GameStatus, SquareId, Winner } from "@/lib/types";
import {
  History,
  Trophy,
  XCircle,
  Minus,
  Coins,
  ChevronRight,
  Download,
  Copy,
  Share2,
  Swords,
  Search,
  Filter,
  Flame,
  Bot,
  Globe,
  Sparkles,
  Clock,
  Check,
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
  const filteredGames = (games || []).filter((g) => {
    if (!searchQuery.trim()) return true;
    return g.opponentName.toLowerCase().includes(searchQuery.trim().toLowerCase());
  });

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

  return (
    <div className="space-y-6">
      {/* 1. Header & Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground flex items-center gap-2.5">
            <History className="size-7 text-primary" />
            Match History & Analysis
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Review your past games, inspect positions with Stockfish engine analysis, and download match PGNs.
          </p>
        </div>

        <Link
          href="/play"
          className="inline-flex h-10 items-center justify-center gap-2 rounded-2xl bg-primary text-primary-foreground px-4 text-xs font-bold shadow hover:bg-primary/90 transition-colors self-start sm:self-auto"
        >
          <Swords className="size-4" />
          Play New Game
        </Link>
      </div>

      {/* 2. Overview Performance KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {/* Win Rate */}
        <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 space-y-1.5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Win Rate
            </span>
            <Trophy className="size-4 text-primary" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="font-mono text-2xl sm:text-3xl font-black text-primary">
              {stats?.winRate ?? 0}%
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground font-medium">
            Across {stats?.totalGames ?? 0} total games
          </p>
        </div>

        {/* Record (W-D-L) */}
        <div className="rounded-2xl border border-border bg-card p-4 space-y-2 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Record
            </span>
            <span className="font-mono text-xs font-bold text-foreground">
              {stats?.wins ?? 0}W · {stats?.draws ?? 0}D · {stats?.losses ?? 0}L
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-muted/60 overflow-hidden flex">
            {stats && stats.totalGames > 0 && (
              <>
                <div
                  style={{ width: `${(stats.wins / stats.totalGames) * 100}%` }}
                  className="h-full bg-green-500"
                  title={`Wins: ${stats.wins}`}
                />
                <div
                  style={{ width: `${(stats.draws / stats.totalGames) * 100}%` }}
                  className="h-full bg-muted-foreground/40"
                  title={`Draws: ${stats.draws}`}
                />
                <div
                  style={{ width: `${(stats.losses / stats.totalGames) * 100}%` }}
                  className="h-full bg-red-500/80"
                  title={`Losses: ${stats.losses}`}
                />
              </>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground font-mono">
            Overall competitive performance
          </p>
        </div>

        {/* Current Streak */}
        <div className="rounded-2xl border border-border bg-card p-4 space-y-1.5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Current Streak
            </span>
            <Flame className="size-4 text-amber-500" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span
              className={cn(
                "font-mono text-2xl sm:text-3xl font-black",
                (stats?.currentStreak ?? 0) > 0
                  ? "text-emerald-500"
                  : (stats?.currentStreak ?? 0) < 0
                  ? "text-red-500"
                  : "text-foreground"
              )}
            >
              {(stats?.currentStreak ?? 0) > 0
                ? `+${stats?.currentStreak}`
                : stats?.currentStreak ?? 0}
            </span>
            <span className="text-xs font-bold text-muted-foreground">games</span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            {(stats?.currentStreak ?? 0) > 0
              ? "Consecutive victories 🔥"
              : (stats?.currentStreak ?? 0) < 0
              ? "Rebounding round"
              : "Neutral balance"}
          </p>
        </div>

        {/* Staked ETB Earnings */}
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 space-y-1.5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Staked Prizes Won
            </span>
            <Coins className="size-4 text-emerald-500" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="font-mono text-2xl sm:text-3xl font-black text-emerald-500">
              {stats?.totalEarned?.toFixed(2) ?? "0.00"}
            </span>
            <span className="text-xs font-bold text-emerald-500">ETB</span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            {stats?.stakedGames ?? 0} staked matches played
          </p>
        </div>
      </div>

      {/* 3. Filter & Search Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-2 rounded-2xl border border-border/80 bg-card shadow-xs">
        {/* Outcome Filter Pills */}
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pb-1 md:pb-0">
          <button
            onClick={() => setResultFilter("all")}
            className={cn(
              "px-3 py-1.5 text-xs font-bold rounded-xl transition-all whitespace-nowrap",
              resultFilter === "all"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            All Results
          </button>
          <button
            onClick={() => setResultFilter("win")}
            className={cn(
              "px-3 py-1.5 text-xs font-bold rounded-xl transition-all whitespace-nowrap flex items-center gap-1",
              resultFilter === "win"
                ? "bg-green-600 text-white shadow-xs"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <Trophy className="size-3" />
            Wins
          </button>
          <button
            onClick={() => setResultFilter("loss")}
            className={cn(
              "px-3 py-1.5 text-xs font-bold rounded-xl transition-all whitespace-nowrap flex items-center gap-1",
              resultFilter === "loss"
                ? "bg-red-600 text-white shadow-xs"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <XCircle className="size-3" />
            Losses
          </button>
          <button
            onClick={() => setResultFilter("draw")}
            className={cn(
              "px-3 py-1.5 text-xs font-bold rounded-xl transition-all whitespace-nowrap flex items-center gap-1",
              resultFilter === "draw"
                ? "bg-muted text-foreground border border-border shadow-xs"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <Minus className="size-3" />
            Draws
          </button>
        </div>

        {/* Mode & Stakes & Search cluster */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Mode Select */}
          <select
            value={modeFilter}
            onChange={(e) => setModeFilter(e.target.value as any)}
            className="h-8 rounded-xl border border-input bg-background px-2.5 text-xs font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="all">All Modes</option>
            <option value="online">Online PvP</option>
            <option value="ai">vs AI Engine</option>
            <option value="local">Local Match</option>
          </select>

          {/* Staked Only Toggle */}
          <button
            type="button"
            onClick={() => setStakedOnly(!stakedOnly)}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-xl border px-2.5 text-xs font-bold transition-colors",
              stakedOnly
                ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-500 shadow-xs"
                : "border-border bg-card text-muted-foreground hover:text-foreground"
            )}
          >
            <Coins className="size-3.5" />
            <span>Staked Only</span>
          </button>

          {/* Opponent Search */}
          <div className="relative flex-1 sm:w-44">
            <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search opponent..."
              className="w-full h-8 rounded-xl border border-input bg-background pl-8 pr-2.5 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>
      </div>

      {/* 4. Match List */}
      {authLoading || games === undefined ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-20 w-full animate-pulse rounded-2xl border border-border/60 bg-muted/30"
            />
          ))}
        </div>
      ) : filteredGames.length === 0 ? (
        <div className="py-16 text-center space-y-3 rounded-3xl border border-dashed border-border/80 bg-card/50">
          <div className="size-12 rounded-2xl bg-muted flex items-center justify-center mx-auto text-muted-foreground">
            <History className="size-6" />
          </div>
          <p className="text-base font-bold text-foreground">No matches found</p>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            {searchQuery || resultFilter !== "all" || modeFilter !== "all" || stakedOnly
              ? "Try adjusting your filters or search terms to see past games."
              : "You haven't played any matches yet. Step into the arena and play your first game!"}
          </p>
          <Link
            href="/play"
            className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-primary text-primary-foreground px-4 text-xs font-bold shadow hover:bg-primary/90 transition-colors mt-2"
          >
            <Swords className="size-3.5" /> Start Playing
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredGames.map((game) => {
            const outcome = outcomeFor(game.status, game.winner, game.myColour);
            const isWinner = outcome === "win";
            const isLoss = outcome === "loss";

            const outcomeColor = isWinner
              ? "border-green-500/30 bg-green-500/10 text-green-500"
              : isLoss
              ? "border-red-500/30 bg-red-500/10 text-red-500"
              : "border-border bg-muted/40 text-muted-foreground";

            return (
              <div
                key={game._id}
                className="group flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 sm:p-4 rounded-2xl border border-border/80 bg-card hover:border-primary/40 hover:bg-muted/10 transition-all shadow-sm"
              >
                {/* Left: MiniBoard + Game Details */}
                <div className="flex items-center gap-3.5 min-w-0 flex-1">
                  {/* Final Position MiniBoard */}
                  <div className="shrink-0 rounded-xl overflow-hidden shadow-inner ring-1 ring-border">
                    <MiniBoard
                      fen={game.fen ?? DEFAULT_FEN}
                      size={58}
                      orientation={game.myColour ?? "w"}
                      label={`Final position against ${game.opponentName}`}
                    />
                  </div>

                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/profile/${encodeURIComponent(game.opponentName)}`}
                        className="truncate text-sm font-bold text-foreground hover:underline"
                      >
                        {game.opponentName}
                      </Link>

                      {/* Color Tag */}
                      {game.myColour !== null && (
                        <span className="shrink-0 text-[10px] font-semibold text-muted-foreground uppercase px-1.5 py-0.5 rounded bg-muted/60 border border-border/50">
                          {formatColour(game.myColour)}
                        </span>
                      )}

                      {/* Staked ETB badge */}
                      {game.stake && game.stake > 0 && (
                        <span className="shrink-0 inline-flex items-center gap-1 text-[10px] font-bold text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                          <Coins className="size-3" />
                          {game.stake * 2} ETB Pool
                        </span>
                      )}

                      {/* Time control badge */}
                      {game.timeControlKey && (
                        <span className="shrink-0 inline-flex items-center gap-1 text-[10px] font-semibold text-muted-foreground bg-muted/50 border border-border/50 px-2 py-0.5 rounded-full">
                          <Clock className="size-2.5" />
                          {game.timeControlKey.replace("_", " ").toUpperCase()}
                        </span>
                      )}
                    </div>

                    <p className="truncate text-xs text-muted-foreground flex items-center gap-1.5">
                      <span>{formatMode(game.mode)}</span>
                      <span>•</span>
                      <span>{pluralize(game.moveCount, "move")}</span>
                      <span>•</span>
                      <span>{formatDate(game.createdAt)}</span>
                      {game.endReason && (
                        <>
                          <span>•</span>
                          <span className="capitalize">{game.endReason.replace("-", " ")}</span>
                        </>
                      )}
                      {!game.rated && <span className="text-amber-500/80">• Unrated</span>}
                    </p>
                  </div>
                </div>

                {/* Right: Outcome + Actions */}
                <div className="flex items-center justify-between sm:justify-end gap-2.5 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-border/50">
                  {/* Outcome Badge */}
                  <span
                    className={cn(
                      "rounded-xl border px-3 py-1.5 text-xs font-bold uppercase tracking-wider",
                      outcomeColor
                    )}
                  >
                    {formatOutcome(outcome)}
                  </span>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5">
                    {/* Copy PGN */}
                    {game.pgn && (
                      <button
                        type="button"
                        onClick={() => handleCopyPgn(game._id, game.pgn)}
                        className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                        title="Copy PGN"
                      >
                        {copiedPgnGameId === game._id ? (
                          <Check className="size-4 text-emerald-500" />
                        ) : (
                          <Copy className="size-4" />
                        )}
                      </button>
                    )}

                    {/* Download PGN */}
                    {game.pgn && (
                      <button
                        type="button"
                        onClick={() => handleDownloadPgn(game)}
                        className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                        title="Download PGN"
                      >
                        <Download className="size-4" />
                      </button>
                    )}

                    {/* Replay & Review */}
                    <Link
                      href={`/game/${game._id}`}
                      className="inline-flex h-8 items-center gap-1 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 px-3 text-xs font-bold transition-colors"
                    >
                      <span>Analyze</span>
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
