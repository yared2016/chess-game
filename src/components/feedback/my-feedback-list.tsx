"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
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
  Clock,
  CheckCircle2,
  FileText,
  Image as ImageIcon,
  ExternalLink,
  Loader2,
  Paperclip,
  Gamepad2,
} from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { cn } from "@/lib/ui";
import { formatFileSize } from "./file-uploader";

export interface MyFeedbackListProps {
  onCreateFeedback?: () => void;
}

const CATEGORY_MAP: Record<
  string,
  { label: string; icon: typeof Swords; color: string }
> = {
  chess_game: { label: "Chess Game", icon: Swords, color: "text-amber-500" },
  matchmaking: { label: "Matchmaking", icon: Users, color: "text-blue-500" },
  tournaments: { label: "Tournaments", icon: Trophy, color: "text-indigo-500" },
  wallet_payments: { label: "Wallet & Payments", icon: Wallet, color: "text-emerald-500" },
  account_profile: { label: "Account & Profile", icon: UserCheck, color: "text-purple-500" },
  website_app: { label: "App & Performance", icon: Layout, color: "text-cyan-500" },
  feature_request: { label: "Feature Request", icon: Lightbulb, color: "text-yellow-400" },
  report_problem: { label: "Report a Bug", icon: AlertCircle, color: "text-rose-500" },
  general_feedback: { label: "General Feedback", icon: MessageSquare, color: "text-primary" },
};

function StatusBadge({ status }: { status: "NEW" | "IN_REVIEW" | "RESOLVED" | "CLOSED" }) {
  switch (status) {
    case "NEW":
      return (
        <Badge variant="outline" className="border-blue-500/40 text-blue-400 bg-blue-500/10 font-semibold text-xs">
          <Clock className="size-3 mr-1" /> Received
        </Badge>
      );
    case "IN_REVIEW":
      return (
        <Badge variant="outline" className="border-amber-500/40 text-amber-400 bg-amber-500/10 font-semibold text-xs">
          <Clock className="size-3 mr-1" /> Under Review
        </Badge>
      );
    case "RESOLVED":
      return (
        <Badge variant="outline" className="border-emerald-500/40 text-emerald-400 bg-emerald-500/10 font-semibold text-xs">
          <CheckCircle2 className="size-3 mr-1" /> Resolved
        </Badge>
      );
    case "CLOSED":
      return (
        <Badge variant="outline" className="border-slate-500/40 text-slate-400 bg-slate-500/10 font-semibold text-xs">
          Closed
        </Badge>
      );
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

/** Individual attachment opener using secure getAttachmentUrl query */
function AttachmentButton({
  feedbackId,
  storageId,
  fileName,
  fileSize,
  fileType,
}: {
  feedbackId: Id<"feedback">;
  storageId: Id<"_storage">;
  fileName: string;
  fileSize: number;
  fileType: string;
}) {
  const [opening, setOpening] = useState(false);
  const attachmentUrl = useQuery(api.feedback.getAttachmentUrl, { feedbackId, storageId });

  async function handleOpen() {
    if (opening) return;
    if (attachmentUrl) {
      window.open(attachmentUrl, "_blank", "noopener,noreferrer");
      return;
    }

    setOpening(true);
    toast.info("Retrieving secure attachment link...");
    try {
      if (attachmentUrl) {
        window.open(attachmentUrl, "_blank", "noopener,noreferrer");
      }
    } finally {
      setOpening(false);
    }
  }

  const isPdf = fileType === "application/pdf";

  return (
    <button
      type="button"
      onClick={handleOpen}
      disabled={opening}
      className="inline-flex items-center gap-2 p-2 rounded-lg border border-border/70 bg-card hover:bg-muted/40 transition-colors text-left text-xs max-w-full group"
    >
      <div className="size-6 rounded bg-muted/60 flex items-center justify-center shrink-0">
        {isPdf ? (
          <FileText className="size-3.5 text-rose-400" />
        ) : (
          <ImageIcon className="size-3.5 text-primary" />
        )}
      </div>

      <div className="min-w-0">
        <p className="font-medium text-foreground truncate max-w-[140px] sm:max-w-[200px]" title={fileName}>
          {fileName}
        </p>
        <p className="text-[10px] text-muted-foreground">{formatFileSize(fileSize)}</p>
      </div>

      {opening ? (
        <Loader2 className="size-3.5 animate-spin text-muted-foreground ml-1 shrink-0" />
      ) : (
        <ExternalLink className="size-3.5 text-muted-foreground group-hover:text-primary transition-colors ml-1 shrink-0" />
      )}
    </button>
  );
}

export function MyFeedbackList({ onCreateFeedback }: MyFeedbackListProps) {
  const feedbackList = useQuery(api.feedback.getMyFeedback);

  // Loading state
  if (feedbackList === undefined) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="p-6 border-border/80 bg-card/60 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-5 w-24" />
            </div>
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-4 w-40" />
          </Card>
        ))}
      </div>
    );
  }

  // Empty state
  if (feedbackList.length === 0) {
    return (
      <Card className="p-12 border-border/80 bg-card/60 text-center rounded-2xl space-y-4">
        <div className="mx-auto size-14 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
          <MessageSquare className="size-7" />
        </div>

        <div className="space-y-1">
          <h3 className="text-lg font-bold text-foreground">No Feedback Yet</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            You have not submitted any feedback tickets yet. Have a thought, bug report, or feature request?
          </p>
        </div>

        {onCreateFeedback && (
          <Button
            type="button"
            onClick={onCreateFeedback}
            className="rounded-xl font-bold"
          >
            Share Your Feedback
          </Button>
        )}
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-1">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Your Submissions ({feedbackList.length})
        </p>
        {onCreateFeedback && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onCreateFeedback}
            className="text-xs text-primary hover:text-primary"
          >
            + New Feedback
          </Button>
        )}
      </div>

      <div className="space-y-3">
        {feedbackList.map((item) => {
          const catInfo = CATEGORY_MAP[item.category] ?? {
            label: item.category,
            icon: MessageSquare,
            color: "text-primary",
          };
          const CatIcon = catInfo.icon;
          const formattedDate = new Date(item.createdAt).toLocaleDateString(undefined, {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          });

          return (
            <Card
              key={item._id}
              className="p-5 sm:p-6 border-border/80 bg-card/70 backdrop-blur-sm rounded-2xl space-y-3 transition-all hover:border-border"
            >
              {/* Header row: Category & Status */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="size-7 rounded-lg bg-muted flex items-center justify-center">
                    <CatIcon className={cn("size-3.5", catInfo.color)} />
                  </div>
                  <span className="text-xs font-bold text-foreground">{catInfo.label}</span>
                </div>

                <div className="flex items-center gap-2">
                  <StatusBadge status={item.status} />
                  <span className="text-[11px] text-muted-foreground">{formattedDate}</span>
                </div>
              </div>

              {/* Description */}
              <p className="text-xs sm:text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">
                {item.description}
              </p>

              {/* Chess Context Badges if present */}
              {(item.gameId || item.opponentUsername || item.tournamentId || item.matchId) && (
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  {item.gameId && (
                    <Link
                      href={`/game/${item.gameId}`}
                      className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md bg-primary/10 border border-primary/20 text-primary hover:bg-primary/20 transition-colors"
                    >
                      <Gamepad2 className="size-3" />
                      Game #{item.gameId.slice(0, 8)}
                    </Link>
                  )}
                  {item.opponentUsername && (
                    <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-muted/60 border border-border/50 text-muted-foreground">
                      vs @{item.opponentUsername}
                    </span>
                  )}
                  {item.tournamentId && (
                    <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-muted/60 border border-border/50 text-muted-foreground">
                      Tournament: {item.tournamentId}
                    </span>
                  )}
                </div>
              )}

              {/* Attachments */}
              {item.attachments && item.attachments.length > 0 && (
                <div className="pt-2 border-t border-border/40 space-y-2">
                  <div className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
                    <Paperclip className="size-3 text-primary" />
                    <span>Attachments ({item.attachments.length})</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {item.attachments.map((att, idx) => (
                      <AttachmentButton
                        key={`${att.storageId}-${idx}`}
                        feedbackId={item._id}
                        storageId={att.storageId}
                        fileName={att.fileName}
                        fileSize={att.fileSize}
                        fileType={att.fileType}
                      />
                    ))}
                  </div>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
