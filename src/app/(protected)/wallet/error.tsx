"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Display, Eyebrow } from "@/components/ui-kit";
import { Wallet, RefreshCw, ArrowLeft } from "lucide-react";

export default function WalletError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[wallet] route error", error);
  }, [error]);

  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center gap-4 px-4 py-20 text-center">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
        <Wallet className="size-7" />
      </div>
      <Eyebrow>Wallet Connectivity</Eyebrow>
      <Display level={3} as="h1">
        Unable to load <em>wallet</em> right now
      </Display>
      <p className="text-[14px] leading-relaxed text-muted-foreground">
        We encountered a temporary connection issue syncing your financial ledger and balance.
        No funds were affected.
      </p>
      {error.message && (
        <code className="max-w-md break-all rounded-lg bg-muted/60 px-3 py-1.5 font-mono text-xs text-muted-foreground border border-border/80">
          {error.message}
        </code>
      )}
      <div className="mt-3 flex flex-wrap justify-center gap-2">
        <Button onClick={reset} className="gap-2">
          <RefreshCw className="size-3.5" />
          Retry
        </Button>
        <Link prefetch={false} href="/play" className={buttonVariants({ variant: "outline" })}>
          <ArrowLeft className="size-3.5" />
          Back to Lobby
        </Link>
      </div>
    </div>
  );
}
