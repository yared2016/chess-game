import { Suspense } from "react";
import type { Metadata } from "next";
import { ModePicker } from "@/components/play/mode-picker";
import { OnlineNowRail } from "@/components/players/online-now-rail";
import { PlayersYouMayLike } from "@/components/players/players-you-may-like";
import { Display, Section } from "@/components/ui-kit";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Play" };

export default function PlayPage() {
  return (
    <Section width="app" padding="md" className="pt-8 sm:pt-10 space-y-8">
      {/* Header */}
      <header className="grid gap-2">
        <Display level={3} as="h1">
          Play
        </Display>
        <p className="text-[0.9375rem] leading-relaxed text-muted-foreground">Take a seat.</p>
      </header>

      {/* Live Online Rail */}
      <OnlineNowRail />

      {/* ModePicker with query params */}
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
        <ModePicker />
      </Suspense>

      {/* Recommended Player Discovery */}
      <PlayersYouMayLike />
    </Section>
  );
}
