"use client";
// src/components/game/game-result-dialog.tsx  [P3 → rebuilt U2 → UI_UPGRADE_2 §4.5 / §4.8 item 4]
// The verdict, said once. A Fraunces headline, one result line, one rating line
// in mono, and the three ways out in a single row.
//
// What this round removed: the inner box (a card inside a dialog is a nested
// card), and the badge cluster that restated in three chips what the sentence
// above it had already said. Initial focus lands on "Play again"; the page
// behind is inert while the dialog is open (Base UI's modal dialog does that).
//
// The delta and the take-back line stay EXCLUSIVE: a game with take-backs is
// unrated (FR-43), so it gets the sentence and no number.
//
// PURE: the rating row and the rematch mutation are fed in by `GameShell`, so
// /dev/game can open this dialog with no Convex at all.
import { useRef, useState } from "react";
import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Coins, Eye, Flag, Handshake, Trophy } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Display } from "@/components/ui-kit";
import { formatEndReason, formatGameResult, formatRatingDelta, outcomeFor } from "@/lib/format";
import { cn } from "@/lib/ui";
import type { Colour, GameView } from "@/lib/types";

export interface GameResultDialogProps {
  view: GameView;
  /** The viewer's seat; null for spectators (they get a link, not a rematch). */
  seat: Colour | "both" | null;
  /** The viewer's rating change for this game, when there was one (FR-49). */
  rating: { delta: number; after: number } | null;
  /** True while the rematch mutation is in flight. */
  playAgainPending?: boolean;
  onPlayAgain(): void;
  /** Where "Back to lobby" goes. */
  lobbyHref?: string;
  isOpen?: boolean;
  onClose?(): void;
}

function headlineFor(view: GameView, seat: Colour | "both" | null): string {
  const { game } = view;
  const myColour: Colour | null = seat === "both" || seat === null ? null : seat;
  const outcome = outcomeFor(game.status, game.winner, myColour);
  if (outcome === "loss" && game.status === "resigned") return "You resigned";
  if (outcome === "win") return "Victory!";
  if (outcome === "loss") return "Defeat";
  if (game.winner === "draw") return "Draw";
  return "Game over";
}

function descriptionFor(
  view: GameView,
  seat: Colour | "both" | null,
  outcome: "win" | "loss" | "draw" | "ongoing"
): string {
  const { game } = view;
  const isWinner = outcome === "win";
  const isLoss = outcome === "loss";
  const seated = seat !== null && seat !== "both";

  if (game.status === "abandoned") {
    if (seated) {
      if (isWinner) return "Time forfeit · Your opponent ran out of time to make a move.";
      if (isLoss) return "Time forfeit · You ran out of time to make a move.";
      return "Draw · Both players timed out or left the match.";
    }
    return `Game over · ${game.winner === "draw" ? "Both players timed out." : `${game.winner === "w" ? view.whiteName : view.blackName} won on time forfeit.`}`;
  }

  if (game.status === "resigned") {
    if (seated) {
      if (isWinner) return "Resignation · Your opponent resigned the match.";
      if (isLoss) return "Resignation · You resigned the match.";
    }
    return `Game over · ${game.winner === "w" ? view.blackName : view.whiteName} resigned.`;
  }

  if (game.status === "checkmate" || game.endReason === "checkmate") {
    if (seated) {
      if (isWinner) return "Checkmate · You delivered checkmate!";
      if (isLoss) return "Checkmate · Your opponent delivered checkmate.";
    }
    return `Checkmate · ${game.winner === "w" ? view.whiteName : view.blackName} won by checkmate.`;
  }

  if (game.winner === "draw" || game.status === "draw" || game.status === "stalemate") {
    const reasonText = game.endReason ? formatEndReason(game.endReason).replace(/^by /, "") : "agreement";
    return `Draw · ${reasonText[0]?.toUpperCase()}${reasonText.slice(1)}.`;
  }

  return formatGameResult(game.status, game.winner, game.endReason, {
    whiteName: view.whiteName,
    blackName: view.blackName,
  });
}

/** The host says small numbers as words: "no take-back", not "0 take-back". */
const NUMBER_WORDS = [
  "no",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
];

function spellCount(n: number): string {
  return NUMBER_WORDS[n] ?? String(n);
}

export function GameResultDialog({
  view,
  seat,
  rating,
  playAgainPending = false,
  onPlayAgain,
  lobbyHref = "/play",
  isOpen,
  onClose,
}: GameResultDialogProps) {
  const { game } = view;
  const finished = game.status !== "active" && game.status !== "waiting";
  const [dismissedFor, setDismissedFor] = useState<string | null>(null);
  const playAgainRef = useRef<HTMLButtonElement | null>(null);
  const dismissKey = `${game._id}:${game.status}:${game.endedAt ?? 0}`;
  const open = isOpen !== undefined ? isOpen : (finished && dismissedFor !== dismissKey);

  const myColour: Colour | null = seat === "both" || seat === null ? null : seat;
  const outcome = outcomeFor(game.status, game.winner, myColour);
  const isWinner = outcome === "win";
  const isLoss = outcome === "loss";
  const isDraw = game.winner === "draw";

  const takeBacks = game.undoCount;
  const seated = myColour !== null;
  const myRating =
    myColour === null ? null : (view[myColour === "w" ? "white" : "black"]?.rating ?? null);
  const verb = !seated ? "Played" : outcome === "win" ? "Won" : outcome === "loss" ? "Lost" : "Drew";

  const takeBackLine =
    takeBacks === 0
      ? null
      : {
          text:
            `${verb} with ${spellCount(takeBacks)} take-back${takeBacks === 1 ? "" : "s"}` +
            (!seated ? "." : ", so the rating stays put"),
          rating: seated && myRating !== null ? myRating : null,
        };

  const ratingLine =
    takeBacks > 0
      ? null
      : rating !== null
        ? {
            text: `Rating ${rating.after - rating.delta} → ${rating.after}`,
            delta: formatRatingDelta(rating.delta),
            up: rating.delta >= 0,
          }
        : null;

  return (
    <Dialog
      open={open}
      modal
      onOpenChange={(next) => {
        if (!next) {
          setDismissedFor(dismissKey);
          onClose?.();
        }
      }}
    >
      <DialogContent
        className="gap-4 sm:max-w-md rounded-3xl border border-border/80 bg-card/95 backdrop-blur-2xl shadow-2xl p-6"
        initialFocus={seat === null ? true : playAgainRef}
      >
        <DialogHeader className="flex flex-col items-center text-center gap-2 pb-1">
          <div
            className={cn(
              "size-14 rounded-2xl flex items-center justify-center border shadow-md transition-transform",
              isWinner
                ? "bg-emerald-500/15 border-emerald-500/35 text-emerald-400 shadow-[0_0_24px_rgba(16,185,129,0.25)]"
                : isLoss
                  ? "bg-destructive/15 border-destructive/35 text-destructive shadow-[0_0_24px_rgba(239,68,68,0.2)]"
                  : "bg-primary/15 border-primary/35 text-primary shadow-[0_0_24px_rgba(217,119,6,0.2)]"
            )}
          >
            {isWinner ? (
              <Trophy className="size-7" />
            ) : isLoss ? (
              <Flag className="size-7" />
            ) : (
              <Handshake className="size-7" />
            )}
          </div>
          <DialogTitle>
            <Display level={4} as="span" className="block text-2xl font-bold tracking-tight">
              {headlineFor(view, seat)}
            </Display>
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground max-w-xs mx-auto">
            {descriptionFor(view, seat, outcome)}
          </DialogDescription>
        </DialogHeader>

        {/* Staked ETB prize display */}
        {game.payout && game.payout > 0 && isWinner ? (
          <div className="flex items-center justify-center gap-2 rounded-xl bg-amber-500/15 border border-amber-500/35 py-2 px-3 text-amber-300 font-mono text-sm font-bold shadow-xs">
            <Coins className="size-4 text-amber-400 shrink-0" />
            <span>Prize: +{game.payout} ETB Credited to Wallet</span>
          </div>
        ) : null}

        {ratingLine ? (
          <p className="tabular font-mono text-[13px] text-muted-foreground">
            {ratingLine.text}{" "}
            <span
              className={cn("font-medium", ratingLine.up ? "text-primary" : "text-destructive")}
            >
              {ratingLine.delta}
            </span>
          </p>
        ) : takeBackLine ? (
          <p className="tabular font-mono text-[13px] text-muted-foreground">
            {takeBackLine.text}
            {takeBackLine.rating === null ? null : (
              <>
                {" — "}
                <span className="font-medium text-foreground">{takeBackLine.rating}</span>
              </>
            )}
          </p>
        ) : (
          <p className="text-[13px] text-muted-foreground">
            {game.rated ? "This game counted toward your rating." : "This game was unrated."}
          </p>
        )}

        {/* Spectator statistics for finished matches */}
        {(game.mode === "online" || (game.spectatorCount ?? 0) > 0) && (
          <div className="flex items-center gap-2 text-[12px] text-muted-foreground bg-muted/40 px-3 py-1.5 rounded-xl border border-border/50">
            <Eye className="size-3.5 text-primary shrink-0" />
            <span>
              Spectators: <strong className="text-foreground">{game.peakSpectators ?? game.spectatorCount ?? 0}</strong> watched live · <strong className="text-foreground">{game.totalViews ?? Math.max(game.spectatorCount ?? 0, 1)}</strong> total views
            </span>
          </div>
        )}

        {/* One order at both widths: the shadcn footer reverses its column on
            mobile, which turned "Review game … Back to lobby, Play again" into
            "Back to lobby, Play again … Review game" on a phone. */}
        <DialogFooter className="flex-row flex-wrap items-center sm:justify-between">
          <Button variant="ghost" onClick={() => setDismissedFor(dismissKey)}>
            Review game
          </Button>
          <div className="flex flex-wrap gap-2">
            <Link
              prefetch={false}
              href={lobbyHref}
              // Ghost, not outline: a bordered, filled control inside a dialog is a
              // card inside a card, and this row already has its one brass action.
              className={buttonVariants({ variant: "ghost" })}
            >
              Back to lobby
            </Link>
            {seat === null ? null : (
              <Button
                ref={playAgainRef}
                // The brass fill is its own edge inside a dialog, so it drops the
                // shared Button's 1px transparent border.
                className="border-0"
                disabled={playAgainPending}
                onClick={onPlayAgain}
              >
                Play again
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
