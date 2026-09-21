"use client";
// src/components/tutor/tutor-composer.tsx
// Asking the tutor a question: context-aware suggestions submit immediately,
// with a context line that says which position
// the answer will be about, and a field with a visible label — Enter sends,
// Shift+Enter starts a new line.
import { useId, useRef } from "react";
import { SendHorizontalIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useIsLandscape, useKeyboardInset } from "@/components/game/use-viewport";
import { cn, focusRing } from "@/lib/ui";

export interface TutorComposerProps {
  value: string;
  onChange(value: string): void;
  onSend(text?: string): void;
  suggestions: readonly string[];
  /** "Live position · move 14" or "Reviewing move 8". */
  context: string;
  /** Non-null disables the field and says why, in words, next to it. */
  disabledReason: string | null;
  className?: string;
}

export function TutorComposer({
  value,
  onChange,
  onSend,
  suggestions,
  context,
  disabledReason,
  className,
}: TutorComposerProps) {
  const fieldId = useId();
  const reasonId = useId();
  const field = useRef<HTMLTextAreaElement | null>(null);
  const disabled = disabledReason !== null;
  const empty = value.trim().length === 0;
  const isLandscape = useIsLandscape();
  const keyboardInset = useKeyboardInset();
  const hideSuggestions = isLandscape && keyboardInset > 0;

  return (
    <div
      data-base-ui-swipe-ignore="true"
      data-swipe-ignore="true"
      className={cn(
        "flex shrink-0 flex-col gap-1.5 border-t border-border p-2 sm:gap-2 sm:p-3 landscape:p-1.5",
        className,
      )}
    >
      {/* §3.4: which position the answer will be about, so a member reviewing move
          8 is never surprised by an answer about move 14. */}
      <p className={cn("tabular font-mono text-[11px] sm:text-[12px] text-muted-foreground", hideSuggestions ? "hidden" : "landscape:hidden")}>
        {context}
      </p>

      <div
        className={cn(
          "flex gap-1.5 overflow-x-auto pb-0.5 flex-nowrap lg:flex-wrap [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          hideSuggestions && "hidden",
        )}
      >
        {suggestions.map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            aria-disabled={disabled || undefined}
            onClick={() => {
              if (disabled) return;
              onSend(suggestion);
              field.current?.focus();
            }}
            className={cn(
              "min-h-7 shrink-0 cursor-pointer rounded-full border border-border/70 bg-card px-2.5 py-1 text-[11px] whitespace-nowrap sm:text-[12px]",
              "text-muted-foreground transition-all hover:border-primary/40 hover:text-foreground active:scale-95",
              "pointer-coarse:min-h-7.5 pointer-coarse:px-2.5 sm:pointer-coarse:min-h-9 sm:pointer-coarse:px-3",
              focusRing,
              disabled && "cursor-default opacity-50 hover:text-muted-foreground",
            )}
          >
            {suggestion}
          </button>
        ))}
      </div>

      <label htmlFor={fieldId} className="text-[12px] font-medium text-foreground sr-only sm:not-sr-only landscape:sr-only">
        Ask the tutor
      </label>
      <div className="flex items-end gap-1.5 rounded-2xl border border-input/60 bg-muted/40 p-1 pl-3 transition-all focus-within:border-primary/60 focus-within:bg-card focus-within:ring-2 focus-within:ring-primary/20">
        <textarea
          id={fieldId}
          ref={field}
          rows={1}
          value={value}
          readOnly={disabled}
          aria-disabled={disabled || undefined}
          aria-describedby={disabled ? reasonId : undefined}
          placeholder="Why is this square weak?"
          autoCapitalize="sentences"
          autoCorrect="on"
          spellCheck={true}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
            event.preventDefault();
            if (!empty && !disabled) onSend();
          }}
          className={cn(
            "field-sizing-content max-h-28 min-h-[38px] w-full min-w-0 resize-none border-0 bg-transparent",
            "py-2 text-[16px] sm:text-[13px] leading-snug text-foreground transition-colors outline-none",
            "placeholder:text-muted-foreground select-text focus:ring-0 focus-visible:ring-0",
            "aria-disabled:cursor-not-allowed aria-disabled:opacity-50",
          )}
        />
        <Button
          size="icon"
          aria-label="Send"
          disabled={disabled || empty}
          className="size-8.5 shrink-0 rounded-full active:scale-95 disabled:opacity-30"
          onClick={() => onSend()}
        >
          <SendHorizontalIcon aria-hidden className="size-4" />
        </Button>
      </div>
      {disabled ? (
        <p id={reasonId} className="text-[12px] text-muted-foreground">
          {disabledReason}
        </p>
      ) : null}
    </div>
  );
}
