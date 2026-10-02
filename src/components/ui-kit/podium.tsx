// src/components/ui-kit/podium.tsx  [U0]
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn, initials } from "@/lib/ui";
import { Crown, Medal, Award } from "lucide-react";

export interface PodiumEntry {
  /** 1, 2 or 3. */
  rank: number;
  name: string;
  rating: number;
  avatarUrl?: string | null;
  /** "18-4-2" or similar. */
  record?: string;
}

export interface PodiumProps extends React.ComponentProps<"ol"> {
  entries: PodiumEntry[];
  /** Wrap each name in a link to the profile. */
  renderName?(entry: PodiumEntry): React.ReactNode;
  /**
   * `"podium"` (default) is the Olympic three-column shape: 2 · 1 · 3, first place
   * raised in center. `"stack"` is the same three entries in one column.
   */
  layout?: "podium" | "stack";
}

/** Visual order 2 · 1 · 3: 2nd on left, 1st raised in center, 3rd on right. */
const ORDER_CLASS: Record<number, string> = {
  1: "order-2",
  2: "order-1",
  3: "order-3",
};

/** Olympic Grandmaster Podium: Top 3 with Gold, Silver, and Bronze pedestals */
export function Podium({
  entries,
  renderName,
  layout = "podium",
  className,
  ...props
}: PodiumProps) {
  const stacked = layout === "stack";

  return (
    <ol
      className={cn(
        "grid gap-2 sm:gap-4",
        stacked ? "grid-cols-1" : "grid-cols-3 items-end",
        className,
      )}
      aria-label="Top three players podium"
      {...props}
    >
      {entries.slice(0, 3).map((entry) => {
        const isFirst = entry.rank === 1;
        const isSecond = entry.rank === 2;

        return (
          <li
            key={entry.rank}
            className={cn(
              "flex flex-col items-center gap-1 sm:gap-2 rounded-2xl border text-center transition-all relative overflow-hidden",
              stacked ? null : ORDER_CLASS[entry.rank],
              isFirst
                ? "border-2 border-amber-500/60 bg-gradient-to-b from-amber-500/20 via-card to-card shadow-lg shadow-amber-500/10 px-2 sm:px-4 pb-3.5 pt-3 sm:pb-6 sm:pt-5"
                : isSecond
                  ? "border border-slate-300/50 dark:border-slate-600/60 bg-gradient-to-b from-slate-400/15 via-card to-card shadow-sm px-2 sm:px-4 pb-2.5 pt-2 sm:pb-4 sm:pt-3.5"
                  : "border border-amber-800/40 bg-gradient-to-b from-amber-900/20 via-card to-card shadow-sm px-2 sm:px-4 pb-2 pt-1.5 sm:pb-3 sm:pt-3",
            )}
          >
            {/* Rank Trophy Badge */}
            {isFirst ? (
              <div className="flex items-center justify-center gap-1 px-2 py-0.5 rounded-full bg-amber-500 text-black text-[10px] sm:text-xs font-black shadow-xs mb-1">
                <Crown className="size-3 sm:size-3.5 fill-black" />
                <span>1st</span>
              </div>
            ) : isSecond ? (
              <div className="flex items-center justify-center gap-1 px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-foreground text-[10px] sm:text-xs font-black mb-1">
                <Medal className="size-3 sm:size-3.5 text-slate-500 dark:text-slate-300" />
                <span>2nd</span>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-1 px-2 py-0.5 rounded-full bg-amber-900/30 text-amber-300 text-[10px] sm:text-xs font-black border border-amber-800/40 mb-1">
                <Award className="size-3 sm:size-3.5 text-amber-400" />
                <span>3rd</span>
              </div>
            )}

            {/* Avatar with Metallic Ring */}
            <Avatar
              className={cn(
                "transition-transform hover:scale-105",
                isFirst
                  ? "size-11 sm:size-16 ring-2 ring-amber-400 ring-offset-2 ring-offset-background shadow-md"
                  : isSecond
                    ? "size-9 sm:size-13 ring-2 ring-slate-300/70 dark:ring-slate-500 ring-offset-2 ring-offset-background"
                    : "size-9 sm:size-13 ring-2 ring-amber-700/70 ring-offset-2 ring-offset-background",
              )}
            >
              {entry.avatarUrl ? <AvatarImage src={entry.avatarUrl} alt={entry.name} /> : null}
              <AvatarFallback className="font-bold text-xs sm:text-base">
                {initials(entry.name)}
              </AvatarFallback>
            </Avatar>

            {/* Player Name */}
            <span
              className={cn(
                "max-w-full truncate text-foreground mt-1",
                isFirst
                  ? "text-xs sm:text-base font-black"
                  : "text-xs sm:text-sm font-bold",
              )}
            >
              {renderName ? renderName(entry) : entry.name}
            </span>

            {/* Rating */}
            <span
              className={cn(
                "font-mono font-black",
                isFirst
                  ? "text-xs sm:text-base text-amber-400"
                  : isSecond
                    ? "text-xs sm:text-sm text-foreground"
                    : "text-xs sm:text-sm text-amber-500/90",
              )}
            >
              {entry.rating}
              <span className="text-[10px] font-normal text-muted-foreground ml-1">Elo</span>
            </span>

            {/* Record W-D-L */}
            {entry.record ? (
              <span
                className={cn(
                  "font-mono text-[9px] sm:text-xs truncate max-w-full",
                  isFirst
                    ? "text-amber-200/80 font-medium"
                    : "text-muted-foreground",
                )}
              >
                {entry.record}
              </span>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
