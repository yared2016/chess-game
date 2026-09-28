"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import {
  Swords,
  Users,
  Trophy,
  Wallet,
  UserCheck,
  Layout,
  Lightbulb,
  AlertCircle,
  MessageSquare,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Loader2,
  Send,
  Gamepad2,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { describeConvexError } from "@/lib/errors";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { FileUploader } from "./file-uploader";
import { cn } from "@/lib/ui";

export type FeedbackCategory =
  | "chess_game"
  | "matchmaking"
  | "tournaments"
  | "wallet_payments"
  | "account_profile"
  | "website_app"
  | "feature_request"
  | "report_problem"
  | "general_feedback";

export interface FeedbackFormProps {
  initialContext?: {
    gameId?: string;
    matchId?: string;
    tournamentId?: string;
    opponentUsername?: string;
  };
  onSuccess?: (feedbackId: string) => void;
  onViewHistory?: () => void;
}

interface CategoryOption {
  id: FeedbackCategory;
  label: string;
  icon: typeof Swords;
  helper: string;
  placeholder: string;
}

export const CATEGORIES: CategoryOption[] = [
  {
    id: "chess_game",
    label: "Chess Game & Board",
    icon: Swords,
    helper: "Tell us about the 3D/2D board, pieces, move notation, clock, or game rules.",
    placeholder: "Describe the move, piece, or board behavior you observed...",
  },
  {
    id: "matchmaking",
    label: "Matchmaking & Queue",
    icon: Users,
    helper: "Feedback regarding queue speed, Elo fairness, or opponent connections.",
    placeholder: "How was your matchmaking experience or opponent pairing?",
  },
  {
    id: "tournaments",
    label: "Tournaments & Arenas",
    icon: Trophy,
    helper: "Feedback about arena pacing, leaderboard standings, or prize pools.",
    placeholder: "Tell us about your tournament experience...",
  },
  {
    id: "wallet_payments",
    label: "Wallet & Payments",
    icon: Wallet,
    helper: "Assistance or inquiries regarding ETB deposits, withdrawals, or receipts.",
    placeholder: "Include transaction references or details about the payment issue...",
  },
  {
    id: "account_profile",
    label: "Account & Profile",
    icon: UserCheck,
    helper: "Ratings, avatars, account security, or settings adjustments.",
    placeholder: "What would you like assistance with regarding your player account?",
  },
  {
    id: "website_app",
    label: "Performance & UI",
    icon: Layout,
    helper: "App loading, audio effects, mobile layouts, or visual elements.",
    placeholder: "Tell us about any UI glitch, visual artifact, or performance issue...",
  },
  {
    id: "feature_request",
    label: "Feature Request",
    icon: Lightbulb,
    helper: "Have an idea or new feature to make Castle Chess better? We'd love to hear it!",
    placeholder: "I would love to see a feature where...",
  },
  {
    id: "report_problem",
    label: "Report a Bug",
    icon: AlertCircle,
    helper: "Unexpected error, disconnect, or bug. Steps to reproduce are very helpful.",
    placeholder: "What happened, what did you expect, and how can we reproduce it?",
  },
  {
    id: "general_feedback",
    label: "General Feedback",
    icon: MessageSquare,
    helper: "General impressions, compliments, or thoughts on the platform.",
    placeholder: "Share your thoughts with the Castle team...",
  },
];

export function FeedbackForm({
  initialContext,
  onSuccess,
  onViewHistory,
}: FeedbackFormProps) {
  const [category, setCategory] = useState<FeedbackCategory>("report_problem");
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submittedId, setSubmittedId] = useState<string | null>(null);

  // Chess context state
  const [showContext, setShowContext] = useState(
    Boolean(
      initialContext?.gameId ||
      initialContext?.opponentUsername ||
      initialContext?.matchId ||
      initialContext?.tournamentId
    )
  );
  const [gameId, setGameId] = useState(initialContext?.gameId ?? "");
  const [matchId, setMatchId] = useState(initialContext?.matchId ?? "");
  const [tournamentId, setTournamentId] = useState(initialContext?.tournamentId ?? "");
  const [opponentUsername, setOpponentUsername] = useState(
    initialContext?.opponentUsername ?? ""
  );

  // Debounced values for real-time validation
  const [debouncedGameId, setDebouncedGameId] = useState(gameId);
  const [debouncedOpponent, setDebouncedOpponent] = useState(opponentUsername);
  const [debouncedMatchId, setDebouncedMatchId] = useState(matchId);
  const [debouncedTournamentId, setDebouncedTournamentId] = useState(tournamentId);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedGameId(gameId.trim());
      setDebouncedOpponent(opponentUsername.trim());
      setDebouncedMatchId(matchId.trim());
      setDebouncedTournamentId(tournamentId.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [gameId, opponentUsername, matchId, tournamentId]);

  const hasAnyDebouncedContext = Boolean(
    debouncedGameId || debouncedOpponent || debouncedMatchId || debouncedTournamentId
  );
  const hasAnyRawContext = Boolean(
    gameId.trim() || opponentUsername.trim() || matchId.trim() || tournamentId.trim()
  );

  const contextValidation = useQuery(
    api.feedback.validateMatchContext,
    hasAnyDebouncedContext
      ? {
          gameId: debouncedGameId || undefined,
          opponentUsername: debouncedOpponent || undefined,
          matchId: debouncedMatchId || undefined,
          tournamentId: debouncedTournamentId || undefined,
        }
      : "skip"
  );

  const isDebouncing =
    gameId.trim() !== debouncedGameId ||
    opponentUsername.trim() !== debouncedOpponent ||
    matchId.trim() !== debouncedMatchId ||
    tournamentId.trim() !== debouncedTournamentId;

  const isContextValidating =
    hasAnyRawContext &&
    (isDebouncing || (hasAnyDebouncedContext && contextValidation === undefined));

  interface MatchContextStatus {
    game: { provided: boolean; valid: boolean; error?: string; label?: string };
    opponent: { provided: boolean; valid: boolean; error?: string; label?: string; rating?: number };
    match: { provided: boolean; valid: boolean; error?: string; label?: string };
    tournament: { provided: boolean; valid: boolean; error?: string; label?: string };
    allValid: boolean;
  }

  const validation: MatchContextStatus | null =
    contextValidation &&
    typeof contextValidation === "object" &&
    !Array.isArray(contextValidation) &&
    "allValid" in contextValidation
      ? (contextValidation as unknown as MatchContextStatus)
      : null;

  const isContextInvalid = Boolean(
    hasAnyRawContext &&
    !isContextValidating &&
    validation &&
    !validation.allValid
  );

  const generateUploadUrl = useMutation(api.feedback.generateUploadUrl);
  const submitFeedback = useMutation(api.feedback.submit);

  const activeCategory = CATEGORIES.find((c) => c.id === category) ?? CATEGORIES[0];
  const charCount = description.trim().length;
  const isDescriptionValid = charCount >= 10 && charCount <= 4000;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isDescriptionValid) {
      if (charCount < 10) {
        toast.error("Feedback description must be at least 10 characters long.");
      } else {
        toast.error("Feedback description must not exceed 4,000 characters.");
      }
      return;
    }

    if (isContextValidating) {
      toast.error("Please wait while your match details are being verified.");
      return;
    }

    if (isContextInvalid) {
      toast.error("Please correct or clear the invalid match details before submitting.");
      return;
    }

    setIsSubmitting(true);

    try {
      // Step 1: Upload attachments to Convex storage if any
      const uploadedAttachments: {
        storageId: Id<"_storage">;
        fileName: string;
        fileType: string;
        fileSize: number;
        uploadedAt: number;
      }[] = [];

      for (const file of files) {
        const uploadUrl = await generateUploadUrl({});
        const res = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": file.type },
          body: file,
        });

        if (!res.ok) {
          throw new Error(`Failed to upload ${file.name} (HTTP ${res.status})`);
        }

        const { storageId } = (await res.json()) as { storageId: Id<"_storage"> };
        uploadedAttachments.push({
          storageId,
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
          uploadedAt: Date.now(),
        });
      }

      // Step 2: Submit ticket
      const newFeedbackId = await submitFeedback({
        category,
        description: description.trim(),
        gameId: gameId.trim() || undefined,
        matchId: matchId.trim() || undefined,
        tournamentId: tournamentId.trim() || undefined,
        opponentUsername: opponentUsername.trim() || undefined,
        attachments: uploadedAttachments,
      });

      setSubmittedId(newFeedbackId);
      setSubmitSuccess(true);
      toast.success("Feedback submitted successfully! Thank you.");
      onSuccess?.(newFeedbackId);
    } catch (err: unknown) {
      console.error("[Feedback Submit Error]", err);
      toast.error(describeConvexError(err, "Failed to submit feedback. Please try again."));
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleReset() {
    setDescription("");
    setFiles([]);
    setGameId("");
    setMatchId("");
    setTournamentId("");
    setOpponentUsername("");
    setSubmitSuccess(false);
    setSubmittedId(null);
  }

  // Success view
  if (submitSuccess) {
    return (
      <Card className="p-8 border-border/80 bg-card/80 backdrop-blur-sm shadow-xl rounded-2xl text-center space-y-6 animate-in fade-in zoom-in-95 duration-200">
        <div className="mx-auto size-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-500">
          <CheckCircle2 className="size-8" />
        </div>

        <div className="space-y-2">
          <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center justify-center gap-2">
            <span>♟</span> Thank You, Player!
          </h2>
          <p className="text-muted-foreground text-sm max-w-md mx-auto leading-relaxed">
            Your feedback has been received. Our team reviews every player submission closely
            to keep improving Castle 3D Chess.
          </p>
        </div>

        <div className="p-4 rounded-xl bg-muted/40 border border-border/60 max-w-md mx-auto text-left space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground font-medium">Category:</span>
            <Badge variant="outline" className="text-xs font-semibold capitalize border-primary/30 text-primary">
              {activeCategory.label}
            </Badge>
          </div>
          {submittedId && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground font-medium">Reference ID:</span>
              <span className="text-foreground font-mono text-[11px] font-semibold">{submittedId}</span>
            </div>
          )}
          {files.length > 0 && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground font-medium">Attachments:</span>
              <span className="text-foreground font-semibold">{files.length} file(s) attached</span>
            </div>
          )}
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground font-medium">Confirmation Email:</span>
            <span className="text-emerald-500 font-semibold flex items-center gap-1">
              <Sparkles className="size-3" /> Queued for delivery
            </span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <Button
            type="button"
            variant="default"
            onClick={handleReset}
            className="w-full sm:w-auto"
          >
            Submit Another Report
          </Button>

          {onViewHistory && (
            <Button
              type="button"
              variant="outline"
              onClick={onViewHistory}
              className="w-full sm:w-auto"
            >
              View My Feedback History
            </Button>
          )}

          <Link href="/play" className="w-full sm:w-auto">
            <Button type="button" variant="ghost" className="w-full text-primary hover:text-primary">
              Return to Chess
            </Button>
          </Link>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6 sm:p-8 border-border/80 bg-card/70 backdrop-blur-sm shadow-xl rounded-2xl">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Step 1: Category selection */}
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-sm font-bold text-foreground">
              1. What kind of feedback are you sharing?
            </Label>
            <p className="text-xs text-muted-foreground">
              Select the area that best describes your message.
            </p>
          </div>

          <div
            role="radiogroup"
            aria-label="Feedback category"
            className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-2.5"
          >
            {CATEGORIES.map((cat) => {
              const Icon = cat.icon;
              const isSelected = category === cat.id;

              return (
                <button
                  type="button"
                  key={cat.id}
                  onClick={(e) => {
                    e.preventDefault();
                    setCategory(cat.id);
                  }}
                  disabled={isSubmitting}
                  className={cn(
                    "flex items-center gap-2 sm:gap-3 p-2.5 sm:p-3 rounded-xl border text-left transition-all",
                    isSelected
                      ? "border-primary bg-primary/10 shadow-sm text-foreground ring-1 ring-primary/40"
                      : "border-border/70 bg-muted/20 hover:bg-muted/40 text-muted-foreground hover:text-foreground",
                    isSubmitting && "opacity-50 cursor-not-allowed"
                  )}
                  aria-checked={isSelected}
                  role="radio"
                >
                  <div
                    className={cn(
                      "size-7 sm:size-8 rounded-lg flex items-center justify-center shrink-0 transition-colors",
                      isSelected
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground group-hover:text-foreground"
                    )}
                  >
                    <Icon className="size-3.5 sm:size-4" />
                  </div>
                  <span className="text-[11px] sm:text-xs font-semibold leading-tight line-clamp-2">
                    {cat.label}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Dynamic Helper Prompt */}
          <div className="p-3 rounded-xl bg-primary/5 border border-primary/20 flex items-start gap-2.5 text-xs text-primary">
            <Sparkles className="size-4 shrink-0 mt-0.5 text-primary" />
            <span className="leading-relaxed">{activeCategory.helper}</span>
          </div>
        </div>

        {/* Step 2: Description */}
        <div className="space-y-2 scroll-mt-20" id="feedback-message-section">
          <div className="flex items-center justify-between">
            <Label htmlFor="feedback-description" className="text-sm font-bold text-foreground">
              2. Your Message <span className="text-primary">*</span>
            </Label>
            <span
              className={cn(
                "text-xs tabular-nums font-medium",
                charCount < 10
                  ? "text-muted-foreground"
                  : charCount > 4000
                  ? "text-destructive font-bold"
                  : "text-emerald-500"
              )}
            >
              {charCount} / 4000
            </span>
          </div>

          <Textarea
            id="feedback-description"
            rows={5}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={activeCategory.placeholder}
            disabled={isSubmitting}
            className={cn(
              "resize-y min-h-[120px] rounded-xl bg-muted/20 border-border/80 focus-visible:ring-primary text-base sm:text-sm",
              charCount > 0 && charCount < 10 && "border-amber-500/50"
            )}
          />

          {charCount > 0 && charCount < 10 && (
            <p className="text-xs text-amber-500 font-medium">
              Please enter at least {10 - charCount} more character{10 - charCount === 1 ? "" : "s"}.
            </p>
          )}
        </div>

        {/* Step 3: Chess Context (Collapsible) */}
        <div className="rounded-xl border border-border/70 bg-muted/10 overflow-hidden">
          <button
            type="button"
            onClick={() => setShowContext(!showContext)}
            className="w-full flex items-center justify-between p-3.5 text-left hover:bg-muted/20 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Gamepad2 className="size-4 text-primary" />
              <span className="text-xs font-bold text-foreground">
                Chess Match Details (Optional)
              </span>
              {(gameId || opponentUsername) && (
                <Badge variant="outline" className="text-[10px] border-primary/30 text-primary py-0 flex items-center gap-1">
                  Attached {gameId ? `#${gameId.slice(0, 8)}` : (opponentUsername ? `@${opponentUsername}` : "")}
                  {isContextValidating ? (
                    <span className="text-[9px] text-muted-foreground ml-1 flex items-center gap-0.5 font-normal">
                      <Loader2 className="size-2 animate-spin" /> checking
                    </span>
                  ) : isContextInvalid ? (
                    <span className="text-[9px] text-destructive ml-1 flex items-center gap-0.5 font-bold">
                      <AlertCircle className="size-2" /> invalid
                    </span>
                  ) : validation?.allValid ? (
                    <span className="text-[9px] text-emerald-500 ml-1 flex items-center gap-0.5 font-bold">
                      <CheckCircle2 className="size-2" /> verified
                    </span>
                  ) : null}
                </Badge>
              )}
            </div>
            {showContext ? (
              <ChevronUp className="size-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="size-4 text-muted-foreground" />
            )}
          </button>

          {showContext && (
            <div className="p-4 pt-1 border-t border-border/50 grid grid-cols-1 sm:grid-cols-2 gap-3 animate-in fade-in duration-150">
              {/* Game ID */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label htmlFor="context-game-id" className="text-xs text-muted-foreground font-medium">
                    Game ID
                  </Label>
                  {gameId.trim() && (
                    <span className="text-[11px]">
                      {isContextValidating && (gameId.trim() !== debouncedGameId || validation === null) ? (
                        <span className="text-muted-foreground flex items-center gap-1 font-mono">
                          <Loader2 className="size-2.5 animate-spin" /> checking...
                        </span>
                      ) : validation?.game.valid ? (
                        <span className="text-emerald-500 font-semibold flex items-center gap-1">
                          <CheckCircle2 className="size-3" /> Found
                        </span>
                      ) : validation && !validation.game.valid ? (
                        <span className="text-destructive font-semibold flex items-center gap-1">
                          <AlertCircle className="size-3" /> Not found
                        </span>
                      ) : null}
                    </span>
                  )}
                </div>
                <Input
                  id="context-game-id"
                  placeholder="e.g. k57df... or #game_123"
                  value={gameId}
                  onChange={(e) => setGameId(e.target.value)}
                  disabled={isSubmitting}
                  className={cn(
                    "h-8 text-xs rounded-lg transition-colors",
                    gameId.trim() && validation && !isContextValidating && (
                      validation.game.valid
                        ? "border-emerald-500/50 focus-visible:ring-emerald-500/30"
                        : "border-destructive focus-visible:ring-destructive/30"
                    )
                  )}
                />
                {gameId.trim() && !isContextValidating && validation && (
                  validation.game.valid && validation.game.label ? (
                    <p className="text-[10px] text-emerald-500/90 font-medium">
                      ✓ {validation.game.label}
                    </p>
                  ) : !validation.game.valid ? (
                    <p className="text-[10px] text-destructive font-medium flex items-center gap-1">
                      <AlertCircle className="size-3 shrink-0" />
                      {validation.game.error || "Game ID does not exist in system."}
                    </p>
                  ) : null
                )}
              </div>

              {/* Opponent Username */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label htmlFor="context-opponent" className="text-xs text-muted-foreground font-medium">
                    Opponent Username
                  </Label>
                  {opponentUsername.trim() && (
                    <span className="text-[11px]">
                      {isContextValidating && (opponentUsername.trim() !== debouncedOpponent || validation === null) ? (
                        <span className="text-muted-foreground flex items-center gap-1 font-mono">
                          <Loader2 className="size-2.5 animate-spin" /> checking...
                        </span>
                      ) : validation?.opponent.valid ? (
                        <span className="text-emerald-500 font-semibold flex items-center gap-1">
                          <CheckCircle2 className="size-3" /> Found
                        </span>
                      ) : validation && !validation.opponent.valid ? (
                        <span className="text-destructive font-semibold flex items-center gap-1">
                          <AlertCircle className="size-3" /> Not found
                        </span>
                      ) : null}
                    </span>
                  )}
                </div>
                <Input
                  id="context-opponent"
                  placeholder="e.g. grandmaster_bob or @bob"
                  value={opponentUsername}
                  onChange={(e) => setOpponentUsername(e.target.value)}
                  disabled={isSubmitting}
                  className={cn(
                    "h-8 text-xs rounded-lg transition-colors",
                    opponentUsername.trim() && validation && !isContextValidating && (
                      validation.opponent.valid
                        ? "border-emerald-500/50 focus-visible:ring-emerald-500/30"
                        : "border-destructive focus-visible:ring-destructive/30"
                    )
                  )}
                />
                {opponentUsername.trim() && !isContextValidating && validation && (
                  validation.opponent.valid && validation.opponent.label ? (
                    <p className="text-[10px] text-emerald-500/90 font-medium">
                      ✓ {validation.opponent.label}
                    </p>
                  ) : !validation.opponent.valid ? (
                    <p className="text-[10px] text-destructive font-medium flex items-center gap-1">
                      <AlertCircle className="size-3 shrink-0" />
                      {validation.opponent.error || "Player does not exist."}
                    </p>
                  ) : null
                )}
              </div>

              {/* Match / Wager ID */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label htmlFor="context-match-id" className="text-xs text-muted-foreground font-medium">
                    Match / Wager ID
                  </Label>
                  {matchId.trim() && (
                    <span className="text-[11px]">
                      {isContextValidating && (matchId.trim() !== debouncedMatchId || validation === null) ? (
                        <span className="text-muted-foreground flex items-center gap-1 font-mono">
                          <Loader2 className="size-2.5 animate-spin" /> checking...
                        </span>
                      ) : validation?.match.valid ? (
                        <span className="text-emerald-500 font-semibold flex items-center gap-1">
                          <CheckCircle2 className="size-3" /> Found
                        </span>
                      ) : validation && !validation.match.valid ? (
                        <span className="text-destructive font-semibold flex items-center gap-1">
                          <AlertCircle className="size-3" /> Not found
                        </span>
                      ) : null}
                    </span>
                  )}
                </div>
                <Input
                  id="context-match-id"
                  placeholder="e.g. wager_ref or challenge_id"
                  value={matchId}
                  onChange={(e) => setMatchId(e.target.value)}
                  disabled={isSubmitting}
                  className={cn(
                    "h-8 text-xs rounded-lg transition-colors",
                    matchId.trim() && validation && !isContextValidating && (
                      validation.match.valid
                        ? "border-emerald-500/50 focus-visible:ring-emerald-500/30"
                        : "border-destructive focus-visible:ring-destructive/30"
                    )
                  )}
                />
                {matchId.trim() && !isContextValidating && validation && (
                  validation.match.valid && validation.match.label ? (
                    <p className="text-[10px] text-emerald-500/90 font-medium">
                      ✓ {validation.match.label}
                    </p>
                  ) : !validation.match.valid ? (
                    <p className="text-[10px] text-destructive font-medium flex items-center gap-1">
                      <AlertCircle className="size-3 shrink-0" />
                      {validation.match.error || "Match or wager not found."}
                    </p>
                  ) : null
                )}
              </div>

              {/* Tournament ID */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label htmlFor="context-tournament-id" className="text-xs text-muted-foreground font-medium">
                    Tournament ID
                  </Label>
                  {tournamentId.trim() && (
                    <span className="text-[11px]">
                      {isContextValidating && (tournamentId.trim() !== debouncedTournamentId || validation === null) ? (
                        <span className="text-muted-foreground flex items-center gap-1 font-mono">
                          <Loader2 className="size-2.5 animate-spin" /> checking...
                        </span>
                      ) : validation?.tournament.valid ? (
                        <span className="text-emerald-500 font-semibold flex items-center gap-1">
                          <CheckCircle2 className="size-3" /> Found
                        </span>
                      ) : validation && !validation.tournament.valid ? (
                        <span className="text-destructive font-semibold flex items-center gap-1">
                          <AlertCircle className="size-3" /> Not found
                        </span>
                      ) : null}
                    </span>
                  )}
                </div>
                <Input
                  id="context-tournament-id"
                  placeholder="e.g. blitz_arena_1 or tournament title"
                  value={tournamentId}
                  onChange={(e) => setTournamentId(e.target.value)}
                  disabled={isSubmitting}
                  className={cn(
                    "h-8 text-xs rounded-lg transition-colors",
                    tournamentId.trim() && validation && !isContextValidating && (
                      validation.tournament.valid
                        ? "border-emerald-500/50 focus-visible:ring-emerald-500/30"
                        : "border-destructive focus-visible:ring-destructive/30"
                    )
                  )}
                />
                {tournamentId.trim() && !isContextValidating && validation && (
                  validation.tournament.valid && validation.tournament.label ? (
                    <p className="text-[10px] text-emerald-500/90 font-medium">
                      ✓ {validation.tournament.label}
                    </p>
                  ) : !validation.tournament.valid ? (
                    <p className="text-[10px] text-destructive font-medium flex items-center gap-1">
                      <AlertCircle className="size-3 shrink-0" />
                      {validation.tournament.error || "Tournament was not found."}
                    </p>
                  ) : null
                )}
              </div>
            </div>
          )}
        </div>

        {/* Step 4: Attachments */}
        <div className="space-y-2">
          <Label className="text-sm font-bold text-foreground">
            3. Attachments (Optional)
          </Label>
          <FileUploader
            files={files}
            onFilesChange={setFiles}
            maxFiles={5}
            disabled={isSubmitting}
          />
        </div>

        {/* Invalid Context Warning Banner */}
        {isContextInvalid && (
          <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/30 flex items-start gap-2.5 text-xs text-destructive animate-in fade-in duration-150">
            <AlertCircle className="size-4 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Invalid match details:</span> One or more entered chess match details do not exist in the system. Please correct the values or leave them blank (they are optional) to submit.
            </div>
          </div>
        )}

        {/* Submit Action */}
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-[11px] text-muted-foreground order-2 sm:order-1 text-center sm:text-left">
            Submissions are sent directly to platform administrators.
          </p>

          <Button
            type="submit"
            disabled={!isDescriptionValid || isSubmitting || isContextValidating || isContextInvalid}
            className="w-full sm:w-auto min-w-[160px] rounded-xl font-bold order-1 sm:order-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="size-4 animate-spin mr-2" />
                Submitting...
              </>
            ) : isContextValidating ? (
              <>
                <Loader2 className="size-4 animate-spin mr-2" />
                Verifying Details...
              </>
            ) : (
              <>
                <Send className="size-4 mr-2" />
                Submit Feedback
              </>
            )}
          </Button>
        </div>
      </form>
    </Card>
  );
}
