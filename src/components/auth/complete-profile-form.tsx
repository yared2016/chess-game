"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useConvexAuth, useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { PhoneInput, validatePhoneNumber } from "./phone-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Check, AlertCircle, ShieldCheck } from "lucide-react";
import { describeConvexError } from "@/lib/errors";

interface CompleteProfileFormProps {
  onSuccess?: () => void;
}

export function CompleteProfileForm({
  onSuccess,
}: CompleteProfileFormProps) {
  const router = useRouter();
  const { isAuthenticated } = useConvexAuth();
  const me = useQuery(api.players.me, isAuthenticated ? {} : "skip");
  const completeProfile = useMutation(api.players.completeProfile);

  // Form State
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("+251");

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
    }
  }, [me]);

  // Live username availability check
  const usernameQuery = useQuery(
    api.players.checkUsernameAvailability,
    username.trim().length >= 3 ? { username: username.trim() } : "skip",
  );

  const isUsernameValid = username.length >= 3 && username.length <= 20 && /^[a-z0-9_-]+$/.test(username.toLowerCase());
  const isUsernameAvailable = usernameQuery ? usernameQuery.available : isUsernameValid;

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

    startTransition(async () => {
      try {
        await completeProfile({
          username: username.trim(),
          displayName: displayName.trim(),
          phoneNumber: phoneNumber.trim(),
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
    <form onSubmit={handleSubmit} className="space-y-6">
      {errorMessage && (
        <div className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-3.5 text-sm text-destructive">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <p>{errorMessage}</p>
        </div>
      )}

      {/* BASIC INFORMATION */}
      <div className="space-y-4">
        <div className="border-b border-border/70 pb-2">
          <h2 className="text-base font-semibold text-foreground">Player Profile</h2>
          <p className="text-xs text-muted-foreground">Set up your public chess identity to begin playing.</p>
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
