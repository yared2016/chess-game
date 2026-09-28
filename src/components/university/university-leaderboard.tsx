// src/components/university/university-leaderboard.tsx
"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import {
  GraduationCap,
  Trophy,
  Users,
  Flame,
  Award,
  ChevronRight,
  CheckCircle2,
  Medal,
  Sparkles,
  MapPin,
  Building2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { cn, initials } from "@/lib/ui";

export function UniversityLeaderboard() {
  const universities = useQuery(api.universities.listUniversities);
  const myUniversity = useQuery(api.universities.getMyUniversity);
  const joinUniversityMutation = useMutation(api.universities.joinUniversity);
  const leaveUniversityMutation = useMutation(api.universities.leaveUniversity);

  const [selectedUniId, setSelectedUniId] = useState<Id<"universities"> | null>(null);
  const [filter, setFilter] = useState<"rating" | "players" | "wins">("rating");
  const [isJoining, setIsJoining] = useState(false);

  const selectedUniDetail = useQuery(
    api.universities.getUniversity,
    selectedUniId ? { universityId: selectedUniId } : "skip"
  );

  const sortedUniversities = [...(universities ?? [])].sort((a, b) => {
    if (filter === "players") return b.totalPlayers - a.totalPlayers;
    if (filter === "wins") return b.totalWins - a.totalWins;
    return b.averageRating - a.averageRating;
  });

  const handleJoin = async (uniId: Id<"universities">) => {
    setIsJoining(true);
    try {
      const res = await joinUniversityMutation({ universityId: uniId });
      toast.success(`You are now representing ${res.shortName}!`, { icon: "🎓" });
    } catch (err: any) {
      toast.error(err.message || "Failed to join university");
    } finally {
      setIsJoining(false);
    }
  };

  const handleLeave = async () => {
    try {
      await leaveUniversityMutation({});
      toast.info("Removed university affiliation");
    } catch (err: any) {
      toast.error(err.message || "Failed to leave university");
    }
  };

  return (
    <div className="space-y-8">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-card via-card/90 to-primary/5 p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              <GraduationCap className="size-4" />
              <span>Campus League</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
              Ethiopian Universities Chess League
            </h1>
            <p className="text-sm text-muted-foreground max-w-xl">
              Represent your higher institution, battle in inter-university matches, and lead your campus to the national chess championship.
            </p>
          </div>

          {/* Player's Current Affiliation */}
          <div className="w-full sm:w-auto rounded-2xl border border-border/80 bg-background/80 backdrop-blur p-4 sm:p-5 shadow-sm space-y-2 min-w-[220px]">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">My Campus</p>
            {myUniversity ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="flex size-8 items-center justify-center rounded-lg bg-primary/15 font-black text-xs text-primary">
                    {myUniversity.shortName}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-foreground leading-tight">{myUniversity.name}</p>
                    <p className="text-[10px] text-muted-foreground">{myUniversity.city}</p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleLeave}
                  className="w-full h-7 text-[11px] text-muted-foreground hover:text-destructive"
                >
                  Change Affiliation
                </Button>
              </div>
            ) : (
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-foreground">No campus selected</p>
                <p className="text-[11px] text-muted-foreground">Select a university below to represent your school.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Podium Top 3 */}
      {sortedUniversities.length >= 3 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* 2nd Place */}
          <div className="order-2 md:order-1 rounded-2xl border border-slate-300/40 bg-card p-5 shadow-sm flex flex-col justify-between relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="flex size-7 items-center justify-center rounded-full bg-slate-200 dark:bg-slate-800 text-xs font-black text-slate-700 dark:text-slate-300">
                #2
              </span>
              <Medal className="size-5 text-slate-400" />
            </div>
            <div className="my-4 space-y-1">
              <h3 className="text-base font-bold text-foreground">{sortedUniversities[1].name}</h3>
              <p className="text-xs text-muted-foreground">{sortedUniversities[1].city}</p>
            </div>
            <div className="flex items-center justify-between pt-3 border-t border-border/60 text-xs">
              <span className="text-muted-foreground">Avg Rating</span>
              <span className="font-mono font-bold text-foreground">{sortedUniversities[1].averageRating}</span>
            </div>
          </div>

          {/* 1st Place */}
          <div className="order-1 md:order-2 rounded-2xl border-2 border-amber-500/40 bg-gradient-to-b from-amber-500/10 via-card to-card p-6 shadow-md flex flex-col justify-between relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="flex size-8 items-center justify-center rounded-full bg-amber-500 text-xs font-black text-white shadow-sm">
                #1
              </span>
              <Trophy className="size-6 text-amber-500 animate-bounce" />
            </div>
            <div className="my-4 space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-500">League Leader</span>
              <h3 className="text-lg font-black text-foreground">{sortedUniversities[0].name}</h3>
              <p className="text-xs text-muted-foreground">{sortedUniversities[0].city}</p>
            </div>
            <div className="grid grid-cols-3 gap-2 pt-3 border-t border-border/80 text-center text-xs">
              <div>
                <p className="text-[10px] text-muted-foreground">Rating</p>
                <p className="font-mono font-black text-amber-500 text-sm">{sortedUniversities[0].averageRating}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">Players</p>
                <p className="font-mono font-bold text-foreground text-sm">{sortedUniversities[0].totalPlayers}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">Wins</p>
                <p className="font-mono font-bold text-foreground text-sm">{sortedUniversities[0].totalWins}</p>
              </div>
            </div>
          </div>

          {/* 3rd Place */}
          <div className="order-3 rounded-2xl border border-amber-700/30 bg-card p-5 shadow-sm flex flex-col justify-between relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="flex size-7 items-center justify-center rounded-full bg-amber-900/20 text-xs font-black text-amber-700 dark:text-amber-500">
                #3
              </span>
              <Award className="size-5 text-amber-700" />
            </div>
            <div className="my-4 space-y-1">
              <h3 className="text-base font-bold text-foreground">{sortedUniversities[2].name}</h3>
              <p className="text-xs text-muted-foreground">{sortedUniversities[2].city}</p>
            </div>
            <div className="flex items-center justify-between pt-3 border-t border-border/60 text-xs">
              <span className="text-muted-foreground">Avg Rating</span>
              <span className="font-mono font-bold text-foreground">{sortedUniversities[2].averageRating}</span>
            </div>
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-3">
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-muted/60">
          <button
            onClick={() => setFilter("rating")}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
              filter === "rating" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            Highest Rating
          </button>
          <button
            onClick={() => setFilter("players")}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
              filter === "players" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            Most Players
          </button>
          <button
            onClick={() => setFilter("wins")}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
              filter === "wins" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            Most Wins
          </button>
        </div>

        <p className="text-xs text-muted-foreground font-medium">
          {sortedUniversities.length} Institutions Participating
        </p>
      </div>

      {/* University Standings Table */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="divide-y divide-border/60">
          {sortedUniversities.map((uni, idx) => {
            const isMyUni = myUniversity?._id === uni._id;
            return (
              <div
                key={uni.shortName}
                onClick={() => setSelectedUniId(uni._id)}
                className={cn(
                  "p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4 transition-colors hover:bg-muted/40 cursor-pointer",
                  isMyUni && "bg-primary/5 hover:bg-primary/10 border-l-4 border-l-primary"
                )}
              >
                <div className="flex items-center gap-3.5 min-w-[240px]">
                  <span className="w-6 text-center font-mono font-bold text-sm text-muted-foreground">
                    #{idx + 1}
                  </span>
                  <div className="flex size-10 items-center justify-center rounded-xl bg-muted border border-border font-black text-sm text-foreground">
                    {uni.shortName}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-foreground">{uni.name}</p>
                      {isMyUni && (
                        <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-black text-primary">
                          My Campus
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                      <span className="flex items-center gap-1">
                        <MapPin className="size-3" />
                        {uni.city}
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Users className="size-3" />
                        {uni.totalPlayers} students
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-6 ml-auto">
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground font-medium">Rating</p>
                    <p className="text-base font-black font-mono text-foreground">{uni.averageRating}</p>
                  </div>

                  <div className="text-right hidden sm:block">
                    <p className="text-xs text-muted-foreground font-medium">Total Wins</p>
                    <p className="text-sm font-bold font-mono text-emerald-500">{uni.totalWins}</p>
                  </div>

                  {!isMyUni ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleJoin(uni._id);
                      }}
                      disabled={isJoining}
                      className="rounded-xl text-xs font-bold"
                    >
                      Join Campus
                    </Button>
                  ) : (
                    <div className="flex items-center gap-1 text-xs font-bold text-primary px-3">
                      <CheckCircle2 className="size-4" />
                      <span>Representing</span>
                    </div>
                  )}

                  <ChevronRight className="size-4 text-muted-foreground" />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Campus Students Roster Modal */}
      {selectedUniDetail && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in"
          onClick={() => setSelectedUniId(null)}
        >
          <div
            className="w-full max-w-lg rounded-3xl border border-border bg-card p-6 shadow-2xl space-y-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <span className="text-xs font-black uppercase text-primary tracking-wider">
                  {selectedUniDetail.university.shortName} Campus Roster
                </span>
                <h3 className="text-xl font-black text-foreground">{selectedUniDetail.university.name}</h3>
                <p className="text-xs text-muted-foreground">{selectedUniDetail.university.description}</p>
              </div>
              <button
                onClick={() => setSelectedUniId(null)}
                className="rounded-full p-1.5 text-muted-foreground hover:bg-muted transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3 p-3 rounded-2xl bg-muted/50 text-center text-xs">
              <div>
                <p className="text-muted-foreground text-[10px]">Avg Rating</p>
                <p className="text-base font-black font-mono text-foreground">
                  {selectedUniDetail.university.averageRating}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground text-[10px]">Total Wins</p>
                <p className="text-base font-black font-mono text-emerald-500">
                  {selectedUniDetail.university.totalWins}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground text-[10px]">Total Players</p>
                <p className="text-base font-black font-mono text-foreground">
                  {selectedUniDetail.university.totalPlayers}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Top Campus Players</h4>
              {selectedUniDetail.students.length > 0 ? (
                <div className="divide-y divide-border/60 max-h-60 overflow-y-auto pr-1">
                  {selectedUniDetail.students.map((student, idx) => (
                    <div key={student._id} className="flex items-center justify-between py-2.5">
                      <div className="flex items-center gap-3">
                        <span className="w-5 text-center font-mono text-xs font-bold text-muted-foreground">
                          #{idx + 1}
                        </span>
                        <Avatar className="size-8">
                          <AvatarImage src={student.avatarUrl} alt={student.username} />
                          <AvatarFallback className="text-xs font-bold">{initials(student.username)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-xs font-bold text-foreground">{student.username}</p>
                          <p className="text-[10px] text-muted-foreground">{student.wins} match wins</p>
                        </div>
                      </div>
                      <span className="font-mono text-xs font-black text-foreground">{student.rating} Elo</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground py-4 text-center">
                  No registered student players yet. Be the first to join this campus!
                </p>
              )}
            </div>

            <div className="flex gap-2">
              <Button
                className="w-full rounded-xl font-bold text-xs"
                onClick={() => {
                  handleJoin(selectedUniDetail.university._id);
                  setSelectedUniId(null);
                }}
              >
                Join this University
              </Button>
              <Button
                variant="outline"
                className="rounded-xl font-bold text-xs"
                onClick={() => setSelectedUniId(null)}
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
