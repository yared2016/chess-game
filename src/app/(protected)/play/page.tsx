import { Suspense } from "react";
import type { Metadata } from "next";
import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { ModePicker } from "@/components/play/mode-picker";
import { OnlineNowRail } from "@/components/players/online-now-rail";
import { PlayersYouMayLike } from "@/components/players/players-you-may-like";
import { Display, Section } from "@/components/ui-kit";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Play" };

export default async function PlayPage({
  searchParams,
}: {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const isPlayerView = params?.view === "player";
  const user = await currentUser();
  const email = user?.emailAddresses?.[0]?.emailAddress?.toLowerCase();
  const isOwner = email === "yaredusk@gmail.com" || email === "yaredusk0@gmail.com";

  // If the Owner visits /play without explicitly choosing player view, route to Owner Command Center
  if (isOwner && !isPlayerView) {
    redirect("/yyhnan");
  }

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
