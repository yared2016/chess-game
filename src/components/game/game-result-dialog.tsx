"use client";
// src/components/game/game-result-dialog.tsx
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ArrowRightLeft,
  Check,
  Clock,
  Coins,
  Eye,
  Flag,
  Handshake,
  Loader2,
  RotateCw,
  Swords,
  Trophy,
  X,
  BarChart3,
  ShieldAlert,
  MessageSquarePlus,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Display } from "@/components/ui-kit";
import { Input } from "@/components/ui/input";
import { TimeControlPicker, POPULAR_TIME_CONTROLS } from "@/components/play/time-control-picker";
import { GameReviewPanel } from "@/components/analysis/game-review-panel";
import { FairPlayReportModal } from "@/components/game/fair-play-report-modal";
import { formatEndReason, formatGameResult, formatRatingDelta, outcomeFor } from "@/lib/format";
import { cn } from "@/lib/ui";
import { toast } from "sonner";
import { api } from "../../../convex/_generated/api";
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

  if (game.status === "checkmate" || game.endReason === "checkmate") {
    return outcome === "win" ? "Checkmate · Victory!" : outcome === "loss" ? "Checkmate · Defeat" : "Checkmate";
  }
  if (game.status === "resigned" || game.endReason === "resignation") {
    return outcome === "loss" ? "Resigned" : "Opponent Resigned";
  }
  if (game.endReason === "timeout") {
    return outcome === "loss" ? "Lost on time" : "Opponent lost on time";
  }
  if (game.status === "abandoned" || game.endReason === "abandonment") {
    return outcome === "loss" ? "Forfeited" : "Opponent forfeited";
  }
  if (game.winner === "draw" || game.status === "draw" || game.status === "stalemate") {
    return "Draw";
  }
  if (outcome === "win") return "Victory!";
  if (outcome === "loss") return "Defeat";
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

  if (game.endReason === "timeout") {
    if (seated) {
      if (isWinner) return "Lost on time · Your opponent ran out of time.";
      if (isLoss) return "Lost on time · You ran out of time.";
      return "Draw · Time expired with insufficient material.";
    }
    return `Lost on time · ${game.winner === "w" ? view.whiteName : view.blackName} won on time.`;
  }

  if (game.status === "abandoned" || game.endReason === "abandonment") {
    if (seated) {
      if (isWinner) return "Forfeited · Your opponent timed out or left the match.";
      if (isLoss) return "Forfeited · You timed out or left the match.";
      return "Draw · Both players timed out or left the match.";
    }
    return `Forfeited · ${game.winner === "draw" ? "Both players timed out." : `${game.winner === "w" ? view.whiteName : view.blackName} won by forfeit.`}`;
  }

  if (game.status === "resigned" || game.endReason === "resignation") {
    if (seated) {
      if (isWinner) return "Resigned · Your opponent resigned the match.";
      if (isLoss) return "Resigned · You resigned the match.";
    }
    return `Resigned · ${game.winner === "w" ? view.blackName : view.whiteName} resigned.`;
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

function tcLabel(key?: string): string {
  if (!key) return "5+0 Blitz";
  const found = POPULAR_TIME_CONTROLS.find((tc) => tc.key === key);
  return found ? found.sublabel : key;
}

/**
 * Online multiplayer Rematch Panel.
 * Handles proposing with custom time control + custom ETB stake,
 * receiving and accepting/declining proposals, and automatic navigation
 * upon acceptance with strictly alternated colors.
 */
function OnlineRematchPanel({
  game,
  view,
  seat,
}: {
  game: GameView["game"];
  view: GameView;
  seat: Colour;
}) {
  const router = useRouter();
  const rematch = useQuery(api.challenges.getRematchForGame, { gameId: game._id });
  const balance = useQuery(api.wallets.getBalance, {});
  const requestRematch = useMutation(api.challenges.requestRematch);
  const respondRematch = useMutation(api.challenges.respond);
  const cancelChallenge = useMutation(api.challenges.cancel);

  // Strict alternation: previous White plays Black, previous Black plays White
  const nextColor: Colour = seat === "w" ? "b" : "w";
  const opponentId = seat === "w" ? view.black?._id : view.white?._id;
  const opponentName = seat === "w" ? view.blackName : view.whiteName;

  const defaultTc = game.timeControlKey ?? "blitz_5_0";
  const defaultStake = game.stake ?? 0;

  const [selectedTc, setSelectedTc] = useState(defaultTc);
  const [selectedStake, setSelectedStake] = useState(defaultStake);
  const [customStakeInput, setCustomStakeInput] = useState(defaultStake >= 10 ? String(defaultStake) : "20");
  const [isCustomStake, setIsCustomStake] = useState(false);
  const [isCustomizing, setIsCustomizing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [forceShowOffer, setForceShowOffer] = useState(false);

  // Auto-redirect both players when rematch is accepted
  useEffect(() => {
    if (rematch?.status === "accepted" && rematch.gameId) {
      toast.success("⚔️ Rematch accepted! Starting new game...");
      router.push(`/game/${rematch.gameId}`);
    }
  }, [rematch?.status, rematch?.gameId, router]);

  const availableBal = balance?.available ?? 0;
  const effectiveStake = isCustomStake ? (parseInt(customStakeInput, 10) || 0) : selectedStake;
  const isInsufficient = effectiveStake > 0 && availableBal < effectiveStake;

  const handleOfferRematch = async () => {
    if (!opponentId) {
      toast.error("Opponent unavailable for rematch.");
      return;
    }
    if (isInsufficient) {
      toast.error(`Insufficient balance. You need ${effectiveStake} ETB, but only have ${availableBal} ETB available.`);
      return;
    }
    setSubmitting(true);
    try {
      await requestRematch({
        parentGameId: game._id,
        timeControlKey: selectedTc,
        stake: effectiveStake > 0 ? effectiveStake : undefined,
      });
      toast.success(`Rematch offer sent to ${opponentName}!`);
      setForceShowOffer(false);
    } catch (err: any) {
      toast.error(err?.message || "Could not send rematch offer.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRespond = async (accept: boolean) => {
    if (!rematch) return;
    if (accept && rematch.stake > 0 && availableBal < rematch.stake) {
      toast.error(`Insufficient balance to accept this rematch. You need ${rematch.stake} ETB.`);
      return;
    }
    setSubmitting(true);
    try {
      await respondRematch({
        challengeId: rematch._id,
        accept,
      });
      if (accept) {
        toast.success("Rematch accepted! Preparing board...");
      } else {
        toast.info("Rematch declined.");
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to respond to rematch.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async () => {
    if (!rematch) return;
    setSubmitting(true);
    try {
      await cancelChallenge({ challengeId: rematch._id });
      toast.info("Rematch offer cancelled.");
      setForceShowOffer(true);
    } catch (err: any) {
      toast.error(err?.message || "Could not cancel rematch.");
    } finally {
      setSubmitting(false);
    }
  };

  // 1. Pending: Current user sent the challenge
  if (rematch && rematch.status === "pending" && rematch.isSender) {
    return (
      <div className="rounded-2xl border border-primary/40 bg-primary/5 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Loader2 className="size-4 animate-spin text-primary" />
            <span className="text-sm font-bold text-foreground">Rematch Offered</span>
          </div>
          <span className="text-[11px] font-mono font-medium px-2 py-0.5 rounded-full bg-primary/20 text-primary">
            Waiting for response
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          Waiting for <strong className="text-foreground">{rematch.toUsername}</strong> to accept your rematch offer.
        </p>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="inline-flex items-center gap-1 font-mono bg-background/80 px-2 py-1 rounded-lg border">
            <Clock className="size-3 text-muted-foreground" />
            {tcLabel(rematch.timeControlKey)}
          </span>
          <span className="inline-flex items-center gap-1 font-mono bg-background/80 px-2 py-1 rounded-lg border text-amber-400">
            <Coins className="size-3 text-amber-500" />
            {rematch.stake > 0 ? `${rematch.stake} ETB Stake` : "Casual (0 ETB)"}
          </span>
          <span className="inline-flex items-center gap-1 font-semibold bg-background/80 px-2 py-1 rounded-lg border text-foreground">
            <ArrowRightLeft className="size-3 text-primary" />
            You will play {rematch.viewerColor === "w" ? "White ♔" : "Black ♚"}
          </span>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={submitting}
          onClick={handleCancel}
          className="w-full text-xs text-muted-foreground hover:text-destructive hover:border-destructive/40"
        >
          {submitting ? <Loader2 className="size-3.5 animate-spin mr-1.5" /> : <X className="size-3.5 mr-1.5" />}
          Cancel Rematch Offer
        </Button>
      </div>
    );
  }

  // 2. Pending: Current user received the challenge from opponent
  if (rematch && rematch.status === "pending" && !rematch.isSender) {
    const isAcceptInsufficient = rematch.stake > 0 && availableBal < rematch.stake;
    return (
      <div className="rounded-2xl border-2 border-primary bg-primary/10 p-4 space-y-3 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Swords className="size-4 text-primary" />
            <span className="text-sm font-bold text-foreground">Rematch Challenge!</span>
          </div>
          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-primary text-primary-foreground animate-pulse">
            Action Required
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          <strong className="text-foreground">{rematch.fromUsername}</strong> proposed a rematch:
        </p>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="inline-flex items-center gap-1 font-mono font-bold bg-background/90 px-2.5 py-1 rounded-lg border">
            <Clock className="size-3.5 text-primary" />
            {tcLabel(rematch.timeControlKey)}
          </span>
          <span className="inline-flex items-center gap-1 font-mono font-bold bg-background/90 px-2.5 py-1 rounded-lg border text-amber-400">
            <Coins className="size-3.5 text-amber-500" />
            {rematch.stake > 0 ? `${rematch.stake} ETB Stake` : "Casual (0 ETB)"}
          </span>
          <span className="inline-flex items-center gap-1 font-bold bg-background/90 px-2.5 py-1 rounded-lg border text-foreground">
            <ArrowRightLeft className="size-3.5 text-primary" />
            You play {rematch.viewerColor === "w" ? "White ♔" : "Black ♚"}
          </span>
        </div>
        {rematch.stake > 0 && (
          <div className="rounded-lg bg-amber-500/10 border border-amber-500/25 p-2 text-[11px] text-amber-300">
            💰 Winner takes {Math.round(rematch.stake * 2 * 0.9)} ETB (10% rake). Available balance: {availableBal} ETB.
          </div>
        )}
        {isAcceptInsufficient && (
          <p className="text-xs text-destructive font-medium">
            ⚠️ You need at least {rematch.stake} ETB in your wallet to accept this rematch.
          </p>
        )}
        <div className="flex items-center gap-2 pt-1">
          <Button
            className="flex-1 font-bold h-9"
            disabled={submitting || isAcceptInsufficient}
            onClick={() => handleRespond(true)}
          >
            {submitting ? <Loader2 className="size-4 animate-spin mr-1.5" /> : <Check className="size-4 mr-1.5" />}
            Accept Rematch
          </Button>
          <Button
            variant="outline"
            className="h-9 text-muted-foreground hover:text-destructive hover:border-destructive/40"
            disabled={submitting}
            onClick={() => handleRespond(false)}
          >
            <X className="size-4 mr-1" />
            Decline
          </Button>
        </div>
      </div>
    );
  }

  // 3. Declined or Cancelled recently (within 30s)
  if (rematch && (rematch.status === "declined" || rematch.status === "cancelled") && !forceShowOffer) {
    return (
      <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-3.5 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="font-semibold text-destructive">
            {rematch.status === "cancelled"
              ? "Rematch offer cancelled."
              : rematch.isSender
                ? `${rematch.toUsername} declined the rematch.`
                : "You declined the rematch."}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 px-3 rounded-xl text-xs font-bold text-foreground hover:bg-muted shadow-xs transition-all"
            onClick={() => {
              setForceShowOffer(true);
              setIsCustomizing(true);
            }}
          >
            Offer New Rematch
          </Button>
        </div>
      </div>
    );
  }

  // 4. Default: Configurable Rematch Offer
  return (
    <div className="rounded-2xl border border-border/80 bg-muted/20 p-3.5 sm:p-4 space-y-3 w-full">
      <div className="flex flex-wrap items-center justify-between gap-1.5">
        <div className="flex items-center gap-1.5 font-bold text-sm text-foreground">
          <Swords className="size-4 text-primary" />
          <span>Rematch</span>
        </div>
        <span className="text-[10px] sm:text-[11px] font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 flex items-center gap-1 shrink-0">
          <ArrowRightLeft className="size-3" />
          You play {nextColor === "w" ? "White ♔" : "Black ♚"}
        </span>
      </div>

      {/* Compact summary / toggle */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-card/60 rounded-xl p-2.5 border border-border/60 text-xs w-full">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-mono font-bold text-foreground truncate">{tcLabel(selectedTc)}</span>
          <span className="text-muted-foreground">·</span>
          <span className={cn("font-mono font-bold truncate", effectiveStake > 0 ? "text-amber-400" : "text-muted-foreground")}>
            {effectiveStake > 0 ? `${effectiveStake} ETB Stake` : "Casual (Free)"}
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs text-primary font-semibold hover:bg-primary/10 px-2 shrink-0"
          onClick={() => setIsCustomizing(!isCustomizing)}
        >
          {isCustomizing ? "Close options" : "Customize"}
        </Button>
      </div>

      {/* Expanded customization pane */}
      {isCustomizing && (
        <div className="space-y-3 pt-1 border-t border-border/40 animate-in fade-in-50 duration-150 w-full">
          <TimeControlPicker
            selectedKey={selectedTc}
            onChange={(tc) => setSelectedTc(tc)}
            disabled={submitting}
          />

          {/* Stake picker */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-muted-foreground">Stake (ETB)</span>
              <span className="text-[11px] font-mono text-muted-foreground">
                Available: <strong className="text-foreground">{availableBal} ETB</strong>
              </span>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
              {[0, 10, 25, 50, 100].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    setIsCustomStake(false);
                    setSelectedStake(s);
                  }}
                  className={cn(
                    "py-1.5 rounded-lg border text-xs font-mono font-bold transition-all",
                    !isCustomStake && selectedStake === s
                      ? "bg-primary text-primary-foreground border-primary shadow-xs"
                      : "bg-card/60 text-muted-foreground hover:text-foreground border-border/60"
                  )}
                >
                  {s === 0 ? "Free" : s}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setIsCustomStake(true)}
                className={cn(
                  "py-1.5 rounded-lg border text-xs font-bold transition-all",
                  isCustomStake
                    ? "bg-primary text-primary-foreground border-primary shadow-xs"
                    : "bg-card/60 text-muted-foreground hover:text-foreground border-border/60"
                )}
              >
                Custom
              </button>
            </div>

            {isCustomStake && (
              <div className="pt-1">
                <Input
                  type="number"
                  min="10"
                  step="5"
                  placeholder="Custom stake (min 10 ETB)"
                  value={customStakeInput}
                  onChange={(e) => setCustomStakeInput(e.target.value)}
                  className="h-8 text-xs font-mono"
                />
              </div>
            )}

            {effectiveStake > 0 && (
              <p className="text-[11px] text-amber-400 font-mono">
                💰 Winner payout: {Math.round(effectiveStake * 2 * 0.9)} ETB (10% platform rake)
              </p>
            )}
          </div>
        </div>
      )}

      {isInsufficient && (
        <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-2.5 text-xs text-destructive flex items-center justify-between gap-2">
          <span>⚠️ Need {effectiveStake} ETB (Have: {availableBal} ETB).</span>
          <button
            type="button"
            onClick={() => {
              setSelectedStake(0);
              setIsCustomStake(false);
            }}
            className="underline font-bold text-primary hover:text-primary/80 shrink-0"
          >
            Play Free (0 ETB)
          </button>
        </div>
      )}

      <Button
        className="w-full font-bold h-10 rounded-xl shadow-xs"
        disabled={submitting || isInsufficient || (isCustomStake && effectiveStake < 10)}
        onClick={handleOfferRematch}
      >
        {submitting ? (
          <Loader2 className="size-4 animate-spin mr-1.5" />
        ) : (
          <Swords className="size-4 mr-1.5" />
        )}
        Send Rematch Offer ({effectiveStake > 0 ? `${effectiveStake} ETB` : "Free"})
      </Button>
    </div>
  );
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
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const playAgainRef = useRef<HTMLButtonElement | null>(null);
  const dismissKey = `${game._id}:${game.status}:${game.endedAt ?? 0}`;
  const open = isOpen !== undefined ? isOpen : (finished && dismissedFor !== dismissKey);

  const myColour: Colour | null = seat === "both" || seat === null ? null : seat;
  const opponentColour: Colour | null = myColour === "w" ? "b" : myColour === "b" ? "w" : null;
  const opponent = opponentColour ? view[opponentColour === "w" ? "white" : "black"] : null;
  const outcome = outcomeFor(game.status, game.winner, myColour);
  const isWinner = outcome === "win";
  const isLoss = outcome === "loss";

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

  const handleBoardReview = () => {
    setDismissedFor(dismissKey);
    onClose?.();
  };

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
        className={cn(
          "w-full max-w-[calc(100%-1.5rem)] rounded-3xl border border-border/80 bg-card/95 backdrop-blur-2xl shadow-2xl p-4 sm:p-6 max-h-[90vh] overflow-y-auto overflow-x-hidden transition-all duration-200",
          showAnalysis ? "sm:max-w-2xl" : "sm:max-w-md"
        )}
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
          <div className="flex flex-wrap items-center justify-center gap-2 rounded-2xl bg-amber-500/15 border border-amber-500/35 py-2.5 px-3 text-amber-300 font-mono text-xs sm:text-sm font-bold shadow-xs text-center w-full">
            <Coins className="size-4 text-amber-400 shrink-0" />
            <span>Prize: +{game.payout} ETB Credited to Wallet</span>
          </div>
        ) : null}

        {ratingLine ? (
          <p className="tabular font-mono text-[13px] text-muted-foreground text-center">
            {ratingLine.text}{" "}
            <span
              className={cn("font-medium", ratingLine.up ? "text-primary" : "text-destructive")}
            >
              {ratingLine.delta}
            </span>
          </p>
        ) : takeBackLine ? (
          <p className="tabular font-mono text-[13px] text-muted-foreground text-center">
            {takeBackLine.text}
            {takeBackLine.rating === null ? null : (
              <>
                {" — "}
                <span className="font-medium text-foreground">{takeBackLine.rating}</span>
              </>
            )}
          </p>
        ) : (
          <p className="text-[13px] text-muted-foreground text-center">
            {game.rated ? "This game counted toward your rating." : "This game was unrated."}
          </p>
        )}

        {/* Spectator statistics for finished matches */}
        {(game.mode === "online" || (game.spectatorCount ?? 0) > 0) && (
          <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 text-[11px] sm:text-[12px] text-muted-foreground bg-muted/40 px-3 py-1.5 rounded-xl border border-border/50 text-center w-full">
            <Eye className="size-3.5 text-primary shrink-0" />
            <span>
              Spectators: <strong className="text-foreground">{game.peakSpectators ?? game.spectatorCount ?? 0}</strong> watched live · <strong className="text-foreground">{game.totalViews ?? Math.max(game.spectatorCount ?? 0, 1)}</strong> total views
            </span>
          </div>
        )}

        {/* Rematch Section */}
        {game.mode === "online" && seated ? (
          <OnlineRematchPanel game={game} view={view} seat={myColour} />
        ) : game.mode === "ai" && seated ? (
          <Button
            ref={playAgainRef}
            className="w-full font-bold h-11 rounded-2xl border-0 shadow-sm"
            disabled={playAgainPending}
            onClick={onPlayAgain}
          >
            <ArrowRightLeft className="size-4 mr-2" />
            Rematch vs Computer (Play as {myColour === "w" ? "Black ♚" : "White ♔"})
          </Button>
        ) : game.mode === "local" ? (
          <Button
            ref={playAgainRef}
            className="w-full font-bold h-11 rounded-2xl border-0 shadow-sm"
            disabled={playAgainPending}
            onClick={onPlayAgain}
          >
            <RotateCw className="size-4 mr-2" />
            New Local Game
          </Button>
        ) : null}

        {/* Game Evaluation & Accuracy Analysis Section */}
        {showAnalysis && (
          <div className="pt-2 animate-in fade-in zoom-in-95 w-full">
            <GameReviewPanel
              pgn={game.pgn}
              moves={game.moves}
              whitePlayerName={view.whiteName}
              blackPlayerName={view.blackName}
            />
          </div>
        )}

        {/* Post-game actions toolbar */}
        <div className="pt-2 border-t border-border/60 space-y-2.5 w-full">
          {/* Main Action Buttons: Analyze Game & Board Review */}
          <div className="grid grid-cols-2 gap-2.5 w-full">
            <Button
              variant={showAnalysis ? "default" : "outline"}
              size="sm"
              onClick={() => setShowAnalysis(!showAnalysis)}
              className={cn(
                "h-10 text-xs font-bold gap-2 rounded-2xl justify-center w-full shadow-xs transition-all",
                showAnalysis ? "bg-primary text-primary-foreground" : "hover:bg-muted"
              )}
            >
              <BarChart3 className="size-4" />
              <span>{showAnalysis ? "Hide Analysis" : "Analyze Game"}</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleBoardReview}
              className="h-10 text-xs font-bold gap-2 rounded-2xl justify-center w-full hover:bg-muted transition-all"
            >
              <Eye className="size-4 text-primary" />
              <span>Board Review</span>
            </Button>
          </div>

          {/* Secondary Utilities & Lobby Navigation */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5 w-full">
            <div className="flex items-center gap-1.5 sm:gap-2">
              {game.mode === "online" && seated && opponent && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowReportModal(true)}
                  className="h-8 px-2.5 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 gap-1.5 rounded-xl transition-colors"
                  title={`Report ${opponent.username} for Fair Play violations`}
                >
                  <ShieldAlert className="size-3.5" />
                  <span className="hidden sm:inline">Report Opponent</span>
                  <span className="sm:hidden">Report</span>
                </Button>
              )}

              <Link
                href={`/feedback?gameId=${game._id}${opponent ? `&opponent=${encodeURIComponent(opponent.username)}` : ""}`}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonVariants({
                  variant: "ghost",
                  size: "sm",
                  className: "h-8 px-2.5 text-xs text-muted-foreground hover:text-primary hover:bg-primary/10 gap-1.5 rounded-xl transition-colors",
                })}
                title="Share feedback on this game"
              >
                <MessageSquarePlus className="size-3.5 text-primary" />
                <span>Feedback</span>
              </Link>
            </div>

            <Link
              prefetch={false}
              href={lobbyHref}
              onClick={() => {
                setDismissedFor(dismissKey);
                onClose?.();
              }}
              className={buttonVariants({
                variant: "ghost",
                size: "sm",
                className: "h-8 px-3 text-xs font-semibold text-foreground hover:bg-muted rounded-xl transition-colors shrink-0",
              })}
            >
              Back to lobby
            </Link>
          </div>
        </div>
      </DialogContent>
      {showReportModal && opponent && (
        <FairPlayReportModal
          isOpen={showReportModal}
          onClose={() => setShowReportModal(false)}
          gameId={game._id}
          reportedPlayerId={opponent._id}
          reportedUsername={opponent.username}
        />
      )}
    </Dialog>
  );
}
