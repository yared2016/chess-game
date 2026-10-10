"use client";

import { useEffect } from "react";
import "./globals.css";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app] global root error", error);
  }, [error]);

  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[#0b0d11] text-foreground flex flex-col items-center justify-center p-4 antialiased">
        <div className="mx-auto flex w-full max-w-lg flex-col items-center justify-center gap-4 text-center">
          <div className="size-16 rounded-2xl overflow-hidden border border-amber-500/30 bg-black flex items-center justify-center shadow-lg shadow-amber-950/20">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/brand/abay-chess-emblem.png" alt="Abay Chess" className="size-full object-cover" />
          </div>
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Something broke
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            This page stopped mid-move.
          </h1>
          <p className="text-[15px] leading-relaxed text-muted-foreground">
            Nothing on the server was lost — your games, ratings and settings are safe.
            Try reloading, or return to the lobby.
          </p>
          {error.digest ? (
            <code className="rounded-lg bg-white/5 border border-white/10 px-2 py-1 font-mono text-xs text-muted-foreground">
              {error.digest}
            </code>
          ) : null}
          <div className="mt-4 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={() => reset()}
              className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors cursor-pointer"
            >
              Try again
            </button>
            <a
              href="/play"
              className="inline-flex items-center justify-center rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-accent transition-colors"
            >
              Back to the lobby
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
