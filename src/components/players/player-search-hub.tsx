"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { initials } from "@/lib/ui";
import { formatPresenceLastSeen } from "@/lib/format";
import { FindOpponentModal, type OpponentSummary } from "./find-opponent-modal";
import {
  Search,
  X,
  SwordsIcon,
  GraduationCap,
  User,
  Users,
  ExternalLink,
  Sparkles,
  Filter,
  RotateCcw,
} from "lucide-react";
import { cn } from "@/lib/ui";

const RATING_PRESETS = [
  { label: "All Ratings", min: undefined, max: undefined },
  { label: "< 1200", min: undefined, max: 1199 },
  { label: "1200 – 1500", min: 1200, max: 1500 },
  { label: "1500 – 1800", min: 1501, max: 1800 },
  { label: "1800+", min: 1801, max: undefined },
];

export function PlayerSearchHub() {
  const universities = useQuery(api.universities.listUniversities, {});
  const [selectedOpponent, setSelectedOpponent] = useState<OpponentSummary | null>(null);

  // Filters State
  const [searchQuery, setSearchQuery] = useState("");
  const [onlineOnly, setOnlineOnly] = useState(false);
  const [playerType, setPlayerType] = useState<"university_student" | "public_player" | "all">("all");
  const [selectedUniId, setSelectedUniId] = useState<Id<"universities"> | "all">("all");
  const [ratingPresetIdx, setRatingPresetIdx] = useState(0);

  const selectedRatingPreset = RATING_PRESETS[ratingPresetIdx];

  // Search Query
  const players = useQuery(api.discovery.searchPlayers, {
    query: searchQuery,
    onlineOnly: onlineOnly ? true : undefined,
    playerType: playerType !== "all" ? playerType : undefined,
    universityId: selectedUniId !== "all" ? selectedUniId : undefined,
    minRating: selectedRatingPreset.min,
    maxRating: selectedRatingPreset.max,
    limit: 30,
  });

  const uniList = Array.isArray(universities) ? universities : [];

  const handleResetFilters = () => {
    setSearchQuery("");
    setOnlineOnly(false);
    setPlayerType("all");
    setSelectedUniId("all");
    setRatingPresetIdx(0);
  };

  const hasActiveFilters =
    searchQuery.trim().length > 0 ||
    onlineOnly ||
    playerType !== "all" ||
    selectedUniId !== "all" ||
    ratingPresetIdx !== 0;

  return (
    <div className="space-y-6">
      {/* Header and Search Controls */}
      <div className="space-y-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Player Directory
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Discover and challenge players across campuses and the Castle Chess community.
          </p>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-3 size-4 text-muted-foreground" />
          <Input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search players by username or display name..."
            className="h-10 pl-10 pr-10 text-sm bg-background/50 shadow-sm"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-2.5 rounded p-0.5 text-muted-foreground hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        {/* Filter Pills / Controls */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {/* Online Now Toggle */}
          <button
            type="button"
            onClick={() => setOnlineOnly(!onlineOnly)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all",
              onlineOnly
                ? "border-emerald-500 bg-emerald-500/10 text-emerald-500 ring-1 ring-emerald-500/30"
                : "border-border/70 bg-card/60 text-muted-foreground hover:border-border hover:bg-muted/40",
            )}
          >
            <span
              className={cn("size-2 rounded-full", onlineOnly ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground/60")}
            />
            Online Now
          </button>

          {/* Player Type Selector */}
          <select
            value={playerType}
            onChange={(e) => setPlayerType(e.target.value as any)}
            aria-label="Player Type Filter"
            className="h-8 rounded-lg border border-border/70 bg-card/60 px-2.5 text-xs font-medium text-foreground outline-none hover:bg-muted/40"
          >
            <option value="all">All Player Types</option>
            <option value="university_student">University Students</option>
            <option value="public_player">Public Players</option>
          </select>

          {/* Rating Range Selector */}
          <select
            value={ratingPresetIdx}
            onChange={(e) => setRatingPresetIdx(Number(e.target.value))}
            aria-label="Rating Range Filter"
            className="h-8 rounded-lg border border-border/70 bg-card/60 px-2.5 text-xs font-medium text-foreground outline-none hover:bg-muted/40"
          >
            {RATING_PRESETS.map((preset, idx) => (
              <option key={preset.label} value={idx}>
                {preset.label}
              </option>
            ))}
          </select>

          {/* University Filter */}
          <select
            value={selectedUniId}
            onChange={(e) => setSelectedUniId(e.target.value as any)}
            aria-label="University Filter"
            className="h-8 max-w-[200px] truncate rounded-lg border border-border/70 bg-card/60 px-2.5 text-xs font-medium text-foreground outline-none hover:bg-muted/40"
          >
            <option value="all">All Universities</option>
            {uniList.map((uni) => (
              <option key={uni._id} value={uni._id}>
                {uni.shortName} ({uni.name})
              </option>
            ))}
          </select>

          {/* Reset Filters */}
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleResetFilters}
              className="h-8 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="size-3" />
              Reset
            </Button>
          )}
        </div>
      </div>

      {/* Results Count */}
      <div className="flex items-center justify-between text-xs text-muted-foreground border-b border-border/60 pb-2">
        <span>
          {players === undefined
            ? "Searching players..."
            : `Showing ${players.length} ${players.length === 1 ? "player" : "players"}`}
        </span>
      </div>

      {/* Loading Skeletons */}
      {players === undefined && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i} className="space-y-3 p-4">
              <div className="flex items-center gap-3">
                <Skeleton className="size-11 rounded-full" />
                <div className="space-y-1.5 flex-1">
                  <Skeleton className="h-4 w-28 rounded" />
                  <Skeleton className="h-3 w-16 rounded" />
                </div>
              </div>
              <Skeleton className="h-8 w-full rounded-lg" />
            </Card>
          ))}
        </div>
      )}

      {/* Empty State */}
      {players && players.length === 0 && (
        <Card className="flex flex-col items-center justify-center p-12 text-center border-dashed border-border/80 bg-card/30">
          <Users className="size-10 text-muted-foreground/60 mb-2" />
          <p className="text-sm font-semibold text-foreground">No players found matching your criteria</p>
          <p className="mt-1 text-xs text-muted-foreground max-w-sm">
            Try adjusting your search query, widening the rating range, or turning off the online filter.
          </p>
          {hasActiveFilters && (
            <Button variant="outline" size="sm" onClick={handleResetFilters} className="mt-4 gap-1.5 text-xs">
              <RotateCcw className="size-3" />
              Reset All Filters
            </Button>
          )}
        </Card>
      )}

      {/* Players Grid */}
      {players && players.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {players.map((player) => {
            const isStudent = player.playerType === "university_student";

            return (
              <Card
                key={player._id}
                className="group flex flex-col justify-between border-border/70 bg-card/60 p-4 transition-all duration-200 hover:border-primary/50 hover:bg-card/90 hover:shadow-lg hover:shadow-primary/5"
              >
                <div className="space-y-3">
                  {/* Top: Avatar, Name, Rating */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="relative shrink-0">
                        <Avatar className="size-11 border border-border/80">
                          <AvatarImage src={player.avatarUrl} alt={player.displayName} />
                          <AvatarFallback>{initials(player.displayName || player.username)}</AvatarFallback>
                        </Avatar>
                        {player.isOnline && (
                          <span className="absolute bottom-0 right-0 size-2.5 rounded-full border-2 border-background bg-emerald-500" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/profile/${player.username}`}
                          className="truncate font-semibold text-foreground transition-colors hover:text-primary block text-sm"
                        >
                          {player.displayName}
                        </Link>
                        <span className="truncate text-xs text-muted-foreground block">
                          @{player.username}
                        </span>
                      </div>
                    </div>
                    <Badge variant="outline" className="font-bold text-xs text-primary shrink-0">
                      {player.ratingHuman}
                    </Badge>
                  </div>

                  {/* Middle: Badges & Presence */}
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {isStudent && player.universityName ? (
                        <Badge
                          variant="secondary"
                          className="flex items-center gap-1 truncate text-[0.65rem] border-primary/20 bg-primary/10 text-primary font-medium"
                        >
                          <GraduationCap className="size-3 shrink-0" />
                          <span className="truncate">{player.universityName}</span>
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="flex items-center gap-1 text-[0.65rem] text-muted-foreground">
                          <User className="size-3 shrink-0" />
                          <span>Public Player</span>
                        </Badge>
                      )}

                      {player.verificationStatus === "verified" && (
                        <Badge variant="outline" className="text-[0.65rem] border-emerald-500/30 text-emerald-500">
                          Verified
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 text-[0.7rem] text-muted-foreground">
                      <span
                        className={cn(
                          "size-1.5 rounded-full",
                          player.isOnline ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground/50",
                        )}
                      />
                      <span>{formatPresenceLastSeen(player.lastSeen)}</span>
                    </div>
                  </div>
                </div>

                {/* Bottom: Action Buttons */}
                <div className="mt-4 flex gap-2 border-t border-border/50 pt-3">
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => setSelectedOpponent(player as OpponentSummary)}
                    className="flex-1 gap-1.5 text-xs font-semibold"
                  >
                    <SwordsIcon className="size-3.5" />
                    Challenge
                  </Button>
                  <Link
                    href={`/profile/${player.username}`}
                    aria-label={`View profile of ${player.displayName}`}
                    className={cn(
                      buttonVariants({ variant: "outline", size: "sm" }),
                      "px-2.5 text-xs text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <ExternalLink className="size-3.5" />
                  </Link>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Direct Challenge Modal */}
      <FindOpponentModal
        isOpen={!!selectedOpponent}
        onClose={() => setSelectedOpponent(null)}
        opponent={selectedOpponent}
      />
    </div>
  );
}
