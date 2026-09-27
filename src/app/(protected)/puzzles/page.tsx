// src/app/(protected)/puzzles/page.tsx
import type { Metadata } from "next";
import { PuzzlesView } from "@/components/puzzles/puzzles-view";
import { Section } from "@/components/ui-kit";

export const metadata: Metadata = {
  title: "Tactical Puzzles Trainer — Castle Chess",
  description: "Solve daily tactical chess puzzles, climb the puzzle Elo leaderboard, and master tactical motifs.",
};

export default function PuzzlesPage() {
  return (
    <Section width="app" padding="md" className="pt-6 sm:pt-8" innerClassName="max-w-6xl mx-auto">
      <PuzzlesView />
    </Section>
  );
}
