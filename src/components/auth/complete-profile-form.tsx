"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useConvexAuth, useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { PhoneInput, validatePhoneNumber } from "./phone-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/ui";
import { GraduationCap, User, Check, AlertCircle, Search, ShieldCheck } from "lucide-react";
import { describeConvexError } from "@/lib/errors";

interface CompleteProfileFormProps {
  initialPlayerType?: "university_student" | "public_player";
  onSuccess?: () => void;
}

export function CompleteProfileForm({
  initialPlayerType = "university_student",
  onSuccess,
}: CompleteProfileFormProps) {
  const router = useRouter();
  const { isAuthenticated } = useConvexAuth();
  const me = useQuery(api.players.me, isAuthenticated ? {} : "skip");
  const universities = useQuery(api.universities.listUniversities, {});
  const completeProfile = useMutation(api.players.completeProfile);

  // Form State
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("+251");
  const [playerType, setPlayerType] = useState<"university_student" | "public_player">(initialPlayerType);
  const [universityId, setUniversityId] = useState<Id<"universities"> | "">("");
  const [studentId, setStudentId] = useState("");
  const [uniSearch, setUniSearch] = useState("");

  // Validation & UI State
  const [phoneError, setPhoneError] = useState<string | undefined>();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Populate initial values once `me` loads
  useEffect(() => {
    if (me) {
      if (me.username && !username) setUsername(me.username);
      if (me.displayName && !displayName) setDisplayName(me.displayName);
      if (me.phoneNumber && phoneNumber === "+251") setPhoneNumber(me.phoneNumber);
      if (me.playerType === "university_student" || me.playerType === "public_player") {
        setPlayerType(me.playerType);
      }
      if (me.universityId) setUniversityId(me.universityId);
      if (me.studentId && !studentId) setStudentId(me.studentId);
    }
  }, [me]);

  // Live username availability check
  const usernameQuery = useQuery(
    api.players.checkUsernameAvailability,
    username.trim().length >= 3 ? { username: username.trim() } : "skip",
  );

  const isUsernameValid = username.length >= 3 && username.length <= 20 && /^[a-z0-9_-]+$/.test(username.toLowerCase());
  const isUsernameAvailable = usernameQuery ? usernameQuery.available : isUsernameValid;

  // Filtered universities
  const uniList = Array.isArray(universities) ? universities : [];
  const filteredUniversities = uniList.filter((u) => {
    if (!u) return false;
    if (!uniSearch.trim()) return true;
    const q = uniSearch.toLowerCase();
    const name = (u.name ?? "").toLowerCase();
    const shortName = (u.shortName ?? "").toLowerCase();
    const city = (u.city ?? "").toLowerCase();
    return name.includes(q) || shortName.includes(q) || city.includes(q);
  });

  const selectedUni = universityId ? uniList.find((u) => u && u._id === universityId) : undefined;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // 1. Validate Phone
    if (!validatePhoneNumber(phoneNumber)) {
      setPhoneError("Please enter a valid phone number (e.g. +251 9XX XXX XXX).");
      return;
    }
    setPhoneError(undefined);

    // 2. Validate Username
    if (!isUsernameValid) {
      setErrorMessage("Username must be 3-20 characters using lowercase letters, numbers, hyphens, or underscores.");
      return;
    }
    if (usernameQuery && !usernameQuery.available) {
      setErrorMessage(usernameQuery.reason ?? "This username is already taken. Please choose another.");
      return;
    }

    // 3. Validate Display Name
    if (displayName.trim().length < 2 || displayName.trim().length > 30) {
      setErrorMessage("Display name must be between 2 and 30 characters.");
      return;
    }

    // 4. Validate University Student fields
    if (playerType === "university_student") {
      if (!universityId) {
        setErrorMessage("Please select your official university from the list.");
        return;
      }
      if (studentId.trim().length < 2 || studentId.trim().length > 30) {
        setErrorMessage("Student ID must be between 2 and 30 characters.");
        return;
      }
    }

    startTransition(async () => {
      try {
        await completeProfile({
          username: username.trim(),
          displayName: displayName.trim(),
          phoneNumber: phoneNumber.trim(),
          playerType,
          universityId: playerType === "university_student" && universityId ? (universityId as Id<"universities">) : undefined,
          studentId: playerType === "university_student" ? studentId.trim() : undefined,
        });

        if (onSuccess) {
          onSuccess();
        } else {
          router.replace("/play");
        }
      } catch (err: unknown) {
        setErrorMessage(describeConvexError(err, "Failed to save profile. Please check your inputs."));
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {errorMessage && (
        <div className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-3.5 text-sm text-destructive">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <p>{errorMessage}</p>
        </div>
      )}

      {/* SECTION 1: BASIC INFORMATION */}
      <div className="space-y-4">
        <div className="border-b border-border/70 pb-2">
          <h2 className="text-base font-semibold text-foreground">1. Basic Information</h2>
          <p className="text-xs text-muted-foreground">Your public chess identity and private verification info.</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {/* Username */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="cp-username">Username</Label>
              {username.trim().length >= 3 && (
                <span className="text-[0.75rem]">
                  {usernameQuery === undefined ? (
                    <span className="text-muted-foreground">Checking...</span>
                  ) : isUsernameAvailable ? (
                    <span className="flex items-center gap-1 font-medium text-emerald-500">
                      <Check className="size-3" /> Available
                    </span>
                  ) : (
                    <span className="font-medium text-destructive">Unavailable</span>
                  )}
                </span>
              )}
            </div>
            <Input
              id="cp-username"
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""))}
              placeholder="e.g. kasparov_et"
              required
              minLength={3}
              maxLength={20}
              disabled={isPending}
            />
            <p className="text-[0.75rem] text-muted-foreground">
              3-20 characters: lowercase letters, numbers, hyphens, and underscores.
            </p>
          </div>

          {/* Display Name */}
          <div className="space-y-1.5">
            <Label htmlFor="cp-display-name">Display Name</Label>
            <Input
              id="cp-display-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g. Abebe Bikila"
              required
              minLength={2}
              maxLength={30}
              disabled={isPending}
            />
            <p className="text-[0.75rem] text-muted-foreground">
              How your name appears to other players on leaderboards and in matches.
            </p>
          </div>
        </div>

        {/* Phone Number */}
        <div className="space-y-1.5 pt-1">
          <Label htmlFor="cp-phone">Phone Number</Label>
          <PhoneInput
            id="cp-phone"
            value={phoneNumber}
            onChange={(val) => {
              setPhoneNumber(val);
              if (phoneError) setPhoneError(undefined);
            }}
            error={phoneError}
            disabled={isPending}
            required
          />
        </div>
      </div>

      {/* SECTION 2: PLAYER TYPE */}
      <div className="space-y-4">
        <div className="border-b border-border/70 pb-2">
          <h2 className="text-base font-semibold text-foreground">2. Player Type</h2>
          <p className="text-xs text-muted-foreground">Select how you want to participate in Castle Chess.</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {/* University Student Card */}
          <Card
            onClick={() => setPlayerType("university_student")}
            className={cn(
              "cursor-pointer border-2 p-4 transition-all duration-150 hover:border-primary/60",
              playerType === "university_student"
                ? "border-primary bg-primary/10 shadow-sm shadow-primary/20 ring-1 ring-primary/40"
                : "border-border/70 bg-card/60 opacity-80 hover:opacity-100",
            )}
          >
            <div className="flex items-start gap-3">
              <div
                className={cn(
                  "flex size-10 shrink-0 items-center justify-center rounded-xl",
                  playerType === "university_student"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground",
                )}
              >
                <GraduationCap className="size-5" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-foreground">University Student</span>
                  {playerType === "university_student" && (
                    <Badge variant="default" className="text-[0.65rem] px-1.5 py-0">
                      Selected
                    </Badge>
                  )}
                </div>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Verify your university identity and participate in inter-university chess competitions.
                </p>
              </div>
            </div>
          </Card>

          {/* Public Player Card */}
          <Card
            onClick={() => {
              setPlayerType("public_player");
              setUniversityId("");
              setStudentId("");
            }}
            className={cn(
              "cursor-pointer border-2 p-4 transition-all duration-150 hover:border-primary/60",
              playerType === "public_player"
                ? "border-primary bg-primary/10 shadow-sm shadow-primary/20 ring-1 ring-primary/40"
                : "border-border/70 bg-card/60 opacity-80 hover:opacity-100",
            )}
          >
            <div className="flex items-start gap-3">
              <div
                className={cn(
                  "flex size-10 shrink-0 items-center justify-center rounded-xl",
                  playerType === "public_player"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground",
                )}
              >
                <User className="size-5" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-foreground">Public Player</span>
                  {playerType === "public_player" && (
                    <Badge variant="default" className="text-[0.65rem] px-1.5 py-0">
                      Selected
                    </Badge>
                  )}
                </div>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Play Castle Chess freely without university affiliation or student verification.
                </p>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* SECTION 3: UNIVERSITY AFFILIATION (Conditional for Students) */}
      {playerType === "university_student" && (
        <div className="space-y-4 rounded-xl border border-primary/30 bg-primary/5 p-4 sm:p-5">
          <div className="border-b border-primary/20 pb-2">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-foreground">3. University Information</h2>
              <Badge variant="outline" className="border-amber-500/50 bg-amber-500/10 text-amber-500">
                Verification Pending
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">Select your institution and provide your official Student ID.</p>
          </div>

          {/* Immutability Notice */}
          <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-500">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <div>
              <p className="font-semibold">University cannot be changed after profile completion</p>
              <p className="text-amber-500/90">
                Your institution and verified student record become permanent upon completion to prevent league tampering.
              </p>
            </div>
          </div>

          {/* University Combobox / Searchable Picker */}
          <div className="space-y-1.5">
            <Label htmlFor="cp-uni-select">Select your university</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground" />
              <Input
                id="cp-uni-select"
                type="text"
                placeholder="Search university by name, short code, or city..."
                value={selectedUni ? `${selectedUni.name ?? ""} (${selectedUni.shortName ?? ""})` : uniSearch}
                onChange={(e) => {
                  setUniSearch(e.target.value);
                  if (universityId) setUniversityId("");
                }}
                className="pl-9"
                disabled={isPending}
              />
              {selectedUni && (
                <button
                  type="button"
                  onClick={() => {
                    setUniversityId("");
                    setUniSearch("");
                  }}
                  className="absolute right-3 top-2.5 text-xs text-muted-foreground hover:text-foreground"
                >
                  Change
                </button>
              )}
            </div>

            {/* University Dropdown List */}
            {!universityId && (
              <div className="mt-1 max-h-48 overflow-y-auto rounded-lg border border-border/80 bg-popover p-1 shadow-lg">
                {filteredUniversities.length === 0 ? (
                  <p className="p-3 text-center text-xs text-muted-foreground">No universities match your search.</p>
                ) : (
                  filteredUniversities.map((uni) => (
                    <button
                      key={uni._id}
                      type="button"
                      onClick={() => {
                        setUniversityId(uni._id);
                        setUniSearch("");
                      }}
                      className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-xs transition-colors hover:bg-accent hover:text-accent-foreground"
                    >
                      <span className="font-medium">{uni.name}</span>
                      <span className="rounded bg-muted px-1.5 py-0.5 text-[0.65rem] font-semibold text-muted-foreground">
                        {uni.shortName} · {uni.city}
                      </span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Student ID */}
          <div className="space-y-1.5">
            <Label htmlFor="cp-student-id">Student ID</Label>
            <Input
              id="cp-student-id"
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              placeholder="e.g. UGR/1234/15"
              required
              minLength={2}
              maxLength={30}
              disabled={isPending}
            />
            <p className="text-[0.75rem] text-muted-foreground">
              Official institutional ID issued by your university registrar. Kept private.
            </p>
          </div>
        </div>
      )}

      {/* SUBMIT BUTTON */}
      <div className="pt-2">
        <Button
          type="submit"
          className="h-11 w-full gap-2 text-base font-semibold shadow-md shadow-primary/20"
          disabled={isPending || !isUsernameAvailable}
        >
          {isPending ? (
            <span className="flex items-center gap-2">
              <span className="size-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
              Saving Profile...
            </span>
          ) : (
            <>
              <ShieldCheck className="size-4" />
              Complete Profile & Start Playing ♞
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
