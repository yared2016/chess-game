// src/components/game/fair-play-report-modal.tsx
"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { describeConvexError } from "@/lib/errors";
import { ShieldAlert, AlertTriangle, Eye, Clock, Flag, X } from "lucide-react";

interface FairPlayReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  gameId: Id<"games">;
  reportedPlayerId: Id<"players">;
  reportedUsername: string;
}

type ReportReason = "engine_assistance" | "suspicious_timing" | "stalling" | "other";

export function FairPlayReportModal({
  isOpen,
  onClose,
  gameId,
  reportedPlayerId,
  reportedUsername,
}: FairPlayReportModalProps) {
  const [reason, setReason] = useState<ReportReason>("engine_assistance");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const reportPlayerMutation = useMutation(api.fairPlay.reportPlayer);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await reportPlayerMutation({
        gameId,
        reportedPlayerId,
        reason,
        notes: notes.trim() || undefined,
      });
      toast.success("Fair Play report submitted", {
        description: `Our anti-cheat team and automated engine will review ${reportedUsername}'s moves and telemetry.`,
        icon: "🛡️",
      });
      onClose();
    } catch (err: any) {
      toast.error(describeConvexError(err, "Failed to submit report"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-2xl space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
              <ShieldAlert className="size-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground">Report for Fair Play</h3>
              <p className="text-xs text-muted-foreground">Reporting player: <span className="font-semibold text-foreground">{reportedUsername}</span></p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-muted-foreground hover:bg-muted transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Violation Reason
            </label>
            <div className="grid grid-cols-1 gap-2">
              <label
                className={`flex items-center gap-3 p-3 rounded-2xl border cursor-pointer transition-all ${
                  reason === "engine_assistance"
                    ? "border-destructive bg-destructive/5 text-foreground"
                    : "border-border hover:bg-muted/40 text-muted-foreground"
                }`}
              >
                <input
                  type="radio"
                  name="reason"
                  value="engine_assistance"
                  checked={reason === "engine_assistance"}
                  onChange={() => setReason("engine_assistance")}
                  className="sr-only"
                />
                <Eye className="size-4 text-destructive shrink-0" />
                <div className="text-left">
                  <p className="text-xs font-bold">External Engine Assistance</p>
                  <p className="text-[11px] text-muted-foreground">Using Stockfish, chess bot, or analysis board</p>
                </div>
              </label>

              <label
                className={`flex items-center gap-3 p-3 rounded-2xl border cursor-pointer transition-all ${
                  reason === "suspicious_timing"
                    ? "border-destructive bg-destructive/5 text-foreground"
                    : "border-border hover:bg-muted/40 text-muted-foreground"
                }`}
              >
                <input
                  type="radio"
                  name="reason"
                  value="suspicious_timing"
                  checked={reason === "suspicious_timing"}
                  onChange={() => setReason("suspicious_timing")}
                  className="sr-only"
                />
                <Clock className="size-4 text-amber-500 shrink-0" />
                <div className="text-left">
                  <p className="text-xs font-bold">Suspicious Tab Switching / Timing</p>
                  <p className="text-[11px] text-muted-foreground">Constant window defocus or uniform move intervals</p>
                </div>
              </label>

              <label
                className={`flex items-center gap-3 p-3 rounded-2xl border cursor-pointer transition-all ${
                  reason === "stalling"
                    ? "border-destructive bg-destructive/5 text-foreground"
                    : "border-border hover:bg-muted/40 text-muted-foreground"
                }`}
              >
                <input
                  type="radio"
                  name="reason"
                  value="stalling"
                  checked={reason === "stalling"}
                  onChange={() => setReason("stalling")}
                  className="sr-only"
                />
                <AlertTriangle className="size-4 text-amber-600 shrink-0" />
                <div className="text-left">
                  <p className="text-xs font-bold">Intentional Stalling</p>
                  <p className="text-[11px] text-muted-foreground">Letting time run out in a lost position</p>
                </div>
              </label>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-muted-foreground">
              Additional Details (Optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Blatant 99% accuracy after move 15, left tab on every critical position..."
              rows={3}
              maxLength={500}
              className="w-full rounded-2xl border border-border bg-muted/40 p-3 text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-xl text-xs font-bold"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="destructive"
              size="sm"
              disabled={isSubmitting}
              className="rounded-xl text-xs font-bold"
            >
              {isSubmitting ? "Submitting..." : "Submit Report"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
