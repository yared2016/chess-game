"use client";

import Link from "next/link";
import { useConvexAuth, useQuery } from "convex/react";
import { Coins } from "lucide-react";
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
        "inline-flex h-8 items-center gap-1.5 rounded-lg px-2 sm:px-2.5 text-xs sm:text-sm font-black whitespace-nowrap",
        "text-emerald-700 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30",
        "dark:text-emerald-400 dark:bg-emerald-500/15 dark:border-emerald-500/30 shadow-xs",
        "pointer-coarse:min-h-9 transition-all duration-(--dur-micro)",
        focusRing,
      )}
    >
      <div className="flex size-4.5 items-center justify-center rounded-full bg-amber-500/20 text-amber-600 dark:bg-amber-400/20 dark:text-amber-400 shrink-0">
        <Coins className="size-3" />
      </div>
      <span className="tabular font-black tracking-tight">{balance?.available ?? 0}</span>
      <span className="text-[10px] sm:text-xs font-bold opacity-80">ETB</span>
    </Link>
  );
}
