"use client";
// src/components/ui-kit/shortcuts-dialog.tsx  [U0]
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/ui";
import { Kbd } from "./kbd";
import { KeyboardIcon, XIcon } from "lucide-react";

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

/** Keyboard help (§5.1). Groups are derived from the array, never hard-coded. */
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger ? <DialogTrigger render={trigger as React.ReactElement} /> : null}
      <DialogContent
        showCloseButton={false}
        className={cn(
          "w-full sm:max-w-md max-h-[calc(100dvh-2.5rem)] flex flex-col overflow-hidden p-0 gap-0 rounded-2xl border border-border/60 bg-card shadow-2xl",
          className,
        )}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-border/50 px-4 py-3 sm:px-5 sm:py-3.5 bg-muted/15">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <KeyboardIcon className="size-4" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-sm font-bold text-foreground truncate">
                {title}
              </DialogTitle>
              <DialogDescription className="text-[11px] text-muted-foreground truncate mt-0.5">
                {description}
              </DialogDescription>
            </div>
          </div>
          <DialogClose
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                className="size-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/80 shrink-0 ml-2"
                aria-label="Close shortcuts dialog"
              >
                <XIcon className="size-4" />
              </Button>
            }
          />
        </div>

        {/* Scrollable list */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-3 sm:px-5 sm:py-4 space-y-4">
          {[...groups.entries()].map(([group, rows]) => (
            <div key={group || "general"} className="space-y-1.5">
              {group ? (
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80 px-0.5">
                  {group}
                </p>
              ) : null}
              <dl className="grid gap-1">
                {rows.map((row) => (
                  <div
                    key={`${group}-${row.label}`}
                    className="flex items-center justify-between gap-4 py-1.5 px-2 rounded-lg hover:bg-muted/30 transition-colors"
                  >
                    <dt className="text-xs text-foreground/90 font-medium">{row.label}</dt>
                    <dd className="flex shrink-0 items-center gap-1.5">
                      {row.keys.map((key) => (
                        <Kbd key={key} className="px-2 py-0.5 text-xs font-semibold shadow-xs">
                          {key}
                        </Kbd>
                      ))}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}

          {note ? (
            <div className="rounded-xl bg-muted/40 border border-border/40 p-3 mt-3">
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                {note}
              </p>
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="flex shrink-0 items-center justify-end border-t border-border/50 px-4 py-2.5 sm:px-5 sm:py-3 bg-muted/15">
          <DialogClose
            render={
              <Button size="sm" variant="outline" className="font-semibold text-xs h-8 px-4">
                Close
              </Button>
            }
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
