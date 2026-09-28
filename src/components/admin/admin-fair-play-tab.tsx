// src/components/admin/admin-fair-play-tab.tsx
"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { describeConvexError } from "@/lib/errors";
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Ban,
  Clock,
  Eye,
  CheckCircle2,
  RefreshCw,
  Search,
  ExternalLink,
  Coins,
  UserX,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export function AdminFairPlayTab() {
  const [activeSubTab, setActiveSubTab] = useState<"flagged" | "reports">("flagged");
  const [isActing, setIsActing] = useState(false);
  const [selectedAction, setSelectedAction] = useState<{
    action: "ban" | "warn" | "dismiss" | "refund";
    targetPlayerId: Id<"players">;
    targetUsername: string;
    gameId?: Id<"games">;
    reportId?: Id<"fairPlayReports">;
  } | null>(null);
  const [adminNote, setAdminNote] = useState("");

  const stats = useQuery(api.fairPlay.getFairPlayStats);
  const flaggedGames = useQuery(api.fairPlay.listFlaggedGames, { limit: 50 });
  const reports = useQuery(api.fairPlay.listReports, { status: "all", limit: 50 });
  const takeActionMutation = useMutation(api.fairPlay.takeFairPlayAction);

  const handleExecuteAction = async () => {
    if (!selectedAction) return;
    setIsActing(true);
    try {
      await takeActionMutation({
        action: selectedAction.action,
        targetPlayerId: selectedAction.targetPlayerId,
        gameId: selectedAction.gameId,
        reportId: selectedAction.reportId,
        adminNotes: adminNote.trim() || undefined,
      });

      const labelMap = {
        ban: "Account banned & wallet frozen",
        warn: "Warning issued to player",
        dismiss: "Flag dismissed as clean",
        refund: "Match stake refunded to opponent",
      };
      toast.success(labelMap[selectedAction.action]);
      setSelectedAction(null);
      setAdminNote("");
    } catch (err: any) {
      toast.error(describeConvexError(err, "Failed to execute fair play action"));
    } finally {
      setIsActing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-bold uppercase tracking-wider">Flagged Games</span>
            <ShieldAlert className="size-4 text-destructive" />
          </div>
          <p className="text-2xl font-black font-mono text-foreground">
            {stats?.totalFlaggedGames ?? "—"}
          </p>
          <p className="text-[11px] text-muted-foreground">Automated Ken Regan engine</p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-bold uppercase tracking-wider">Open Reports</span>
            <AlertTriangle className="size-4 text-amber-500" />
          </div>
          <p className="text-2xl font-black font-mono text-foreground">
            {stats?.pendingReports ?? "—"}
          </p>
          <p className="text-[11px] text-muted-foreground">Pending peer reviews</p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-bold uppercase tracking-wider">Banned Players</span>
            <Ban className="size-4 text-rose-500" />
          </div>
          <p className="text-2xl font-black font-mono text-foreground">
            {stats?.bannedPlayers ?? "—"}
          </p>
          <p className="text-[11px] text-muted-foreground">Restricted from matchmaking</p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-bold uppercase tracking-wider">Warned Players</span>
            <Clock className="size-4 text-sky-500" />
          </div>
          <p className="text-2xl font-black font-mono text-foreground">
            {stats?.warnedPlayers ?? "—"}
          </p>
          <p className="text-[11px] text-muted-foreground">Formal warnings served</p>
        </div>
      </div>

      {/* Sub Tab Switcher */}
      <div className="flex items-center gap-2 border-b border-border pb-3 overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveSubTab("flagged")}
          className={cn(
            "px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap shrink-0",
            activeSubTab === "flagged"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
          )}
        >
          <Eye className="size-3.5" />
          Automated Anomaly Detections ({flaggedGames?.length ?? 0})
        </button>

        <button
          onClick={() => setActiveSubTab("reports")}
          className={cn(
            "px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap shrink-0",
            activeSubTab === "reports"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
          )}
        >
          <AlertTriangle className="size-3.5" />
          Peer Reports ({reports?.length ?? 0})
        </button>
      </div>

      {/* Flagged Games List */}
      {activeSubTab === "flagged" && (
        <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
          {flaggedGames && flaggedGames.length > 0 ? (
            <div className="divide-y divide-border/60">
              {flaggedGames.map((item) => (
                <div key={item._id} className="p-4 sm:p-5 space-y-3 hover:bg-muted/20 transition-colors">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex size-9 items-center justify-center rounded-xl bg-destructive/15 font-black text-xs text-destructive shrink-0">
                        {item.suspicionScore}
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-sm text-foreground truncate">{item.playerUsername}</span>
                          <span className="rounded-full bg-destructive/10 text-destructive text-[10px] font-black px-2 py-0.5">
                            SUSPICION {item.suspicionScore}/100
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                          Game: <code className="font-mono text-[11px]">{item.gameId}</code>
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto pt-1 sm:pt-0">
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() =>
                          setSelectedAction({
                            action: "ban",
                            targetPlayerId: item.playerId,
                            targetUsername: item.playerUsername,
                            gameId: item.gameId,
                          })
                        }
                        className="rounded-xl text-xs font-bold h-8 flex-1 sm:flex-initial justify-center"
                      >
                        <Ban className="size-3.5 mr-1" />
                        Ban Player
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setSelectedAction({
                            action: "warn",
                            targetPlayerId: item.playerId,
                            targetUsername: item.playerUsername,
                            gameId: item.gameId,
                          })
                        }
                        className="rounded-xl text-xs font-bold h-8 flex-1 sm:flex-initial justify-center"
                      >
                        Warn
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setSelectedAction({
                            action: "refund",
                            targetPlayerId: item.playerId,
                            targetUsername: item.playerUsername,
                            gameId: item.gameId,
                          })
                        }
                        className="rounded-xl text-xs font-bold h-8 text-emerald-600 hover:text-emerald-700 flex-1 sm:flex-initial justify-center"
                      >
                        <Coins className="size-3.5 mr-1" />
                        Refund Stake
                      </Button>
                    </div>
                  </div>

                  {/* Telemetry Breakdown Details */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 rounded-xl bg-muted/40 text-xs">
                    <div>
                      <span className="text-muted-foreground text-[10px] uppercase font-bold block">Tab Defocus</span>
                      <span className="font-mono font-bold text-foreground">
                        {item.tabBlurCount} times ({Math.round(item.blursPerMove * 100)}% of turns)
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-[10px] uppercase font-bold block">Avg Move Time</span>
                      <span className="font-mono font-bold text-foreground">
                        {(item.avgMoveTimeMs / 1000).toFixed(1)}s
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-[10px] uppercase font-bold block">Cadence Variance</span>
                      <span className="font-mono font-bold text-foreground">
                        {item.moveTimeVariance}ms
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-[10px] uppercase font-bold block">Precision / ACPL</span>
                      <span className="font-mono font-bold text-foreground">
                        {item.acpl !== undefined ? `${item.acpl} ACPL` : "N/A"}
                      </span>
                    </div>
                  </div>

                  {item.flagReason && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-500/10 p-2.5 rounded-xl border border-amber-500/20">
                      <strong>Detection Signals:</strong> {item.flagReason}
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="p-12 text-center text-muted-foreground space-y-2">
              <ShieldCheck className="size-10 text-emerald-500 mx-auto" />
              <p className="text-sm font-bold text-foreground">All Games Clean</p>
              <p className="text-xs">No active games flagged for external assistance.</p>
            </div>
          )}
        </div>
      )}

      {/* Peer Reports List */}
      {activeSubTab === "reports" && (
        <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
          {reports && reports.length > 0 ? (
            <div className="divide-y divide-border/60">
              {reports.map((rep) => (
                <div key={rep._id} className="p-4 sm:p-5 space-y-3 hover:bg-muted/20 transition-colors">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-foreground">
                          {rep.reportedUsername}
                        </span>
                        <span
                          className={cn(
                            "text-[10px] font-black uppercase px-2 py-0.5 rounded-full",
                            rep.status === "pending"
                              ? "bg-amber-500/15 text-amber-600"
                              : rep.status === "banned"
                              ? "bg-destructive/15 text-destructive"
                              : "bg-emerald-500/15 text-emerald-600"
                          )}
                        >
                          {rep.status}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Reported by: <span className="font-semibold text-foreground">{rep.reporterUsername}</span> • Reason:{" "}
                        <span className="font-bold uppercase text-[11px] text-foreground">{rep.reason.replace("_", " ")}</span>
                      </p>
                    </div>

                    {rep.status === "pending" && (
                      <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto pt-1 sm:pt-0">
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() =>
                            setSelectedAction({
                              action: "ban",
                              targetPlayerId: rep.reportedPlayerId,
                              targetUsername: rep.reportedUsername,
                              gameId: rep.gameId,
                              reportId: rep._id,
                            })
                          }
                          className="rounded-xl text-xs font-bold h-8 flex-1 sm:flex-initial justify-center"
                        >
                          Ban
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setSelectedAction({
                              action: "dismiss",
                              targetPlayerId: rep.reportedPlayerId,
                              targetUsername: rep.reportedUsername,
                              reportId: rep._id,
                            })
                          }
                          className="rounded-xl text-xs font-bold h-8 flex-1 sm:flex-initial justify-center"
                        >
                          Dismiss Clean
                        </Button>
                      </div>
                    )}
                  </div>

                  {rep.notes && (
                    <p className="text-xs text-muted-foreground bg-muted/40 p-3 rounded-xl border border-border">
                      &quot;{rep.notes}&quot;
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="p-12 text-center text-muted-foreground space-y-2">
              <CheckCircle2 className="size-10 text-emerald-500 mx-auto" />
              <p className="text-sm font-bold text-foreground">No Pending Reports</p>
              <p className="text-xs">No player reports awaiting review.</p>
            </div>
          )}
        </div>
      )}

      {/* Confirmation Modal */}
      {selectedAction && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in"
          onClick={() => setSelectedAction(null)}
        >
          <div
            className="w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-bold text-foreground">
              Confirm Action: <span className="uppercase text-primary">{selectedAction.action}</span>
            </h3>
            <p className="text-xs text-muted-foreground">
              Target player: <span className="font-bold text-foreground">{selectedAction.targetUsername}</span>
            </p>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground">Admin Note (Internal Log)</label>
              <textarea
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
                placeholder="Document your review decision..."
                rows={2}
                className="w-full rounded-2xl border border-border bg-muted/40 p-2.5 text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedAction(null)}
                disabled={isActing}
                className="rounded-xl text-xs font-bold"
              >
                Cancel
              </Button>
              <Button
                variant={selectedAction.action === "ban" ? "destructive" : "default"}
                size="sm"
                onClick={handleExecuteAction}
                disabled={isActing}
                className="rounded-xl text-xs font-bold"
              >
                {isActing ? "Executing..." : `Confirm ${selectedAction.action.toUpperCase()}`}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
