"use client";

import Link from "next/link";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { cn, focusRing } from "@/lib/ui";

export function BalancePill() {
  const { isAuthenticated } = useConvexAuth();
  const balance = useQuery(api.wallets.getBalance, isAuthenticated ? {} : "skip");

  if (!isAuthenticated) return null;

  if (balance === undefined) {
    return (
      <div
        aria-hidden
        className="h-8 w-24 animate-pulse rounded-lg bg-muted/60"
      />
    );
  }

  return (
    <Link
      prefetch={false}
      href="/wallet"
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium whitespace-nowrap text-green-500",
        "pointer-coarse:min-h-9 transition-colors duration-(--dur-micro) hover:bg-muted/60",
        focusRing,
      )}
    >
      💰 {balance?.available ?? 0} ETB
    </Link>
  );
}
