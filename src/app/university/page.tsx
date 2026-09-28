// src/app/university/page.tsx
import type { Metadata } from "next";
import { UniversityLeaderboard } from "@/components/university/university-leaderboard";
import { Section } from "@/components/ui-kit";

export const metadata: Metadata = {
  title: "Ethiopian Universities League — Castle Chess",
  description: "Rankings and campus leaderboards for Ethiopian higher education institutions on Castle Chess.",
};

export default function UniversityPage() {
  return (
    <Section width="app" padding="md" className="pt-6 sm:pt-8" innerClassName="max-w-6xl mx-auto">
      <UniversityLeaderboard />
    </Section>
  );
}
