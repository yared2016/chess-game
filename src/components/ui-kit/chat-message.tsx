"use client";
// src/components/ui-kit/chat-message.tsx  [U0]
import { useEffect, useState } from "react";
import { cn } from "@/lib/ui";

export type ChatMessageVariant = "ai" | "you" | "system" | "thinking";

export interface ChatMessageProps extends Omit<React.ComponentProps<"li">, "children"> {
  variant: ChatMessageVariant;
  children?: React.ReactNode;
  /** ai / thinking: the opponent's name, e.g. "Pip". */
  personaName?: string;
  /** ai / thinking: letter for the brass disc. Defaults to the name's first letter. */
  personaInitial?: string;
  /** ai: the move the line is about, e.g. "12. Nf3". */
  moveLabel?: string;
  /** Small brass tag inside the bubble, e.g. "Hint". */
  tag?: string;
  /** thinking: delay before "still thinking…" appears (§5.1). */
  stillThinkingAfterMs?: number;
  /** Assigned player side for side-based color-coding ("w" or "b"). */
  side?: "w" | "b" | null;
}

function PersonaDisc({ initial }: { initial: string }) {
  return (
    <span
      aria-hidden
      className="grid size-7 shrink-0 place-items-center rounded-full bg-primary text-[12px] font-medium text-primary-foreground"
    >
      {initial}
    </span>
  );
}

/**
 * Three pulsing dots that grow a "still thinking…" tail (§5.1). Its own component
 * so mounting and unmounting resets the timer — a `thinking` bubble that turns
 * into a real message and back must start counting from zero again.
 */
function ThinkingDots({ personaName, afterMs }: { personaName?: string; afterMs: number }) {
  const [still, setStill] = useState(false);

  useEffect(() => {
    const id = window.setTimeout(() => setStill(true), afterMs);
    return () => window.clearTimeout(id);
  }, [afterMs]);

  return (
    <span className="inline-flex items-center gap-2">
      <span aria-hidden className="inline-flex gap-1">
        {[0, 1, 2].map((i) => (
          // `game-typing-dot` (src/app/globals.css): a staggered lift and
          // fade rather than a generic pulse, and nothing at all under reduced
          // motion.
          <span
            key={i}
            className="game-typing-dot size-1.5 rounded-full bg-muted-foreground"
            style={{ animationDelay: `${i * 160}ms` }}
          />
        ))}
      </span>
      <span className="sr-only">{personaName ? `${personaName} is thinking` : "Thinking"}</span>
      {still ? <span className="text-muted-foreground">still thinking…</span> : null}
    </span>
  );
}

/** One row of the chat. Four layouts, one component (§5.1). */
export function ChatMessage({
  variant,
  children,
  personaName,
  personaInitial,
  moveLabel,
  tag,
  stillThinkingAfterMs = 3000,
  side,
  className,
  ...props
}: ChatMessageProps) {
  if (variant === "system") {
    return (
      <li className={cn("flex justify-center py-1", className)} {...props}>
        {/* §4.4: system events are centred parchment chips. */}
        <span className="game-bubble-in max-w-[85%] rounded-full bg-bg-sunken px-3 py-1 text-center text-[12px] text-muted-foreground">
          {children}
        </span>
      </li>
    );
  }

  if (variant === "you") {
    return (
      <li className={cn("flex flex-col items-end gap-1", className)} {...props}>
        {side ? (
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground pr-1">
            <span
              className={cn(
                "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold tracking-wide",
                side === "w"
                  ? "bg-amber-100/90 text-amber-950 border border-amber-300 dark:bg-amber-950/70 dark:text-amber-100 dark:border-amber-800"
                  : "bg-neutral-800 text-neutral-100 border border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200",
              )}
            >
              {side === "w" ? "White" : "Black"}
            </span>
            <span className="font-medium text-foreground">You</span>
          </div>
        ) : null}
        {/* §4.4: the player's bubble tucks its TOP-RIGHT corner to 4px and enters
            over `--dur-bubble` as a 6px rise, not a zoom (see game.css). */}
        <div
          className={cn(
            "game-bubble-in max-w-[85%] rounded-xl rounded-tr-[4px] bg-line px-3 py-2 text-[13px] text-foreground dark:text-primary",
            side === "w" && "border border-amber-300/50 dark:border-amber-700/50",
            side === "b" && "border border-neutral-700/60 dark:border-neutral-600/60",
          )}
        >
          {children}
        </div>
      </li>
    );
  }

  const initial = personaInitial ?? personaName?.[0]?.toUpperCase() ?? "AI";

  return (
    <li className={cn("flex gap-2", className)} {...props}>
      <PersonaDisc initial={initial} />
      <div className="min-w-0 max-w-[85%]">
        {personaName || moveLabel || side ? (
          <p className="mb-1 flex items-baseline gap-1.5 text-[12px] text-muted-foreground">
            {side ? (
              <span
                className={cn(
                  "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold tracking-wide",
                  side === "w"
                    ? "bg-amber-100/90 text-amber-950 border border-amber-300 dark:bg-amber-950/70 dark:text-amber-100 dark:border-amber-800"
                    : "bg-neutral-800 text-neutral-100 border border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200",
                )}
              >
                {side === "w" ? "White" : "Black"}
              </span>
            ) : null}
            {personaName ? <span className="font-medium text-foreground">{personaName}</span> : null}
            {moveLabel ? <span className="tabular font-mono">{moveLabel}</span> : null}
          </p>
        ) : null}
        {/* §4.4: opponent bubbles are walnut with the top-LEFT corner tucked to
            4px, so the tail points at the speaker. */}
        <div
          className={cn(
            "game-bubble-in rounded-xl rounded-tl-[4px] border border-border bg-card px-3 py-2 text-[13px] text-foreground",
            side === "w" && "border-amber-300/60 dark:border-amber-700/50",
            side === "b" && "border-neutral-700/80 dark:border-neutral-600/60",
          )}
        >
          {tag ? (
            <>
              <span className="mr-1.5 rounded-full bg-primary/15 px-1.5 py-0.5 text-[12px] font-medium tracking-wide text-primary uppercase">
                {tag}
              </span>
              {/* Inline children concatenate with no separator, so the hint bubble
                  announced as "HintNf3 …". A real one, for readers only. */}
              <span className="sr-only">: </span>
            </>
          ) : null}
          {variant === "thinking" ? (
            <ThinkingDots personaName={personaName} afterMs={stillThinkingAfterMs} />
          ) : (
            children
          )}
        </div>
      </div>
    </li>
  );
}
