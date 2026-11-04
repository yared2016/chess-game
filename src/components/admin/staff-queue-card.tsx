"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import {
  Activity,
  AlertTriangle,
  Clock,
  Layers,
  Shield,
  Eye,
  EyeOff,
  CheckCircle2,
  XCircle,
  FileWarning,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface StaffQueueCardProps {
  unmaskedPii: boolean;
  onTogglePii: () => void;
}

export function StaffQueueCard({ unmaskedPii, onTogglePii }: StaffQueueCardProps) {
  const queueHealth = useQuery((api as any)["financial/queue"].getQueueHealth, {});

  const handleToggle = () => {
    if (!unmaskedPii) {
      toast.info("Player PII unmasked for current session. Action logged to audit trail under view_pii.");
    } else {
      toast.info("Player PII masked.");
    }
    onTogglePii();
  };

  const hasDeadLetter = queueHealth && queueHealth.deadLetter > 0;

  return (
    <section className="relative overflow-hidden rounded-3xl border border-border/80 bg-gradient-to-br from-card via-card/95 to-muted/20 p-5 sm:p-7 shadow-xs space-y-6">
      {/* Subtle Ambient Background Highlight matching Wallet hero */}
      <div className="absolute -right-16 -top-16 size-48 rounded-full bg-primary/10 blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/50 pb-4 relative z-10">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-2xl bg-primary/10 text-primary font-bold border border-primary/20 shadow-xs shrink-0">
            <Layers className="size-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold tracking-tight text-foreground">
                Staff Operations &amp; Durable Queue Monitor
              </h2>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 font-semibold">
                Scoped /fssmyfkl
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Operational queue telemetry, lease locking monitoring, and zero-trust staff PII governance
            </p>
          </div>
        </div>

        {/* PII Masking Control Button */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleToggle}
            className={`h-9 gap-1.5 text-xs font-semibold rounded-xl border-border/80 bg-card shadow-xs transition-colors ${
              unmaskedPii
                ? "text-primary border-primary/40 bg-primary/10 hover:bg-primary/20"
                : "text-foreground hover:bg-muted/50"
            }`}
          >
            {unmaskedPii ? (
              <>
                <EyeOff className="size-3.5 text-primary" />
                <span>Mask PII</span>
              </>
            ) : (
              <>
                <Eye className="size-3.5 text-emerald-500" />
                <span>Unmask PII (Audited)</span>
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Dead-Letter Alert Banner if DLQ > 0 */}
      {hasDeadLetter && (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-3.5 sm:p-4 flex items-center justify-between gap-3 text-rose-700 dark:text-rose-300 relative z-10">
          <div className="flex items-center gap-2.5">
            <FileWarning className="size-5 text-rose-500 shrink-0" />
            <div>
              <p className="text-xs font-bold uppercase tracking-wider">
                Attention Required: Dead-Letter Queue Tasks Detected
              </p>
              <p className="text-[11px] text-rose-700/80 dark:text-rose-300/80">
                {queueHealth?.deadLetter} background financial task(s) exceeded max retry limit (5 attempts) and require manual operator review.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Queue Health Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 relative z-10">
        {/* Total Tasks */}
        <div className="rounded-2xl border border-border/70 bg-card/60 p-3.5 space-y-1 backdrop-blur-xs">
          <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Total Tasks
          </span>
          <p className="text-xl sm:text-2xl font-mono font-bold tracking-tight text-foreground">
            {queueHealth?.totalTasks ?? "..."}
          </p>
        </div>

        {/* Pending */}
        <div className="rounded-2xl border border-border/70 bg-card/60 p-3.5 space-y-1 backdrop-blur-xs">
          <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Pending Tasks
          </span>
          <p className="text-xl sm:text-2xl font-mono font-bold tracking-tight text-amber-600 dark:text-amber-400">
            {queueHealth?.pending ?? "..."}
          </p>
        </div>

        {/* Processing */}
        <div className="rounded-2xl border border-border/70 bg-card/60 p-3.5 space-y-1 backdrop-blur-xs">
          <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            In Processing
          </span>
          <p className="text-xl sm:text-2xl font-mono font-bold tracking-tight text-blue-600 dark:text-blue-400">
            {queueHealth?.processing ?? "..."}
          </p>
        </div>

        {/* Active Leases */}
        <div className="rounded-2xl border border-border/70 bg-card/60 p-3.5 space-y-1 backdrop-blur-xs">
          <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Active Leases
          </span>
          <p className="text-xl sm:text-2xl font-mono font-bold tracking-tight text-purple-600 dark:text-purple-400">
            {queueHealth?.activeLeases ?? "..."}
          </p>
        </div>

        {/* Completed */}
        <div className="rounded-2xl border border-border/70 bg-card/60 p-3.5 space-y-1 backdrop-blur-xs">
          <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Completed
          </span>
          <p className="text-xl sm:text-2xl font-mono font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
            {queueHealth?.completed ?? "..."}
          </p>
        </div>

        {/* Dead Letter */}
        <div
          className={`rounded-2xl border p-3.5 space-y-1 backdrop-blur-xs ${
            hasDeadLetter
              ? "border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300"
              : "border-border/70 bg-card/60 text-muted-foreground"
          }`}
        >
          <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider">
            Dead-Letter (DLQ)
          </span>
          <p className={`text-xl sm:text-2xl font-mono font-bold tracking-tight ${hasDeadLetter ? "text-rose-600 dark:text-rose-400" : "text-foreground"}`}>
            {queueHealth?.deadLetter ?? "..."}
          </p>
        </div>
      </div>
    </section>
  );
}
