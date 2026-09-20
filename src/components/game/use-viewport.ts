"use client";
// src/components/game/use-viewport.ts  [U2]
// One media query, read the hydration-safe way: the server snapshot is `false`
// (desktop) and the first client snapshot is taken in the same commit, so the
// game screen never flashes the wrong layout (UI_REDESIGN quality floor).
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

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

/**
 * Tracks the virtual keyboard height on mobile via the Visual Viewport API,
 * and sets `--keyboard-inset-bottom` on :root so sheets/dialogs automatically
 * lift above the keyboard.
 */
export function useKeyboardInset(): number {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined" || !window.visualViewport) return;

    const vv = window.visualViewport;
    const update = () => {
      // If visual viewport is shorter than window.innerHeight, the keyboard is open
      const diff = Math.max(0, Math.round(window.innerHeight - vv.height));
      setInset(diff);
      document.documentElement.style.setProperty("--keyboard-inset-bottom", `${diff}px`);
    };

    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    update();

    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
      document.documentElement.style.removeProperty("--keyboard-inset-bottom");
    };
  }, []);

  return inset;
}

