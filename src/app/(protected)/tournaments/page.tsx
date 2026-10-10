// src/app/(protected)/tournaments/page.tsx
import type { Metadata } from "next";
import { TournamentList } from "@/components/tournaments/tournament-list";
import { Section } from "@/components/ui-kit";

export const metadata: Metadata = {
  title: "Tournaments & Arenas — Abay Chess",
  description: "Join competitive chess arenas, climb tournament leaderboards, and battle for the prize pool.",
};

export default function TournamentsPage() {
  return (
    <Section width="app" padding="md" className="pt-6 sm:pt-8" innerClassName="max-w-6xl mx-auto">
      <TournamentList />
    </Section>
  );
}
