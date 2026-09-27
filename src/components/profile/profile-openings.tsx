// src/components/profile/profile-openings.tsx
"use client";

import { useMemo, useState, useCallback } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { detectOpening, OPENINGS, type OpeningDefinition } from "@/lib/chess/openings";
import { Chess } from "chess.js";
import { BoardSurface } from "@/components/game/board-surface";
import type { BoardViewProps, Colour, LastMove, LegalTarget, SquareId } from "@/lib/types";
import { checkSquareOf, legalTargetsFor } from "@/lib/chess";
import { derivePieces, EMPTY_PIECE_TRACKER_STATE, type PieceTrackerState } from "@/lib/piece-tracker";
import {
  BookOpen,
  Trophy,
  Swords,
  Zap,
  TrendingUp,
  Percent,
  Play,
  RotateCcw,
  Sparkles,
  X,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/ui";

interface OpeningStat {
  eco: string;
  name: string;
  fullName: string;
  moves: string[];
  total: number;
  wins: number;
  draws: number;
  losses: number;
  winRate: number;
}

export function ProfileOpenings({ username }: { username: string }) {
  const data = useQuery(api.openingAnalytics.getPlayerGamesForAnalytics, { username });
  const [selectedDrillOpening, setSelectedDrillOpening] = useState<OpeningDefinition | null>(null);

  // Group games by ECO and calculate win/draw/loss rates
  const stats = useMemo(() => {
    if (!data || !data.games) return { white: [], black: [], totalCount: 0 };

    const whiteMap = new Map<string, OpeningStat>();
    const blackMap = new Map<string, OpeningStat>();

    for (const g of data.games) {
      const match = detectOpening(g.moves);
      if (!match) continue;

      const targetMap = g.color === "w" ? whiteMap : blackMap;
      const key = match.fullName;

      let stat = targetMap.get(key);
      if (!stat) {
        // Find definition for moves
        const def = OPENINGS.find((o) => o.eco === match.eco && o.name === match.name);
        stat = {
          eco: match.eco,
          name: match.name,
          fullName: match.fullName,
          moves: def?.moves ?? g.moves.slice(0, match.plyCount),
          total: 0,
          wins: 0,
          draws: 0,
          losses: 0,
          winRate: 0,
        };
        targetMap.set(key, stat);
      }

      stat.total += 1;
      if (g.outcome === "win") stat.wins += 1;
      else if (g.outcome === "draw") stat.draws += 1;
      else stat.losses += 1;
    }

    const finalize = (map: Map<string, OpeningStat>) =>
      [...map.values()]
        .map((s) => ({
          ...s,
          winRate: Math.round((s.wins / s.total) * 100),
        }))
        .sort((a, b) => b.total - a.total);

    return {
      white: finalize(whiteMap),
      black: finalize(blackMap),
      totalCount: data.games.length,
    };
  }, [data]);

  // Derive time category performance
  const timeControlStats = useMemo(() => {
    if (!data || !data.games) return [];
    const categories: Record<string, { total: number; wins: number }> = {
      bullet: { total: 0, wins: 0 },
      blitz: { total: 0, wins: 0 },
      rapid: { total: 0, wins: 0 },
    };

    for (const g of data.games) {
      const cat = g.timeCategory in categories ? g.timeCategory : "blitz";
      categories[cat].total += 1;
      if (g.outcome === "win") categories[cat].wins += 1;
    }

    return Object.entries(categories).map(([name, stat]) => ({
      name,
      total: stat.total,
      wins: stat.wins,
      winRate: stat.total > 0 ? Math.round((stat.wins / stat.total) * 100) : 0,
    }));
  }, [data]);

  if (!data) {
    return (
      <div className="space-y-4">
        <div className="h-44 rounded-2xl bg-card border border-border animate-pulse" />
        <div className="h-64 rounded-2xl bg-card border border-border animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Banner & Overview */}
      <div className="rounded-2xl bg-card border border-border/80 p-5 sm:p-6 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <BookOpen className="size-5 text-primary" />
              <h2 className="text-lg sm:text-xl font-bold tracking-tight">Opening Repertoire & Analytics</h2>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Performance breakdown across openings, ECO classification, and interactive line training.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-primary/10 border border-primary/20 px-3.5 py-1.5 text-center">
              <div className="text-[10px] uppercase font-bold text-primary">Analyzed Games</div>
              <div className="text-sm sm:text-base font-black text-foreground">{stats.totalCount}</div>
            </div>
          </div>
        </div>

        {/* Time Control Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          {timeControlStats.map((tc) => (
            <div
              key={tc.name}
              className="p-3.5 rounded-xl bg-muted/40 border border-border/60 flex items-center justify-between"
            >
              <div>
                <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                  {tc.name}
                </span>
                <div className="text-sm sm:text-base font-black text-foreground mt-0.5">
                  {tc.winRate}% <span className="text-xs font-normal text-muted-foreground">Win Rate</span>
                </div>
              </div>
              <div className="text-xs font-semibold text-muted-foreground">
                {tc.total} games
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Opening Repertoires Grid: White & Black */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* As White */}
        <div className="rounded-2xl bg-card border border-border/80 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-border/60">
            <div className="flex items-center gap-2">
              <span className="size-3.5 rounded-full bg-white border border-zinc-400" />
              <h3 className="text-sm sm:text-base font-bold text-foreground">Openings as White</h3>
            </div>
            <span className="text-xs text-muted-foreground">{stats.white.length} Openings</span>
          </div>

          {stats.white.length === 0 ? (
            <p className="text-xs text-muted-foreground py-6 text-center">
              No games as White recorded yet.
            </p>
          ) : (
            <div className="space-y-3">
              {stats.white.slice(0, 6).map((op) => (
                <OpeningRow
                  key={op.fullName}
                  stat={op}
                  onDrill={() =>
                    setSelectedDrillOpening({
                      eco: op.eco,
                      name: op.name,
                      moves: op.moves,
                    })
                  }
                />
              ))}
            </div>
          )}
        </div>

        {/* As Black */}
        <div className="rounded-2xl bg-card border border-border/80 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-border/60">
            <div className="flex items-center gap-2">
              <span className="size-3.5 rounded-full bg-zinc-900 border border-zinc-600" />
              <h3 className="text-sm sm:text-base font-bold text-foreground">Openings as Black</h3>
            </div>
            <span className="text-xs text-muted-foreground">{stats.black.length} Openings</span>
          </div>

          {stats.black.length === 0 ? (
            <p className="text-xs text-muted-foreground py-6 text-center">
              No games as Black recorded yet.
            </p>
          ) : (
            <div className="space-y-3">
              {stats.black.slice(0, 6).map((op) => (
                <OpeningRow
                  key={op.fullName}
                  stat={op}
                  onDrill={() =>
                    setSelectedDrillOpening({
                      eco: op.eco,
                      name: op.name,
                      moves: op.moves,
                    })
                  }
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Interactive Opening Trainer Modal */}
      {selectedDrillOpening && (
        <OpeningDrillModal
          opening={selectedDrillOpening}
          onClose={() => setSelectedDrillOpening(null)}
        />
      )}
    </div>
  );
}

function OpeningRow({ stat, onDrill }: { stat: OpeningStat; onDrill: () => void }) {
  const winPercent = stat.total > 0 ? (stat.wins / stat.total) * 100 : 0;
  const drawPercent = stat.total > 0 ? (stat.draws / stat.total) * 100 : 0;
  const lossPercent = stat.total > 0 ? (stat.losses / stat.total) * 100 : 0;

  return (
    <div className="p-3.5 rounded-xl bg-muted/30 border border-border/60 space-y-2.5 hover:bg-muted/50 transition-colors">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="rounded-lg bg-primary/10 text-primary font-mono text-[10px] font-black px-2 py-0.5 shrink-0">
            {stat.eco}
          </span>
          <span className="text-xs sm:text-sm font-bold text-foreground truncate">
            {stat.fullName}
          </span>
        </div>

        <Button
          size="sm"
          variant="outline"
          onClick={onDrill}
          className="rounded-lg h-7 px-2.5 text-[11px] font-bold shrink-0 flex items-center gap-1"
        >
          <Play className="size-3 text-primary" />
          Drill
        </Button>
      </div>

      {/* Segmented win/draw/loss bar */}
      <div className="space-y-1">
        <div className="h-2 w-full rounded-full bg-muted overflow-hidden flex">
          <div
            style={{ width: `${winPercent}%` }}
            className="h-full bg-emerald-500 transition-all"
            title={`Wins: ${stat.wins} (${Math.round(winPercent)}%)`}
          />
          <div
            style={{ width: `${drawPercent}%` }}
            className="h-full bg-zinc-400 transition-all"
            title={`Draws: ${stat.draws} (${Math.round(drawPercent)}%)`}
          />
          <div
            style={{ width: `${lossPercent}%` }}
            className="h-full bg-rose-500 transition-all"
            title={`Losses: ${stat.losses} (${Math.round(lossPercent)}%)`}
          />
        </div>

        <div className="flex items-center justify-between text-[11px] text-muted-foreground font-medium">
          <span>
            <strong className="text-emerald-500">{stat.wins}W</strong> •{" "}
            <span className="text-muted-foreground">{stat.draws}D</span> •{" "}
            <strong className="text-rose-500">{stat.losses}L</strong> ({stat.total} games)
          </span>
          <span className="font-bold text-foreground">{stat.winRate}% Win</span>
        </div>
      </div>
    </div>
  );
}

/**
 * Interactive Opening Drill Trainer
 */
function OpeningDrillModal({
  opening,
  onClose,
}: {
  opening: OpeningDefinition;
  onClose: () => void;
}) {
  const [fen, setFen] = useState<string>("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
  const [plyIndex, setPlyIndex] = useState<number>(0);
  const [statusMessage, setStatusMessage] = useState<string>("Play the first book move!");
  const [selectedSquare, setSelectedSquare] = useState<SquareId | null>(null);
  const [lastMove, setLastMove] = useState<LastMove | null>(null);
  const [trackerState, setTrackerState] = useState<PieceTrackerState>(EMPTY_PIECE_TRACKER_STATE);

  const moves = opening.moves;
  const chess = useMemo(() => new Chess(), []);

  const reset = useCallback(() => {
    chess.reset();
    setFen(chess.fen());
    setPlyIndex(0);
    setStatusMessage("Play the first book move!");
    setSelectedSquare(null);
    setLastMove(null);
    const initial = derivePieces(EMPTY_PIECE_TRACKER_STATE, chess.fen(), 0, () => null);
    setTrackerState(initial);
  }, [chess]);

  const onSquareSelect = useCallback(
    (square: SquareId) => {
      if (plyIndex >= moves.length) return;

      if (!selectedSquare) {
        const piece = chess.get(square);
        if (piece && piece.color === chess.turn()) {
          setSelectedSquare(square);
        }
        return;
      }

      if (selectedSquare === square) {
        setSelectedSquare(null);
        return;
      }

      const targetPiece = chess.get(square);
      if (targetPiece && targetPiece.color === chess.turn()) {
        setSelectedSquare(square);
        return;
      }

      // Try move
      const expectedSan = moves[plyIndex];
      let moveResult;
      try {
        moveResult = chess.move({ from: selectedSquare, to: square });
      } catch {
        setSelectedSquare(null);
        return;
      }

      if (!moveResult) return;

      if (moveResult.san !== expectedSan) {
        chess.undo();
        setStatusMessage(`Not the book continuation. Expected: ${expectedSan}`);
        setSelectedSquare(null);
        return;
      }

      // Correct move!
      const newFen = chess.fen();
      setFen(newFen);
      setSelectedSquare(null);
      const nextPly = plyIndex + 1;
      setPlyIndex(nextPly);

      const moveObj: LastMove = {
        from: selectedSquare,
        to: square,
        san: moveResult.san,
        colour: moveResult.color as Colour,
      };
      setLastMove(moveObj);

      setTrackerState((prev) => derivePieces(prev, newFen, nextPly, () => moveObj));

      if (nextPly >= moves.length) {
        setStatusMessage("Repertoire line completed! Excellent memory!");
        return;
      }

      // Automated opponent response in line
      const oppExpected = moves[nextPly];
      if (oppExpected) {
        setStatusMessage("Opponent replying...");
        setTimeout(() => {
          const oppResult = chess.move(oppExpected);
          if (oppResult) {
            const oppFen = chess.fen();
            setFen(oppFen);
            const afterOpp = nextPly + 1;
            setPlyIndex(afterOpp);

            const oppObj: LastMove = {
              from: oppResult.from as SquareId,
              to: oppResult.to as SquareId,
              san: oppResult.san,
              colour: oppResult.color as Colour,
            };
            setLastMove(oppObj);
            setTrackerState((prev) => derivePieces(prev, oppFen, afterOpp, () => oppObj));

            if (afterOpp >= moves.length) {
              setStatusMessage("Repertoire line completed! Excellent memory!");
            } else {
              setStatusMessage("Your turn — keep playing the line!");
            }
          }
        }, 500);
      }
    },
    [chess, plyIndex, moves, selectedSquare],
  );

  const boardProps: BoardViewProps = {
    fen,
    position: trackerState.pieces,
    orientation: "w",
    turn: chess.turn() as Colour,
    interactive: plyIndex < moves.length,
    animate: true,
    selectedSquare,
    legalTargets: selectedSquare ? legalTargetsFor(fen, selectedSquare) : [],
    lastMove,
    checkSquare: checkSquareOf(fen),
    captured: { w: [], b: [] },
    promotion: null,
    reviewPly: null,
    onSquareSelect,
    onMove: () => {},
    onPromotionChoice: () => {},
    onDeselect: () => setSelectedSquare(null),
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-lg rounded-2xl bg-card border border-border p-6 shadow-2xl space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-lg bg-primary/10 text-primary font-mono text-xs font-black px-2 py-0.5">
                {opening.eco}
              </span>
              <h3 className="text-base sm:text-lg font-black">{opening.name}</h3>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Line: {opening.moves.join(" ")}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Board Surface */}
        <div className="w-full aspect-square rounded-xl overflow-hidden border border-border/80 relative">
          <BoardSurface {...boardProps} />
        </div>

        {/* Status Message */}
        <div className="flex items-center justify-between text-xs bg-muted/60 px-3.5 py-2.5 rounded-xl border border-border/60">
          <div className="flex items-center gap-2 font-semibold">
            {plyIndex >= moves.length ? (
              <CheckCircle2 className="size-4 text-emerald-500" />
            ) : (
              <Sparkles className="size-4 text-primary" />
            )}
            <span>{statusMessage}</span>
          </div>
          <span className="font-bold text-muted-foreground">
            {plyIndex} / {moves.length}
          </span>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-end gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={reset} className="rounded-xl text-xs font-bold">
            <RotateCcw className="size-3.5 mr-1" />
            Restart Drill
          </Button>
          <Button size="sm" onClick={onClose} className="rounded-xl text-xs font-bold">
            Done
          </Button>
        </div>
      </div>
    </div>
  );
}
