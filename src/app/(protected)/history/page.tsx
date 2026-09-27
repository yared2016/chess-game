import type { Metadata } from "next";
import { GameHistoryView } from "@/components/history/game-history-view";
import { Section } from "@/components/ui-kit";

export const metadata: Metadata = {
  title: "Match History & Analysis",
  description: "Review and analyze your previous chess matches, inspect moves with Stockfish, and export PGN files.",
};

export default function HistoryPage() {
  return (
    <Section width="app" padding="md" className="py-8 sm:py-10">
      <GameHistoryView />
    </Section>
  );
}
