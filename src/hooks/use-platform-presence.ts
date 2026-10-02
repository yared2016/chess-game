"use client";

import { useEffect } from "react";
import { useConvexAuth, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";

const PLATFORM_HEARTBEAT_INTERVAL_MS = 30_000;

/**
 * Periodically beats the platform-wide presence mutation while the player is
 * authenticated and the document is visible.
 *
 * Silently catches failed beats so network hiccups never disrupt the user.
 */
export function usePlatformPresence(): void {
  const { isAuthenticated } = useConvexAuth();
  const heartbeat = useMutation(api.presence.heartbeat);

  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;

    const beat = () => {
      if (cancelled) return;
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      void heartbeat({}).catch(() => undefined);
    };

    beat();
    const id = setInterval(beat, PLATFORM_HEARTBEAT_INTERVAL_MS);
    document.addEventListener("visibilitychange", beat);

    return () => {
      cancelled = true;
      clearInterval(id);
      document.removeEventListener("visibilitychange", beat);
    };
  }, [isAuthenticated, heartbeat]);
}
