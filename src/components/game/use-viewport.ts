"use client";
// src/components/game/use-viewport.ts  [U2]
// One media query, read the hydration-safe way: the server snapshot is `false`
// (desktop) and the first client snapshot is taken in the same commit, so the
// game screen never flashes the wrong layout (UI_REDESIGN quality floor).
import { useCallback, useSyncExternalStore } from "react";

/** Tailwind's `lg`. Below it §5.3's column layout applies. */
const COMPACT_QUERY = "(max-width: 1023.98px)";

function subscribeTo(query: string) {
  return (onChange: () => void): (() => void) => {
    if (typeof window === "undefined" || !window.matchMedia) return () => {};
    const mql = window.matchMedia(query);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  };
}

/** Hoisted so `useSyncExternalStore` sees a stable subscribe and never re-subscribes. */
const subscribeCompact = subscribeTo(COMPACT_QUERY);

function matches(query: string): boolean {
  return typeof window !== "undefined" && window.matchMedia
    ? window.matchMedia(query).matches
    : false;
}

/** True on phones and small tablets — the §5.3 layout. */
export function useIsCompact(): boolean {
  const getSnapshot = useCallback(() => matches(COMPACT_QUERY), []);
  return useSyncExternalStore(subscribeCompact, getSnapshot, () => false);
}

/** Landscape query for phones and tablets. */
const LANDSCAPE_QUERY = "(orientation: landscape)";
const subscribeLandscape = subscribeTo(LANDSCAPE_QUERY);

/** True when the viewport is horizontal/landscape. */
export function useIsLandscape(): boolean {
  const getSnapshot = useCallback(() => matches(LANDSCAPE_QUERY), []);
  return useSyncExternalStore(subscribeLandscape, getSnapshot, () => false);
}

/**
 * Toggles or requests horizontal (landscape) vs vertical (portrait) view.
 * Uses Screen Orientation API when available, with fallback to Fullscreen.
 */
export async function toggleScreenOrientation(toLandscape: boolean): Promise<void> {
  if (typeof window === "undefined") return;

  if (toLandscape) {
    try {
      if (document.documentElement && !document.fullscreenElement && document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen().catch(() => {});
      }
      if (window.screen?.orientation && "lock" in window.screen.orientation) {
        // @ts-expect-error - Screen Orientation API lock
        await window.screen.orientation.lock("landscape").catch(() => {});
      }
    } catch {
      // Browser permissions or unsupported API fallback
    }
  } else {
    try {
      if (window.screen?.orientation && "unlock" in window.screen.orientation) {
        window.screen.orientation.unlock();
      }
      if (window.screen?.orientation && "lock" in window.screen.orientation) {
        // @ts-expect-error - Screen Orientation API lock
        await window.screen.orientation.lock("portrait").catch(() => {});
      }
      if (document.fullscreenElement && document.exitFullscreen) {
        await document.exitFullscreen().catch(() => {});
      }
    } catch {
      // Fallback
    }
  }
}
