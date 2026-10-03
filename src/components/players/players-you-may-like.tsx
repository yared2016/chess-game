"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { initials } from "@/lib/ui";
import { formatPresenceLastSeen } from "@/lib/format";
import { FindOpponentModal, type OpponentSummary } from "./find-opponent-modal";
import { PlayerCard } from "./player-card";
import { Sparkles, ArrowRight } from "lucide-react";
import { cn } from "@/lib/ui";

export function PlayersYouMayLike() {
  const recommendedPlayers = useQuery(api.discovery.getRecommendedPlayers, { limit: 6 });
  const [selectedOpponent, setSelectedOpponent] = useState<OpponentSummary | null>(null);

  return (
    <div className="space-y-4 pt-6">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            <h2 className="font-display text-lg font-bold tracking-tight text-foreground sm:text-xl">
              Players You May Want to Play
            </h2>
          </div>
          <p className="text-xs text-muted-foreground">
            Recommended based on rating proximity and live availability.
          </p>
        </div>
        <Link
          href="/players"
          className="flex items-center gap-1 text-xs font-semibold text-primary transition-colors hover:text-primary/80"
        >
          Explore All
          <ArrowRight className="size-3.5" />
        </Link>
      </div>

      {/* Loading Skeletons */}
      {recommendedPlayers === undefined && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i} className="space-y-3 p-4">
              <div className="flex items-center gap-3">
                <Skeleton className="size-11 rounded-full" />
                <div className="space-y-1.5 flex-1">
                  <Skeleton className="h-4 w-28 rounded" />
                  <Skeleton className="h-3 w-16 rounded" />
                </div>
              </div>
              <Skeleton className="h-8 w-full rounded-lg" />
            </Card>
          ))}
        </div>
      )}

      {/* Empty State */}
      {recommendedPlayers && recommendedPlayers.length === 0 && (
        <Card className="flex flex-col items-center justify-center p-8 text-center border-dashed border-border/80 bg-card/30">
          <p className="text-sm font-medium text-foreground">No recommendations available right now.</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Check back soon or browse active players in the directory.
          </p>
          <Link
            href="/players"
            className="mt-4 inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-3 text-xs font-medium text-foreground hover:bg-muted transition-colors"
          >
            Browse Player Directory
            <ArrowRight className="size-3" />
          </Link>
        </Card>
      )}

      {/* Player Cards Grid */}
      {recommendedPlayers && recommendedPlayers.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {recommendedPlayers.map((player) => (
            <PlayerCard
              key={player._id}
              player={player}
              onChallenge={(p) => setSelectedOpponent(p as OpponentSummary)}
            />
          ))}
        </div>
      )}

      {/* Direct Challenge Modal */}
      <FindOpponentModal
        isOpen={!!selectedOpponent}
        onClose={() => setSelectedOpponent(null)}
        opponent={selectedOpponent}
      />
    </div>
  );
}
