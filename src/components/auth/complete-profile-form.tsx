"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useConvexAuth, useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { PhoneInput, validatePhoneNumber } from "./phone-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Check,
  AlertCircle,
  ShieldCheck,
  Building2,
  Smartphone,
  ChevronDown,
  ChevronUp,
  Wallet,
} from "lucide-react";
import { describeConvexError } from "@/lib/errors";
import type { BankInfo } from "@/lib/payments/types";

interface CompleteProfileFormProps {
  onSuccess?: () => void;
}

const POPULAR_BANKS = [
  { matchKey: "commercial", shortLabel: "CBE", name: "Commercial Bank of Ethiopia" },
  { matchKey: "abyssinia", shortLabel: "Abyssinia", name: "Bank of Abyssinia" },
  { matchKey: "awash", shortLabel: "Awash", name: "Awash Bank" },
  { matchKey: "dashen", shortLabel: "Dashen", name: "Dashen Bank" },
  { matchKey: "coop", shortLabel: "Coop", name: "Cooperative Bank of Oromia" },
];

export function CompleteProfileForm({ onSuccess }: CompleteProfileFormProps) {
  const router = useRouter();
  const { isAuthenticated } = useConvexAuth();
  const me = useQuery(api.players.me, isAuthenticated ? {} : "skip");
  const completeProfile = useMutation(api.players.completeProfile);

  // Form State
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [fullName, setFullName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("+251");

  // Optional Payout Details State
  const [showPayouts, setShowPayouts] = useState(false);
  const [telebirrSameAsPhone, setTelebirrSameAsPhone] = useState(true);
  const [customTelebirr, setCustomTelebirr] = useState("+251");
  const [bankCode, setBankCode] = useState<string>("");
  const [bankName, setBankName] = useState<string>("");
  const [bankAccountNumber, setBankAccountNumber] = useState<string>("");

  // Bank list fetching
  const [banks, setBanks] = useState<BankInfo[]>([]);
  const [isLoadingBanks, setIsLoadingBanks] = useState(false);

  // Validation & UI State
  const [phoneError, setPhoneError] = useState<string | undefined>();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Populate initial values once `me` loads
  useEffect(() => {
    if (me) {
      if (me.username && !username) setUsername(me.username);
      if (me.displayName && !displayName) setDisplayName(me.displayName);
      if (me.fullName && !fullName) setFullName(me.fullName);
      if (me.phoneNumber && phoneNumber === "+251") setPhoneNumber(me.phoneNumber);
      if (me.telebirrNumber) {
        setCustomTelebirr(me.telebirrNumber);
        setTelebirrSameAsPhone(false);
        setShowPayouts(true);
      }
      if (me.bankCode) {
        setBankCode(me.bankCode);
        if (me.bankName) setBankName(me.bankName);
        if (me.bankAccountNumber) setBankAccountNumber(me.bankAccountNumber);
        setShowPayouts(true);
      }
    }
  }, [me]);

  // Lazy-load banks list if user expands optional payout details
  useEffect(() => {
    if (showPayouts && banks.length === 0 && !isLoadingBanks) {
      setIsLoadingBanks(true);
      fetch("/api/finance/banks")
        .then((res) => res.json())
        .then((data) => {
          if (data.banks && Array.isArray(data.banks)) {
            setBanks(data.banks.filter((b: BankInfo) => b.code !== "855")); // Filter out Telebirr from bank list
          }
        })
        .catch((err) => console.error("Failed to load banks:", err))
        .finally(() => setIsLoadingBanks(false));
    }
  }, [showPayouts, banks.length, isLoadingBanks]);

  // Live username availability check
  const usernameQuery = useQuery(
    api.players.checkUsernameAvailability,
    username.trim().length >= 3 ? { username: username.trim() } : "skip"
  );

  const isUsernameValid =
    username.length >= 3 && username.length <= 20 && /^[a-z0-9_-]+$/.test(username.toLowerCase());
  const isUsernameAvailable = usernameQuery ? usernameQuery.available : isUsernameValid;
  const isPhoneValid = validatePhoneNumber(phoneNumber);
  const isDisplayNameValid = displayName.trim().length >= 2 && displayName.trim().length <= 30;
  const isFullNameValid = !fullName.trim() || (fullName.trim().length >= 2 && fullName.trim().length <= 70);

  // Effective Telebirr number
  const effectiveTelebirrNumber = telebirrSameAsPhone
    ? phoneNumber
    : customTelebirr.trim();
  const isTelebirrValid =
    !effectiveTelebirrNumber ||
    effectiveTelebirrNumber === "+251" ||
    validatePhoneNumber(effectiveTelebirrNumber);

  // Overall form validity
  const isFormValid =
    isUsernameValid &&
    isUsernameAvailable &&
    isPhoneValid &&
    isDisplayNameValid &&
    isFullNameValid &&
    isTelebirrValid;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // 1. Validate Phone
    if (!isPhoneValid) {
      setPhoneError("Please enter a valid 9-digit Ethiopian phone number (e.g. +251 9XX XXX XXX).");
      return;
    }
    setPhoneError(undefined);

    // 2. Validate Username
    if (!isUsernameValid) {
      setErrorMessage(
        "Username must be 3-20 characters using lowercase letters, numbers, hyphens, or underscores."
      );
      return;
    }
    if (usernameQuery && !usernameQuery.available) {
      setErrorMessage(usernameQuery.reason ?? "This username is already taken. Please choose another.");
      return;
    }

    // 3. Validate Display Name
    if (!isDisplayNameValid) {
      setErrorMessage("Display name must be between 2 and 30 characters.");
      return;
    }

    // 4. Validate Full Name if provided
    if (fullName.trim() && (fullName.trim().length < 2 || fullName.trim().length > 70)) {
      setErrorMessage("Full legal name must be between 2 and 70 characters.");
      return;
    }

    // 5. Validate Telebirr if custom
    if (!telebirrSameAsPhone && customTelebirr.trim() !== "+251" && !validatePhoneNumber(customTelebirr)) {
      setErrorMessage("Please enter a valid Ethiopian Telebirr phone number (e.g. +251 912345678).");
      return;
    }

    startTransition(async () => {
      try {
        const finalTelebirr = telebirrSameAsPhone
          ? isPhoneValid
            ? phoneNumber.trim()
            : undefined
          : validatePhoneNumber(customTelebirr)
          ? customTelebirr.trim()
          : undefined;

        await completeProfile({
          username: username.trim(),
          displayName: displayName.trim(),
          phoneNumber: phoneNumber.trim(),
          fullName: fullName.trim() || undefined,
          telebirrNumber: finalTelebirr,
          bankCode: bankCode.trim() || undefined,
          bankName: bankName.trim() || undefined,
          bankAccountNumber: bankAccountNumber.trim() || undefined,
          accountHolderName: fullName.trim() || displayName.trim() || undefined,
        });

        if (onSuccess) {
          onSuccess();
        } else if (me?.profileCompleted) {
          router.replace(`/profile/${encodeURIComponent(username.trim())}`);
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
      {me?.profileCompleted && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-primary/30 bg-primary/10 p-4 text-xs text-primary shadow-xs">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="size-5 shrink-0 text-primary" />
            <div>
              <p className="font-bold text-foreground">Editing Verified Profile & Payout Details</p>
              <p className="text-muted-foreground text-[11px]">
                Your updated details will immediately sync with your secure withdrawal preferences.
              </p>
            </div>
          </div>
          <Link
            href={`/profile/${encodeURIComponent(username || me.username)}`}
            className="inline-flex items-center justify-center h-8 px-3 rounded-lg border border-primary/30 bg-background text-primary hover:bg-primary/15 font-semibold transition-colors shrink-0 self-start sm:self-center"
          >
            &larr; Back to Profile
          </Link>
        </div>
      )}

      {errorMessage && (
        <div className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-3.5 text-sm text-destructive">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <p>{errorMessage}</p>
        </div>
      )}

      {/* BASIC IDENTITY */}
      <div className="space-y-4">
        <div className="border-b border-border/70 pb-2">
          <h2 className="text-base font-semibold text-foreground">Player Profile</h2>
          <p className="text-xs text-muted-foreground">
            Set up your Abay Chess identity. Only display name and username are public.
          </p>
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
              onChange={(e) =>
                setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""))
              }
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

        {/* Full Legal Name */}
        <div className="space-y-1.5 pt-1">
          <div className="flex items-center justify-between">
            <Label htmlFor="cp-fullname">Full Legal Name</Label>
            <span className="text-[0.7rem] text-muted-foreground">Recommended for withdrawals</span>
          </div>
          <Input
            id="cp-fullname"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="e.g. Abebe Abraham Mamo"
            maxLength={70}
            disabled={isPending}
          />
          <p className="text-[0.75rem] text-muted-foreground">
            Official legal name matching your bank account or Telebirr. Automatically auto-populates during withdrawals.
          </p>
        </div>

        {/* Primary Phone Number (Strictly Ethiopian) */}
        <div className="space-y-1.5 pt-1">
          <div className="flex items-center justify-between">
            <Label htmlFor="cp-phone">Ethiopian Phone Number</Label>
            <span className="text-[0.7rem] font-medium text-emerald-500">🇪🇹 Ethiopia (+251)</span>
          </div>
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
            placeholder="912345678"
          />
        </div>
      </div>

      {/* OPTIONAL WITHDRAWAL & PAYOUT ACCOUNTS */}
      <div className="rounded-xl border border-border/80 bg-muted/20 p-4 transition-all">
        <button
          type="button"
          onClick={() => setShowPayouts(!showPayouts)}
          className="flex w-full items-center justify-between text-left focus:outline-none"
        >
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Wallet className="size-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-foreground">
                  Withdrawal & Payout Accounts
                </span>
                <span className="rounded bg-muted px-1.5 py-0.5 text-[0.65rem] font-medium text-muted-foreground">
                  Optional
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Set up your Telebirr or Bank Account now for 1-click withdrawals later.
              </p>
            </div>
          </div>
          {showPayouts ? (
            <ChevronUp className="size-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="size-4 text-muted-foreground" />
          )}
        </button>

        {showPayouts && (
          <div className="mt-4 space-y-5 border-t border-border/60 pt-4">
            {/* Telebirr Payout Configuration */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Smartphone className="size-4 text-primary" />
                <span className="text-xs font-semibold text-foreground uppercase tracking-wider">
                  Telebirr Account
                </span>
              </div>

              <div className="flex items-center gap-2 pt-0.5">
                <input
                  type="checkbox"
                  id="telebirr-same"
                  checked={telebirrSameAsPhone}
                  onChange={(e) => setTelebirrSameAsPhone(e.target.checked)}
                  className="size-4 rounded border-input accent-primary"
                />
                <label htmlFor="telebirr-same" className="cursor-pointer text-xs text-foreground">
                  Use my primary phone number for Telebirr withdrawals
                  {isPhoneValid && (
                    <span className="ml-1 text-muted-foreground font-mono">({phoneNumber})</span>
                  )}
                </label>
              </div>

              {!telebirrSameAsPhone && (
                <div className="pt-1">
                  <PhoneInput
                    id="cp-telebirr"
                    value={customTelebirr}
                    onChange={(val) => setCustomTelebirr(val)}
                    placeholder="912345678"
                    disabled={isPending}
                    required={false}
                  />
                </div>
              )}
            </div>

            {/* Bank Account Payout Configuration */}
            <div className="space-y-2 pt-2 border-t border-border/40">
              <div className="flex items-center gap-2">
                <Building2 className="size-4 text-primary" />
                <span className="text-xs font-semibold text-foreground uppercase tracking-wider">
                  Bank Account (Optional)
                </span>
              </div>

              {/* Quick Bank Presets */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {POPULAR_BANKS.map((pop) => {
                  const match = banks.find((b) => b.name.toLowerCase().includes(pop.matchKey));
                  const isSelected = match ? bankCode === match.code : false;
                  return (
                    <button
                      type="button"
                      key={pop.matchKey}
                      onClick={() => {
                        if (match) {
                          setBankCode(match.code);
                          setBankName(match.name);
                        }
                      }}
                      className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition-all ${
                        isSelected
                          ? "border-primary bg-primary/10 text-primary font-semibold shadow-sm"
                          : "border-border/60 bg-background/50 text-muted-foreground hover:border-primary/50 hover:text-foreground"
                      }`}
                    >
                      {pop.shortLabel}
                    </button>
                  );
                })}
              </div>

              {/* Bank Dropdown */}
              <div className="grid gap-2 sm:grid-cols-2 pt-1">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Select Bank</label>
                  <select
                    value={bankCode}
                    onChange={(e) => {
                      const code = e.target.value;
                      setBankCode(code);
                      const found = banks.find((b) => b.code === code);
                      if (found) setBankName(found.name);
                    }}
                    disabled={isPending || isLoadingBanks}
                    className="h-10 w-full rounded-lg border border-input bg-background/50 px-3 text-xs text-foreground outline-none focus:border-primary"
                  >
                    <option value="">-- Choose Ethiopian Bank --</option>
                    {banks.map((b) => (
                      <option key={b.code} value={b.code}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Account Number</label>
                  <Input
                    placeholder="e.g. 1000123456789"
                    value={bankAccountNumber}
                    onChange={(e) => setBankAccountNumber(e.target.value.replace(/\s+/g, ""))}
                    disabled={isPending}
                    maxLength={30}
                    className="h-10 text-xs font-mono"
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* SUBMIT BUTTON */}
      <div className="pt-2">
        <Button
          type="submit"
          className="h-11 w-full gap-2 text-base font-semibold shadow-md shadow-primary/20"
          disabled={isPending || !isFormValid}
        >
          {isPending ? (
            <span className="flex items-center gap-2">
              <span className="size-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
              Saving Profile...
            </span>
          ) : (
            <>
              <ShieldCheck className="size-4" />
              {me?.profileCompleted
                ? "Update Profile & KYC Details ♞"
                : "Complete Profile & Start Playing ♞"}
            </>
          )}
        </Button>
        {me?.profileCompleted && (
          <div className="mt-3 text-center">
            <Link
              href={`/profile/${encodeURIComponent(username || me.username)}`}
              className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-4 font-medium transition-colors"
            >
              Cancel & Return to Profile
            </Link>
          </div>
        )}
        {!isFormValid && (
          <p className="mt-2 text-center text-xs text-amber-500/90 font-medium">
            {!isUsernameValid
              ? "Please enter a valid 3-20 character username"
              : !isUsernameAvailable
              ? "Username is already taken"
              : !isDisplayNameValid
              ? "Please enter a display name (2-30 characters)"
              : !isPhoneValid
              ? "Please enter a valid 9-digit Ethiopian phone number (e.g. 912345678)"
              : !isFullNameValid
              ? "Full legal name must be between 2 and 70 characters"
              : "Please complete all required fields"}
          </p>
        )}
      </div>
    </form>
  );
}
