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
      aria-label={`Wallet balance: ${balance?.available ?? 0} ETB`}
      className={cn(
        "inline-flex h-8 items-center gap-1 rounded-lg px-2 sm:px-2.5 text-xs sm:text-sm font-bold whitespace-nowrap text-green-500 bg-green-500/10 hover:bg-green-500/20 border border-green-500/20",
        "pointer-coarse:min-h-9 transition-colors duration-(--dur-micro)",
        focusRing,
      )}
    >
      <span className="text-xs">💰</span>
      <span>{balance?.available ?? 0}</span>
      <span className="text-[10px] sm:text-xs font-semibold opacity-90">ETB</span>
    </Link>
  );
}
