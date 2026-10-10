import type { Metadata } from "next";
import { LeaderboardTable } from "@/components/leaderboard/leaderboard-table";
import { Display, Section } from "@/components/ui-kit";
import { LEADERBOARD_SIZE } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Grandmaster Leaderboard | Abay Chess",
  description: `The top ${LEADERBOARD_SIZE} players by rating, updating live as games finish.`,
};

/** Public (§G) — `leaderboard.top` needs no identity. */
export default function LeaderboardPage() {
  return (
    <Section width="app" padding="md" className="pt-6 sm:pt-10 pb-12 sm:pb-16">
      <header className="mb-6 sm:mb-8 space-y-2">
        <div className="flex items-center gap-2">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-500 text-[11px] font-bold tracking-wide">
            <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>LIVE STANDINGS</span>
          </div>
          <span className="text-[11px] text-muted-foreground">• Top {LEADERBOARD_SIZE} Rated</span>
        </div>

        <Display level={3} as="h1" className="text-2xl sm:text-4xl font-black tracking-tight">
          Grandmaster Leaderboard
        </Display>

        <p className="max-w-prose text-xs sm:text-[14px] text-muted-foreground leading-relaxed">
          Real-time global chess rankings across competitive Abay Chess game modes. Ratings calculate live the instant each checkmate or resignation is confirmed.
        </p>
      </header>

      <LeaderboardTable />
    </Section>
  );
}
