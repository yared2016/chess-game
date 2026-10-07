"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { ShieldAlert, RefreshCw, ArrowLeft } from "lucide-react";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[admin-error]", error);
  }, [error]);

  return (
    <div className="mx-auto flex w-full max-w-xl min-h-[60vh] flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive border border-destructive/20 shadow-xs">
        <ShieldAlert className="size-7" />
      </div>
      <div className="space-y-1">
        <h1 className="text-xl sm:text-2xl font-black text-foreground tracking-tight">
          Admin Dashboard Error
        </h1>
        <p className="text-sm text-muted-foreground">
          An error occurred while loading administrative data.
        </p>
      </div>

      <div className="w-full text-left bg-muted/60 border border-border/80 rounded-2xl p-4 font-mono text-xs overflow-auto max-h-48 text-destructive space-y-1">
        <p className="font-bold">
          {error?.name || "Error"}: {error?.message || "Unknown error occurred"}
        </p>
        {error?.digest && (
          <p className="text-muted-foreground text-[10px]">Digest: {error.digest}</p>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
        <Button onClick={reset} className="gap-2">
          <RefreshCw className="size-4" /> Try again
        </Button>
        <Button variant="outline" onClick={() => window.location.reload()}>
          Reload page
        </Button>
        <Link href="/play" className={buttonVariants({ variant: "ghost" })}>
          <ArrowLeft className="size-4 mr-1.5" /> Back to lobby
        </Link>
      </div>
    </div>
  );
}
