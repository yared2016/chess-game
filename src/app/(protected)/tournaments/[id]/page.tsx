// src/app/(protected)/tournaments/[id]/page.tsx
import type { Metadata } from "next";
import { TournamentArenaView } from "@/components/tournaments/tournament-arena-view";
import { Section } from "@/components/ui-kit";
import type { Id } from "../../../../../convex/_generated/dataModel";

export const metadata: Metadata = {
  title: "Tournament Arena — Abay Chess",
  description: "Live tournament arena room with real-time pairings, countdowns, and standings.",
};

export default async function TournamentDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;

  return (
    <Section width="app" padding="md" className="pt-6 sm:pt-8" innerClassName="max-w-6xl mx-auto">
      <TournamentArenaView tournamentId={id as Id<"tournaments">} />
    </Section>
  );
}
