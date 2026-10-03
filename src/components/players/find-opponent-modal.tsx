"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { POPULAR_TIME_CONTROLS } from "@/components/play/time-control-picker";
import { initials, cn } from "@/lib/ui";
import { toast } from "sonner";
import { describeConvexError } from "@/lib/errors";
import {
  SwordsIcon,
  Clock,
  Coins,
  ShieldCheck,
  Dices,
  Circle,
  Wallet,
  ArrowUpRight,
  Trophy,
  AlertCircle,
} from "lucide-react";

export interface OpponentSummary {
  _id: Id<"players">;
  username: string;
  displayName: string;
  avatarUrl?: string;
  ratingHuman?: number;
  isOnline?: boolean;
  verificationStatus?: string;
}

interface FindOpponentModalProps {
  isOpen: boolean;
  onClose: () => void;
  opponent: OpponentSummary | null;
}

const PRESET_STAKES = [0, 10, 25, 50, 100, 200];

export function FindOpponentModal({ isOpen, onClose, opponent }: FindOpponentModalProps) {
  const createChallenge = useMutation(api.challenges.createChallenge);
  const balance = useQuery(api.wallets.getBalance);

  const [timeControlKey, setTimeControlKey] = useState("blitz_5_0");
  const [stake, setStake] = useState<number>(0);
  const [isCustomStake, setIsCustomStake] = useState(false);
  const [customStakeInput, setCustomStakeInput] = useState("");
  const [preferredColor, setPreferredColor] = useState<"random" | "white" | "black">("random");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!opponent) return null;

  const availableBalance = balance?.available ?? 0;
  const isStakeExceedingBalance = stake > 0 && stake > availableBalance;
  const isCustomInvalid = isCustomStake && (stake < 10 || !Number.isInteger(stake));
  const canSubmit = !isSubmitting && !isStakeExceedingBalance && !isCustomInvalid;

  const handleSelectPresetStake = (amount: number) => {
    setIsCustomStake(false);
    setStake(amount);
  };

  const handleCustomStakeChange = (value: string) => {
    setCustomStakeInput(value);
    const parsed = parseInt(value, 10);
    if (!isNaN(parsed) && parsed > 0) {
      setStake(parsed);
    } else {
      setStake(0);
    }
  };

  const handleSendChallenge = async () => {
    if (!canSubmit) return;
    setIsSubmitting(true);
    try {
      await createChallenge({
        toPlayerId: opponent._id,
        timeControlKey: timeControlKey === "unlimited" ? undefined : timeControlKey,
        stake: stake > 0 ? stake : undefined,
        preferredColor: preferredColor,
      });
      toast.success(`Challenge sent to @${opponent.username}!`);
      onClose();
    } catch (err: unknown) {
      toast.error(describeConvexError(err, "Failed to send challenge. Please try again."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const activeTimeControl = POPULAR_TIME_CONTROLS.find((tc) => tc.key === timeControlKey);
  const winnerPrize = stake > 0 ? Math.round(stake * 2 * 0.9) : 0;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg border-border/80 bg-background/95 p-6 backdrop-blur-xl max-h-[92vh] overflow-y-auto">
        <DialogHeader className="space-y-1.5 pb-2">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2 font-display text-xl font-bold tracking-tight">
              <SwordsIcon className="size-5 text-primary" />
              Challenge {opponent.displayName}
            </DialogTitle>
            <div className="flex items-center gap-1.5 rounded-full border border-border/80 bg-card/60 px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
              <Wallet className="size-3 text-amber-500" />
              <span>Balance:</span>
              <span className="font-mono font-bold text-foreground">
                {availableBalance.toLocaleString()} ETB
              </span>
            </div>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            Configure match rules, time controls, color preference, and optional stakes for @{opponent.username}.
          </DialogDescription>
        </DialogHeader>

        {/* Opponent Card Preview */}
        <div className="flex items-center gap-3.5 rounded-2xl border border-border/70 bg-card/50 p-3.5 shadow-xs">
          <div className="relative">
            <Avatar className="size-13 border border-border/80">
              <AvatarImage src={opponent.avatarUrl} alt={opponent.displayName} />
              <AvatarFallback className="font-bold">{initials(opponent.displayName || opponent.username)}</AvatarFallback>
            </Avatar>
            {opponent.isOnline && (
              <span
                className="absolute bottom-0 right-0 size-3 rounded-full border-2 border-background bg-emerald-500 animate-pulse"
                title="Online Now"
              />
            )}
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex items-center gap-2">
              <span className="truncate font-bold text-foreground text-sm">{opponent.displayName}</span>
              <Badge variant="outline" className="text-[0.65rem] font-bold text-primary border-primary/40 bg-primary/10">
                {opponent.ratingHuman ?? 1200}
              </Badge>
              {opponent.verificationStatus === "verified" && (
                <span title="Verified Player" className="inline-flex items-center">
                  <ShieldCheck className="size-3.5 text-primary" />
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              <span className="font-mono">@{opponent.username}</span>
              {opponent.isOnline && (
                <>
                  <span>•</span>
                  <span className="text-emerald-500 font-semibold flex items-center gap-1 text-[11px]">
                    <span className="size-1.5 rounded-full bg-emerald-500" />
                    Online
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4 py-1">
          {/* Time Control Picker */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-1.5 text-xs font-bold text-foreground uppercase tracking-wider">
                <Clock className="size-3.5 text-primary" />
                Time Control
              </Label>
              <span className="text-[11px] font-mono text-primary font-semibold">
                {activeTimeControl?.sublabel ?? timeControlKey}
              </span>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-3 gap-1.5">
              {POPULAR_TIME_CONTROLS.map((tc) => {
                const isSelected = timeControlKey === tc.key;
                const Icon = tc.icon;

                return (
                  <button
                    key={tc.key}
                    type="button"
                    onClick={() => setTimeControlKey(tc.key)}
                    className={cn(
                      "flex flex-col items-center justify-center p-2 rounded-xl border text-center transition-all cursor-pointer",
                      isSelected
                        ? "border-primary bg-primary/15 font-bold text-foreground ring-1 ring-primary/40 shadow-xs"
                        : "border-border/60 bg-card/50 text-muted-foreground hover:border-border hover:bg-muted/40 hover:text-foreground",
                    )}
                  >
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <Icon
                        className={cn(
                          "size-3.5",
                          isSelected ? "text-primary" : "text-muted-foreground/70",
                        )}
                      />
                      <span className="text-xs font-bold leading-none">{tc.label}</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground capitalize leading-tight">
                      {tc.category}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Color Preference Picker */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5 text-xs font-bold text-foreground uppercase tracking-wider">
              <Dices className="size-3.5 text-primary" />
              Play As
            </Label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setPreferredColor("white")}
                className={cn(
                  "flex items-center justify-center gap-2 rounded-xl border py-2 px-3 text-xs font-semibold transition-all cursor-pointer",
                  preferredColor === "white"
                    ? "border-primary bg-primary/15 font-bold text-foreground ring-1 ring-primary/40"
                    : "border-border/70 bg-card/50 text-muted-foreground hover:bg-muted/40 hover:text-foreground",
                )}
              >
                <Circle className="size-4 fill-white text-zinc-300 shadow-xs" />
                <span>White</span>
              </button>

              <button
                type="button"
                onClick={() => setPreferredColor("random")}
                className={cn(
                  "flex items-center justify-center gap-2 rounded-xl border py-2 px-3 text-xs font-semibold transition-all cursor-pointer",
                  preferredColor === "random"
                    ? "border-primary bg-primary/15 font-bold text-foreground ring-1 ring-primary/40"
                    : "border-border/70 bg-card/50 text-muted-foreground hover:bg-muted/40 hover:text-foreground",
                )}
              >
                <Dices className="size-4 text-primary" />
                <span>Random</span>
              </button>

              <button
                type="button"
                onClick={() => setPreferredColor("black")}
                className={cn(
                  "flex items-center justify-center gap-2 rounded-xl border py-2 px-3 text-xs font-semibold transition-all cursor-pointer",
                  preferredColor === "black"
                    ? "border-primary bg-primary/15 font-bold text-foreground ring-1 ring-primary/40"
                    : "border-border/70 bg-card/50 text-muted-foreground hover:bg-muted/40 hover:text-foreground",
                )}
              >
                <Circle className="size-4 fill-zinc-900 text-zinc-600 dark:fill-zinc-900" />
                <span>Black</span>
              </button>
            </div>
          </div>

          {/* Match Stake Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-1.5 text-xs font-bold text-foreground uppercase tracking-wider">
                <Coins className="size-3.5 text-amber-500" />
                Match Stake (ETB)
              </Label>
              {stake > 0 && (
                <span className="text-[11px] font-bold text-amber-500 font-mono">
                  {stake} ETB Staked
                </span>
              )}
            </div>

            <div className="flex flex-wrap gap-1.5">
              {PRESET_STAKES.map((amount) => {
                const isSelected = !isCustomStake && stake === amount;
                const isAffordable = amount === 0 || availableBalance >= amount;

                return (
                  <button
                    key={amount}
                    type="button"
                    onClick={() => handleSelectPresetStake(amount)}
                    disabled={!isAffordable}
                    className={cn(
                      "flex-1 min-w-[70px] rounded-xl border py-2 text-center text-xs font-bold transition-all cursor-pointer",
                      isSelected
                        ? "border-amber-500 bg-amber-500/15 font-extrabold text-amber-500 ring-1 ring-amber-500/40 shadow-xs"
                        : "border-border/70 bg-card/50 text-muted-foreground hover:border-border hover:bg-muted/40 hover:text-foreground",
                      !isAffordable && "opacity-40 cursor-not-allowed hover:bg-card/50 hover:text-muted-foreground",
                    )}
                  >
                    {amount === 0 ? "Casual" : `${amount} ETB`}
                  </button>
                );
              })}

              <button
                type="button"
                onClick={() => {
                  setIsCustomStake(true);
                  const parsed = parseInt(customStakeInput, 10);
                  if (!isNaN(parsed) && parsed >= 10) setStake(parsed);
                }}
                className={cn(
                  "flex-1 min-w-[70px] rounded-xl border py-2 text-center text-xs font-bold transition-all cursor-pointer",
                  isCustomStake
                    ? "border-amber-500 bg-amber-500/15 font-extrabold text-amber-500 ring-1 ring-amber-500/40 shadow-xs"
                    : "border-border/70 bg-card/50 text-muted-foreground hover:border-border hover:bg-muted/40 hover:text-foreground",
                )}
              >
                Custom
              </button>
            </div>

            {/* Custom Stake Input Field */}
            {isCustomStake && (
              <div className="pt-1 space-y-1.5 animate-in fade-in duration-150">
                <div className="relative">
                  <input
                    type="number"
                    min={10}
                    step={5}
                    value={customStakeInput}
                    onChange={(e) => handleCustomStakeChange(e.target.value)}
                    placeholder="Enter custom stake (min 10 ETB)"
                    className={cn(
                      "w-full h-10 rounded-xl border bg-background px-3.5 pr-14 text-xs font-bold text-foreground focus:outline-none focus:ring-2 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
                      isStakeExceedingBalance || isCustomInvalid
                        ? "border-rose-500/70 focus:ring-rose-500/30"
                        : "border-input focus:ring-primary/40",
                    )}
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground pointer-events-none">
                    ETB
                  </span>
                </div>
                {isCustomInvalid && (
                  <p className="text-[11px] text-rose-500 font-medium flex items-center gap-1">
                    <AlertCircle className="size-3" />
                    Minimum custom stake is 10 ETB (whole numbers only).
                  </p>
                )}
              </div>
            )}

            {/* Insufficient Funds Warning */}
            {isStakeExceedingBalance && (
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-2.5 flex items-center justify-between text-xs animate-in fade-in">
                <span className="text-[11px] text-rose-500 font-medium flex items-center gap-1.5">
                  <AlertCircle className="size-3.5 shrink-0" />
                  Insufficient balance for {stake} ETB stake. Available: {availableBalance} ETB.
                </span>
                <Link
                  href="/wallet"
                  className="text-[11px] font-bold text-rose-400 hover:text-rose-300 underline inline-flex items-center gap-0.5"
                >
                  Deposit <ArrowUpRight className="size-3" />
                </Link>
              </div>
            )}

            {/* Winner Payout Breakdown */}
            {stake > 0 && !isStakeExceedingBalance && (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 space-y-1 animate-in fade-in">
                <div className="flex items-center justify-between text-xs font-bold text-emerald-500">
                  <span className="flex items-center gap-1.5">
                    <Trophy className="size-4 text-emerald-500" />
                    Winner Payout:
                  </span>
                  <span className="font-mono text-sm font-extrabold">{winnerPrize} ETB</span>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Total escrow: {stake * 2} ETB ({stake} ETB per player) · 10% platform commission deducted automatically on game end.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2.5 pt-2 border-t border-border/70">
          <Button variant="outline" onClick={onClose} disabled={isSubmitting} className="flex-1 rounded-xl">
            Cancel
          </Button>
          <Button
            onClick={handleSendChallenge}
            disabled={!canSubmit}
            className={cn(
              "flex-1 gap-2 font-bold rounded-xl transition-all",
              stake > 0
                ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                : "bg-primary text-primary-foreground hover:bg-primary/90",
            )}
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <span className="size-3.5 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                Sending...
              </span>
            ) : (
              <>
                <SwordsIcon className="size-4" />
                Send Challenge ({stake > 0 ? `${stake} ETB` : "Casual"})
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
