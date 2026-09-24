"use client";
// src/components/ui-kit/shortcuts-dialog.tsx
import * as React from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/ui";
import { InfoIcon, KeyboardIcon, XIcon } from "lucide-react";

export interface Shortcut {
  /** One entry per key cap: ["Shift", "?"] or ["←"]. */
  keys: string[];
  label: string;
  /** Heading the row is filed under, e.g. "Board". Ungrouped rows come first. */
  group?: string;
}

export interface ShortcutsDialogProps {
  shortcuts: Shortcut[];
  open?: boolean;
  onOpenChange?(open: boolean): void;
  /** Optional trigger element; omit when the dialog is controlled by a shortcut. */
  trigger?: React.ReactNode;
  title?: string;
  description?: string;
  /** A closing line under the list — how to make a move, where reset lives. */
  note?: React.ReactNode;
  className?: string;
}

/** Keyboard help (§5.1). Fully custom modal with fixed header, explicit X button, card rows, and scrollable body. */
export function ShortcutsDialog({
  shortcuts,
  open,
  onOpenChange,
  trigger,
  title = "Keyboard shortcuts",
  description = "Shortcuts are ignored while you are typing in a text box.",
  note,
  className,
}: ShortcutsDialogProps) {
  const groups = new Map<string, Shortcut[]>();
  for (const shortcut of shortcuts) {
    const key = shortcut.group ?? "";
    const existing = groups.get(key);
    if (existing) existing.push(shortcut);
    else groups.set(key, [shortcut]);
  }

  const [containerEl, setContainerEl] = React.useState<HTMLElement | null>(null);
  React.useEffect(() => {
    if (typeof document === "undefined") return;
    const el = document.querySelector<HTMLElement>('[data-slot="game-frame"].virtual-landscape');
    setContainerEl(el);
  });

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      {trigger ? <DialogPrimitive.Trigger render={trigger as React.ReactElement} /> : null}
      <DialogPrimitive.Portal container={containerEl ?? undefined}>
        <DialogPrimitive.Backdrop
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs transition-opacity duration-150 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0"
        />
        <DialogPrimitive.Popup
          data-slot="shortcuts-dialog"
          className={cn(
            "fixed top-1/2 left-1/2 z-50 -translate-x-1/2 -translate-y-1/2",
            "w-[calc(100%-2rem)] sm:w-[500px] max-w-lg",
            "max-h-[min(540px,calc(100%-2rem))] h-[min(580px,calc(100%-2rem))]",
            "flex flex-col overflow-hidden",
            "rounded-2xl border border-border/80 bg-card text-card-foreground shadow-2xl",
            "outline-none duration-150 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
            className,
          )}
        >
          {/* Header with Keyboard icon, title, description, and prominent X close button */}
          <div className="shrink-0 flex items-center justify-between border-b border-border/60 px-5 py-3.5 bg-muted/20">
            <div className="flex items-center gap-3 min-w-0">
              <div className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <KeyboardIcon className="size-4" />
              </div>
              <div className="min-w-0">
                <DialogPrimitive.Title className="text-sm font-bold text-foreground">
                  {title}
                </DialogPrimitive.Title>
                <DialogPrimitive.Description className="text-xs text-muted-foreground truncate mt-0.5">
                  {description}
                </DialogPrimitive.Description>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onOpenChange?.(false)}
              className="size-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors shrink-0 ml-2 cursor-pointer"
              aria-label="Close shortcuts dialog"
            >
              <XIcon className="size-4" />
            </button>
          </div>

          {/* Scrollable list styled with category cards and distinct key badges */}
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-5 space-y-4">
            {[...groups.entries()].map(([group, rows]) => (
              <div key={group || "general"} className="space-y-1.5">
                <div className="flex items-center gap-2 px-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    {group || "General"}
                  </span>
                </div>
                <div className="rounded-xl border border-border/50 bg-muted/20 divide-y divide-border/40 overflow-hidden">
                  {rows.map((row) => (
                    <div
                      key={`${group}-${row.label}`}
                      className="flex items-center justify-between gap-3 px-3 py-2 text-xs hover:bg-muted/40 transition-colors"
                    >
                      <span className="font-medium text-foreground/90">{row.label}</span>
                      <div className="flex shrink-0 items-center gap-1">
                        {row.keys.map((key, i) => (
                          <React.Fragment key={key}>
                            {i > 0 && (
                              <span className="text-[10px] text-muted-foreground/60 font-semibold">+</span>
                            )}
                            <kbd className="inline-flex items-center justify-center min-w-5 h-6 px-1.5 text-[11px] font-mono font-semibold rounded-md border border-border/80 bg-background/90 text-foreground shadow-xs">
                              {key}
                            </kbd>
                          </React.Fragment>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {note ? (
              <div className="rounded-xl border border-border/50 bg-muted/30 p-3 text-[11px] leading-relaxed text-muted-foreground flex items-start gap-2.5">
                <InfoIcon className="size-4 text-primary shrink-0 mt-0.5" />
                <div className="flex-1">{note}</div>
              </div>
            ) : null}
          </div>

          {/* Footer with shortcut hint and explicit Close button */}
          <div className="shrink-0 flex items-center justify-between border-t border-border/60 px-5 py-3 bg-muted/20">
            <span className="text-[11px] text-muted-foreground/80">
              Press <kbd className="px-1 py-0.5 font-mono text-[10px] border border-border/60 rounded bg-muted">Esc</kbd> anytime to close
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange?.(false)}
              className="h-8 px-4 text-xs font-semibold cursor-pointer"
            >
              Close
            </Button>
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
