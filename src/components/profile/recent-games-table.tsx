"use client";

import Link from "next/link";
import { useState } from "react";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Skeleton } from "@/components/ui/skeleton";
import { buttonVariants } from "@/components/ui/button";
import { MiniBoard } from "@/components/ui-kit";
import { DIFFICULTIES } from "@/lib/difficulty";
import { DEFAULT_FEN } from "@/lib/constants";
import {
  formatColour,
  formatDate,
  formatMode,
  formatOutcome,
  outcomeFor,
  pluralize,
  type ResultOutcome,
} from "@/lib/format";
import type { Colour, Difficulty, GameMode, GameStatus, SquareId, Winner } from "@/lib/types";
import { cn } from "@/lib/ui";
import { History, Swords, Trophy, XCircle, Minus, Coins, ChevronRight } from "lucide-react";

const RECENT_LIMIT = 20;

const OUTCOME_CLASS: Record<ResultOutcome, string> = {
  win: "border-green-500/30 bg-green-500/10 text-green-500 font-bold",
  loss: "border-red-500/30 bg-red-500/10 text-red-500 font-bold",
  draw: "border-border bg-muted/40 text-muted-foreground font-medium",
  ongoing: "border-primary/30 bg-primary/10 text-primary font-bold",
};

export interface RecentGame {
  _id: string;
  mode: GameMode;
  difficulty?: Difficulty;
  status: GameStatus;
  winner?: Winner;
  opponentName: string;
  myColour: Colour | null;
  moveCount: number;
  undoCount: number;
  rated: boolean;
  stake?: number;
  createdAt: number;
}

export interface RecentGameRowProps {
  game: RecentGame;
  /** The final position. Falls back to the opening position while it loads. */
  fen?: string;
  lastMove?: { from: SquareId; to: SquareId } | null;
}

/** Pure — the /dev/pages harness renders this with fixed positions. */
export function RecentGameRow({ game, fen, lastMove = null }: RecentGameRowProps) {
  const outcome = outcomeFor(game.status, game.winner, game.myColour);

  return (
    <li className="group flex min-w-0 items-center justify-between gap-3 rounded-2xl border border-border/80 bg-card p-3 sm:px-4 sm:py-3.5 shadow-sm hover:border-primary/40 hover:bg-muted/20 transition-all">
      <div className="flex items-center gap-3.5 min-w-0 flex-1">
        <div className="shrink-0 rounded-xl overflow-hidden shadow-inner ring-1 ring-border">
          <MiniBoard
            fen={fen ?? DEFAULT_FEN}
            size={52}
            orientation={game.myColour ?? "w"}
            lastMove={lastMove}
            label={`Final position against ${game.opponentName}`}
            className={cn(fen === undefined && "opacity-60")}
          />
        </div>

        <div className="min-w-0 flex-1 overflow-hidden space-y-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-bold text-foreground">
              {game.opponentName}
            </p>
            {game.myColour !== null && (
              <span className="shrink-0 text-[11px] font-semibold text-muted-foreground uppercase px-1.5 py-0.5 rounded bg-muted/60">
                {formatColour(game.myColour)}
              </span>
            )}
            {game.stake && game.stake > 0 && (
              <span className="shrink-0 inline-flex items-center gap-1 text-[11px] font-bold text-green-500 bg-green-500/10 border border-green-500/20 px-2 py-0.5 rounded-full">
                <Coins className="size-3" />
                {game.stake * 2} ETB Pool
              </span>
            )}
          </div>

          <p className="truncate text-xs text-muted-foreground flex items-center gap-1.5">
            <span>{formatMode(game.mode)}</span>
            {game.difficulty !== undefined && <span>· {DIFFICULTIES[game.difficulty].label}</span>}
            <span>· {pluralize(game.moveCount, "move")}</span>
            <span>· {formatDate(game.createdAt)}</span>
            {!game.rated && <span className="text-amber-500/80">· unrated</span>}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2.5 shrink-0">
        <span
          className={cn(
            "rounded-xl border px-3 py-1.5 text-xs uppercase tracking-wider",
            OUTCOME_CLASS[outcome],
          )}
        >
          {formatOutcome(outcome)}
        </span>

        <Link
          prefetch={false}
          href={`/game/${game._id}`}
          aria-label={`${outcome === "ongoing" ? "Open" : "Replay"} match against ${game.opponentName}`}
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "h-8 px-3 text-xs font-semibold gap-1 hidden sm:inline-flex",
          )}
        >
          {outcome === "ongoing" ? "Open" : "Replay"}
          <ChevronRight className="size-3.5 opacity-60" />
        </Link>
      </div>
    </li>
  );
}

function RecentGameRowLive({ game, enabled }: { game: RecentGame; enabled: boolean }) {
  const view = useQuery(
    api.games.get,
    enabled ? { gameId: game._id as Id<"games"> } : "skip",
  );
  const doc = view?.game;
  const last = doc?.lastMove;

  return (
    <RecentGameRow
      game={{ ...game, stake: doc?.stake }}
      fen={doc?.fen}
      lastMove={
        last === undefined || last === null
          ? null
          : { from: last.from as SquareId, to: last.to as SquareId }
      }
    />
  );
}

export function RecentGamesView({
  games,
  positions,
}: {
  games: RecentGame[];
  positions?: Record<string, string>;
}) {
  if (games.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
        No games played yet. Matches appear here as soon as they finish!
      </p>
    );
  }
  return (
    <ul className="grid gap-2.5">
      {games.map((game) => (
        <RecentGameRow key={game._id} game={game} fen={positions?.[game._id]} />
      ))}
    </ul>
  );
}

export function RecentGamesTable({ username }: { username: string }) {
  const { isAuthenticated } = useConvexAuth();
  const [filter, setFilter] = useState<"all" | "win" | "loss" | "draw">("all");
  const games = useQuery(api.games.gamesForProfile, { username, limit: RECENT_LIMIT });

  const filteredGames = (games || []).filter((g) => {
    if (filter === "all") return true;
    const outcome = outcomeFor(g.status, g.winner, g.myColour);
    return outcome === filter;
  });

  const winCount = (games || []).filter((g) => outcomeFor(g.status, g.winner, g.myColour) === "win").length;
  const lossCount = (games || []).filter((g) => outcomeFor(g.status, g.winner, g.myColour) === "loss").length;
  const drawCount = (games || []).filter((g) => outcomeFor(g.status, g.winner, g.myColour) === "draw").length;

  return (
    <section aria-label="Recent games" className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <History className="size-5 text-primary" />
            Match History & Replays
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Click any match to open the interactive board review and move analysis.
          </p>
        </div>

        {/* Outcome Filters */}
        <div className="flex items-center gap-1 self-start sm:self-auto rounded-xl bg-muted/40 p-1 border border-border">
          <button
            onClick={() => setFilter("all")}
            className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors ${
              filter === "all"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            All ({games?.length ?? 0})
          </button>
          <button
            onClick={() => setFilter("win")}
            className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1 ${
              filter === "win"
                ? "bg-green-500/10 text-green-500 border border-green-500/20 font-bold shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Trophy className="size-3" />
            Wins ({winCount})
          </button>
          <button
            onClick={() => setFilter("loss")}
            className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1 ${
              filter === "loss"
                ? "bg-red-500/10 text-red-500 border border-red-500/20 font-bold shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <XCircle className="size-3" />
            Losses ({lossCount})
          </button>
          <button
            onClick={() => setFilter("draw")}
            className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1 ${
              filter === "draw"
                ? "bg-muted text-foreground border border-border font-bold shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Minus className="size-3" />
            Draws ({drawCount})
          </button>
        </div>
      </div>

      {games === undefined ? (
        <div className="grid gap-2.5" aria-busy>
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-18 w-full rounded-2xl" />
          ))}
        </div>
      ) : filteredGames.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center space-y-2 bg-muted/10">
          <Swords className="size-8 text-muted-foreground/60 mx-auto" />
          <p className="font-semibold text-foreground text-sm">No matches found</p>
          <p className="text-xs text-muted-foreground">
            {filter === "all"
              ? "No games played yet. Start a match from the Play menu!"
              : `No matches matching the "${filter}" filter.`}
          </p>
        </div>
      ) : (
        <ul className="grid gap-2.5">
          {filteredGames.map((game) => (
            <RecentGameRowLive key={game._id} game={game} enabled={isAuthenticated} />
          ))}
        </ul>
      )}
    </section>
  );
}
