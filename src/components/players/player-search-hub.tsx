"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { initials } from "@/lib/ui";
import { formatPresenceLastSeen } from "@/lib/format";
import { FindOpponentModal, type OpponentSummary } from "./find-opponent-modal";
import { PlayerCard } from "./player-card";
import {
  Search,
  X,
  SwordsIcon,
  Users,
  ExternalLink,
  RotateCcw,
  ChevronDown,
  Check,
} from "lucide-react";
import { cn } from "@/lib/ui";

const RATING_PRESETS = [
  { label: "All Ratings", min: undefined, max: undefined },
  { label: "< 1200", min: undefined, max: 1199 },
  { label: "1200 – 1500", min: 1200, max: 1500 },
  { label: "1500 – 1800", min: 1501, max: 1800 },
  { label: "1800+", min: 1801, max: undefined },
];

function FilterDropdown({
  value,
  options,
  onChange,
  className,
}: {
  value: string;
  options: { value: string; label: string }[];
  onChange: (val: string) => void;
  className?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  const selectedOption = options.find((o) => o.value === value) ?? options[0];

  return (
    <div className={cn("relative", className)} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "inline-flex h-8 items-center justify-between gap-1.5 rounded-lg border border-border/70 bg-card/60 px-2.5 text-xs font-medium text-foreground transition-all cursor-pointer hover:border-border hover:bg-muted/40",
          isOpen && "border-primary ring-1 ring-primary/40 bg-muted/40 text-primary",
        )}
      >
        <span className="truncate max-w-[170px]">{selectedOption?.label}</span>
        <ChevronDown
          className={cn(
            "size-3 text-muted-foreground shrink-0 transition-transform duration-200",
            isOpen && "rotate-180 text-primary",
          )}
        />
      </button>

      {isOpen && (
        <div
          role="listbox"
          className="absolute left-0 z-50 mt-1 min-w-[170px] max-w-[240px] max-h-60 overflow-y-auto rounded-xl border border-border/90 bg-card/95 backdrop-blur-xl p-1 shadow-2xl space-y-0.5 animate-in fade-in-0 zoom-in-95 duration-150"
        >
          {options.map((opt) => {
            const isSelected = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
                className={cn(
                  "flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors cursor-pointer text-left",
                  isSelected
                    ? "bg-primary/15 text-primary font-bold shadow-xs"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                )}
              >
                <span className="truncate">{opt.label}</span>
                {isSelected && <Check className="size-3.5 text-primary shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function PlayerSearchHub() {
  const [selectedOpponent, setSelectedOpponent] = useState<OpponentSummary | null>(null);

  // Filters State
  const [searchQuery, setSearchQuery] = useState("");
  const [onlineOnly, setOnlineOnly] = useState(false);
  const [ratingPresetIdx, setRatingPresetIdx] = useState(0);

  const selectedRatingPreset = RATING_PRESETS[ratingPresetIdx];

  // Search Query
  const players = useQuery(api.discovery.searchPlayers, {
    query: searchQuery,
    onlineOnly: onlineOnly ? true : undefined,
    minRating: selectedRatingPreset.min,
    maxRating: selectedRatingPreset.max,
    limit: 30,
  });

  const handleResetFilters = () => {
    setSearchQuery("");
    setOnlineOnly(false);
    setRatingPresetIdx(0);
  };

  const hasActiveFilters =
    searchQuery.trim().length > 0 ||
    onlineOnly ||
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
            Discover and challenge players across the Abay Chess community.
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

          {/* Rating Range Selector */}
          <FilterDropdown
            value={String(ratingPresetIdx)}
            options={RATING_PRESETS.map((preset, idx) => ({
              value: String(idx),
              label: preset.label,
            }))}
            onChange={(val) => setRatingPresetIdx(Number(val))}
          />

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
          {players.map((player) => (
            <PlayerCard
              key={player._id}
              player={player}
              onChallenge={(p) => setSelectedOpponent(p as OpponentSummary)}
            />
          ))}
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
