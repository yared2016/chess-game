"use client";
// src/components/leaderboard/leaderboard-table.tsx  [U4]
import { useState } from "react";
import Link from "next/link";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  FILTER_HINTS,
  LeaderboardFilters,
  POOL_TABS,
} from "@/components/leaderboard/leaderboard-filters";
import { Podium } from "@/components/ui-kit";
import { LEADERBOARD_SIZE } from "@/lib/constants";
import { formatRating, formatRecord, formatWinRate, totalGames } from "@/lib/format";
import type { LeaderboardFilter } from "@/lib/types";
import { cn, focusRing, initials } from "@/lib/ui";
import {
  Search,
  X,
  Trophy,
  ChevronRight,
  ArrowUpRight,
  Target,
  Swords,
  Sparkles,
} from "lucide-react";

export interface LeaderboardRow {
  rank: number;
  playerId: string;
  username: string;
  avatarUrl: string;
  rating: number;
  wins: number;
  losses: number;
  draws: number;
}

function profileHref(username: string): string {
  return `/profile/${encodeURIComponent(username)}`;
}

/** Draws count as half a win, exactly as `formatWinRate` reports them. */
function winRateFraction(row: LeaderboardRow): number {
  const played = totalGames(row);
  if (played === 0) return 0;
  return (row.wins + row.draws / 2) / played;
}

/** Pure: podium + modern dual-view list. The /dev/pages harness renders this with fixed rows. */
export function LeaderboardBody({ rows }: { rows: LeaderboardRow[] }) {
  const [searchQuery, setSearchQuery] = useState("");
  const { isAuthenticated } = useConvexAuth();
  const me = useQuery(api.players.me, isAuthenticated ? {} : "skip");

  if (rows.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-border/80 bg-card/40 p-8 sm:p-12 text-center space-y-4">
        <div className="size-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto text-primary">
          <Trophy className="size-6 text-primary" />
        </div>
        <div className="space-y-1">
          <h3 className="text-base sm:text-lg font-bold text-foreground">
            No rated players in this pool yet
          </h3>
          <p className="text-xs sm:text-sm text-muted-foreground max-w-sm mx-auto">
            Play a rated online match or challenge the computer engine to claim your spot on the grandmaster leaderboard.
          </p>
        </div>
        <Link href="/play" className="inline-block pt-1">
          <Button size="sm" className="rounded-xl font-bold gap-2">
            <Swords className="size-4" />
            <span>Play a Rated Match</span>
          </Button>
        </Link>
      </div>
    );
  }

  const queryClean = searchQuery.trim().toLowerCase();
  const filteredRows = queryClean
    ? rows.filter((r) => r.username.toLowerCase().includes(queryClean))
    : rows;

  const myRow = me
    ? rows.find(
        (r) =>
          r.playerId === me._id ||
          r.username.toLowerCase() === me.username.toLowerCase(),
      )
    : null;

  const handleJumpToMe = () => {
    const el =
      document.getElementById("my-rank-row-mob") ||
      document.getElementById("my-rank-row-desk");
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* 1. Grandmaster Podium (Top 3) — Visible when not searching */}
      {!queryClean && rows.length >= 3 && (
        <section aria-label="Podium">
          <Podium
            entries={rows.slice(0, 3).map((row) => ({
              rank: row.rank,
              name: row.username,
              rating: row.rating,
              avatarUrl: row.avatarUrl,
              record: formatRecord(row),
            }))}
            renderName={(entry) => (
              <Link
                prefetch={false}
                href={profileHref(entry.name)}
                className={cn("rounded-sm hover:text-primary transition-colors", focusRing)}
              >
                {entry.name}
              </Link>
            )}
          />
        </section>
      )}

      {/* 2. Control & Search Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
        {/* Search Input */}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
          <Input
            type="text"
            placeholder="Search player name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-8 h-9 text-xs sm:text-sm rounded-xl bg-card border-border/80"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              title="Clear search"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        {/* Status Chip & My Rank Shortcut */}
        <div className="flex items-center justify-between sm:justify-end gap-2.5">
          <span className="text-xs text-muted-foreground font-medium">
            {queryClean ? (
              <span>
                Found <strong className="text-foreground">{filteredRows.length}</strong> of {rows.length}
              </span>
            ) : (
              <span>
                Top <strong className="text-foreground">{rows.length}</strong> Players
              </span>
            )}
          </span>

          {myRow && (
            <button
              onClick={handleJumpToMe}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-primary/10 hover:bg-primary/20 border border-primary/30 text-primary text-xs font-bold transition-all cursor-pointer shadow-2xs"
            >
              <Target className="size-3.5" />
              <span>Your Rank: #{myRow.rank}</span>
            </button>
          )}
        </div>
      </div>

      {/* 3. Search Empty State */}
      {filteredRows.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border/80 bg-card/40 p-8 text-center space-y-2">
          <p className="text-sm font-semibold text-foreground">
            No players found matching &ldquo;{searchQuery}&rdquo;
          </p>
          <p className="text-xs text-muted-foreground">
            Try checking for typos or searching a different username.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSearchQuery("")}
            className="rounded-xl text-xs mt-2"
          >
            Clear Search Filter
          </Button>
        </div>
      )}

      {/* 4. MOBILE VIEW (< sm): Responsive Card Deck (ZERO Horizontal Scroll) */}
      {filteredRows.length > 0 && (
        <div className="sm:hidden space-y-2">
          {filteredRows.map((row) => {
            const isMe =
              Boolean(me) &&
              (row.playerId === me?._id ||
                row.username.toLowerCase() === me?.username.toLowerCase());
            const winRate = Math.round(winRateFraction(row) * 100);

            return (
              <div
                key={row.playerId}
                id={isMe ? "my-rank-row-mob" : undefined}
                className={cn(
                  "p-3 rounded-2xl bg-card border border-border/80 transition-all flex items-center justify-between gap-2.5 shadow-2xs",
                  isMe &&
                    "border-primary/80 bg-primary/10 shadow-sm shadow-primary/15 ring-1 ring-primary/40",
                )}
              >
                {/* Left Side: Rank Badge + Avatar + Name & Record */}
                <div className="flex items-center gap-2.5 min-w-0">
                  {/* Rank Indicator */}
                  <div
                    className={cn(
                      "size-7 rounded-xl flex items-center justify-center font-black text-xs shrink-0 border",
                      row.rank === 1
                        ? "bg-amber-500/20 text-amber-400 border-amber-500/40"
                        : row.rank === 2
                          ? "bg-slate-400/20 text-slate-300 border-slate-400/40"
                          : row.rank === 3
                            ? "bg-amber-800/20 text-amber-500 border-amber-700/40"
                            : row.rank <= 10
                              ? "bg-muted/80 text-foreground border-border/70 font-mono font-bold"
                              : "bg-transparent text-muted-foreground border-transparent font-mono text-[11px]",
                    )}
                  >
                    {row.rank === 1 ? (
                      "🥇"
                    ) : row.rank === 2 ? (
                      "🥈"
                    ) : row.rank === 3 ? (
                      "🥉"
                    ) : (
                      `#${row.rank}`
                    )}
                  </div>

                  {/* Avatar */}
                  <Avatar className="size-8.5 border border-border/70 shrink-0">
                    <AvatarImage src={row.avatarUrl} alt="" />
                    <AvatarFallback className="font-bold text-xs">
                      {initials(row.username)}
                    </AvatarFallback>
                  </Avatar>

                  {/* Username, You Badge & W-D-L Record */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <Link
                        prefetch={false}
                        href={profileHref(row.username)}
                        className="font-bold text-xs text-foreground truncate max-w-[130px] xs:max-w-[170px] hover:text-primary transition-colors"
                      >
                        {row.username}
                      </Link>
                      {isMe && (
                        <span className="text-[9px] bg-primary/20 text-primary px-1.5 py-0.2 rounded font-black tracking-wide">
                          YOU
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 font-medium mt-0.5">
                      <span>
                        <strong className="text-emerald-500 font-bold">{row.wins}W</strong>{" "}
                        <span className="text-muted-foreground">{row.draws}D</span>{" "}
                        <strong className="text-red-500 font-bold">{row.losses}L</strong>
                      </span>
                      <span className="text-muted-foreground/40">•</span>
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {winRate}% win
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right Side: Rating Elo + Games + Chevron */}
                <div className="flex items-center gap-2 shrink-0">
                  <div className="text-right">
                    <div className="font-mono font-black text-sm text-foreground">
                      {formatRating(row.rating)}{" "}
                      <span className="text-[9px] font-semibold text-muted-foreground uppercase">
                        Elo
                      </span>
                    </div>
                    <div className="text-[10px] font-mono text-muted-foreground mt-0.5">
                      {totalGames(row)} {totalGames(row) === 1 ? "game" : "games"}
                    </div>
                  </div>

                  <Link
                    prefetch={false}
                    href={profileHref(row.username)}
                    className="p-1 rounded-lg text-muted-foreground/60 hover:text-foreground hover:bg-muted/50 transition-colors"
                    title="View Profile"
                  >
                    <ChevronRight className="size-4" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 5. DESKTOP VIEW (hidden sm:block): Full Grandmaster Table */}
      {filteredRows.length > 0 && (
        <div className="hidden sm:block rounded-2xl border border-border/80 bg-card overflow-hidden shadow-xs">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/40 text-muted-foreground uppercase text-[11px] font-bold tracking-wider border-b border-border/60">
              <tr>
                <th className="py-3.5 px-4 w-16 text-center">#</th>
                <th className="py-3.5 px-4">Player</th>
                <th className="py-3.5 px-4 text-right">Rating</th>
                <th className="py-3.5 px-4 text-center">Record (W - D - L)</th>
                <th className="py-3.5 px-4 text-center w-36">Win Rate</th>
                <th className="py-3.5 px-4 text-right">Total Games</th>
                <th className="py-3.5 px-4 w-12 text-center"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {filteredRows.map((row) => {
                const isMe =
                  Boolean(me) &&
                  (row.playerId === me?._id ||
                    row.username.toLowerCase() === me?.username.toLowerCase());
                const winPct = Math.round(winRateFraction(row) * 100);

                return (
                  <tr
                    key={row.playerId}
                    id={isMe ? "my-rank-row-desk" : undefined}
                    className={cn(
                      "transition-colors hover:bg-muted/30 group",
                      isMe && "bg-primary/5 font-semibold",
                    )}
                  >
                    {/* Rank Column */}
                    <td className="py-3.5 px-4 text-center font-bold">
                      {row.rank === 1 ? (
                        <span className="text-amber-500 font-black text-sm">🥇 1</span>
                      ) : row.rank === 2 ? (
                        <span className="text-slate-400 font-black text-sm">🥈 2</span>
                      ) : row.rank === 3 ? (
                        <span className="text-amber-700 font-black text-sm">🥉 3</span>
                      ) : row.rank <= 10 ? (
                        <span className="inline-flex size-6 items-center justify-center rounded-md bg-muted text-foreground font-mono text-xs font-bold">
                          {row.rank}
                        </span>
                      ) : (
                        <span className="font-mono text-muted-foreground text-xs">{row.rank}</span>
                      )}
                    </td>

                    {/* Player Column */}
                    <td className="py-3.5 px-4">
                      <Link
                        prefetch={false}
                        href={profileHref(row.username)}
                        className="flex items-center gap-3 group-hover:text-primary transition-colors"
                      >
                        <Avatar className="size-8 border border-border/70">
                          <AvatarImage src={row.avatarUrl} alt="" />
                          <AvatarFallback className="font-bold text-xs">
                            {initials(row.username)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="font-bold text-sm text-foreground group-hover:text-primary truncate">
                            {row.username}
                          </span>
                          {isMe && (
                            <span className="text-[10px] bg-primary/20 text-primary px-1.5 py-0.2 rounded font-black">
                              YOU
                            </span>
                          )}
                        </div>
                      </Link>
                    </td>

                    {/* Rating Column */}
                    <td className="py-3.5 px-4 text-right">
                      <span className="font-mono font-black text-sm text-foreground">
                        {formatRating(row.rating)}{" "}
                        <span className="text-[10px] font-normal text-muted-foreground">Elo</span>
                      </span>
                    </td>

                    {/* Record Column */}
                    <td className="py-3.5 px-4 text-center">
                      <div className="inline-flex items-center gap-1.5 text-xs font-mono">
                        <span className="text-emerald-500 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded">
                          {row.wins}W
                        </span>
                        <span className="text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded">
                          {row.draws}D
                        </span>
                        <span className="text-red-500 font-bold bg-red-500/10 px-1.5 py-0.5 rounded">
                          {row.losses}L
                        </span>
                      </div>
                    </td>

                    {/* Win Rate Column */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center justify-center gap-2">
                        <span className="block h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                          <span
                            className="block h-full rounded-full bg-primary"
                            style={{ width: `${winPct}%` }}
                          />
                        </span>
                        <span className="font-mono text-xs text-muted-foreground w-9 text-right">
                          {winPct}%
                        </span>
                      </div>
                    </td>

                    {/* Total Games Column */}
                    <td className="py-3.5 px-4 text-right font-mono text-xs text-muted-foreground">
                      {totalGames(row)}
                    </td>

                    {/* Action Column */}
                    <td className="py-3.5 px-4 text-center">
                      <Link
                        prefetch={false}
                        href={profileHref(row.username)}
                        className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-all inline-block"
                        title="View Profile"
                      >
                        <ArrowUpRight className="size-4" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function LeaderboardPool({ filter }: { filter: LeaderboardFilter }) {
  const rows = useQuery(api.leaderboard.top, { filter, limit: LEADERBOARD_SIZE });

  if (rows === undefined) {
    return (
      <div className="space-y-6" aria-busy>
        {/* Podium Skeleton: 3-column Olympic layout */}
        <div className="grid grid-cols-3 gap-2 sm:gap-4 items-end">
          <Skeleton className="h-32 sm:h-44 w-full rounded-2xl" />
          <Skeleton className="h-40 sm:h-56 w-full rounded-2xl" />
          <Skeleton className="h-28 sm:h-38 w-full rounded-2xl" />
        </div>

        {/* Toolbar Skeleton */}
        <div className="flex items-center justify-between gap-3">
          <Skeleton className="h-9 w-48 rounded-xl" />
          <Skeleton className="h-5 w-24 rounded" />
        </div>

        {/* Row Skeletons */}
        <div className="space-y-2">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-14 sm:h-12 w-full rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  return <LeaderboardBody rows={rows} />;
}

export function LeaderboardTable() {
  const [filter, setFilter] = useState<LeaderboardFilter>("all");

  return (
    <Tabs
      value={filter}
      onValueChange={(value) => setFilter(value as LeaderboardFilter)}
      className="gap-5"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-x-4 gap-y-2">
        <LeaderboardFilters />
        <p className="text-[13px] text-muted-foreground font-medium">{FILTER_HINTS[filter]}</p>
      </div>

      {POOL_TABS.map((tab) => (
        <TabsContent key={tab.value} value={tab.value} className="mt-4 sm:mt-6">
          <LeaderboardPool filter={tab.value} />
        </TabsContent>
      ))}
    </Tabs>
  );
}
