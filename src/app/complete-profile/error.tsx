"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";

export default function CompleteProfileError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[complete-profile] page error:", error);
  }, [error]);

  return (
    <div className="flex min-h-[calc(100dvh-3.5rem)] items-center justify-center px-4 py-8 sm:py-12">
      <div className="w-full max-w-md space-y-5 rounded-2xl border border-border/80 bg-card/70 p-6 text-center shadow-xl backdrop-blur-md sm:p-8">
        <div className="mx-auto flex size-12 items-center justify-center rounded-2xl border border-destructive/30 bg-destructive/10 text-2xl text-destructive shadow-sm">
          ♞
        </div>
        <div className="space-y-1.5">
          <h1 className="font-display text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            Unable to load profile setup
          </h1>
          <p className="text-xs text-muted-foreground sm:text-sm">
            {error.message || "An unexpected error occurred while loading your profile data."}
          </p>
        </div>

        <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:justify-center">
          <Button onClick={() => reset()} className="w-full sm:w-auto">
            Try again
          </Button>
          <Link
            href="/"
            prefetch={false}
            className={buttonVariants({ variant: "outline", className: "w-full sm:w-auto" })}
          >
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
