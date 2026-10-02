"use client";
// src/app/sign-in/auth-card.tsx  [U4]
// The Clerk <SignIn/> and <SignUp/> cards, themed onto the Study tokens
// (UI_REDESIGN §1.1). Shared by both auth routes — it lives beside the sign-in
// page because both routes belong to this package and Next only treats reserved
// filenames (page/layout/route/…) inside app/ as routes.
//
// The palette itself is `src/lib/clerk-appearance.ts`, the one place the Study
// tokens are written in Clerk's appearance vocabulary — the same values the
// pricing table and the user-profile modal use, so the auth card cannot drift
// away from the billing surfaces (this file used to carry its own copy).
import Link from "next/link";
import { SignIn, SignUp } from "@clerk/nextjs";
import { useClerkVariables } from "@/lib/clerk-appearance";

/**
 * Neither component takes routing props: the Next SDK fills `routing: "path"`
 * and `path` from the pathname.
 */
export function AuthCard({ kind }: { kind: "sign-in" | "sign-up" }) {
  // Variables only: the plan-card element override in `useClerkAppearance` has
  // nothing to say about a sign-in card.
  const appearance = { variables: useClerkVariables() };
  const isSignUp = kind === "sign-up";

  return (
    <div className="flex min-h-[calc(100dvh-3.5rem)] flex-col items-center justify-center px-4 py-12">
      {/* Castle Chess Brand Header */}
      <div className="mb-6 flex flex-col items-center text-center">
        <Link
          href="/"
          prefetch={false}
          className="group mb-3 flex size-14 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10 text-3xl text-primary shadow-sm shadow-primary/20 transition-all duration-200 hover:border-primary/50 hover:bg-primary/15"
          aria-label="Castle Chess Home"
        >
          <span className="transition-transform duration-200 group-hover:scale-110">♞</span>
        </Link>
        <h1 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Castle Chess
        </h1>
        <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
          {isSignUp
            ? "Join the community, build your rating, and compete in chess."
            : "Welcome back to the board. Pick up where you left off."}
        </p>
      </div>

      <div className="w-full max-w-[440px] flex justify-center">
        {isSignUp ? (
          <SignUp
            appearance={appearance}
            fallbackRedirectUrl="/play"
          />
        ) : (
          <SignIn
            appearance={appearance}
            fallbackRedirectUrl="/play"
          />
        )}
      </div>
    </div>
  );
}
