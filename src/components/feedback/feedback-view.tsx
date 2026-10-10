"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { MessageSquarePlus, History, Sparkles } from "lucide-react";
import { FeedbackForm } from "./feedback-form";
import { MyFeedbackList } from "./my-feedback-list";
import { cn } from "@/lib/ui";

export function FeedbackView() {
  const searchParams = useSearchParams();

  const tabParam = searchParams.get("tab");
  const gameId = searchParams.get("gameId") ?? undefined;
  const opponentUsername = searchParams.get("opponent") ?? undefined;
  const matchId = searchParams.get("matchId") ?? undefined;
  const tournamentId = searchParams.get("tournamentId") ?? undefined;

  const [tabOverride, setTabOverride] = useState<string | null>(null);
  const activeTab = tabOverride ?? (tabParam === "history" ? "history" : "submit");

  const initialContext = gameId || opponentUsername || matchId || tournamentId
    ? { gameId, opponentUsername, matchId, tournamentId }
    : undefined;

  return (
    <div className="min-h-[calc(100dvh-4rem)] py-8 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto space-y-8 animate-in fade-in duration-200">
      {/* Page Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-xs font-semibold text-primary mb-1">
          <Sparkles className="size-3.5" />
          <span>Player Experience &amp; Support</span>
        </div>

        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground flex items-center justify-center gap-2">
          <span>♟</span> Abay Chess Feedback
        </h1>
        <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
          Your insights, bug reports, and ideas directly shape the future of Abay Chess.
        </p>
      </div>

      {/* Tabs navigation */}
      <div className="flex justify-center">
        <div
          role="tablist"
          aria-label="Feedback navigation tabs"
          className="grid grid-cols-2 w-full max-w-md h-11 p-1 bg-muted/50 border border-border/70 rounded-xl"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "submit"}
            onClick={() => setTabOverride("submit")}
            style={{ touchAction: "manipulation" }}
            className={cn(
              "rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer select-none",
              activeTab === "submit"
                ? "bg-card text-primary shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <MessageSquarePlus className="size-4" />
            <span>Share Feedback</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "history"}
            onClick={() => setTabOverride("history")}
            style={{ touchAction: "manipulation" }}
            className={cn(
              "rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer select-none",
              activeTab === "history"
                ? "bg-card text-primary shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <History className="size-4" />
            <span>My Submissions</span>
          </button>
        </div>
      </div>

      <div className="w-full">
        {activeTab === "submit" ? (
          <FeedbackForm
            initialContext={initialContext}
            onViewHistory={() => setTabOverride("history")}
          />
        ) : (
          <MyFeedbackList onCreateFeedback={() => setTabOverride("submit")} />
        )}
      </div>
    </div>
  );
}
