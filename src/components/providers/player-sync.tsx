"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { usePlatformPresence } from "@/hooks/use-platform-presence";
import { usePlayerSync } from "@/hooks/use-player-sync";
import { useSettingsSync } from "@/hooks/use-settings-sync";
import { useUiStore } from "@/lib/stores/ui-store";

/**
 * Renders nothing. Mounted once in the root layout, it is the single place that:
 *
 * 1. rehydrates the persisted ui-store from localStorage — the store is created
 *    with `skipHydration: true`, so NOTHING reads storage until this runs, which
 *    is what keeps the server render and the first client render identical
 *    (state-zustand.md §4.2). `onRehydrateStorage` then flips `hydrated`;
 * 2. provisions the Convex `players` row on first sign-in (FR-3);
 * 3. seeds the ui-store from `players.me` so Convex wins over localStorage;
 * 4. maintains platform-wide online presence while active;
 * 5. redirects users with completed profiles away from the onboarding route.
 */
export function PlayerSync() {
  usePlayerSync();
  useSettingsSync();
  usePlatformPresence();

  const { isAuthenticated } = useConvexAuth();
  const me = useQuery(api.players.me, isAuthenticated ? {} : "skip");
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated || me === undefined || me === null) return;
    if (me.profileCompleted && pathname === "/complete-profile") {
      router.replace("/play");
    }
  }, [isAuthenticated, me, pathname, router]);

  useEffect(() => {
    // `persist` is TYPED as always present but is not always THERE: zustand only
    // assigns `api.persist` once it has a storage object, and `createJSONStorage`
    // returns undefined when reading `localStorage` throws (Safari private mode,
    // embedded webviews, blocked site data — middleware.mjs:279-284, 345-356).
    // Dereferencing it there would throw synchronously inside this effect — before
    // any promise exists to catch it — and take every route to the root error
    // boundary. Nothing can be rehydrated in that case, so just open the gates.
    const persistApi: typeof useUiStore.persist | undefined = useUiStore.persist;
    if (persistApi === undefined) {
      useUiStore.getState().markHydrated();
      return;
    }
    // Returns `Promise<void> | void` — localStorage is synchronous, so this
    // resolves through persist's thenable shim. `onRehydrateStorage` already logs
    // a read failure; catching here stops a rejection escaping unhandled.
    Promise.resolve(persistApi.rehydrate()).catch(() => {
      useUiStore.getState().markHydrated();
    });
  }, []);

  return null;
}
