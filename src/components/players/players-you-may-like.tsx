"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { initials } from "@/lib/ui";
import { formatPresenceLastSeen } from "@/lib/format";
import { FindOpponentModal, type OpponentSummary } from "./find-opponent-modal";
import { SwordsIcon, GraduationCap, User, Sparkles, ExternalLink, ArrowRight } from "lucide-react";
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
            Recommended based on rating proximity, campus community, and live availability.
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
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "mt-4 gap-1.5 text-xs")}
          >
            Browse Player Directory
            <ArrowRight className="size-3" />
          </Link>
        </Card>
      )}

      {/* Player Cards Grid */}
      {recommendedPlayers && recommendedPlayers.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {recommendedPlayers.map((player) => {
            const isStudent = player.playerType === "university_student";

            return (
              <Card
                key={player._id}
                className="group flex flex-col justify-between border-border/70 bg-card/60 p-4 transition-all duration-200 hover:border-primary/50 hover:bg-card/90 hover:shadow-lg hover:shadow-primary/5"
              >
                <div className="space-y-3">
                  {/* Top: Avatar, Name, Rating */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="relative shrink-0">
                        <Avatar className="size-11 border border-border/80">
                          <AvatarImage src={player.avatarUrl} alt={player.displayName} />
                          <AvatarFallback>{initials(player.displayName || player.username)}</AvatarFallback>
                        </Avatar>
                        {player.isOnline && (
                          <span className="absolute bottom-0 right-0 size-2.5 rounded-full border-2 border-background bg-emerald-500" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/profile/${player.username}`}
                          className="truncate font-semibold text-foreground transition-colors hover:text-primary block text-sm"
                        >
                          {player.displayName}
                        </Link>
                        <span className="truncate text-xs text-muted-foreground block">
                          @{player.username}
                        </span>
                      </div>
                    </div>
                    <Badge variant="outline" className="font-bold text-xs text-primary shrink-0">
                      {player.ratingHuman}
                    </Badge>
                  </div>

                  {/* Middle: Badges & Presence */}
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {isStudent && player.universityName ? (
                        <Badge
                          variant="secondary"
                          className="flex items-center gap-1 truncate text-[0.65rem] border-primary/20 bg-primary/10 text-primary font-medium"
                        >
                          <GraduationCap className="size-3 shrink-0" />
                          <span className="truncate">{player.universityName}</span>
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="flex items-center gap-1 text-[0.65rem] text-muted-foreground">
                          <User className="size-3 shrink-0" />
                          <span>Public Player</span>
                        </Badge>
                      )}

                      {player.verificationStatus === "verified" && (
                        <Badge variant="outline" className="text-[0.65rem] border-emerald-500/30 text-emerald-500">
                          Verified
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 text-[0.7rem] text-muted-foreground">
                      <span
                        className={cn(
                          "size-1.5 rounded-full",
                          player.isOnline ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground/50",
                        )}
                      />
                      <span>{formatPresenceLastSeen(player.lastSeen)}</span>
                    </div>
                  </div>
                </div>

                {/* Bottom: Action Buttons */}
                <div className="mt-4 flex gap-2 border-t border-border/50 pt-3">
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => setSelectedOpponent(player as OpponentSummary)}
                    className="flex-1 gap-1.5 text-xs font-semibold"
                  >
                    <SwordsIcon className="size-3.5" />
                    Challenge
                  </Button>
                  <Link
                    href={`/profile/${player.username}`}
                    aria-label={`View profile of ${player.displayName}`}
                    className={cn(
                      buttonVariants({ variant: "outline", size: "sm" }),
                      "px-2.5 text-xs text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <ExternalLink className="size-3.5" />
                  </Link>
                </div>
              </Card>
            );
          })}
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
