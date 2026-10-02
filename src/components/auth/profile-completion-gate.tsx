"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";

/**
 * Client gating layer for all protected dashboard, game, and account routes.
 *
 * Ensures newly signed up or existing players cannot bypass profile completion
 * by directly typing or navigating to a dashboard URL.
 *
 * 1. While auth state or profile record is loading, renders a branded loading screen
 *    and suppresses protected children to prevent query flashing or partial renders.
 * 2. If authenticated and profileCompleted !== true, replaces route with /complete-profile.
 * 3. Once profileCompleted === true, renders the protected route children cleanly.
 */
export function ProfileCompletionGate({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading: isAuthLoading } = useConvexAuth();
  const me = useQuery(api.players.me, isAuthenticated ? {} : "skip");
  const router = useRouter();
  const pathname = usePathname();

  const isPending = isAuthLoading || (isAuthenticated && me === undefined);

  useEffect(() => {
    if (!isAuthenticated || me === undefined || me === null) return;

    if (!me.profileCompleted) {
      if (pathname !== "/complete-profile") {
        router.replace("/complete-profile");
      }
    }
  }, [isAuthenticated, me, pathname, router]);

  if (isPending) {
    return (
      <div className="flex min-h-[calc(100dvh-3.5rem)] items-center justify-center p-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex size-14 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10 text-3xl text-primary animate-pulse shadow-sm shadow-primary/20">
            ♞
          </div>
          <p className="text-sm font-medium text-muted-foreground">Checking player credentials...</p>
        </div>
      </div>
    );
  }

  // If authenticated but profile is incomplete, suppress protected content while redirecting
  if (isAuthenticated && me && !me.profileCompleted) {
    return (
      <div className="flex min-h-[calc(100dvh-3.5rem)] items-center justify-center p-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex size-14 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10 text-3xl text-primary animate-pulse shadow-sm shadow-primary/20">
            ♞
          </div>
          <p className="text-sm font-medium text-muted-foreground">Redirecting to profile setup...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
