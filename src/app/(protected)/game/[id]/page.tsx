// src/app/(protected)/game/[id]/page.tsx  [P3]
// Server component: `params` is a Promise in Next 16 (nextjs16-shadcn.md §2) and the
// route is protected by src/proxy.ts plus (protected)/layout.tsx. The preload gives
// the shell a first-render value so SSR markup and the first client render agree.
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { preloadQuery, preloadedQueryResult } from "convex/nextjs";
import { GameShell } from "@/components/game/game-shell";
import { getAuthToken } from "@/lib/convex-server";
import type { GameId, GameView } from "@/lib/types";
import { api } from "../../../../../convex/_generated/api";

export const metadata: Metadata = {
  title: "Game",
};

/** Convex ids are opaque strings; anything obviously not one is a 404, not a crash. */
function looksLikeConvexId(value: string): boolean {
  return /^[a-z0-9_-]{16,64}$/i.test(value);
}

export default async function GamePage({ params }: PageProps<"/game/[id]">) {
  const { id } = await params;
  if (!looksLikeConvexId(id)) notFound();

  let initialView: GameView | null = null;
  try {
    const token = await Promise.race([
      getAuthToken(),
      new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), 300)),
    ]);
    if (token) {
      const preloaded = await Promise.race([
        preloadQuery(
          api.games.get,
          { gameId: id as GameId },
          { token },
        ),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 400)),
      ]);
      if (preloaded) {
        initialView = preloadedQueryResult(preloaded);
      }
    }
  } catch {
    // If server preload fails or token is unavailable, client-side WebSocket query hydrates seamlessly.
  }

  return <GameShell gameId={id as GameId} initialView={initialView} />;
}
