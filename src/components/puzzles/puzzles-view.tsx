// src/components/puzzles/puzzles-view.tsx
"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
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
  ChevronRight,
  BookOpen,
  Calendar,
  CheckCircle2,
  XCircle,
  HelpCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/ui";

const THEME_OPTIONS = [
  { id: "all", label: "All Themes" },
  { id: "mateIn1", label: "Mate in 1" },
  { id: "mateIn2", label: "Mate in 2" },
  { id: "mateIn3", label: "Mate in 3" },
  { id: "fork", label: "Forks" },
  { id: "pin", label: "Pins" },
  { id: "skewer", label: "Skewers" },
  { id: "smotheredMate", label: "Smothered Mate" },
  { id: "sacrifice", label: "Sacrifices" },
  { id: "endgame", label: "Endgames" },
];

const DIFFICULTY_OPTIONS = [
  { id: "all", label: "All Ratings" },
  { id: "beginner", label: "Beginner (<1100)" },
  { id: "intermediate", label: "Intermediate (1100-1400)" },
  { id: "advanced", label: "Advanced (1400-1800)" },
  { id: "master", label: "Master (1800+)" },
];

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
    <div className="space-y-6">
      {/* Top Banner & Stats Overview - Compact & Balanced */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 rounded-2xl bg-card border border-border/80 p-3.5 sm:p-5 shadow-sm">
        <div className="space-y-0.5 sm:space-y-1">
          <div className="flex items-center gap-2">
            <Target className="size-5 sm:size-6 text-primary" />
            <h1 className="text-lg sm:text-2xl font-black tracking-tight">Tactical Puzzles Trainer</h1>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Sharpen your calculation, pattern recognition, and tactical foresight.
          </p>
        </div>

        {/* 3 Stats in a clean responsive row */}
        <div className="grid grid-cols-3 sm:flex items-center gap-2 sm:gap-3">
          {/* Rating Badge */}
          <div className="flex items-center gap-2 rounded-xl bg-primary/10 border border-primary/20 px-2.5 sm:px-3.5 py-1.5 sm:py-2">
            <Trophy className="size-3.5 sm:size-4 text-primary shrink-0" />
            <div className="min-w-0">
              <div className="text-[9px] sm:text-[10px] uppercase font-semibold text-muted-foreground tracking-wider truncate">
                Rating
              </div>
              <div className="text-xs sm:text-base font-black text-foreground truncate">
                {playerRating} <span className="text-[10px] font-normal text-muted-foreground">Elo</span>
              </div>
            </div>
          </div>

          {/* Streak Badge */}
          <div className="flex items-center gap-2 rounded-xl bg-orange-500/10 border border-orange-500/20 px-2.5 sm:px-3.5 py-1.5 sm:py-2">
            <Flame className="size-3.5 sm:size-4 text-orange-500 shrink-0 animate-pulse" />
            <div className="min-w-0">
              <div className="text-[9px] sm:text-[10px] uppercase font-semibold text-muted-foreground tracking-wider truncate">
                Streak
              </div>
              <div className="text-xs sm:text-base font-black text-orange-500 truncate">
                {currentStreak}{" "}
                <span className="text-[10px] font-normal text-muted-foreground hidden xs:inline">
                  (Best: {bestStreak})
                </span>
              </div>
            </div>
          </div>

          {/* Solved Count */}
          <div className="flex items-center gap-2 rounded-xl bg-muted/60 border border-border/60 px-2.5 sm:px-3.5 py-1.5 sm:py-2">
            <Sparkles className="size-3.5 sm:size-4 text-amber-400 shrink-0" />
            <div className="min-w-0">
              <div className="text-[9px] sm:text-[10px] uppercase font-semibold text-muted-foreground tracking-wider truncate">
                Solved
              </div>
              <div className="text-xs sm:text-base font-black text-foreground truncate">
                {puzzleStats?.solvedCount ?? 0}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mode Navigation Tabs */}
      {/* Mobile Mode Tabs: Modern 3-Column Segmented Deck (Zero Horizontal Scrolling) */}
      <div className="grid grid-cols-3 gap-1.5 p-1 rounded-2xl bg-card border border-border/80 shadow-xs sm:hidden">
        <button
          type="button"
          onClick={() => setActiveTab("trainer")}
          className={cn(
            "flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-xl text-center transition-all",
            activeTab === "trainer"
              ? "bg-primary text-primary-foreground shadow-sm font-bold ring-1 ring-primary/40"
              : "bg-muted/30 text-muted-foreground hover:bg-muted/60 hover:text-foreground active:scale-[0.98]",
          )}
        >
          <Target className="size-4 shrink-0" />
          <span className="text-[11px] font-bold leading-tight truncate w-full">Trainer</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("daily")}
          className={cn(
            "flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-xl text-center transition-all",
            activeTab === "daily"
              ? "bg-primary text-primary-foreground shadow-sm font-bold ring-1 ring-primary/40"
              : "bg-muted/30 text-muted-foreground hover:bg-muted/60 hover:text-foreground active:scale-[0.98]",
          )}
        >
          <Calendar className="size-4 shrink-0" />
          <span className="text-[11px] font-bold leading-tight truncate w-full">Daily</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("catalog")}
          className={cn(
            "flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-xl text-center transition-all",
            activeTab === "catalog"
              ? "bg-primary text-primary-foreground shadow-sm font-bold ring-1 ring-primary/40"
              : "bg-muted/30 text-muted-foreground hover:bg-muted/60 hover:text-foreground active:scale-[0.98]",
          )}
        >
          <BookOpen className="size-4 shrink-0" />
          <span className="text-[11px] font-bold leading-tight truncate w-full">Themes</span>
        </button>
      </div>

      {/* Desktop Mode Tabs: Classic Horizontal Tabs */}
      <div className="hidden sm:flex items-center gap-2 border-b border-border/70 pb-3">
        <button
          onClick={() => setActiveTab("trainer")}
          className={cn(
            "inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs sm:text-sm font-bold transition-all whitespace-nowrap",
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
            "inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs sm:text-sm font-bold transition-all whitespace-nowrap",
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
            "inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs sm:text-sm font-bold transition-all whitespace-nowrap",
            activeTab === "catalog"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
          )}
        >
          <BookOpen className="size-4" />
          Theme Explorer
        </button>
      </div>

      {/* Main Solving Arena */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Chess Board Arena Card (Left 7 columns) */}
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
                    "h-7 px-2 rounded-lg text-xs font-semibold border transition-colors flex items-center gap-1",
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
                      "px-2 py-0.5 rounded-md text-[11px] font-bold transition-all",
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
                      "px-2 py-0.5 rounded-md text-[11px] font-bold transition-all",
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

        {/* Puzzle Controls & Feedback Area (Right 5 columns) */}
        <div className="lg:col-span-5 xl:col-span-5 space-y-4 lg:sticky lg:top-4">
          {/* Puzzle Info Header */}
          <div className="rounded-2xl bg-card border border-border/80 p-5 space-y-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="text-[10px] uppercase font-bold text-primary tracking-wider">
                  {activeTab === "daily" ? "Daily Challenge" : `Puzzle #${activePuzzle.puzzleId}`}
                </span>
                <h2 className="text-lg font-bold text-foreground mt-0.5">
                  {activePuzzle.title}
                </h2>
                {activePuzzle.openingFamily && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {activePuzzle.openingFamily}{" "}
                    {activePuzzle.openingEco ? `(${activePuzzle.openingEco})` : ""}
                  </p>
                )}
              </div>
              <div className="rounded-xl bg-muted px-2.5 py-1 text-xs font-black text-foreground">
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
                "rounded-xl p-3.5 border transition-all flex items-center gap-3",
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
            <div className="grid grid-cols-2 gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={showHint}
                disabled={status === "solved" || status === "opponent-turn"}
                className="rounded-xl flex items-center justify-center gap-1.5 text-xs font-bold"
              >
                <Lightbulb className="size-3.5 text-amber-400" />
                Hint
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={retry}
                disabled={status === "opponent-turn"}
                className="rounded-xl flex items-center justify-center gap-1.5 text-xs font-bold"
              >
                <RotateCcw className="size-3.5" />
                Retry
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={revealSolution}
                disabled={status === "solved" || status === "opponent-turn"}
                className="rounded-xl flex items-center justify-center gap-1.5 text-xs font-bold"
              >
                <Eye className="size-3.5 text-blue-400" />
                Solution
              </Button>
              <Button
                variant={status === "solved" ? "default" : "secondary"}
                size="sm"
                onClick={handleNextPuzzle}
                className={cn(
                  "rounded-xl flex items-center justify-center gap-1.5 text-xs font-bold transition-all",
                  status === "solved" && "animate-pulse shadow-md shadow-primary/20",
                )}
              >
                Next
                <ArrowRight className="size-3.5" />
              </Button>
            </div>
          </div>

          {/* Educational Tactical Explanation Card */}
          <div className="rounded-2xl bg-card border border-border/80 p-5 space-y-2.5 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              <BookOpen className="size-3.5 text-primary" />
              <span>Tactical Breakdown</span>
            </div>
            <p className="text-xs sm:text-sm leading-relaxed text-foreground/90">
              {activePuzzle.solutionExplanation}
            </p>
          </div>

          {/* Theme & Difficulty Filter Controls */}
          {activeTab === "catalog" && (
            <div className="rounded-2xl bg-card border border-border/80 p-5 space-y-4 shadow-sm">
              <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Filter Puzzles
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                    Theme
                  </label>
                  <select
                    value={selectedTheme}
                    onChange={(e) => setSelectedTheme(e.target.value)}
                    className="w-full rounded-xl bg-muted/60 border border-border/60 px-3 py-2 text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    {THEME_OPTIONS.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                    Difficulty / Rating
                  </label>
                  <select
                    value={selectedDifficulty}
                    onChange={(e) => setSelectedDifficulty(e.target.value)}
                    className="w-full rounded-xl bg-muted/60 border border-border/60 px-3 py-2 text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    {DIFFICULTY_OPTIONS.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
