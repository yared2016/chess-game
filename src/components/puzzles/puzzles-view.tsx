// src/components/puzzles/puzzles-view.tsx
"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import {
  TACTICAL_PUZZLES,
  getDailyPuzzle,
  getFilteredPuzzles,
  type TacticalPuzzle,
} from "@/lib/chess/puzzles-data";
import { usePuzzleController } from "@/hooks/use-puzzle-controller";
import { BoardSurface } from "@/components/game/board-surface";
import { useUiStore } from "@/lib/stores/ui-store";
import type { Colour } from "@/lib/types";
import { toast } from "sonner";
import {
  Flame,
  Lightbulb,
  RotateCcw,
  Eye,
  ArrowRight,
  ArrowUpDown,
  Trophy,
  Target,
  Sparkles,
  Layers,
  BookOpen,
  Calendar,
  CheckCircle2,
  XCircle,
  HelpCircle,
  ChevronDown,
  Check,
  Zap,
  Crown,
  Filter,
  SlidersHorizontal,
  Search,
  X,
  Crosshair,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/ui";

interface DropdownOption {
  id: string;
  label: string;
  sub?: string;
  icon?: React.ComponentType<{ className?: string }>;
  dotColor?: string;
  count?: number;
}

const THEME_OPTIONS: (DropdownOption & { icon: React.ComponentType<{ className?: string }> })[] = [
  { id: "all", label: "All Themes", sub: "All tactical motifs", icon: Sparkles },
  { id: "mateIn1", label: "Mate in 1", sub: "One-move checkmates", icon: Target },
  { id: "mateIn2", label: "Mate in 2", sub: "Two-move tactical mates", icon: Zap },
  { id: "mateIn3", label: "Mate in 3", sub: "Deep mating nets", icon: Flame },
  { id: "fork", label: "Forks", sub: "Double attack tactics", icon: Layers },
  { id: "pin", label: "Pins", sub: "Immobilize pieces", icon: Crosshair },
  { id: "skewer", label: "Skewers", sub: "X-ray attacks", icon: ArrowRight },
  { id: "smotheredMate", label: "Smothered Mate", sub: "Knight against boxed king", icon: Crown },
  { id: "sacrifice", label: "Sacrifices", sub: "Decisive material sacrifice", icon: Sparkles },
  { id: "endgame", label: "Endgames", sub: "Precision technical play", icon: Trophy },
];

const DIFFICULTY_OPTIONS: (DropdownOption & { dotColor: string })[] = [
  { id: "all", label: "All Ratings", sub: "Any rating", dotColor: "bg-zinc-400" },
  { id: "beginner", label: "Beginner", sub: "< 1100 Elo", dotColor: "bg-emerald-400" },
  { id: "intermediate", label: "Intermediate", sub: "1100 – 1400 Elo", dotColor: "bg-sky-400" },
  { id: "advanced", label: "Advanced", sub: "1400 – 1800 Elo", dotColor: "bg-purple-400" },
  { id: "master", label: "Master", sub: "1800+ Elo", dotColor: "bg-amber-400" },
];

function CustomSelect({
  label,
  options,
  value,
  onChange,
  icon: HeaderIcon,
}: {
  label: string;
  options: DropdownOption[];
  value: string;
  onChange: (id: string) => void;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [dropUp, setDropUp] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((o) => o.id === value) || options[0];

  useEffect(() => {
    if (isOpen && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      setDropUp(spaceBelow < 320);
    }
  }, [isOpen]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      if (!target) return;

      // Inside trigger container
      if (containerRef.current && containerRef.current.contains(target)) {
        return;
      }

      // Inside any open portaled dialog or select content
      if (
        target.closest("[data-slot^='dialog']") ||
        target.closest("[role='dialog']") ||
        target.closest(".custom-select-dialog") ||
        target.closest(".custom-select-popover")
      ) {
        return;
      }

      setIsOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const SelectedIcon = selectedOption?.icon;

  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) return options;
    const q = searchQuery.toLowerCase().trim();
    return options.filter(
      (o) => o.label.toLowerCase().includes(q) || (o.sub && o.sub.toLowerCase().includes(q)),
    );
  }, [options, searchQuery]);

  return (
    <div className="relative w-full" ref={containerRef}>
      <label className="text-[11px] font-semibold text-muted-foreground mb-1.5 flex items-center gap-1.5">
        {HeaderIcon && <HeaderIcon className="size-3 text-primary" />}
        <span>{label}</span>
      </label>
      <button
        type="button"
        onClick={() => {
          setIsOpen((prev) => !prev);
          setSearchQuery("");
        }}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={cn(
          "w-full rounded-2xl bg-card/90 border border-border/80 px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-foreground shadow-xs",
          "flex items-center justify-between gap-2 transition-all cursor-pointer",
          "hover:border-primary/50 hover:bg-muted/40 focus:outline-none focus:ring-2 focus:ring-primary/40",
          isOpen && "border-primary ring-2 ring-primary/30 bg-muted/40",
        )}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          {SelectedIcon && (
            <div className="size-6 rounded-lg bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shrink-0">
              <SelectedIcon className="size-3.5" />
            </div>
          )}
          {selectedOption?.dotColor && (
            <span className={cn("size-2.5 rounded-full shrink-0 ring-2 ring-card", selectedOption.dotColor)} />
          )}
          <span className="truncate font-bold">{selectedOption?.label}</span>
          {selectedOption?.sub && (
            <span className="text-[11px] text-muted-foreground font-normal hidden xs:inline truncate">
              ({selectedOption.sub})
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {selectedOption?.count !== undefined && (
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-muted/80 text-muted-foreground font-semibold">
              {selectedOption.count}
            </span>
          )}
          <ChevronDown
            className={cn(
              "size-4 text-muted-foreground shrink-0 transition-transform duration-200",
              isOpen && "rotate-180 text-primary",
            )}
          />
        </div>
      </button>

      {/* Mobile Bottom-Sheet Drawer (Screens < 640px) */}
      <div className="sm:hidden">
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogContent
            showCloseButton={false}
            className="custom-select-dialog fixed inset-x-0 bottom-0 top-auto translate-x-0 translate-y-0 max-w-full rounded-t-3xl rounded-b-none border-t border-border/80 bg-card/98 backdrop-blur-2xl p-4 shadow-2xl flex flex-col max-h-[85vh] gap-3 z-[100]"
          >
            {/* Grabber handle */}
            <div className="w-12 h-1.5 rounded-full bg-muted-foreground/30 mx-auto -mt-1 shrink-0" />

            <div className="flex items-center justify-between pb-2 border-b border-border/60 shrink-0">
              <div className="flex items-center gap-2.5">
                {HeaderIcon && (
                  <div className="size-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center shadow-xs">
                    <HeaderIcon className="size-4" />
                  </div>
                )}
                <div>
                  <DialogTitle className="text-sm font-bold text-foreground">{label}</DialogTitle>
                  <p className="text-[11px] text-muted-foreground font-mono">
                    {options.length} options available
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="size-8 rounded-xl bg-muted/60 text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer"
                aria-label="Close"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Quick search filter if more than 5 options */}
            {options.length > 5 && (
              <div className="relative shrink-0">
                <Search className="size-3.5 text-muted-foreground absolute left-3 top-3 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Filter options..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-9 pl-8 pr-8 rounded-xl bg-muted/50 border border-border/70 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary shadow-xs"
                />
                {searchQuery.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5"
                  >
                    <X className="size-3" />
                  </button>
                )}
              </div>
            )}

            {/* Full vertical scroll list with plenty of bottom padding */}
            <div
              className="overflow-y-auto space-y-1.5 flex-1 pr-1 overscroll-contain touch-pan-y pb-8 scrollbar-thin"
              style={{ WebkitOverflowScrolling: "touch" }}
            >
              {filteredOptions.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6">
                  No options found matching &quot;{searchQuery}&quot;
                </p>
              ) : (
                filteredOptions.map((opt) => {
                  const isSelected = opt.id === value;
                  const OptIcon = opt.icon;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        onChange(opt.id);
                        setIsOpen(false);
                      }}
                      className={cn(
                        "w-full rounded-2xl px-3.5 py-3 text-xs font-medium flex items-center justify-between gap-2 transition-all cursor-pointer text-left active:scale-[0.99]",
                        isSelected
                          ? "bg-primary/15 text-primary font-bold shadow-xs border border-primary/40 ring-1 ring-primary/20"
                          : "text-foreground bg-muted/20 hover:bg-muted/60 border border-border/40",
                      )}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {OptIcon && (
                          <div
                            className={cn(
                              "size-8 rounded-xl flex items-center justify-center shrink-0",
                              isSelected ? "bg-primary/20 text-primary" : "bg-card border border-border/60 text-muted-foreground"
                            )}
                          >
                            <OptIcon className="size-4" />
                          </div>
                        )}
                        {opt.dotColor && (
                          <span className={cn("size-2.5 rounded-full shrink-0 ring-2 ring-card", opt.dotColor)} />
                        )}
                        <div className="min-w-0">
                          <div className="truncate font-bold text-xs">{opt.label}</div>
                          {opt.sub && (
                            <div className="text-[11px] text-muted-foreground leading-tight truncate">
                              {opt.sub}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {opt.count !== undefined && (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-lg bg-card border border-border/70 text-muted-foreground font-semibold">
                            {opt.count}
                          </span>
                        )}
                        {isSelected && <Check className="size-4 text-primary shrink-0" />}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Desktop Popover Menu (hidden on mobile, collision-aware drop-up/down) */}
      {isOpen && (
        <div
          role="listbox"
          className={cn(
            "custom-select-popover hidden sm:flex flex-col absolute z-50 left-0 right-0 max-h-84 rounded-2xl bg-card/98 backdrop-blur-xl border border-border/90 shadow-2xl p-2 animate-in fade-in-0 zoom-in-95 duration-150",
            dropUp ? "bottom-full mb-2" : "top-full mt-2",
          )}
        >
          {/* Quick search filter on desktop if > 6 options */}
          {options.length > 6 && (
            <div className="relative mb-2 shrink-0">
              <Search className="size-3.5 text-muted-foreground absolute left-2.5 top-2.5 pointer-events-none" />
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-8 pl-7 pr-7 rounded-lg bg-muted/50 border border-border/70 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary shadow-xs"
              />
              {searchQuery.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5"
                >
                  <X className="size-3" />
                </button>
              )}
            </div>
          )}

          <div className="overflow-y-auto space-y-1 flex-1 pr-1 overscroll-contain scrollbar-thin pb-2">
            {filteredOptions.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">
                No matching options
              </p>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = opt.id === value;
                const OptIcon = opt.icon;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => {
                      onChange(opt.id);
                      setIsOpen(false);
                    }}
                    className={cn(
                      "w-full rounded-xl px-2.5 py-2 text-xs sm:text-sm font-medium flex items-center justify-between gap-2 transition-colors cursor-pointer text-left",
                      isSelected
                        ? "bg-primary/15 text-primary font-bold shadow-xs border border-primary/30"
                        : "text-muted-foreground hover:bg-muted/60 hover:text-foreground border border-transparent",
                    )}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {OptIcon && (
                        <OptIcon
                          className={cn(
                            "size-4 shrink-0",
                            isSelected ? "text-primary" : "text-muted-foreground",
                          )}
                        />
                      )}
                      {opt.dotColor && (
                        <span className={cn("size-2 rounded-full shrink-0 ring-1 ring-card", opt.dotColor)} />
                      )}
                      <div className="min-w-0">
                        <div className="truncate font-semibold text-xs text-foreground">{opt.label}</div>
                        {opt.sub && (
                          <div className="text-[10px] text-muted-foreground truncate">
                            {opt.sub}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {opt.count !== undefined && (
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-muted/80 text-muted-foreground font-semibold">
                          {opt.count}
                        </span>
                      )}
                      {isSelected && <Check className="size-3.5 text-primary shrink-0" />}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function PuzzlesView() {
  const [selectedTheme, setSelectedTheme] = useState<string>("all");
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<"daily" | "trainer" | "catalog">("trainer");
  const [currentPuzzleIndex, setCurrentPuzzleIndex] = useState<number>(0);
  const [isFlipped, setIsFlipped] = useState<boolean>(false);

  const boardView = useUiStore((s) => s.boardView);
  const setBoardView = useUiStore((s) => s.setBoardView);

  // Convex stats and mutations
  const puzzleStats = useQuery(api.puzzles.getPlayerPuzzleStats);
  const recordAttemptMutation = useMutation(api.puzzles.recordAttempt);

  const daily = useMemo(() => getDailyPuzzle(), []);

  // Compute theme counts for the Theme Explorer
  const themeCounts = useMemo(() => {
    const counts: Record<string, number> = { all: TACTICAL_PUZZLES.length };
    for (const t of THEME_OPTIONS) {
      if (t.id === "all") continue;
      counts[t.id] = TACTICAL_PUZZLES.filter((p) => p.themes.includes(t.id)).length;
    }
    return counts;
  }, []);

  const themeDropdownOptions = useMemo(() => {
    return THEME_OPTIONS.map((t) => ({
      ...t,
      count: themeCounts[t.id],
    }));
  }, [themeCounts]);

  const difficultyDropdownOptions = useMemo(() => {
    return DIFFICULTY_OPTIONS.map((d) => {
      let count = TACTICAL_PUZZLES.length;
      if (d.id === "beginner") count = TACTICAL_PUZZLES.filter((p) => p.rating < 1100).length;
      else if (d.id === "intermediate") count = TACTICAL_PUZZLES.filter((p) => p.rating >= 1100 && p.rating <= 1400).length;
      else if (d.id === "advanced") count = TACTICAL_PUZZLES.filter((p) => p.rating > 1400 && p.rating <= 1800).length;
      else if (d.id === "master") count = TACTICAL_PUZZLES.filter((p) => p.rating > 1800).length;
      return { ...d, count };
    });
  }, []);

  const filteredPuzzles = useMemo(() => {
    let minRating: number | undefined;
    let maxRating: number | undefined;
    if (selectedDifficulty === "beginner") maxRating = 1100;
    else if (selectedDifficulty === "intermediate") {
      minRating = 1100;
      maxRating = 1400;
    } else if (selectedDifficulty === "advanced") {
      minRating = 1400;
      maxRating = 1800;
    } else if (selectedDifficulty === "master") {
      minRating = 1800;
    }

    const list = getFilteredPuzzles({
      theme: selectedTheme,
      minRating,
      maxRating,
    });
    return list.length > 0 ? list : TACTICAL_PUZZLES;
  }, [selectedTheme, selectedDifficulty]);

  const activePuzzle: TacticalPuzzle = useMemo(() => {
    if (activeTab === "daily") return daily;
    const idx = currentPuzzleIndex % filteredPuzzles.length;
    return filteredPuzzles[idx] ?? TACTICAL_PUZZLES[0];
  }, [activeTab, daily, currentPuzzleIndex, filteredPuzzles]);

  const handleSelectTheme = (themeId: string) => {
    setSelectedTheme(themeId);
    setCurrentPuzzleIndex(0);
  };

  const handleSelectDifficulty = (diffId: string) => {
    setSelectedDifficulty(diffId);
    setCurrentPuzzleIndex(0);
  };

  const handleSolve = useCallback(
    async ({ timeTakenMs }: { timeTakenMs: number }) => {
      try {
        const res = await recordAttemptMutation({
          puzzleId: activePuzzle.puzzleId,
          solved: true,
          timeTakenMs,
        });
        toast.success(`Puzzle Solved! +${res.delta} Elo (Rating: ${res.newRating})`, {
          icon: "🎉",
        });
      } catch (err) {
        console.error("Failed to record puzzle attempt:", err);
      }
    },
    [activePuzzle.puzzleId, recordAttemptMutation],
  );

  const handleFail = useCallback(async () => {
    try {
      const res = await recordAttemptMutation({
        puzzleId: activePuzzle.puzzleId,
        solved: false,
        timeTakenMs: 10000,
      });
      toast.error(`Incorrect move (${res.delta} Elo). Streak reset!`, {
        icon: "❌",
      });
    } catch (err) {
      console.error("Failed to record puzzle failure:", err);
    }
  }, [activePuzzle.puzzleId, recordAttemptMutation]);

  const handleNextPuzzle = useCallback(() => {
    setCurrentPuzzleIndex((prev) => (prev + 1) % filteredPuzzles.length);
  }, [filteredPuzzles.length]);

  const controller = usePuzzleController({
    puzzle: activePuzzle,
    onSolve: handleSolve,
    onFail: handleFail,
    onNext: handleNextPuzzle,
  });

  const {
    boardProps,
    status,
    statusMessage,
    retry,
    showHint,
    revealSolution,
    currentPlyIndex,
    totalPlies,
  } = controller;

  const currentStreak = puzzleStats?.streak ?? 0;
  const bestStreak = puzzleStats?.bestStreak ?? 0;
  const playerRating = puzzleStats?.rating ?? 1200;

  useEffect(() => {
    setIsFlipped(false);
  }, [activePuzzle.puzzleId]);

  const effectiveOrientation: Colour = isFlipped
    ? (boardProps.orientation === "w" ? "b" : "w")
    : boardProps.orientation;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* 1. Header & Navigation Command Center */}
      <div className="rounded-2xl sm:rounded-3xl bg-card border border-border/80 p-3 sm:p-5 shadow-sm space-y-3">
        {/* Mobile Header: Ultra-compact to preserve viewport height for the board */}
        <div className="sm:hidden flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="size-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
              <Target className="size-4 text-primary" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-black tracking-tight text-foreground truncate">
                Puzzles Trainer
              </h1>
              <p className="text-[10px] text-muted-foreground truncate">Tactical Mastery</p>
            </div>
          </div>

          {/* Quick Stats Pills on Mobile */}
          <div className="flex items-center gap-1.5 shrink-0">
            <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-primary/10 border border-primary/20 text-[11px] font-black text-primary">
              <Trophy className="size-3" />
              <span>{playerRating}</span>
            </div>
            <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-orange-500/10 border border-orange-500/20 text-[11px] font-black text-orange-500">
              <Flame className="size-3" />
              <span>{currentStreak}</span>
            </div>
            <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-muted border border-border/60 text-[11px] font-black text-foreground">
              <Sparkles className="size-3 text-amber-400" />
              <span>{puzzleStats?.solvedCount ?? 0}</span>
            </div>
          </div>
        </div>

        {/* Desktop Header: Expansive Banner with Detailed Stats */}
        <div className="hidden sm:flex flex-row items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="size-9 rounded-2xl bg-primary/15 border border-primary/30 flex items-center justify-center">
                <Target className="size-5 text-primary" />
              </div>
              <h1 className="text-xl lg:text-2xl font-black tracking-tight text-foreground">
                Tactical Puzzles Trainer
              </h1>
            </div>
            <p className="text-xs lg:text-sm text-muted-foreground">
              Sharpen your calculation, pattern recognition, and tactical foresight.
            </p>
          </div>

          {/* Desktop Stats Row */}
          <div className="flex items-center gap-2.5">
            {/* Rating Badge */}
            <div className="flex items-center gap-2.5 rounded-2xl bg-primary/10 border border-primary/20 px-3.5 py-2">
              <Trophy className="size-4 text-primary shrink-0" />
              <div>
                <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                  Rating
                </div>
                <div className="text-sm lg:text-base font-black text-foreground">
                  {playerRating} <span className="text-[10px] font-normal text-muted-foreground">Elo</span>
                </div>
              </div>
            </div>

            {/* Streak Badge */}
            <div className="flex items-center gap-2.5 rounded-2xl bg-orange-500/10 border border-orange-500/20 px-3.5 py-2">
              <Flame className="size-4 text-orange-500 shrink-0 animate-pulse" />
              <div>
                <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                  Streak
                </div>
                <div className="text-sm lg:text-base font-black text-orange-500">
                  {currentStreak}{" "}
                  <span className="text-[10px] font-normal text-muted-foreground">
                    (Best: {bestStreak})
                  </span>
                </div>
              </div>
            </div>

            {/* Solved Badge */}
            <div className="flex items-center gap-2.5 rounded-2xl bg-muted/60 border border-border/60 px-3.5 py-2">
              <Sparkles className="size-4 text-amber-400 shrink-0" />
              <div>
                <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                  Solved
                </div>
                <div className="text-sm lg:text-base font-black text-foreground">
                  {puzzleStats?.solvedCount ?? 0}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Mode Navigation Tabs */}
        {/* Mobile View: 3-column segmented deck with zero horizontal scrolling */}
        <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-muted/40 border border-border/60 sm:hidden">
          <button
            type="button"
            onClick={() => setActiveTab("trainer")}
            className={cn(
              "flex items-center justify-center gap-1.5 py-1.5 px-1 rounded-lg text-center transition-all cursor-pointer",
              activeTab === "trainer"
                ? "bg-primary text-primary-foreground shadow-xs font-bold"
                : "text-muted-foreground hover:text-foreground active:scale-[0.98]",
            )}
          >
            <Target className="size-3.5 shrink-0" />
            <span className="text-xs font-bold truncate">Trainer</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("daily")}
            className={cn(
              "flex items-center justify-center gap-1.5 py-1.5 px-1 rounded-lg text-center transition-all cursor-pointer",
              activeTab === "daily"
                ? "bg-primary text-primary-foreground shadow-xs font-bold"
                : "text-muted-foreground hover:text-foreground active:scale-[0.98]",
            )}
          >
            <Calendar className="size-3.5 shrink-0" />
            <span className="text-xs font-bold truncate">Daily</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("catalog")}
            className={cn(
              "flex items-center justify-center gap-1.5 py-1.5 px-1 rounded-lg text-center transition-all cursor-pointer",
              activeTab === "catalog"
                ? "bg-primary text-primary-foreground shadow-xs font-bold"
                : "text-muted-foreground hover:text-foreground active:scale-[0.98]",
            )}
          >
            <BookOpen className="size-3.5 shrink-0" />
            <span className="text-xs font-bold truncate">Themes</span>
          </button>
        </div>

        {/* Desktop View: Horizontal tab strip */}
        <div className="hidden sm:flex items-center gap-2 border-t border-border/60 pt-3">
          <button
            onClick={() => setActiveTab("trainer")}
            className={cn(
              "inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs sm:text-sm font-bold transition-all cursor-pointer",
              activeTab === "trainer"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
            )}
          >
            <Target className="size-4" />
            Tactical Trainer
          </button>
          <button
            onClick={() => setActiveTab("daily")}
            className={cn(
              "inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs sm:text-sm font-bold transition-all cursor-pointer",
              activeTab === "daily"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
            )}
          >
            <Calendar className="size-4" />
            Daily Puzzle
          </button>
          <button
            onClick={() => setActiveTab("catalog")}
            className={cn(
              "inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs sm:text-sm font-bold transition-all cursor-pointer",
              activeTab === "catalog"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
            )}
          >
            <BookOpen className="size-4" />
            Theme Explorer
          </button>
        </div>
      </div>

      {/* 2. Main Solving Arena & Controls Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 items-start">
        {/* Chess Board Arena Card (Left 7 columns on Desktop) */}
        <div className="lg:col-span-7 xl:col-span-7 flex flex-col items-center w-full">
          <div className="w-full max-w-[580px] rounded-2xl sm:rounded-3xl border border-border/80 bg-card/70 shadow-lg overflow-hidden backdrop-blur-xs">
            {/* 1. Board Header Bar */}
            <div className="flex items-center justify-between px-3 sm:px-4 py-2 sm:py-2.5 border-b border-border/70 bg-muted/30">
              {/* Turn / Orientation Status Badge */}
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className={cn(
                    "size-3 rounded-full border shrink-0 shadow-xs",
                    effectiveOrientation === "w"
                      ? "bg-white border-zinc-400"
                      : "bg-zinc-900 border-zinc-600",
                  )}
                />
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-xs font-bold text-foreground truncate">
                    {effectiveOrientation === "w" ? "White" : "Black"}
                  </span>
                  <span className="text-[11px] text-muted-foreground hidden xs:inline">
                    to move
                  </span>
                </div>
              </div>

              {/* Board Controls: Flip Orientation & 2D/3D Switcher */}
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsFlipped((f) => !f)}
                  title="Flip Board Orientation"
                  className={cn(
                    "h-7 px-2.5 rounded-lg text-xs font-semibold border transition-colors flex items-center gap-1.5 cursor-pointer",
                    isFlipped
                      ? "bg-primary/10 text-primary border-primary/30 font-bold"
                      : "bg-background text-muted-foreground border-border/70 hover:text-foreground hover:bg-muted/60",
                  )}
                >
                  <ArrowUpDown className="size-3 shrink-0" />
                  <span className="text-[10px] hidden xs:inline">Flip</span>
                </button>

                {/* 2D / 3D Board View Toggle */}
                <div className="flex items-center gap-0.5 bg-background p-0.5 rounded-lg border border-border/70">
                  <button
                    type="button"
                    onClick={() => setBoardView("2d")}
                    className={cn(
                      "px-2 py-0.5 rounded-md text-[11px] font-bold transition-all cursor-pointer",
                      boardView === "2d"
                        ? "bg-primary text-primary-foreground shadow-xs"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    2D
                  </button>
                  <button
                    type="button"
                    onClick={() => setBoardView("3d")}
                    className={cn(
                      "px-2 py-0.5 rounded-md text-[11px] font-bold transition-all cursor-pointer",
                      boardView === "3d"
                        ? "bg-primary text-primary-foreground shadow-xs"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    3D
                  </button>
                </div>
              </div>
            </div>

            {/* 2. Board Canvas */}
            <div className="relative w-full aspect-square bg-card/10 overflow-hidden">
              <BoardSurface {...boardProps} orientation={effectiveOrientation} />
            </div>

            {/* 3. Board Footer: Tactical Progress Bar */}
            <div className="flex items-center justify-between px-3 sm:px-4 py-2 sm:py-2.5 border-t border-border/70 bg-muted/30 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold text-muted-foreground">Progress:</span>
                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPlies }).map((_, i) => (
                    <div
                      key={i}
                      className={cn(
                        "h-1.5 sm:h-2 rounded-full transition-all duration-300",
                        i < currentPlyIndex
                          ? "w-4 sm:w-5 bg-emerald-500 shadow-xs shadow-emerald-500/30"
                          : i === currentPlyIndex
                            ? "w-4 sm:w-5 bg-primary animate-pulse"
                            : "w-2 sm:w-2.5 bg-muted-foreground/30",
                      )}
                    />
                  ))}
                </div>
              </div>

              <span className="text-[11px] font-mono font-bold text-foreground">
                {Math.min(currentPlyIndex, totalPlies)} / {totalPlies} plies
              </span>
            </div>
          </div>
        </div>

        {/* Puzzle Controls, Feedback & Filters (Right 5 columns on Desktop) */}
        <div className="lg:col-span-5 xl:col-span-5 space-y-4 lg:sticky lg:top-4">
          {/* Puzzle Info & Interactive Controls Card */}
          <div className="rounded-2xl bg-card border border-border/80 p-4 sm:p-5 space-y-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="text-[10px] uppercase font-bold text-primary tracking-wider">
                  {activeTab === "daily" ? "Daily Challenge" : `Puzzle #${activePuzzle.puzzleId}`}
                </span>
                <h2 className="text-base sm:text-lg font-bold text-foreground mt-0.5">
                  {activePuzzle.title}
                </h2>
                {activePuzzle.openingFamily && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {activePuzzle.openingFamily}{" "}
                    {activePuzzle.openingEco ? `(${activePuzzle.openingEco})` : ""}
                  </p>
                )}
              </div>
              <div className="rounded-xl bg-muted px-2.5 py-1 text-xs font-black text-foreground shrink-0 border border-border/60">
                ★ {activePuzzle.rating}
              </div>
            </div>

            {/* Themes Tags */}
            <div className="flex flex-wrap gap-1.5">
              {activePuzzle.themes.map((theme) => (
                <span
                  key={theme}
                  className="rounded-lg bg-secondary/60 text-secondary-foreground px-2 py-0.5 text-[11px] font-semibold"
                >
                  #{theme}
                </span>
              ))}
            </div>

            {/* Live Status Message Card */}
            <div
              className={cn(
                "rounded-xl p-3 sm:p-3.5 border transition-all flex items-center gap-3",
                status === "solved" &&
                  "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400",
                status === "failed" &&
                  "bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400",
                status === "opponent-turn" &&
                  "bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400",
                status === "playing" && "bg-muted/60 border-border/60 text-foreground",
              )}
            >
              {status === "solved" ? (
                <CheckCircle2 className="size-5 shrink-0 text-emerald-500" />
              ) : status === "failed" ? (
                <XCircle className="size-5 shrink-0 text-red-500" />
              ) : (
                <HelpCircle className="size-5 shrink-0 text-primary" />
              )}
              <div className="text-xs sm:text-sm font-semibold">{statusMessage}</div>
            </div>

            {/* Interactive Action Buttons */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <Button
                variant="outline"
                size="sm"
                onClick={showHint}
                disabled={status === "solved" || status === "opponent-turn"}
                className="rounded-xl flex items-center justify-center gap-1.5 text-xs font-bold border-amber-500/30 text-amber-500 hover:bg-amber-500/10 hover:text-amber-400 cursor-pointer"
              >
                <Lightbulb className="size-3.5 text-amber-400" />
                Hint
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={retry}
                disabled={status === "opponent-turn"}
                className="rounded-xl flex items-center justify-center gap-1.5 text-xs font-bold border-border/80 hover:bg-muted/60 cursor-pointer"
              >
                <RotateCcw className="size-3.5" />
                Retry
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={revealSolution}
                disabled={status === "solved" || status === "opponent-turn"}
                className="rounded-xl flex items-center justify-center gap-1.5 text-xs font-bold border-sky-500/30 text-sky-400 hover:bg-sky-500/10 hover:text-sky-300 cursor-pointer"
              >
                <Eye className="size-3.5 text-sky-400" />
                Solution
              </Button>
              <Button
                variant={status === "solved" ? "default" : "secondary"}
                size="sm"
                onClick={handleNextPuzzle}
                className={cn(
                  "rounded-xl flex items-center justify-center gap-1.5 text-xs font-bold transition-all cursor-pointer",
                  status === "solved" && "animate-pulse shadow-md shadow-primary/25",
                )}
              >
                Next
                <ArrowRight className="size-3.5" />
              </Button>
            </div>
          </div>

          {/* Educational Tactical Explanation Card */}
          <div className="rounded-2xl bg-card border border-border/80 p-4 sm:p-5 space-y-2 shadow-sm border-l-4 border-l-primary/70">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              <BookOpen className="size-3.5 text-primary" />
              <span>Tactical Breakdown</span>
            </div>
            <p className="text-xs sm:text-sm leading-relaxed text-foreground/90">
              {activePuzzle.solutionExplanation}
            </p>
          </div>

          {/* Theme & Difficulty Custom Dropdowns (Available in Trainer & Catalog) */}
          <div className="rounded-2xl bg-card border border-border/80 p-4 sm:p-5 space-y-3.5 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <SlidersHorizontal className="size-3.5 text-primary" />
                <span>Filters & Options</span>
              </div>
              <span className="text-[11px] text-muted-foreground font-mono">
                {filteredPuzzles.length} available
              </span>
            </div>

            <div className="space-y-3">
              <CustomSelect
                label="Theme Filter"
                options={themeDropdownOptions}
                value={selectedTheme}
                onChange={handleSelectTheme}
                icon={Target}
              />

              <CustomSelect
                label="Difficulty / Rating"
                options={difficultyDropdownOptions}
                value={selectedDifficulty}
                onChange={handleSelectDifficulty}
                icon={Trophy}
              />
            </div>
          </div>

          {/* Dedicated Theme Explorer Visual Hub (When in Theme Explorer mode) */}
          {activeTab === "catalog" && (
            <div className="rounded-2xl bg-card border border-border/80 p-4 sm:p-5 space-y-4 shadow-sm animate-in fade-in-0 duration-200">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <BookOpen className="size-3.5 text-primary" />
                  <span>Browse by Tactical Motif</span>
                </h3>
              </div>

              {/* Theme Chips Grid */}
              <div className="grid grid-cols-2 gap-2">
                {THEME_OPTIONS.map((theme) => {
                  const isSelected = selectedTheme === theme.id;
                  const Icon = theme.icon;
                  const count = themeCounts[theme.id] ?? 0;
                  return (
                    <button
                      key={theme.id}
                      type="button"
                      onClick={() => handleSelectTheme(theme.id)}
                      className={cn(
                        "flex items-center gap-2 p-2 rounded-xl border text-left transition-all cursor-pointer",
                        isSelected
                          ? "bg-primary/15 border-primary text-foreground ring-1 ring-primary/40 shadow-xs"
                          : "bg-muted/30 border-border/60 text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                      )}
                    >
                      <div
                        className={cn(
                          "size-7 rounded-lg flex items-center justify-center shrink-0",
                          isSelected
                            ? "bg-primary text-primary-foreground shadow-xs"
                            : "bg-muted text-muted-foreground",
                        )}
                      >
                        <Icon className="size-3.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold truncate leading-tight">
                          {theme.label}
                        </div>
                        <div className="text-[10px] text-muted-foreground truncate font-mono">
                          {count} {count === 1 ? "puzzle" : "puzzles"}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Difficulty Quick Pills */}
              <div className="space-y-1.5 pt-2 border-t border-border/60">
                <div className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5">
                  <Trophy className="size-3 text-primary" />
                  <span>Difficulty Tiers</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {DIFFICULTY_OPTIONS.map((diff) => {
                    const isSelected = selectedDifficulty === diff.id;
                    return (
                      <button
                        key={diff.id}
                        type="button"
                        onClick={() => handleSelectDifficulty(diff.id)}
                        className={cn(
                          "px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer flex items-center gap-1.5",
                          isSelected
                            ? "bg-primary text-primary-foreground border-primary shadow-xs font-bold"
                            : "bg-muted/30 border-border/60 text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                        )}
                      >
                        <span className={cn("size-1.5 rounded-full", diff.dotColor)} />
                        <span>{diff.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
