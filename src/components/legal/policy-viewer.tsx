import React from "react";
import { ShieldCheck, Calendar } from "lucide-react";

interface PolicyViewerProps {
  title: string;
  version?: string;
  effectiveDate?: string;
  description?: string;
  children: React.ReactNode;
}

export function PolicyViewer({
  title,
  effectiveDate = "November 1, 2026",
  description,
  children,
}: PolicyViewerProps) {
  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Header Banner */}
      <div className="rounded-3xl border border-border/80 bg-card/60 p-6 sm:p-8 backdrop-blur-md shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-border/60">
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <ShieldCheck className="size-4.5" />
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-primary">
              Official Governance Document
            </span>
          </div>

          <div className="flex items-center gap-4 text-xs text-muted-foreground font-mono">
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="size-3.5" />
              Effective: {effectiveDate}
            </span>
          </div>
        </div>

        <div className="mt-5">
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
            {title}
          </h1>
          {description && (
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
              {description}
            </p>
          )}
        </div>
      </div>

      {/* Content Document Card */}
      <div className="rounded-3xl border border-border/80 bg-card p-6 sm:p-10 shadow-sm space-y-8 text-sm leading-relaxed text-muted-foreground">
        {children}
      </div>
    </div>
  );
}

export function LegalSection({
  title,
  number,
  children,
}: {
  title: string;
  number?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3 pt-4 first:pt-0 border-t border-border/40 first:border-t-0">
      <h2 className="text-lg sm:text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
        {number && <span className="text-primary font-mono text-base">{number}</span>}
        <span>{title}</span>
      </h2>
      <div className="space-y-2.5 text-xs sm:text-sm text-muted-foreground leading-relaxed">
        {children}
      </div>
    </section>
  );
}
