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
    <section className="rounded-3xl border border-border/80 bg-[#121513]/95 p-5 sm:p-6 shadow-xl space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
            <Layers className="size-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-black text-neutral-100">
                Staff Operations &amp; Durable Queue Monitor
              </h2>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                Scoped /fssmyfkl
              </span>
            </div>
            <p className="text-xs text-neutral-400">
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
            className={`h-9 gap-1.5 text-xs font-bold transition-all ${
              unmaskedPii
                ? "bg-amber-500/20 text-amber-300 border-amber-500/50 hover:bg-amber-500/30"
                : "bg-neutral-900 border-neutral-700 text-neutral-200 hover:bg-neutral-800"
            }`}
          >
            {unmaskedPii ? (
              <>
                <EyeOff className="size-3.5 text-amber-400" />
                <span>Mask PII</span>
              </>
            ) : (
              <>
                <Eye className="size-3.5 text-emerald-400" />
                <span>Unmask PII (Audited)</span>
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Dead-Letter Alert Banner if DLQ > 0 */}
      {hasDeadLetter && (
        <div className="rounded-2xl border border-rose-500/50 bg-rose-500/10 p-3 sm:p-4 flex items-center justify-between gap-3 text-rose-300">
          <div className="flex items-center gap-2.5">
            <FileWarning className="size-5 text-rose-400 shrink-0" />
            <div>
              <p className="text-xs font-black uppercase tracking-wider">
                Attention Required: Dead-Letter Queue Tasks Detected
              </p>
              <p className="text-[11px] text-rose-300/80">
                {queueHealth?.deadLetter} background financial task(s) exceeded max retry limit (5 attempts) and require manual operator review.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Queue Health Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Total Tasks */}
        <div className="rounded-2xl border border-neutral-800 bg-black/40 p-3.5 space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
            Total Tasks
          </span>
          <p className="text-xl font-mono font-black text-neutral-100">
            {queueHealth?.totalTasks ?? "..."}
          </p>
        </div>

        {/* Pending */}
        <div className="rounded-2xl border border-neutral-800 bg-black/40 p-3.5 space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
            Pending Tasks
          </span>
          <p className="text-xl font-mono font-black text-amber-400">
            {queueHealth?.pending ?? "..."}
          </p>
        </div>

        {/* Processing */}
        <div className="rounded-2xl border border-neutral-800 bg-black/40 p-3.5 space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
            In Processing
          </span>
          <p className="text-xl font-mono font-black text-blue-400">
            {queueHealth?.processing ?? "..."}
          </p>
        </div>

        {/* Active Leases */}
        <div className="rounded-2xl border border-neutral-800 bg-black/40 p-3.5 space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
            Active Leases
          </span>
          <p className="text-xl font-mono font-black text-purple-400">
            {queueHealth?.activeLeases ?? "..."}
          </p>
        </div>

        {/* Completed */}
        <div className="rounded-2xl border border-neutral-800 bg-black/40 p-3.5 space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
            Completed
          </span>
          <p className="text-xl font-mono font-black text-emerald-400">
            {queueHealth?.completed ?? "..."}
          </p>
        </div>

        {/* Dead Letter */}
        <div
          className={`rounded-2xl border p-3.5 space-y-1 ${
            hasDeadLetter
              ? "border-rose-500/60 bg-rose-500/10 text-rose-300"
              : "border-neutral-800 bg-black/40 text-neutral-400"
          }`}
        >
          <span className="text-[10px] font-bold uppercase tracking-wider">
            Dead-Letter (DLQ)
          </span>
          <p className={`text-xl font-mono font-black ${hasDeadLetter ? "text-rose-400" : "text-neutral-100"}`}>
            {queueHealth?.deadLetter ?? "..."}
          </p>
        </div>
      </div>
    </section>
  );
}
