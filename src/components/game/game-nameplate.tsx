"use client";
// src/components/game/game-nameplate.tsx  [U2]
// UI_UPGRADE_2 §4.1. The two plain player rows become NAMEPLATES: a 48px walnut
// plate with a seam hairline carrying, in reading order,
//
//   turn lamp · avatar disc · name (title weight) + rating (mono) · mode chip
//   · [status pill slot] · captured tray + material balance (mono)
//
// The lamp is the only baize on the screen that is not the board: it lights for
// the side to move (DESIGN.md, The Live Green Rule) and switches to brass with
// the word "reviewing" while the board is rewound (§4.8 item 6), so a reader who
// arrows through the game always has a second place that agrees with the pill.
//
// On a phone the plate compresses to 40px and the tray hides behind its own
// balance chip, which expands it on tap.
import { Clock, Eye, WifiOffIcon } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PieceGlyph } from "@/components/board2d/pieces-svg";
import { cn, initials } from "@/lib/ui";
import type { CapturedPieces, Colour, PlayerSummary } from "@/lib/types";
import { CapturedTray } from "./captured-tray";

export type NameplateLamp = "off" | "to-move" | "reviewing";

export interface GameNameplateProps extends React.ComponentProps<"div"> {
  name: string;
  player: PlayerSummary | null;
  colour: Colour;
  /** "off" is dark, "to-move" is baize, "reviewing" is brass (§4.8 item 6). */
  lamp: NameplateLamp;
  captured: CapturedPieces;
  /** "AI · Beginner", "Online · Rated", "Local" — the mode chip of §4.1. */
  modeChip?: string;
  /** Spectators, shown on both mobile and desktop. */
  watching?: number;
  /** Turn countdown in seconds, e.g. 60s forfeit clock or active timer. */
  countdown?: number | null;
  /** Only ever true for the opponent in an online game (FR-32). */
  stale?: boolean;
  /** True if this plate represents the viewing player. */
  isYou?: boolean;
  /** Which edge carries the seam hairline. */
  seam?: "top" | "bottom";
  /** Slot before the tray — the status pill sits here on the far plate. */
  children?: React.ReactNode;
}

const LAMP_TEXT: Record<NameplateLamp, string | null> = {
  off: null,
  "to-move": "to move",
  reviewing: "reviewing",
};

export function GameNameplate({
  name,
  player,
  colour,
  lamp,
  captured,
  modeChip,
  watching,
  countdown = null,
  stale = false,
  isYou,
  seam = "bottom",
  className,
  children,
  ...props
}: GameNameplateProps) {
  const lampText = LAMP_TEXT[lamp];

  return (
    <div
      data-slot="game-nameplate"
      className={cn(
        // Walnut plate, seam hairline, no shadow: this is structure, not a
        // floating layer (DESIGN.md, The Only-Floating-Things-Cast-Shadows Rule).
        "flex min-h-10 shrink-0 items-center gap-1.5 bg-card px-2 py-1 sm:min-h-12 sm:gap-2.5 sm:px-3 overflow-hidden",
        seam === "bottom" ? "border-b border-border" : "border-t border-border",
        className,
      )}
      {...props}
    >
      {/* --------------------------------------------------------- turn lamp */}
      <span
        className={cn(
          "flex shrink-0 items-center gap-1.5 text-[12px] leading-none font-medium",
          lamp === "to-move" && "text-live",
          lamp === "reviewing" && "text-primary",
        )}
      >
        <span
          aria-hidden
          data-lit={lamp === "off" ? "false" : lamp === "reviewing" ? "review" : "true"}
          className={cn(
            "game-lamp size-1.5 shrink-0 rounded-full",
            lamp === "off" && "bg-border",
            lamp === "to-move" && "bg-live",
            lamp === "reviewing" && "bg-primary",
          )}
        />
        {lampText ? (
          // Hidden below `sm` where the plate is 40px and the name has to win the
          // width; the status pill above the board still says whose move it is.
          <span className="hidden sm:inline">{lampText}</span>
        ) : null}
      </span>

      {/* ------------------------------------------------------------ player */}
      <Avatar size="sm" className="shrink-0">
        {player?.avatarUrl ? <AvatarImage src={player.avatarUrl} alt="" /> : null}
        <AvatarFallback>{initials(name)}</AvatarFallback>
      </Avatar>

      <div className="flex min-w-0 items-center gap-1.5 overflow-hidden">
        <PieceGlyph
          type="p"
          colour={colour}
          className="hidden sm:inline-block size-3.5 shrink-0 translate-y-0.5 [&>g]:stroke-foreground/70"
          title={colour === "w" ? "Plays white" : "Plays black"}
        />
        <span
          className={cn(
            "inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-semibold tracking-wide shrink-0",
            colour === "w"
              ? "bg-amber-100/90 text-amber-950 border border-amber-300 dark:bg-amber-950/70 dark:text-amber-100 dark:border-amber-800"
              : "bg-neutral-800 text-neutral-100 border border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200",
          )}
        >
          {colour === "w" ? "White" : "Black"}
        </span>
        <span className="truncate text-sm font-semibold text-foreground">{name}</span>
        {isYou !== undefined ? (
          <span
            className={cn(
              "shrink-0 text-[12px] font-medium text-muted-foreground",
              !isYou && "hidden sm:inline"
            )}
          >
            {isYou ? "(You)" : "(Opponent)"}
          </span>
        ) : null}
        {player?.rating == null ? null : (
          <span className="tabular shrink-0 font-mono text-[12px] sm:text-[13px] text-muted-foreground">
            {player.rating}
          </span>
        )}
      </div>

      {/* §4.1: the tray is this player's material, so it sits with this player's
          name — not parked at the far edge of a 1040px plate where a single pawn
          glyph reads as a stray icon. The mode chip takes the `ml-auto` instead. */}
      <CapturedTray captured={captured} colour={colour} collapsible className="shrink-0" />

      {/* Everything that is about the GAME rather than about this player rides one
          `ml-auto` at the far end, so the plate reads as two groups and not as four
          things drifting apart. */}
      <div className="ml-auto flex min-w-0 shrink-0 items-center gap-2">
        {modeChip ? (
          <span className="hidden shrink-0 rounded-full bg-bg-sunken px-2 py-0.5 text-[12px] leading-none font-medium text-muted-foreground md:inline-block">
            {modeChip}
          </span>
        ) : null}

        {typeof watching === "number" ? (
          <span
            className={cn(
              "tabular inline-flex shrink-0 items-center gap-1.5 font-mono text-[11px] sm:text-[12px] px-2.5 py-0.5 rounded-full border transition-all duration-200 shadow-xs",
              watching > 0
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 shadow-[0_0_8px_rgba(16,185,129,0.15)]"
                : "bg-muted/40 text-muted-foreground/80 border-border/40"
            )}
            title={`${watching} spectator${watching === 1 ? "" : "s"} watching`}
          >
            <Eye className={cn("size-3.5", watching > 0 ? "text-emerald-400 animate-pulse" : "text-muted-foreground/70")} />
            <span className="font-semibold">{watching}</span>
            <span className="hidden sm:inline font-sans text-[11px]">watching</span>
          </span>
        ) : null}

        {lamp === "to-move" && countdown !== null && countdown !== undefined ? (
          <span
            className={cn(
              "tabular inline-flex shrink-0 items-center gap-1 font-mono text-[11px] sm:text-[12px] px-2 py-0.5 rounded-full border transition-colors",
              countdown <= 15
                ? "bg-destructive/15 text-destructive border-destructive/40 animate-pulse font-bold"
                : "bg-primary/10 text-primary border-primary/30"
            )}
            title={`${countdown}s turn time remaining`}
          >
            <Clock className="size-3 shrink-0" />
            <span>{countdown}s</span>
          </span>
        ) : null}

        {stale ? (
          <span
            role="status"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] sm:text-[12px] text-destructive border border-destructive/30"
          >
            <WifiOffIcon className="size-3 sm:size-3.5" aria-hidden />
            {countdown !== null && countdown !== undefined ? `Forfeit in ${countdown}s` : "Disconnected"}
          </span>
        ) : null}

        {children}
      </div>
    </div>
  );
}
