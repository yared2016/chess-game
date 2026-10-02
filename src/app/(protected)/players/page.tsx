import type { Metadata } from "next";
import { PlayerSearchHub } from "@/components/players/player-search-hub";
import { Section } from "@/components/ui-kit";

export const metadata: Metadata = {
  title: "Player Directory",
  description: "Search and challenge Castle Chess players across university campuses and the global community.",
};

export default function PlayersPage() {
  return (
    <Section width="app" padding="md" className="pt-8 sm:pt-10">
      <PlayerSearchHub />
    </Section>
  );
}
