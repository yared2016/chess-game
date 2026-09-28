"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import {
  X,
  FileText,
  Image as ImageIcon,
  ExternalLink,
  Gamepad2,
  Mail,
  RefreshCw,
  Save,
  Lock,
  Loader2,
  Copy,
  Check,
} from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { cn } from "@/lib/ui";
import { formatFileSize } from "../feedback/file-uploader";

export interface FeedbackItem {
  _id: Id<"feedback">;
  userId: Id<"players">;
  clerkId: string;
  userName: string;
  userEmail: string;
  userAvatarUrl?: string;
  category: string;
  description: string;
  gameId?: string;
  matchId?: string;
  tournamentId?: string;
  opponentUsername?: string;
  attachments: {
    storageId: Id<"_storage">;
    fileName: string;
    fileType: string;
    fileSize: number;
    uploadedAt: number;
  }[];
  status: "NEW" | "IN_REVIEW" | "RESOLVED" | "CLOSED";
  adminNotes?: string;
  emailStatus: "NOT_SENT" | "SENT" | "FAILED";
  emailError?: string;
  emailSentAt?: number;
  createdAt: number;
  updatedAt: number;
  resolvedAt?: number;
  resolvedBy?: string;
}

interface FeedbackDetailModalProps {
  feedback: FeedbackItem;
  onClose: () => void;
}

function AdminAttachmentItem({
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
  const attachmentUrl = useQuery(api.feedback.getAttachmentUrl, { feedbackId, storageId });
  const isPdf = fileType === "application/pdf";

  return (
    <div className="flex flex-col justify-between p-3 rounded-xl border border-border/80 bg-muted/20 gap-2">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="size-8 rounded-lg bg-card flex items-center justify-center shrink-0 border border-border/60">
          {isPdf ? (
            <FileText className="size-4 text-rose-400" />
          ) : (
            <ImageIcon className="size-4 text-primary" />
          )}
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-foreground truncate" title={fileName}>
            {fileName}
          </p>
          <p className="text-[10px] text-muted-foreground">{formatFileSize(fileSize)}</p>
        </div>
      </div>

      {attachmentUrl ? (
        <a
          href={attachmentUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-1.5 w-full py-1.5 px-2 rounded-lg bg-card hover:bg-muted text-xs font-semibold text-primary border border-border/60 transition-colors"
        >
          <ExternalLink className="size-3" />
          <span>{isPdf ? "Open Document" : "View Image"}</span>
        </a>
      ) : (
        <div className="flex items-center justify-center py-1.5 text-xs text-muted-foreground gap-1">
          <Loader2 className="size-3 animate-spin" />
          <span>Securing URL...</span>
        </div>
      )}
    </div>
  );
}

export function FeedbackDetailModal({ feedback, onClose }: FeedbackDetailModalProps) {
  const [adminNotes, setAdminNotes] = useState(feedback.adminNotes ?? "");
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [isRetryingEmail, setIsRetryingEmail] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState(false);

  const updateStatus = useMutation(api.feedback.adminUpdateStatus);
  const updateNotes = useMutation(api.feedback.adminUpdateNotes);
  const retryEmail = useMutation(api.feedback.adminRetryEmail);

  async function handleStatusChange(status: "NEW" | "IN_REVIEW" | "RESOLVED" | "CLOSED") {
    setIsUpdatingStatus(true);
    try {
      await updateStatus({ feedbackId: feedback._id, status });
      toast.success(`Status updated to ${status}`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to update status");
    } finally {
      setIsUpdatingStatus(false);
    }
  }

  async function handleSaveNotes() {
    setIsSavingNotes(true);
    try {
      await updateNotes({ feedbackId: feedback._id, adminNotes: adminNotes.trim() });
      toast.success("Admin notes saved.");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save admin notes");
    } finally {
      setIsSavingNotes(false);
    }
  }

  async function handleRetryEmail() {
    setIsRetryingEmail(true);
    try {
      await retryEmail({ feedbackId: feedback._id });
      toast.success("Confirmation email scheduled for retry.");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to retry email");
    } finally {
      setIsRetryingEmail(false);
    }
  }

  function handleCopyEmail() {
    if (!feedback.userEmail) return;
    navigator.clipboard.writeText(feedback.userEmail);
    setCopiedEmail(true);
    setTimeout(() => setCopiedEmail(false), 2000);
    toast.success("Email copied to clipboard");
  }

  const formattedCreated = new Date(feedback.createdAt).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-2xl max-h-[90vh] bg-card border border-border shadow-2xl rounded-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border/80 bg-muted/20">
          <div className="flex items-center gap-2.5">
            <span className="text-lg">♟</span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-foreground">Feedback Ticket</h2>
                <Badge variant="outline" className="text-xs font-mono uppercase">
                  #{feedback._id.slice(0, 8)}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">Submitted {formattedCreated}</p>
            </div>
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="size-8 rounded-lg text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" />
          </Button>
        </div>

        {/* Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Submitter & Category Section */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-muted/20 border border-border/70">
            {/* Player Info */}
            <div className="flex items-center gap-3">
              <Avatar className="size-11 border border-border">
                <AvatarImage src={feedback.userAvatarUrl} />
                <AvatarFallback className="font-bold text-xs">
                  {feedback.userName ? feedback.userName.slice(0, 2).toUpperCase() : "PL"}
                </AvatarFallback>
              </Avatar>

              <div className="min-w-0 space-y-0.5">
                <p className="text-sm font-bold text-foreground truncate">{feedback.userName}</p>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="truncate">{feedback.userEmail || "No email on file"}</span>
                  {feedback.userEmail && (
                    <button
                      type="button"
                      onClick={handleCopyEmail}
                      className="text-muted-foreground hover:text-foreground"
                      title="Copy email"
                    >
                      {copiedEmail ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Category & Status */}
            <div className="flex flex-col justify-center sm:items-end gap-1.5">
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground font-medium">Category:</span>
                <Badge variant="outline" className="text-xs font-semibold capitalize border-primary/30 text-primary">
                  {feedback.category.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                </Badge>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground font-medium">Status:</span>
                <Badge
                  variant="outline"
                  className={cn(
                    "text-xs font-semibold capitalize",
                    feedback.status === "NEW" && "border-blue-500/40 text-blue-400 bg-blue-500/10",
                    feedback.status === "IN_REVIEW" && "border-amber-500/40 text-amber-400 bg-amber-500/10",
                    feedback.status === "RESOLVED" && "border-emerald-500/40 text-emerald-400 bg-emerald-500/10",
                    feedback.status === "CLOSED" && "border-slate-500/40 text-slate-400 bg-slate-500/10"
                  )}
                >
                  {feedback.status.replace(/_/g, " ")}
                </Badge>
              </div>
            </div>
          </div>

          {/* Chess Context Bar if present */}
          {(feedback.gameId || feedback.opponentUsername || feedback.tournamentId || feedback.matchId) && (
            <div className="p-3.5 rounded-xl bg-primary/5 border border-primary/20 space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-primary">
                <Gamepad2 className="size-3.5" />
                <span>Associated Chess Context</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {feedback.gameId && (
                  <Link
                    href={`/game/${feedback.gameId}`}
                    target="_blank"
                    className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-md bg-card border border-border text-foreground hover:text-primary transition-colors"
                  >
                    <span>Game #{feedback.gameId.slice(0, 10)}</span>
                    <ExternalLink className="size-3 ml-0.5" />
                  </Link>
                )}
                {feedback.opponentUsername && (
                  <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-card border border-border text-muted-foreground">
                    Opponent: @{feedback.opponentUsername}
                  </span>
                )}
                {feedback.tournamentId && (
                  <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-card border border-border text-muted-foreground">
                    Tournament: {feedback.tournamentId}
                  </span>
                )}
                {feedback.matchId && (
                  <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-card border border-border text-muted-foreground">
                    Match: {feedback.matchId}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Description */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Feedback Description
            </h3>
            <div className="p-4 rounded-xl bg-muted/30 border border-border/70 text-sm text-foreground leading-relaxed whitespace-pre-wrap">
              {feedback.description}
            </div>
          </div>

          {/* Attachments Section */}
          {feedback.attachments && feedback.attachments.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Attachments ({feedback.attachments.length})
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {feedback.attachments.map((att) => (
                  <AdminAttachmentItem
                    key={att.storageId}
                    feedbackId={feedback._id}
                    storageId={att.storageId}
                    fileName={att.fileName}
                    fileSize={att.fileSize}
                    fileType={att.fileType}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Status Lifecycle Controls */}
          <div className="space-y-2 pt-2 border-t border-border/70">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Update Status
              </h3>
              {feedback.resolvedAt && feedback.resolvedBy && (
                <span className="text-[11px] text-emerald-500 font-medium">
                  Resolved by @{feedback.resolvedBy} on {new Date(feedback.resolvedAt).toLocaleDateString()}
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <Button
                type="button"
                variant={feedback.status === "NEW" ? "default" : "outline"}
                size="sm"
                onClick={() => handleStatusChange("NEW")}
                disabled={isUpdatingStatus || feedback.status === "NEW"}
                className="text-xs font-bold"
              >
                Mark New
              </Button>
              <Button
                type="button"
                variant={feedback.status === "IN_REVIEW" ? "default" : "outline"}
                size="sm"
                onClick={() => handleStatusChange("IN_REVIEW")}
                disabled={isUpdatingStatus || feedback.status === "IN_REVIEW"}
                className="text-xs font-bold"
              >
                In Review
              </Button>
              <Button
                type="button"
                variant={feedback.status === "RESOLVED" ? "default" : "outline"}
                size="sm"
                onClick={() => handleStatusChange("RESOLVED")}
                disabled={isUpdatingStatus || feedback.status === "RESOLVED"}
                className="text-xs font-bold text-emerald-500"
              >
                Resolved
              </Button>
              <Button
                type="button"
                variant={feedback.status === "CLOSED" ? "default" : "outline"}
                size="sm"
                onClick={() => handleStatusChange("CLOSED")}
                disabled={isUpdatingStatus || feedback.status === "CLOSED"}
                className="text-xs font-bold text-muted-foreground"
              >
                Close Ticket
              </Button>
            </div>
          </div>

          {/* Private Internal Admin Notes */}
          <div className="space-y-2 pt-2 border-t border-border/70">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                <Lock className="size-3 text-amber-500" />
                <span>Internal Staff Notes</span>
              </div>
              <span className="text-[11px] text-amber-500/80 font-medium">
                Confidential · Never shown to players
              </span>
            </div>

            <Textarea
              rows={3}
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              placeholder="Add private investigation notes, bug tracking URLs, or action items here..."
              className="text-xs rounded-xl bg-muted/20 border-border/80"
            />

            <div className="flex justify-end">
              <Button
                type="button"
                size="sm"
                onClick={handleSaveNotes}
                disabled={isSavingNotes || adminNotes === (feedback.adminNotes ?? "")}
                className="text-xs font-bold gap-1.5"
              >
                {isSavingNotes ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Save className="size-3.5" />
                )}
                Save Notes
              </Button>
            </div>
          </div>

          {/* Confirmation Email Delivery Status */}
          <div className="p-3.5 rounded-xl bg-muted/20 border border-border/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <Mail className="size-4 text-primary" />
              <div>
                <span className="font-semibold text-foreground">Confirmation Email: </span>
                <span
                  className={cn(
                    "font-bold capitalize",
                    feedback.emailStatus === "SENT" && "text-emerald-500",
                    feedback.emailStatus === "FAILED" && "text-rose-500",
                    feedback.emailStatus === "NOT_SENT" && "text-muted-foreground"
                  )}
                >
                  {feedback.emailStatus.replace(/_/g, " ")}
                </span>
                {feedback.emailError && (
                  <p className="text-[11px] text-rose-400 mt-0.5">{feedback.emailError}</p>
                )}
              </div>
            </div>

            {feedback.emailStatus !== "SENT" && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleRetryEmail}
                disabled={isRetryingEmail}
                className="text-xs font-bold gap-1.5 shrink-0"
              >
                <RefreshCw className={cn("size-3", isRetryingEmail && "animate-spin")} />
                Retry Email
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
