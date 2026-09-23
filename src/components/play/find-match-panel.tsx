"use client";
// src/components/play/find-match-panel.tsx
import { useEffect, useRef, useState } from "react";
import { SwordsIcon, Search, UserCheck, X, Check, Clock, Coins, ShieldAlert, Sparkles } from "lucide-react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { RatingWindow } from "@/components/ui-kit";
import { QUEUE_BASE_RANGE, QUEUE_WIDEN_INTERVAL_MS, queueRangeAt } from "@/lib/constants";
import { formatElapsed, formatRating } from "@/lib/format";
import { describeConvexError } from "@/components/providers/convex-errors";
import { SeatPanel, SeatReason } from "./seat-panel";
import { cn } from "@/lib/ui";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { initials } from "@/lib/ui";

const TICK_MS = 500;
const BAR_MAX_RANGE = 1000;
const WIDEN_SECONDS = Math.round(QUEUE_WIDEN_INTERVAL_MS / 1000);

/* --------------------------------------------------------------- the rail */

function RatingWindowRail({ range, myRating }: { range: number; myRating: number | null }) {
  const low = myRating === null ? null : Math.max(0, myRating - range);
  const high = myRating === null ? null : myRating + range;

  return (
    <div className="grid gap-1.5">
      <div className="lobby-micro flex items-baseline justify-between gap-3 text-muted-foreground">
        <span>Rating window</span>
        <span className="lobby-data text-foreground">
          {low === null || high === null
            ? `±${range}`
            : `${formatRating(low)}–${formatRating(high)}`}
        </span>
      </div>

      <div
        role="progressbar"
        aria-label="Rating window"
        aria-valuemin={QUEUE_BASE_RANGE}
        aria-valuemax={BAR_MAX_RANGE}
        aria-valuenow={Math.min(BAR_MAX_RANGE, range)}
        aria-valuetext={`plus or minus ${range} rating points`}
      >
        <RatingWindow
          rating={myRating}
          range={range}
          caption={`±${range} now · wider every ${WIDEN_SECONDS}s`}
        />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ the waiting */

export interface QueuePanelViewProps {
  className?: string;
  seat?: string;
  elapsedMs: number;
  range: number | null;
  myRating: number | null;
  pending?: boolean;
  flash?: boolean;
  stake?: number;
  onCancel(): void;
  onPlayAi(): void;
}

export function QueuePanelView({
  className,
  seat,
  elapsedMs,
  range,
  myRating,
  pending = false,
  flash = false,
  stake,
  onCancel,
  onPlayAi,
}: QueuePanelViewProps) {
  const shown = range ?? QUEUE_BASE_RANGE;

  return (
    <SeatPanel
      icon={SwordsIcon}
      title="Looking for an opponent"
      flash={flash}
      className={className}
      seat={seat}
      line={
        myRating === null
          ? `Looking for a player near your rating. The window widens every ${WIDEN_SECONDS} seconds.`
          : `Looking for a player near ${formatRating(myRating)}. The window widens every ${WIDEN_SECONDS} seconds.`
      }
      action={
        <>
          <Button
            size="lg"
            variant="outline"
            onClick={onCancel}
            disabled={pending}
            className="min-w-40 cursor-pointer py-2"
          >
            {pending ? "Cancelling…" : "Cancel"}
          </Button>
          <Button
            size="lg"
            variant="ghost"
            onClick={onPlayAi}
            disabled={pending}
            className="cursor-pointer py-2"
          >
            Play the AI while you wait
          </Button>
        </>
      }
    >
      <div className="grid max-w-md gap-4">
        <div className="flex items-center justify-between gap-3">
          <span className="lobby-micro flex items-center gap-2 text-muted-foreground">
            <span aria-hidden className="size-1.5 rounded-full bg-live" />
            Searching
            {stake && stake > 0 && ` · 💰 Stake: ${stake} ETB · Prize: ${Math.round(stake * 2 * 0.9)} ETB`}
          </span>
          <span
            role="status"
            aria-atomic="true"
            className="lobby-data text-foreground"
          >
            <span className="sr-only">Waiting </span>
            {formatElapsed(elapsedMs)}
          </span>
        </div>

        <RatingWindowRail range={shown} myRating={myRating} />

        <p className="lobby-micro text-muted-foreground">
          You are taken to the board the moment someone is matched. Keep this tab open.
        </p>
      </div>
    </SeatPanel>
  );
}

/* -------------------------------------------------------------- the seat */

export interface MatchSeatViewProps {
  className?: string;
  seat?: string;
  myRating: number | null;
  loading?: boolean;
  pending?: boolean;
  disabled?: boolean;
  disabledReason?: string;
  primary?: boolean;
  flash?: boolean;
  onFind(): void;
  selectedStake?: number;
  onStakeChange?: (stake: number) => void;
  balance?: any;
  customStakeInput?: string;
  setCustomStakeInput?: (val: string) => void;
  isCustom?: boolean;
  setIsCustom?: (val: boolean) => void;
}

export function MatchSeatView({
  className,
  seat,
  myRating,
  loading = false,
  pending = false,
  disabled = false,
  disabledReason,
  primary = true,
  flash = false,
  onFind,
  selectedStake = 0,
  onStakeChange,
  balance,
  customStakeInput = "20",
  setCustomStakeInput,
  isCustom = false,
  setIsCustom,
}: MatchSeatViewProps) {
  const availableBal = balance?.available ?? 0;

  const handleCustomChange = (val: string) => {
    setCustomStakeInput?.(val);
    const parsed = parseInt(val, 10);
    if (!isNaN(parsed) && parsed >= 10 && onStakeChange) {
      onStakeChange(parsed);
    }
  };

  return (
    <SeatPanel
      icon={SwordsIcon}
      title="Find a match"
      flash={flash}
      className={className}
      seat={seat}
      line={
        <>
          <span className="block mb-3">
            {loading ? (
              <span
                aria-hidden
                className="inline-block h-4 w-72 max-w-full rounded bg-secondary align-middle motion-safe:animate-pulse"
              />
            ) : myRating === null ? (
              `Rated online matchmaking. Someone near your rating first; widens every ${WIDEN_SECONDS}s.`
            ) : (
              `Rated online match near ${formatRating(myRating)}. Widens every ${WIDEN_SECONDS}s.`
            )}
          </span>

          {onStakeChange && (
            <div className="mb-4 space-y-2">
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">
                Select ETB Match Stake
              </span>
              <div className="flex flex-wrap items-center gap-1.5">
                {[0, 10, 25, 50, 100].map((tier) => (
                  <button
                    key={tier}
                    type="button"
                    onClick={() => {
                      setIsCustom?.(false);
                      onStakeChange(tier);
                    }}
                    disabled={tier > 0 && availableBal < tier}
                    className={cn(
                      "rounded-xl px-3 py-1.5 text-xs font-bold transition-all",
                      !isCustom && selectedStake === tier
                        ? "bg-primary text-primary-foreground shadow-xs font-extrabold"
                        : "bg-secondary hover:bg-secondary/80 text-foreground",
                      tier > 0 && availableBal < tier && "opacity-40 cursor-not-allowed"
                    )}
                  >
                    {tier === 0 ? "Free" : `${tier} ETB`}
                  </button>
                ))}

                <button
                  type="button"
                  onClick={() => {
                    setIsCustom?.(true);
                    const parsed = parseInt(customStakeInput, 10);
                    if (!isNaN(parsed) && parsed >= 10) onStakeChange(parsed);
                  }}
                  className={cn(
                    "rounded-xl px-3 py-1.5 text-xs font-bold transition-all",
                    isCustom
                      ? "bg-emerald-600 text-white shadow-xs font-extrabold"
                      : "bg-secondary hover:bg-secondary/80 text-foreground"
                  )}
                >
                  Custom
                </button>
              </div>

              {isCustom && (
                <div className="pt-2 flex items-center gap-2 max-w-xs animate-in fade-in">
                  <div className="relative flex-1">
                    <input
                      type="number"
                      min={10}
                      value={customStakeInput}
                      onChange={(e) => handleCustomChange(e.target.value)}
                      placeholder="Stake (min 10 ETB)"
                      className="w-full h-9 rounded-xl border border-input bg-background px-3 pr-12 text-xs font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground pointer-events-none">
                      ETB
                    </span>
                  </div>
                </div>
              )}

              {selectedStake > 0 && (
                <p className="text-xs text-emerald-500 font-bold flex items-center gap-1 mt-1">
                  <Coins className="size-3.5" />
                  Winner gets {Math.round(selectedStake * 2 * 0.9)} ETB (10% platform rake)
                </p>
              )}
            </div>
          )}
        </>
      }
      action={
        <>
          <Button
            size="lg"
            variant={primary ? "default" : "outline"}
            onClick={onFind}
            disabled={
              pending ||
              disabled ||
              (selectedStake > 0 && availableBal < selectedStake) ||
              (isCustom && selectedStake < 10)
            }
            title={disabled ? disabledReason : undefined}
            className="min-w-40 cursor-pointer py-2 font-bold text-xs"
          >
            {pending ? "Joining Queue…" : "Find a match"}
          </Button>
          {disabled && disabledReason ? <SeatReason>{disabledReason}</SeatReason> : null}
        </>
      }
    />
  );
}

/* ------------------------------------------------------------- Direct Challenge Seat */

export function DirectChallengeSeatView({
  className,
  seat,
  balance,
  onChallengeAccepted,
  initialUsername,
}: {
  className?: string;
  seat?: string;
  balance?: any;
  onChallengeAccepted: (gameId: string) => void;
  initialUsername?: string;
}) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState(initialUsername || "");
  const [selectedPlayer, setSelectedPlayer] = useState<any | null>(null);
  const [challengeStake, setChallengeStake] = useState(0);
  const [customStakeInput, setCustomStakeInput] = useState("20");
  const [isCustomStake, setIsCustomStake] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dismissedDeclinedId, setDismissedDeclinedId] = useState<string | null>(null);

  const handledGamesRef = useRef<Set<string>>(new Set());

  const searchResults = useQuery(
    (api as any).challenges?.searchPlayers,
    searchQuery.trim().length >= 2 ? { query: searchQuery.trim() } : "skip"
  );

  const outgoingChallenges = useQuery((api as any).challenges?.myOutgoingChallenges, {});
  const createChallenge = useMutation((api as any).challenges?.createChallenge);
  const cancelChallenge = useMutation((api as any).challenges?.cancel);

  const activeOutgoing = outgoingChallenges?.find((c: any) => c.status === "pending");
  // Only route to accepted challenges whose game is ACTIVE and has not been handled
  const acceptedOutgoing = outgoingChallenges?.find(
    (c: any) => c.status === "accepted" && c.gameId && c.gameStatus === "active"
  );

  const recentlyDeclined = outgoingChallenges?.find(
    (c: any) => c.status === "declined" && c.respondedAt && (Date.now() - c.respondedAt < 300000)
  );

  // If initialUsername is provided, pre-select player once search results arrive
  useEffect(() => {
    if (initialUsername && searchResults && searchResults.length > 0 && !selectedPlayer) {
      const match = searchResults.find(
        (p: any) => p.username.toLowerCase() === initialUsername.toLowerCase()
      );
      if (match) setSelectedPlayer(match);
    }
  }, [initialUsername, searchResults, selectedPlayer]);

  useEffect(() => {
    if (acceptedOutgoing?.gameId) {
      const key = `castle_handled_game_${acceptedOutgoing.gameId}`;
      if (typeof window !== "undefined" && window.sessionStorage.getItem(key)) {
        return;
      }
      if (handledGamesRef.current.has(acceptedOutgoing.gameId)) {
        return;
      }
      handledGamesRef.current.add(acceptedOutgoing.gameId);
      if (typeof window !== "undefined") {
        window.sessionStorage.setItem(key, "true");
      }
      toast.success("Challenge accepted! Entering match...");
      onChallengeAccepted(acceptedOutgoing.gameId);
    }
  }, [acceptedOutgoing, onChallengeAccepted]);

  const [timerNow, setTimerNow] = useState(Date.now());
  useEffect(() => {
    if (!activeOutgoing) return;
    const interval = setInterval(() => setTimerNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [activeOutgoing]);

  const remainingMs = activeOutgoing
    ? Math.max(0, 10 * 60 * 1000 - (timerNow - activeOutgoing.createdAt))
    : 0;

  // Auto-expire after 10 minutes without response
  useEffect(() => {
    if (activeOutgoing && remainingMs <= 0) {
      void cancelChallenge({ challengeId: activeOutgoing._id })
        .then(() => {
          toast.info("Direct challenge expired after 10 minutes. Any staked balance refunded.");
        })
        .catch(() => {});
    }
  }, [activeOutgoing, remainingMs, cancelChallenge]);

  const handleSendChallenge = async () => {
    if (!selectedPlayer) return;
    try {
      setIsSubmitting(true);
      await createChallenge({
        toPlayerId: selectedPlayer._id,
        stake: challengeStake > 0 ? challengeStake : undefined,
      });
      toast.success(`Challenge sent to ${selectedPlayer.username}!`);
      setSelectedPlayer(null);
      setSearchQuery("");
      setIsCustomStake(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to send challenge");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelChallenge = async (id: string) => {
    try {
      await cancelChallenge({ challengeId: id });
      toast.success("Challenge cancelled and any staked balance refunded");
    } catch (err: any) {
      toast.error(err.message || "Failed to cancel challenge");
    }
  };

  return (
    <SeatPanel
      icon={SwordsIcon}
      title="Direct Player Challenge"
      className={className}
      seat={seat}
      line={
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Search any registered player by <strong>username</strong> or <strong>email</strong> to play a direct staked or casual game.
          </p>

          {/* Recent Declined Notification Banner */}
          {recentlyDeclined && recentlyDeclined._id !== dismissedDeclinedId && (
            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 flex items-center justify-between text-xs animate-in fade-in">
              <div>
                <p className="font-bold text-amber-500">Challenge Declined</p>
                <p className="text-[11px] text-muted-foreground">
                  {recentlyDeclined.toPlayer?.username ?? "Player"} declined your challenge. Any staked ETB has been refunded.
                </p>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs font-semibold px-2"
                onClick={() => setDismissedDeclinedId(recentlyDeclined._id)}
              >
                Dismiss
              </Button>
            </div>
          )}

          {/* Active Pending Outgoing Challenge Banner with 10-Minute Timer */}
          {activeOutgoing && (
            <div className="rounded-2xl border border-primary/30 bg-primary/10 p-3.5 space-y-2.5 animate-in fade-in">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="size-4 text-primary animate-pulse" />
                  <span className="text-xs font-bold text-foreground">
                    Challenge sent to {activeOutgoing.toPlayer?.username}
                  </span>
                </div>
                <span className="text-xs font-bold text-primary">
                  {activeOutgoing.stake ? `${activeOutgoing.stake} ETB` : "Free"}
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span>Awaiting acceptance...</span>
                <span className="font-mono font-bold text-foreground bg-background/60 px-2 py-0.5 rounded-md border border-border/50">
                  Expires in {Math.floor(remainingMs / 60000)}:{Math.floor((remainingMs % 60000) / 1000).toString().padStart(2, "0")}
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleCancelChallenge(activeOutgoing._id)}
                className="h-8 text-xs font-semibold w-full hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 transition-colors"
              >
                Cancel Challenge & Refund
              </Button>
            </div>
          )}

          {/* Search Input */}
          {!activeOutgoing && (
            <div className="space-y-2">
              <div className="relative">
                <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Type username or email (e.g. marco, user@gmail.com)..."
                  className="w-full h-10 rounded-xl border border-input bg-background pl-9 pr-3 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {/* Search Results List */}
              {searchQuery.trim().length >= 2 && !selectedPlayer && (
                <div className="rounded-2xl border border-border bg-card p-2 shadow-sm space-y-1 max-h-48 overflow-y-auto">
                  {!searchResults || searchResults.length === 0 ? (
                    <p className="text-xs text-muted-foreground p-3 text-center">
                      No players matching &quot;{searchQuery}&quot; found.
                    </p>
                  ) : (
                    searchResults.map((player: any) => (
                      <div
                        key={player._id}
                        onClick={() => setSelectedPlayer(player)}
                        className={`flex items-center justify-between p-2 rounded-xl cursor-pointer transition-colors ${
                          selectedPlayer?._id === player._id
                            ? "bg-primary/15 border border-primary/30"
                            : "hover:bg-muted/50"
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <Avatar className="size-7">
                            <AvatarImage src={player.avatarUrl} alt={player.username} />
                            <AvatarFallback className="text-xs font-bold">
                              {initials(player.username)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-xs font-bold text-foreground">{player.username}</p>
                            <p className="text-[10px] text-muted-foreground font-mono">
                              Rating: {formatRating(player.ratingHuman)}
                            </p>
                          </div>
                        </div>
                        <Button size="xs" variant={selectedPlayer?._id === player._id ? "default" : "outline"}>
                          {selectedPlayer?._id === player._id ? "Selected" : "Pick"}
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Selected Player Details & Stake Picker */}
              {selectedPlayer && (
                <div className="rounded-2xl border border-border bg-muted/30 p-3.5 space-y-3 animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-foreground">
                      Challenging: <strong>{selectedPlayer.username}</strong>
                    </span>
                    <button
                      onClick={() => setSelectedPlayer(null)}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      Change
                    </button>
                  </div>

                  <div className="space-y-1.5">
                    <span className="text-[11px] font-bold text-muted-foreground uppercase">
                      Select Match Stake
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {[0, 10, 25, 50, 100].map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => {
                            setIsCustomStake(false);
                            setChallengeStake(s);
                          }}
                          disabled={s > 0 && (balance?.available ?? 0) < s}
                          className={`rounded-xl px-2.5 py-1 text-xs font-bold transition-all ${
                            !isCustomStake && challengeStake === s
                              ? "bg-primary text-primary-foreground font-extrabold shadow-xs"
                              : "bg-background border hover:bg-muted text-foreground"
                          } ${s > 0 && (balance?.available ?? 0) < s ? "opacity-40 cursor-not-allowed" : ""}`}
                        >
                          {s === 0 ? "Free" : `${s} ETB`}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => {
                          setIsCustomStake(true);
                          const parsed = parseInt(customStakeInput, 10);
                          if (!isNaN(parsed) && parsed >= 10) setChallengeStake(parsed);
                        }}
                        className={`rounded-xl px-2.5 py-1 text-xs font-bold transition-all ${
                          isCustomStake
                            ? "bg-primary text-primary-foreground font-extrabold shadow-xs"
                            : "bg-background border hover:bg-muted text-foreground"
                        }`}
                      >
                        Custom
                      </button>
                    </div>

                    {isCustomStake && (
                      <div className="pt-2 flex items-center gap-2 max-w-xs animate-in fade-in">
                        <div className="relative flex-1">
                          <input
                            type="number"
                            min={10}
                            value={customStakeInput}
                            onChange={(e) => {
                              const val = e.target.value;
                              setCustomStakeInput(val);
                              const parsed = parseInt(val, 10);
                              if (!isNaN(parsed) && parsed >= 10) setChallengeStake(parsed);
                            }}
                            placeholder="Stake (min 10 ETB)"
                            className="w-full h-9 rounded-xl border border-input bg-background px-3 pr-12 text-xs font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground pointer-events-none">
                            ETB
                          </span>
                        </div>
                      </div>
                    )}

                    {challengeStake > 0 && (
                      <p className="text-[11px] text-emerald-500 font-bold flex items-center gap-1 mt-1">
                        <Coins className="size-3.5" />
                        Winner gets {Math.round(challengeStake * 2 * 0.9)} ETB (10% platform rake)
                      </p>
                    )}
                  </div>

                  <Button
                    size="sm"
                    onClick={handleSendChallenge}
                    disabled={isSubmitting || (challengeStake > 0 && (balance?.available ?? 0) < challengeStake) || (isCustomStake && challengeStake < 10)}
                    className="w-full h-9 font-bold text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    {isSubmitting ? "Sending..." : `Send Challenge (${challengeStake > 0 ? challengeStake + " ETB" : "Free"})`}
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      }
      action={null}
    />
  );
}

/* -------------------------------------------------------------- Main Combined Panel */

export function FindMatchPanel({
  enabled,
  myRating,
  onPlayAi,
  disabled = false,
  disabledReason,
  primary = true,
  flash = false,
  className,
  seat,
}: {
  enabled: boolean;
  myRating: number | null;
  onPlayAi: () => void;
  disabled?: boolean;
  disabledReason?: string;
  primary?: boolean;
  flash?: boolean;
  className?: string;
  seat?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const challengeUser = searchParams?.get("challenge");
  const modeParam = searchParams?.get("mode");

  const status = useQuery(api.queue.myStatus, enabled ? {} : "skip");
  const balance = useQuery(api.wallets?.getBalance as any, enabled ? {} : "skip");
  const join = useMutation(api.queue.join);
  const leave = useMutation(api.queue.leave);

  // Challenges queries & mutations
  const incomingChallenges = useQuery(
    (api as any).challenges?.myIncomingChallenges,
    enabled ? {} : "skip"
  );
  const respondChallenge = useMutation((api as any).challenges?.respond);

  const [matchMode, setMatchMode] = useState<"quick" | "direct">(
    challengeUser || modeParam === "direct" ? "direct" : "quick"
  );
  const [pending, setPending] = useState(false);
  const [nowMs, setNowMs] = useState(0);
  const [selectedStake, setSelectedStake] = useState(0);
  const [customStakeInput, setCustomStakeInput] = useState("20");
  const [isCustom, setIsCustom] = useState(false);

  const inQueue = status?.inQueue ?? false;
  const joinedAt = status?.joinedAt ?? null;

  useEffect(() => {
    if (joinedAt === null) return;
    const id = setInterval(() => setNowMs(Date.now()), TICK_MS);
    return () => clearInterval(id);
  }, [joinedAt]);

  const queuedRef = useRef(false);
  const leaveRef = useRef(leave);
  useEffect(() => {
    queuedRef.current = inQueue;
  }, [inQueue]);
  useEffect(() => {
    leaveRef.current = leave;
  }, [leave]);

  useEffect(() => {
    const abandon = () => {
      if (!queuedRef.current) return;
      leaveRef.current({}).catch(() => {});
    };
    window.addEventListener("pagehide", abandon);
    return () => {
      window.removeEventListener("pagehide", abandon);
      abandon();
    };
  }, []);

  const elapsedMs = joinedAt === null || nowMs === 0 ? 0 : Math.max(0, nowMs - joinedAt);
  const range = joinedAt === null || nowMs === 0 ? null : queueRangeAt(joinedAt, nowMs);

  async function toggle() {
    if (pending) return;
    setPending(true);
    try {
      if (inQueue) {
        await leave({});
        queuedRef.current = false;
      } else {
        queuedRef.current = true;
        await join({ stake: selectedStake > 0 ? selectedStake : undefined } as any);
      }
    } catch (error) {
      queuedRef.current = inQueue;
      toast.error(describeConvexError(error, "Matchmaking is unavailable right now."));
    } finally {
      setPending(false);
    }
  }

  const handleAcceptIncoming = async (challengeId: string) => {
    try {
      const res = await respondChallenge({ challengeId, accept: true });
      if (res?.gameId) {
        toast.success("Challenge accepted! Match starting...");
        router.push(`/game/${res.gameId}`);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to accept challenge");
    }
  };

  const handleDeclineIncoming = async (challengeId: string) => {
    try {
      await respondChallenge({ challengeId, accept: false });
      toast.success("Challenge declined");
    } catch (err: any) {
      toast.error(err.message || "Failed to decline challenge");
    }
  };

  return (
    <div className="space-y-3">
      {/* Live Incoming Challenge Prompt */}
      {incomingChallenges && incomingChallenges.length > 0 && (
        <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4 shadow-sm space-y-3 animate-in fade-in duration-200">
          {incomingChallenges.map((c: any) => (
            <div key={c._id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <Avatar className="size-8 ring-2 ring-emerald-500">
                  <AvatarImage src={c.fromPlayer?.avatarUrl} alt={c.fromPlayer?.username} />
                  <AvatarFallback className="text-xs font-bold">
                    {initials(c.fromPlayer?.username ?? "?")}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-xs font-bold text-foreground">
                    ⚔️ <strong>{c.fromPlayer?.username}</strong> ({formatRating(c.fromPlayer?.ratingHuman)}) challenged you!
                  </p>
                  <p className="text-[11px] text-emerald-500 font-bold mt-0.5">
                    {c.stake ? `Stake: ${c.stake} ETB · Winner gets ${Math.round(c.stake * 2 * 0.9)} ETB` : "Casual match (Free)"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => handleAcceptIncoming(c._id)}
                  className="h-8 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
                >
                  <Check className="size-3.5" /> Accept
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleDeclineIncoming(c._id)}
                  className="h-8 text-xs font-semibold gap-1"
                >
                  <X className="size-3.5" /> Decline
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Mode Sub-Tabs: Quick Match vs Direct Challenge */}
      {!inQueue && (
        <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-muted/40 border border-border/70 w-fit">
          <button
            type="button"
            onClick={() => setMatchMode("quick")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              matchMode === "quick"
                ? "bg-background text-foreground shadow-xs border border-border/60"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            ⚡ Quick Matchmaking
          </button>
          <button
            type="button"
            onClick={() => setMatchMode("direct")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              matchMode === "direct"
                ? "bg-background text-foreground shadow-xs border border-border/60"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            🎯 Direct Player Challenge
          </button>
        </div>
      )}

      {/* In-Queue state */}
      {inQueue && (
        <QueuePanelView
          className={className}
          seat={seat}
          elapsedMs={elapsedMs}
          range={range}
          myRating={myRating}
          pending={pending}
          flash={flash}
          stake={(status as any)?.stake || selectedStake}
          onCancel={toggle}
          onPlayAi={onPlayAi}
        />
      )}

      {/* Quick Matchmaking Seat */}
      {!inQueue && matchMode === "quick" && (
        <MatchSeatView
          className={className}
          seat={seat}
          myRating={myRating}
          loading={enabled && status === undefined}
          pending={pending}
          disabled={disabled}
          disabledReason={disabledReason}
          primary={primary}
          flash={flash}
          onFind={toggle}
          selectedStake={selectedStake}
          onStakeChange={setSelectedStake}
          balance={balance}
          customStakeInput={customStakeInput}
          setCustomStakeInput={setCustomStakeInput}
          isCustom={isCustom}
          setIsCustom={setIsCustom}
        />
      )}

      {/* Direct Player Challenge Seat */}
      {!inQueue && matchMode === "direct" && (
        <DirectChallengeSeatView
          className={className}
          seat={seat}
          balance={balance}
          onChallengeAccepted={(gameId) => router.push(`/game/${gameId}`)}
          initialUsername={challengeUser || undefined}
        />
      )}
    </div>
  );
}
