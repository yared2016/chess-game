"use client";

import { useState, useEffect } from "react";
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
  CheckCircle2,
  Clock,
  AlertCircle,
  XCircle,
} from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { StatusBadge } from "@/components/admin/ui";
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
  onStatusChange?: (newStatus: FeedbackItem["status"]) => void;
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
  const [showLightbox, setShowLightbox] = useState(false);

  return (
    <div className="flex flex-col justify-between p-3 rounded-2xl border border-border/80 bg-muted/20 gap-2.5">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="size-8 rounded-xl bg-card flex items-center justify-center shrink-0 border border-border/60">
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

      {/* Screenshot viewer for images */}
      {!isPdf && attachmentUrl && (
        <div
          onClick={() => setShowLightbox(true)}
          className="relative group rounded-xl overflow-hidden border border-border/60 bg-black/20 aspect-video flex items-center justify-center cursor-pointer"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={attachmentUrl}
            alt={fileName}
            className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-200"
          />
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs font-semibold transition-opacity">
            Preview Screenshot
          </div>
        </div>
      )}

      {attachmentUrl ? (
        <a
          href={attachmentUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-1.5 w-full py-1.5 px-2 rounded-xl bg-card hover:bg-muted text-xs font-semibold text-primary border border-border/60 transition-colors"
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

      {/* Lightbox Modal */}
      {showLightbox && attachmentUrl && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={() => setShowLightbox(false)}
        >
          <div
            className="relative max-w-4xl max-h-[85vh] overflow-hidden rounded-3xl bg-card p-2 border border-border shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setShowLightbox(false)}
              className="absolute top-4 right-4 z-10 p-1.5 rounded-full bg-black/60 text-white hover:bg-black/80"
              aria-label="Close screenshot preview"
            >
              <X className="size-4" />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={attachmentUrl}
              alt={fileName}
              className="max-h-[80vh] w-auto rounded-2xl object-contain mx-auto"
            />
          </div>
        </div>
      )}
    </div>
  );
}

export function FeedbackDetailModal({
  feedback,
  onClose,
  onStatusChange,
}: FeedbackDetailModalProps) {
  const [currentStatus, setCurrentStatus] = useState<FeedbackItem["status"]>(feedback.status);
  const [adminNotes, setAdminNotes] = useState(feedback.adminNotes ?? "");
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [isRetryingEmail, setIsRetryingEmail] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState(false);

  useEffect(() => {
    setCurrentStatus(feedback.status);
  }, [feedback.status]);

  const updateStatus = useMutation(api.feedback.adminUpdateStatus);
  const updateNotes = useMutation(api.feedback.adminUpdateNotes);
  const retryEmail = useMutation(api.feedback.adminRetryEmail);

  async function handleStatusChange(status: "NEW" | "IN_REVIEW" | "RESOLVED" | "CLOSED") {
    if (status === currentStatus || isUpdatingStatus) return;
    const previousStatus = currentStatus;
    setCurrentStatus(status);
    setIsUpdatingStatus(true);
    try {
      await updateStatus({ feedbackId: feedback._id, status });
      toast.success(`Status updated to ${status.replace(/_/g, " ")}`);
      onStatusChange?.(status);
    } catch (err: unknown) {
      setCurrentStatus(previousStatus);
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
      <div className="relative w-full max-w-2xl max-h-[90vh] bg-card border border-border shadow-2xl rounded-3xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
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
                <StatusBadge status={currentStatus.replace(/_/g, " ")} size="sm" />
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
          <div className="space-y-3 pt-2 border-t border-border/70">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="space-y-0.5">
                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Update Status
                </h3>
                {feedback.resolvedAt && feedback.resolvedBy && (
                  <span className="text-[11px] text-emerald-500 font-medium block">
                    Resolved by @{feedback.resolvedBy} on {new Date(feedback.resolvedAt).toLocaleDateString()}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <label htmlFor="feedback-status-dropdown" className="text-xs text-muted-foreground font-semibold">
                  Status:
                </label>
                <select
                  id="feedback-status-dropdown"
                  value={currentStatus}
                  onChange={(e) => handleStatusChange(e.target.value as FeedbackItem["status"])}
                  disabled={isUpdatingStatus}
                  className="rounded-xl border border-border/80 bg-background px-2.5 py-1 text-xs font-bold text-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
                >
                  <option value="NEW">NEW</option>
                  <option value="IN_REVIEW">IN_REVIEW</option>
                  <option value="RESOLVED">RESOLVED</option>
                  <option value="CLOSED">CLOSED</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {/* Mark New */}
              <button
                type="button"
                onClick={() => handleStatusChange("NEW")}
                disabled={isUpdatingStatus}
                className={cn(
                  "flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold border transition-all duration-150 select-none",
                  currentStatus === "NEW"
                    ? "bg-blue-600 hover:bg-blue-500 text-white border-blue-500 shadow-md shadow-blue-500/25 ring-2 ring-blue-400/50 scale-[1.02]"
                    : "border-blue-500/30 text-blue-400 bg-blue-500/5 hover:bg-blue-500/20 hover:border-blue-500/70 hover:text-blue-300 hover:shadow-sm hover:scale-[1.01] active:scale-[0.98] cursor-pointer"
                )}
              >
                {currentStatus === "NEW" ? (
                  <Check className="size-3.5 shrink-0 stroke-[3]" />
                ) : (
                  <Clock className="size-3.5 shrink-0" />
                )}
                <span>Mark New</span>
              </button>

              {/* In Review */}
              <button
                type="button"
                onClick={() => handleStatusChange("IN_REVIEW")}
                disabled={isUpdatingStatus}
                className={cn(
                  "flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold border transition-all duration-150 select-none",
                  currentStatus === "IN_REVIEW"
                    ? "bg-amber-600 hover:bg-amber-500 text-white border-amber-500 shadow-md shadow-amber-500/25 ring-2 ring-amber-400/50 scale-[1.02]"
                    : "border-amber-500/30 text-amber-400 bg-amber-500/5 hover:bg-amber-500/20 hover:border-amber-500/70 hover:text-amber-300 hover:shadow-sm hover:scale-[1.01] active:scale-[0.98] cursor-pointer"
                )}
              >
                {currentStatus === "IN_REVIEW" ? (
                  <Check className="size-3.5 shrink-0 stroke-[3]" />
                ) : (
                  <AlertCircle className="size-3.5 shrink-0" />
                )}
                <span>In Review</span>
              </button>

              {/* Resolved */}
              <button
                type="button"
                onClick={() => handleStatusChange("RESOLVED")}
                disabled={isUpdatingStatus}
                className={cn(
                  "flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold border transition-all duration-150 select-none",
                  currentStatus === "RESOLVED"
                    ? "bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500 shadow-md shadow-emerald-500/25 ring-2 ring-emerald-400/50 scale-[1.02]"
                    : "border-emerald-500/30 text-emerald-400 bg-emerald-500/5 hover:bg-emerald-500/20 hover:border-emerald-500/70 hover:text-emerald-300 hover:shadow-sm hover:scale-[1.01] active:scale-[0.98] cursor-pointer"
                )}
              >
                {currentStatus === "RESOLVED" ? (
                  <Check className="size-3.5 shrink-0 stroke-[3]" />
                ) : (
                  <CheckCircle2 className="size-3.5 shrink-0" />
                )}
                <span>Resolved</span>
              </button>

              {/* Close Ticket */}
              <button
                type="button"
                onClick={() => handleStatusChange("CLOSED")}
                disabled={isUpdatingStatus}
                className={cn(
                  "flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold border transition-all duration-150 select-none",
                  currentStatus === "CLOSED"
                    ? "bg-slate-700 hover:bg-slate-600 text-white border-slate-600 shadow-md shadow-slate-900/40 ring-2 ring-slate-400/50 scale-[1.02]"
                    : "border-slate-500/30 text-slate-400 bg-slate-500/5 hover:bg-slate-500/20 hover:border-slate-500/70 hover:text-slate-200 hover:shadow-sm hover:scale-[1.01] active:scale-[0.98] cursor-pointer"
                )}
              >
                {currentStatus === "CLOSED" ? (
                  <Check className="size-3.5 shrink-0 stroke-[3]" />
                ) : (
                  <XCircle className="size-3.5 shrink-0" />
                )}
                <span>Close Ticket</span>
              </button>
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
