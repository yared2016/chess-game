"use client";
// src/components/game/use-viewport.ts  [U2]
// One media query, read the hydration-safe way: the server snapshot is `false`
// (desktop) and the first client snapshot is taken in the same commit, so the
// game screen never flashes the wrong layout (UI_REDESIGN quality floor).
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { useUiStore } from "@/lib/stores/ui-store";

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
 * In mobile browsers, Screen Orientation API strictly requires Fullscreen.
 */
export async function toggleScreenOrientation(toLandscape: boolean): Promise<void> {
  if (typeof window === "undefined") return;

  if (toLandscape) {
    try {
      if (!document.fullscreenElement) {
        const docEl = document.documentElement as HTMLElement & {
          webkitRequestFullscreen?: () => Promise<void> | void;
        };
        if (typeof docEl.requestFullscreen === "function") {
          await docEl.requestFullscreen().catch(() => {});
        } else if (typeof docEl.webkitRequestFullscreen === "function") {
          await docEl.webkitRequestFullscreen();
        }
      }
      useUiStore.getState().setLayoutMode("focus");
      if (window.screen?.orientation && "lock" in window.screen.orientation) {
        // @ts-expect-error - Screen Orientation API lock
        await window.screen.orientation.lock("landscape").catch(async () => {
          // @ts-expect-error - Screen Orientation API lock fallback
          await window.screen.orientation.lock("landscape-primary").catch(() => {});
        });
      }
    } catch {
      // Browser permissions or unsupported API fallback
    }
  } else {
    try {
      if (window.screen?.orientation && "unlock" in window.screen.orientation) {
        window.screen.orientation.unlock();
      }
      if (document.fullscreenElement) {
        const doc = document as Document & {
          webkitExitFullscreen?: () => Promise<void> | void;
        };
        if (typeof doc.exitFullscreen === "function") {
          await doc.exitFullscreen().catch(() => {});
        } else if (typeof doc.webkitExitFullscreen === "function") {
          await doc.webkitExitFullscreen();
        }
      }
      useUiStore.getState().setLayoutMode("default");
    } catch {
      // Fallback
    }
  }
}

/**
 * Tracks the virtual keyboard on mobile via the Visual Viewport API.
 * - `inset`: Unhandled keyboard overlap over the layout viewport (non-zero only
 *   when layout viewport does NOT shrink, e.g. iOS Safari without interactive-widget).
 * - `isOpen`: True whenever the virtual keyboard is open.
 */
export function useKeyboardMetrics(): { inset: number; isOpen: boolean } {
  const [metrics, setMetrics] = useState({ inset: 0, isOpen: false });

  useEffect(() => {
    if (typeof window === "undefined") return;

    let maxSeenHeight = window.innerHeight;
    let lastWidth = window.innerWidth;

    const update = () => {
      const vv = window.visualViewport;
      let unhandledInset = 0;
      let isOpen = false;

      // If screen orientation changed (width changed), reset baseline
      if (window.innerWidth !== lastWidth) {
        lastWidth = window.innerWidth;
        maxSeenHeight = window.innerHeight;
      }

      if (vv) {
        if (vv.height > maxSeenHeight) {
          maxSeenHeight = vv.height;
        }

        // 1. iOS Safari / browsers where layout viewport doesn't shrink with keyboard:
        const layoutDiff = window.innerHeight - (vv.height + vv.offsetTop);
        if (layoutDiff > 30) {
          unhandledInset = Math.max(0, Math.round(layoutDiff));
          isOpen = true;
        } else if (maxSeenHeight - vv.height > 100) {
          // 2. Android Chrome / Samsung where layout viewport shrinks with keyboard:
          // The layout viewport already shrank to vv.height, so elements positioned
          // with bottom: 0 are naturally above the virtual keyboard. No extra bottom inset needed.
          unhandledInset = 0;
          isOpen = true;
        }
      }

      setMetrics({ inset: unhandledInset, isOpen });
      document.documentElement.style.setProperty("--keyboard-inset-bottom", `${unhandledInset}px`);
      if (!isOpen && window.scrollY > 0) {
        window.scrollTo({ top: 0, left: 0, behavior: "instant" });
      }
    };

    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", update);
      window.visualViewport.addEventListener("scroll", update);
    }
    window.addEventListener("resize", update);
    update();

    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener("resize", update);
        window.visualViewport.removeEventListener("scroll", update);
      }
      window.removeEventListener("resize", update);
      document.documentElement.style.removeProperty("--keyboard-inset-bottom");
    };
  }, []);

  return metrics;
}

export function useKeyboardInset(): number {
  return useKeyboardMetrics().inset;
}

export function useIsKeyboardOpen(): boolean {
  return useKeyboardMetrics().isOpen;
}


