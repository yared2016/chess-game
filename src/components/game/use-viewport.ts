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

function isLandscapeViewport(): boolean {
  if (typeof window === "undefined") return false;

  // 1. Hardware Screen Orientation API
  const screenOrientation = window.screen?.orientation;
  if (screenOrientation) {
    if (typeof screenOrientation.type === "string") {
      if (screenOrientation.type.startsWith("landscape")) return true;
      if (screenOrientation.type.startsWith("portrait")) return false;
    }
    if (typeof screenOrientation.angle === "number") {
      const angle = Math.abs(screenOrientation.angle);
      if (angle === 90 || angle === 270) return true;
      if (angle === 0 || angle === 180) return false;
    }
  }

  // 2. iOS Safari legacy window.orientation
  if (typeof window.orientation === "number") {
    const angle = Math.abs(window.orientation);
    if (angle === 90) return true;
    if (angle === 0 || angle === 180) return false;
  }

  // 3. Viewport dimensions comparison
  if (window.innerWidth > window.innerHeight) {
    // Mobile virtual keyboard protection:
    // When virtual keyboard opens in mobile portrait, innerHeight shrinks (e.g. from 800px to 350px).
    // The width (390px) temporarily becomes > height (350px).
    // On phones, true landscape width is always greater than the physical short dimension (Math.min(width, height)).
    const isTouchDevice =
      typeof navigator !== "undefined" &&
      (navigator.maxTouchPoints > 0 || "ontouchstart" in window);
    if (isTouchDevice && window.screen?.width && window.screen?.height) {
      const minPhysical = Math.min(window.screen.width, window.screen.height);
      if (window.innerWidth <= minPhysical) {
        return false;
      }
    }
    return true;
  }

  return false;
}

function subscribeLandscape(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("resize", onChange);
  window.addEventListener("orientationchange", onChange);
  if (window.screen?.orientation) {
    window.screen.orientation.addEventListener("change", onChange);
  }
  const mql = window.matchMedia ? window.matchMedia("(orientation: landscape)") : null;
  mql?.addEventListener("change", onChange);
  return () => {
    window.removeEventListener("resize", onChange);
    window.removeEventListener("orientationchange", onChange);
    if (window.screen?.orientation) {
      window.screen.orientation.removeEventListener("change", onChange);
    }
    mql?.removeEventListener("change", onChange);
  };
}

/** True when the viewport is horizontal/landscape. */
export function useIsLandscape(): boolean {
  const getSnapshot = useCallback(() => isLandscapeViewport(), []);
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
      if (window.screen?.orientation && "lock" in window.screen.orientation) {
        // @ts-expect-error - Screen Orientation API lock
        await window.screen.orientation.lock("landscape").catch(async () => {
          // @ts-expect-error - Screen Orientation API lock fallback
          await window.screen.orientation.lock("landscape-primary").catch(() => {});
        });
      }
    } catch {}
    useUiStore.getState().setLayoutMode("focus");
  } else {
    try {
      if (window.screen?.orientation && "lock" in window.screen.orientation) {
        // @ts-expect-error - Screen Orientation API lock
        await window.screen.orientation.lock("portrait").catch(async () => {
          // @ts-expect-error - Screen Orientation API lock fallback
          await window.screen.orientation.lock("portrait-primary").catch(() => {});
        });
      }
      if (window.screen?.orientation && "unlock" in window.screen.orientation) {
        try {
          window.screen.orientation.unlock();
        } catch {}
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
    } catch {}
    useUiStore.getState().setLayoutMode("default");
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


