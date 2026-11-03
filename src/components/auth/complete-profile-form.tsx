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
  ChevronDown,
  ChevronUp,
  Wallet,
} from "lucide-react";
import { describeConvexError } from "@/lib/errors";

interface CompleteProfileFormProps {
  onSuccess?: () => void;
}

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

  // Optional Payout Details State: strictly Telebirr, CBE Bank, and CBE Birr
  const [showPayouts, setShowPayouts] = useState(false);
  const [telebirrSameAsPhone, setTelebirrSameAsPhone] = useState(true);
  const [customTelebirr, setCustomTelebirr] = useState("+251");

  const [bankAccountNumber, setBankAccountNumber] = useState<string>("");

  const [cbeBirrEnabled, setCbeBirrEnabled] = useState(false);
  const [cbeBirrSameAsPhone, setCbeBirrSameAsPhone] = useState(true);
  const [customCbeBirr, setCustomCbeBirr] = useState("+251");

  // Validation & UI State
  const [acceptedPolicies, setAcceptedPolicies] = useState(false);
  const [phoneError, setPhoneError] = useState<string | undefined>();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Populate initial values once `me` loads
  useEffect(() => {
    if (me) {
      if (me.profileCompleted || me.acceptedPoliciesAt) {
        setAcceptedPolicies(true);
      }
      if (me.username && !username) setUsername(me.username);
      if (me.displayName && !displayName) setDisplayName(me.displayName);
      if (me.fullName && !fullName) setFullName(me.fullName);
      if (me.phoneNumber && phoneNumber === "+251") setPhoneNumber(me.phoneNumber);
      if (me.telebirrNumber) {
        setCustomTelebirr(me.telebirrNumber);
        setTelebirrSameAsPhone(me.telebirrNumber === me.phoneNumber);
        setShowPayouts(true);
      }
      if (me.bankAccountNumber) {
        setBankAccountNumber(me.bankAccountNumber);
        setShowPayouts(true);
      }
      if ((me as any).cbeBirrNumber) {
        setCustomCbeBirr((me as any).cbeBirrNumber);
        setCbeBirrSameAsPhone((me as any).cbeBirrNumber === me.phoneNumber);
        setCbeBirrEnabled(true);
        setShowPayouts(true);
      }
    }
  }, [me]);

  // Live username availability check
  const usernameQuery = useQuery(
    api.players.checkUsernameAvailability,
    username.trim().length >= 3 ? { username: username.trim().toLowerCase() } : "skip"
  );

  const isUsernameValid =
    username.length >= 3 && username.length <= 20 && /^[a-z0-9_-]+$/.test(username.toLowerCase());
  const isUsernameAvailable = usernameQuery ? usernameQuery.available : isUsernameValid;
  const isPhoneValid = validatePhoneNumber(phoneNumber);
  const isDisplayNameValid = displayName.trim().length >= 2 && displayName.trim().length <= 30;
  const isFullNameValid = !fullName.trim() || (fullName.trim().length >= 2 && fullName.trim().length <= 70);

  // Effective Telebirr validity
  const effectiveTelebirrNumber = telebirrSameAsPhone
    ? phoneNumber
    : customTelebirr.trim();
  const isTelebirrValid =
    !effectiveTelebirrNumber ||
    effectiveTelebirrNumber === "+251" ||
    validatePhoneNumber(effectiveTelebirrNumber);

  // Effective CBE Birr validity
  const effectiveCbeBirrNumber = cbeBirrSameAsPhone
    ? phoneNumber
    : customCbeBirr.trim();
  const isCbeBirrValid =
    !cbeBirrEnabled ||
    !effectiveCbeBirrNumber ||
    effectiveCbeBirrNumber === "+251" ||
    validatePhoneNumber(effectiveCbeBirrNumber);

  // CBE Account validity (optional, but if provided must be min 6 characters)
  const isCbeAccountValid =
    !bankAccountNumber.trim() || bankAccountNumber.trim().length >= 6;

  // Overall form validity
  const isFormValid =
    isUsernameValid &&
    isUsernameAvailable &&
    isPhoneValid &&
    isDisplayNameValid &&
    isFullNameValid &&
    isTelebirrValid &&
    isCbeBirrValid &&
    isCbeAccountValid &&
    acceptedPolicies;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // 0. Validate Policy Acceptance
    if (!acceptedPolicies) {
      setErrorMessage("Please accept the Terms of Service and Privacy Policy to complete registration.");
      return;
    }

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

    // 6. Validate CBE Birr if custom
    if (cbeBirrEnabled && !cbeBirrSameAsPhone && customCbeBirr.trim() !== "+251" && !validatePhoneNumber(customCbeBirr)) {
      setErrorMessage("Please enter a valid Ethiopian CBE Birr phone number (e.g. +251 912345678).");
      return;
    }

    startTransition(async () => {
      try {
        const cleanPhone = phoneNumber.trim().replace(/[\s\-()]/g, "");
        const finalTelebirr = telebirrSameAsPhone
          ? isPhoneValid
            ? cleanPhone
            : undefined
          : validatePhoneNumber(customTelebirr)
          ? customTelebirr.trim().replace(/[\s\-()]/g, "")
          : undefined;

        const cleanBankAcc = bankAccountNumber.trim().replace(/\s+/g, "");

        const finalCbeBirr = cbeBirrEnabled
          ? cbeBirrSameAsPhone
            ? isPhoneValid
              ? cleanPhone
              : undefined
            : validatePhoneNumber(customCbeBirr)
            ? customCbeBirr.trim().replace(/[\s\-()]/g, "")
            : undefined
          : undefined;

        await completeProfile({
          username: username.trim().toLowerCase(),
          displayName: displayName.trim(),
          phoneNumber: cleanPhone,
          fullName: fullName.trim() || undefined,
          telebirrNumber: finalTelebirr,
          cbeBirrNumber: finalCbeBirr,
          bankCode: cleanBankAcc ? "cbe" : undefined,
          bankName: cleanBankAcc ? "Commercial Bank of Ethiopia (CBE)" : undefined,
          bankAccountNumber: cleanBankAcc || undefined,
          accountHolderName: fullName.trim() || displayName.trim() || undefined,
          acceptedTermsVersion: "4.2.7",
          acceptedPrivacyVersion: "4.2.7",
        });

        if (onSuccess) {
          onSuccess();
        } else if (me?.profileCompleted) {
          router.replace(`/profile/${encodeURIComponent(username.trim().toLowerCase())}`);
        } else {
          router.replace("/play");
        }
      } catch (err: unknown) {
        console.error("[CompleteProfileForm] Save profile error:", err);
        const rawMsg = err instanceof Error ? err.message : String(err);
        const mappedMsg = describeConvexError(err);
        const displayMsg =
          mappedMsg !== "Something went wrong. Please try again."
            ? mappedMsg
            : rawMsg.replace(/\[CONVEX[^\]]*\]/g, "").replace(/Server Error/g, "").trim() ||
              "Failed to save profile. Please check your inputs.";
        setErrorMessage(displayMsg);
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

      {/* OPTIONAL WITHDRAWAL & PAYOUT ACCOUNTS (Telebirr, CBE Bank Account, CBE Birr) */}
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
                Set up your Telebirr, CBE Account, or CBE Birr now for 1-click withdrawals later.
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
            {/* 1. Telebirr Account with Official Company Logo */}
            <div className="rounded-xl border border-border/60 bg-background/50 p-3.5 space-y-3">
              <div className="flex items-center gap-3">
                <img
                  src="/images/banks/telebirr.svg"
                  alt="Telebirr"
                  className="size-8 rounded-lg object-contain bg-white/10 p-0.5 shadow-xs"
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-foreground tracking-wide">
                      Telebirr Account
                    </span>
                    <span className="rounded bg-emerald-500/10 text-emerald-500 px-1.5 py-0.2 text-[10px] font-semibold">
                      Mobile Money
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Ethio Telecom official digital payment channel
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="telebirr-same"
                  checked={telebirrSameAsPhone}
                  onChange={(e) => setTelebirrSameAsPhone(e.target.checked)}
                  className="size-4 rounded border-input accent-primary cursor-pointer"
                />
                <label htmlFor="telebirr-same" className="cursor-pointer text-xs text-foreground">
                  Use my primary phone number for Telebirr withdrawals
                  {isPhoneValid && (
                    <span className="ml-1 text-muted-foreground font-mono">({phoneNumber})</span>
                  )}
                </label>
              </div>

              {!telebirrSameAsPhone && (
                <div className="pt-1 space-y-1">
                  <label className="text-[11px] text-muted-foreground">Custom Telebirr Phone Number</label>
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

            {/* 2. Commercial Bank of Ethiopia (CBE) Account with Official Company Logo */}
            <div className="rounded-xl border border-border/60 bg-background/50 p-3.5 space-y-3">
              <div className="flex items-center gap-3">
                <img
                  src="/images/banks/cbe.svg"
                  alt="Commercial Bank of Ethiopia"
                  className="size-8 rounded-lg object-contain bg-white/10 p-0.5 shadow-xs"
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-foreground tracking-wide">
                      Commercial Bank of Ethiopia (CBE)
                    </span>
                    <span className="rounded bg-primary/10 text-primary px-1.5 py-0.2 text-[10px] font-semibold">
                      Bank Account
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Direct bank transfer to your official CBE account
                  </p>
                </div>
              </div>

              <div className="space-y-1 pt-1">
                <label className="text-xs text-muted-foreground">CBE Account Number</label>
                <Input
                  placeholder="e.g. 1000123456789"
                  value={bankAccountNumber}
                  onChange={(e) => setBankAccountNumber(e.target.value.replace(/\s+/g, ""))}
                  disabled={isPending}
                  maxLength={30}
                  className="h-10 text-xs font-mono"
                />
                <p className="text-[10px] text-muted-foreground">
                  Standard 13-digit Commercial Bank of Ethiopia account number.
                </p>
              </div>
            </div>

            {/* 3. CBE Birr (Optional) with Official Company Logo */}
            <div className="rounded-xl border border-border/60 bg-background/50 p-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <img
                    src="/images/banks/cbe_birr.svg"
                    alt="CBE Birr"
                    className="size-8 rounded-lg object-contain bg-white/10 p-0.5 shadow-xs"
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-foreground tracking-wide">
                        CBE Birr
                      </span>
                      <span className="rounded bg-amber-500/10 text-amber-500 px-1.5 py-0.2 text-[10px] font-semibold">
                        Optional Wallet
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Commercial Bank of Ethiopia mobile wallet service
                    </p>
                  </div>
                </div>

                <input
                  type="checkbox"
                  id="cbe-birr-enable"
                  checked={cbeBirrEnabled}
                  onChange={(e) => setCbeBirrEnabled(e.target.checked)}
                  className="size-4 rounded border-input accent-amber-500 cursor-pointer"
                />
              </div>

              {cbeBirrEnabled && (
                <div className="pt-2 border-t border-border/40 space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="cbe-birr-same"
                      checked={cbeBirrSameAsPhone}
                      onChange={(e) => setCbeBirrSameAsPhone(e.target.checked)}
                      className="size-4 rounded border-input accent-primary cursor-pointer"
                    />
                    <label htmlFor="cbe-birr-same" className="cursor-pointer text-xs text-foreground">
                      Use my primary phone number for CBE Birr withdrawals
                      {isPhoneValid && (
                        <span className="ml-1 text-muted-foreground font-mono">({phoneNumber})</span>
                      )}
                    </label>
                  </div>

                  {!cbeBirrSameAsPhone && (
                    <div className="pt-1 space-y-1">
                      <label className="text-[11px] text-muted-foreground">Custom CBE Birr Phone Number</label>
                      <PhoneInput
                        id="cp-cbe-birr"
                        value={customCbeBirr}
                        onChange={(val) => setCustomCbeBirr(val)}
                        placeholder="912345678"
                        disabled={isPending}
                        required={false}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* MANDATORY LEGAL POLICY ACCEPTANCE */}
      <div className="rounded-2xl border border-border/80 bg-muted/20 p-4 shadow-xs">
        <label className="flex items-start gap-3 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={acceptedPolicies}
            onChange={(e) => setAcceptedPolicies(e.target.checked)}
            className="mt-0.5 size-4 rounded border-border text-primary focus:ring-primary cursor-pointer shrink-0"
            required
          />
          <span className="text-xs text-muted-foreground leading-relaxed">
            I confirm that I am at least 18 years old and agree to Abay Chess&apos;s{" "}
            <Link
              href="/legal/terms"
              target="_blank"
              rel="noreferrer noopener"
              className="font-semibold text-foreground underline underline-offset-2 hover:text-primary transition-colors"
            >
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link
              href="/legal/privacy"
              target="_blank"
              rel="noreferrer noopener"
              className="font-semibold text-foreground underline underline-offset-2 hover:text-primary transition-colors"
            >
              Privacy Policy
            </Link>
            . I understand that Abay Chess strictly enforces fair play and anti-cheating regulations.
          </span>
        </label>
      </div>

      {/* SUBMIT BUTTON */}
      <div className="pt-2">
        <Button
          type="submit"
          className="h-11 w-full gap-2 text-base font-semibold shadow-md shadow-primary/20 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
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
              : !isTelebirrValid
              ? "Please enter a valid Telebirr number"
              : !isCbeAccountValid
              ? "CBE Account number must be at least 6 digits"
              : !isCbeBirrValid
              ? "Please enter a valid CBE Birr number"
              : !acceptedPolicies
              ? "You must accept the Terms of Service and Privacy Policy to proceed"
              : "Please complete all required fields"}
          </p>
        )}
      </div>
    </form>
  );
}
