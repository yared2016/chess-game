"use client";

import React, { useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface DetailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}

export function DetailDrawer({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  footer,
  className,
}: DetailDrawerProps) {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    // Prevent document body scrolling when drawer is open
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop with Blur */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer: Fullscreen sheet on mobile, slide-over drawer on desktop */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="detail-drawer-title"
        className={cn(
          "fixed inset-0 sm:left-auto sm:right-0 z-50 flex flex-col bg-card w-full sm:max-w-lg sm:border-l sm:border-border/80 shadow-2xl transition-all animate-in slide-in-from-bottom sm:slide-in-from-right duration-200",
          className
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-border/60 bg-card shrink-0">
          <div className="space-y-0.5 min-w-0 pr-3">
            <h2
              id="detail-drawer-title"
              className="text-base sm:text-lg font-bold tracking-tight text-foreground truncate"
            >
              {title}
            </h2>
            {subtitle && (
              <p className="text-xs text-muted-foreground truncate">
                {subtitle}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors shrink-0"
            aria-label="Close drawer"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {children}
        </div>

        {/* Optional Footer */}
        {footer && (
          <div className="p-4 sm:p-6 border-t border-border/60 bg-muted/20 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
