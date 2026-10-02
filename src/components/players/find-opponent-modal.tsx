"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { initials } from "@/lib/ui";
import { toast } from "sonner";
import { describeConvexError } from "@/lib/errors";
import { SwordsIcon, Clock, Coins, ShieldCheck, GraduationCap } from "lucide-react";
import { cn } from "@/lib/ui";

export interface OpponentSummary {
  _id: Id<"players">;
  username: string;
  displayName: string;
  avatarUrl?: string;
  ratingHuman?: number;
  playerType?: "university_student" | "public_player";
  universityName?: string;
  verificationStatus?: "none" | "pending" | "verified";
}

interface FindOpponentModalProps {
  isOpen: boolean;
  onClose: () => void;
  opponent: OpponentSummary | null;
}

const TIME_CONTROLS = [
  { key: "1+0", label: "1 min", type: "Bullet" },
  { key: "3+0", label: "3 min", type: "Blitz" },
  { key: "5+0", label: "5 min", type: "Blitz" },
  { key: "10+0", label: "10 min", type: "Rapid" },
  { key: "15+10", label: "15 | 10", type: "Rapid" },
];

export function FindOpponentModal({ isOpen, onClose, opponent }: FindOpponentModalProps) {
  const createChallenge = useMutation(api.challenges.createChallenge);
  const [timeControlKey, setTimeControlKey] = useState("5+0");
  const [stake, setStake] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!opponent) return null;

  const handleSendChallenge = async () => {
    setIsSubmitting(true);
    try {
      await createChallenge({
        toPlayerId: opponent._id,
        timeControlKey,
        stake: stake > 0 ? stake : undefined,
      });
      toast.success(`Challenge sent to @${opponent.username}!`);
      onClose();
    } catch (err: unknown) {
      toast.error(describeConvexError(err, "Failed to send challenge. Please try again."));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md border-border/80 bg-background/95 p-6 backdrop-blur-md">
        <DialogHeader className="space-y-2">
          <DialogTitle className="flex items-center gap-2 font-display text-xl font-bold">
            <SwordsIcon className="size-5 text-primary" />
            Challenge {opponent.displayName}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Send a direct challenge to @{opponent.username}. They will receive a game invitation.
          </DialogDescription>
        </DialogHeader>

        {/* Opponent Card Preview */}
        <div className="my-2 flex items-center gap-3.5 rounded-xl border border-border/70 bg-card/50 p-3.5">
          <Avatar className="size-12 border border-border/80">
            <AvatarImage src={opponent.avatarUrl} alt={opponent.displayName} />
            <AvatarFallback>{initials(opponent.displayName || opponent.username)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex items-center gap-2">
              <span className="truncate font-semibold text-foreground">{opponent.displayName}</span>
              <Badge variant="outline" className="text-[0.65rem] font-bold text-primary">
                {opponent.ratingHuman ?? 1200}
              </Badge>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              <span>@{opponent.username}</span>
              {opponent.playerType === "university_student" && opponent.universityName && (
                <>
                  <span>•</span>
                  <span className="flex items-center gap-1 truncate text-amber-500">
                    <GraduationCap className="size-3" />
                    {opponent.universityName}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4 py-2">
          {/* Time Control Picker */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
              <Clock className="size-3.5 text-primary" />
              Time Control
            </Label>
            <div className="grid grid-cols-5 gap-1.5">
              {TIME_CONTROLS.map((tc) => (
                <button
                  key={tc.key}
                  type="button"
                  onClick={() => setTimeControlKey(tc.key)}
                  className={cn(
                    "flex flex-col items-center justify-center rounded-lg border py-2 text-center transition-all",
                    timeControlKey === tc.key
                      ? "border-primary bg-primary/10 font-bold text-primary ring-1 ring-primary/40"
                      : "border-border/70 bg-muted/20 text-muted-foreground hover:border-border hover:bg-muted/40",
                  )}
                >
                  <span className="text-xs font-semibold">{tc.label}</span>
                  <span className="text-[0.65rem] opacity-75">{tc.type}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Optional Match Stake */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
              <Coins className="size-3.5 text-amber-500" />
              Stake (ETB)
            </Label>
            <div className="grid grid-cols-4 gap-1.5">
              {[0, 50, 100, 200].map((amount) => (
                <button
                  key={amount}
                  type="button"
                  onClick={() => setStake(amount)}
                  className={cn(
                    "rounded-lg border py-1.5 text-center text-xs font-medium transition-all",
                    stake === amount
                      ? "border-amber-500 bg-amber-500/10 font-bold text-amber-500 ring-1 ring-amber-500/40"
                      : "border-border/70 bg-muted/20 text-muted-foreground hover:border-border hover:bg-muted/40",
                  )}
                >
                  {amount === 0 ? "Casual" : `${amount} ETB`}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 pt-2">
          <Button variant="outline" onClick={onClose} disabled={isSubmitting} className="flex-1">
            Cancel
          </Button>
          <Button onClick={handleSendChallenge} disabled={isSubmitting} className="flex-1 gap-2 font-semibold">
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <span className="size-3.5 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                Sending...
              </span>
            ) : (
              <>
                <SwordsIcon className="size-4" />
                Send Challenge
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
