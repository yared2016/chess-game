"use client";

import React, { useState, useEffect } from "react";
import { AlertTriangle, AlertCircle, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void> | void;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  requireReason?: boolean;
  reasonPlaceholder?: string;
  isDestructive?: boolean;
  targetName?: string;
  isLoading?: boolean;
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = "Confirm",
  cancelText = "Cancel",
  requireReason = false,
  reasonPlaceholder = "Please provide an administrative reason...",
  isDestructive = false,
  targetName,
  isLoading = false,
}: ConfirmDialogProps) {
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isActionLoading = isLoading || isSubmitting;
  const isConfirmDisabled = isActionLoading || (requireReason && !reason.trim());

  useEffect(() => {
    if (!isOpen) {
      setReason("");
      setIsSubmitting(false);
      return;
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isActionLoading) {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, isActionLoading]);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    if (requireReason && !reason.trim()) return;
    setIsSubmitting(true);
    try {
      await onConfirm(reason.trim());
      setReason("");
    } catch {
      // Handled by parent or toast
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-150">
      {/* Click outside to cancel */}
      <div
        className="fixed inset-0 -z-10"
        onClick={() => !isActionLoading && onClose()}
        aria-hidden="true"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        className="relative w-full max-w-md overflow-hidden rounded-3xl border border-border/80 bg-card p-6 shadow-2xl space-y-5 transition-all animate-in zoom-in-95 duration-150"
      >
        {/* Header with Alert Icon & Title */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span
              className={cn(
                "flex size-10 shrink-0 items-center justify-center rounded-2xl border shadow-xs",
                isDestructive
                  ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
                  : "bg-primary/10 text-primary border-primary/20"
              )}
            >
              {isDestructive ? (
                <AlertTriangle className="size-5" />
              ) : (
                <AlertCircle className="size-5" />
              )}
            </span>
            <div className="space-y-1">
              <h2
                id="confirm-dialog-title"
                className="text-base sm:text-lg font-bold tracking-tight text-foreground"
              >
                {title}
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                {description}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isActionLoading}
            className="rounded-xl p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-50"
            aria-label="Close dialog"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Optional Target Name Highlight */}
        {targetName && (
          <div className="rounded-2xl border border-border/60 bg-muted/20 px-3.5 py-2.5 text-xs flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Target
            </span>
            <span className="font-mono font-bold text-foreground truncate max-w-[220px]">
              {targetName}
            </span>
          </div>
        )}

        {/* Reason Input (High-Friction Auditing) */}
        {requireReason && (
          <div className="space-y-1.5">
            <label
              htmlFor="confirm-dialog-reason"
              className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-muted-foreground block"
            >
              Audit Reason <span className="text-rose-500">*</span>
            </label>
            <textarea
              id="confirm-dialog-reason"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={reasonPlaceholder}
              disabled={isActionLoading}
              className="w-full rounded-2xl border border-border/80 bg-background px-3.5 py-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary transition-colors resize-none disabled:opacity-50"
            />
            {!reason.trim() && (
              <p className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                A valid reason is required to proceed.
              </p>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-border/50">
          <button
            type="button"
            onClick={onClose}
            disabled={isActionLoading}
            className="rounded-xl border border-border/80 bg-muted/50 px-4 py-2 text-xs font-semibold text-foreground hover:bg-muted active:scale-[0.98] transition-all disabled:opacity-50"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isConfirmDisabled}
            className={cn(
              "rounded-xl px-4 py-2 text-xs font-bold shadow-xs active:scale-[0.98] transition-all inline-flex items-center gap-1.5",
              isDestructive
                ? "bg-rose-600 text-white hover:bg-rose-700 disabled:bg-rose-600/50"
                : "bg-primary text-primary-foreground hover:brightness-110 disabled:bg-primary/50",
              isConfirmDisabled && "cursor-not-allowed opacity-60"
            )}
          >
            {isActionLoading && <Loader2 className="size-3.5 animate-spin" />}
            <span>{confirmText}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
