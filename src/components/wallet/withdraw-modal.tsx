"use client";

import { useState } from "react";
import { useQuery, useMutation, useConvexAuth } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  ArrowDownLeft,
  Loader2,
  ShieldCheck,
  X,
  Building2,
  Smartphone,
  ArrowRight,
  Wallet,
  Lock,
  Info,
} from "lucide-react";

interface WithdrawModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableBalanceEtb: number;
}

const PRESET_AMOUNTS = [100, 250, 500, 1000];

type PayoutChannel = "telebirr" | "cbe_bank" | "cbe_birr";

export function WithdrawModal({
  isOpen,
  onClose,
  availableBalanceEtb,
}: WithdrawModalProps) {
  const [method, setMethod] = useState<PayoutChannel>("telebirr");
  const [amountEtb, setAmountEtb] = useState<number>(500);
  const [customInput, setCustomInput] = useState<string>("500");
  const [customAccountNumber, setCustomAccountNumber] = useState<string | null>(null);
  const [customAccountHolderName, setCustomAccountHolderName] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmittedSuccess, setIsSubmittedSuccess] = useState(false);

  const { isAuthenticated } = useConvexAuth();
  const me = useQuery(api.players.me, isAuthenticated ? {} : "skip");
  const updatePayoutSettings = useMutation(api.players.updatePayoutSettings);
  const requestWithdrawal = useMutation(api.withdrawals.request);
  const [saveToProfile, setSaveToProfile] = useState(false);

  // Derived account details avoiding effect-based setState
  const defaultAccountHolderName = me?.fullName ?? "";
  const defaultAccountNumber =
    method === "telebirr"
      ? (me?.telebirrNumber ?? "")
      : method === "cbe_bank"
        ? (me?.bankAccountNumber ?? "")
        : "";

  const accountHolderName =
    customAccountHolderName !== null ? customAccountHolderName : defaultAccountHolderName;
  const accountNumber =
    customAccountNumber !== null ? customAccountNumber : defaultAccountNumber;

  if (!isOpen) return null;

  const hasSufficientFunds = availableBalanceEtb >= amountEtb && amountEtb >= 50;

  function handleSelectPreset(val: number) {
    const clamped = Math.min(val, Math.max(50, availableBalanceEtb));
    setAmountEtb(clamped);
    setCustomInput(String(clamped));
  }

  function handleSelectMax() {
    const maxVal = Math.floor(availableBalanceEtb);
    setAmountEtb(maxVal);
    setCustomInput(String(maxVal));
  }

  function handleCustomChange(val: string) {
    setCustomInput(val);
    const parsed = parseFloat(val);
    if (!isNaN(parsed) && parsed > 0) {
      setAmountEtb(parsed);
    } else {
      setAmountEtb(0);
    }
  }

  async function handleWithdraw() {
    if (amountEtb < 50) {
      toast.error("Minimum withdrawal is 50 ETB");
      return;
    }
    if (amountEtb > availableBalanceEtb) {
      toast.error(`Insufficient balance. Available: ${availableBalanceEtb.toFixed(2)} ETB`);
      return;
    }

    const cleanAcc = accountNumber.trim().replace(/\s/g, "");
    if (!cleanAcc) {
      toast.error(
        method === "cbe_bank"
          ? "Please enter your CBE account number"
          : "Please enter your phone number",
      );
      return;
    }

    if (!accountHolderName.trim()) {
      toast.error("Please enter the account holder name");
      return;
    }

    if (method === "telebirr" || method === "cbe_birr") {
      if (!/^(09|07|\+2519|\+2517)\d{8}$/.test(cleanAcc) && cleanAcc.length < 9) {
        toast.error("Please enter a valid phone number (e.g. 0912345678)");
        return;
      }
    }

    setIsSubmitting(true);
    try {
      await requestWithdrawal({
        amount: amountEtb,
        payoutMethod: method,
        payoutAccount: cleanAcc,
        accountHolderName: accountHolderName.trim(),
      });

      if (saveToProfile) {
        try {
          await updatePayoutSettings({
            fullName: accountHolderName.trim(),
            ...(method === "telebirr"
              ? { telebirrNumber: cleanAcc }
              : method === "cbe_bank"
                ? {
                    bankName: "Commercial Bank of Ethiopia (CBE)",
                    bankAccountNumber: cleanAcc,
                  }
                : {}),
          });
        } catch (err) {
          console.warn("Could not save to profile:", err);
        }
      }

      setIsSubmittedSuccess(true);
      toast.success("Withdrawal request submitted successfully!");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to request withdrawal");
    } finally {
      setIsSubmitting(false);
    }
  }

  const channelLabel =
    method === "telebirr"
      ? "Telebirr"
      : method === "cbe_bank"
        ? "CBE Bank Account"
        : "CBE Birr";

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4 backdrop-blur-sm animate-in fade-in duration-150 overflow-y-auto">
      <div className="relative w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl border border-border/80 bg-card shadow-2xl flex flex-col max-h-[92dvh] sm:max-h-[88vh] overflow-hidden my-auto transition-all animate-in slide-in-from-bottom-4 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/60 px-5 py-4 shrink-0 bg-card">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500 font-bold border border-amber-500/20 shadow-xs">
              <ArrowDownLeft className="size-5" />
            </span>
            <div>
              <h2 className="text-base sm:text-lg font-bold tracking-tight text-foreground">
                Withdraw Funds
              </h2>
              <p className="text-[11px] text-muted-foreground">
                Manual payout via Telebirr, CBE Bank Account &amp; CBE Birr
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="overflow-y-auto px-5 py-4 space-y-4 text-xs">
          {!isSubmittedSuccess ? (
            <>
              {/* Channel Selector */}
              <div>
                <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block mb-2">
                  1. Select Payout Channel
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setMethod("telebirr");
                      setCustomAccountNumber(null);
                    }}
                    className={`flex flex-col items-center justify-center gap-1.5 p-3 rounded-2xl border transition-all text-center cursor-pointer ${
                      method === "telebirr"
                        ? "border-emerald-500 bg-emerald-500/10 text-foreground ring-1 ring-emerald-500/30"
                        : "border-border bg-muted/20 hover:bg-muted/40 text-muted-foreground"
                    }`}
                  >
                    <Smartphone className="size-5 text-emerald-500" />
                    <span className="text-xs font-bold text-foreground">Telebirr</span>
                    <span className="text-[10px] text-muted-foreground">Mobile account</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setMethod("cbe_bank");
                      setCustomAccountNumber(null);
                    }}
                    className={`flex flex-col items-center justify-center gap-1.5 p-3 rounded-2xl border transition-all text-center cursor-pointer ${
                      method === "cbe_bank"
                        ? "border-primary bg-primary/10 text-foreground ring-1 ring-primary/30"
                        : "border-border bg-muted/20 hover:bg-muted/40 text-muted-foreground"
                    }`}
                  >
                    <Building2 className="size-5 text-primary" />
                    <span className="text-xs font-bold text-foreground">CBE Bank</span>
                    <span className="text-[10px] text-muted-foreground">Bank account</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setMethod("cbe_birr");
                      setCustomAccountNumber(null);
                    }}
                    className={`flex flex-col items-center justify-center gap-1.5 p-3 rounded-2xl border transition-all text-center cursor-pointer ${
                      method === "cbe_birr"
                        ? "border-amber-500 bg-amber-500/10 text-foreground ring-1 ring-amber-500/30"
                        : "border-border bg-muted/20 hover:bg-muted/40 text-muted-foreground"
                    }`}
                  >
                    <Smartphone className="size-5 text-amber-500" />
                    <span className="text-xs font-bold text-foreground">CBE Birr</span>
                    <span className="text-[10px] text-muted-foreground">Mobile wallet</span>
                  </button>
                </div>
              </div>

              {/* Amount Selector */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                    2. Payout Amount (ETB)
                  </label>
                  <div className="flex items-center gap-1 text-[11px] text-muted-foreground font-mono">
                    <Wallet className="size-3.5" />
                    <span>Avail: {availableBalanceEtb.toFixed(2)} ETB</span>
                  </div>
                </div>

                <div className="relative">
                  <input
                    type="number"
                    min="50"
                    max={availableBalanceEtb}
                    value={customInput}
                    onChange={(e) => handleCustomChange(e.target.value)}
                    placeholder="500"
                    className="w-full h-12 px-4 pr-16 rounded-2xl border border-border/80 bg-background text-foreground font-mono text-base font-bold focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
                  />
                  <span className="absolute right-4 top-3.5 text-xs font-mono font-bold text-muted-foreground">
                    ETB
                  </span>
                </div>

                {/* Preset Chips */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  {PRESET_AMOUNTS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => handleSelectPreset(preset)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                        amountEtb === preset
                          ? "bg-primary text-primary-foreground shadow-xs font-bold"
                          : "bg-muted/50 text-foreground hover:bg-muted border border-border/60"
                      }`}
                    >
                      {preset} ETB
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={handleSelectMax}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-500/10 text-amber-500 border border-amber-500/30 hover:bg-amber-500/20 transition-all cursor-pointer"
                  >
                    Max ({Math.floor(availableBalanceEtb)} ETB)
                  </button>
                </div>
              </div>

              {/* Destination Account Fields */}
              <div className="space-y-3 pt-1">
                <div>
                  <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                    Account Holder Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={accountHolderName}
                    onChange={(e) => setCustomAccountHolderName(e.target.value)}
                    placeholder="e.g. Abebe Bikila Kebede"
                    className="w-full h-10 px-3 rounded-xl border border-border bg-background text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                  />
                  <span className="text-[10px] text-muted-foreground mt-0.5 block">
                    Must match the legal name on your {channelLabel} account.
                  </span>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                    {method === "cbe_bank" ? "CBE Account Number *" : "Phone / Account Number *"}
                  </label>
                  <input
                    type="text"
                    required
                    value={accountNumber}
                    onChange={(e) => setCustomAccountNumber(e.target.value)}
                    placeholder={method === "cbe_bank" ? "e.g. 1000123456789" : "e.g. 0912345678"}
                    className="w-full h-10 px-3 rounded-xl border border-border bg-background text-foreground text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                  />
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="saveToProfileWithdraw"
                    checked={saveToProfile}
                    onChange={(e) => setSaveToProfile(e.target.checked)}
                    className="rounded border-border text-primary focus:ring-primary cursor-pointer"
                  />
                  <label htmlFor="saveToProfileWithdraw" className="text-xs text-muted-foreground cursor-pointer">
                    Save this destination to my profile for future withdrawals
                  </label>
                </div>
              </div>

              {/* Fee & Wallet Hold Breakdown */}
              <div className="rounded-2xl border border-border/70 bg-muted/30 p-4 space-y-2 text-xs">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>Requested payout</span>
                  <span className="font-mono font-semibold text-foreground">
                    {amountEtb > 0 ? amountEtb.toFixed(2) : "0.00"} ETB
                  </span>
                </div>

                <div className="flex items-center justify-between text-muted-foreground">
                  <span>Abay Chess platform fee</span>
                  <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                    0.00 ETB (Free)
                  </span>
                </div>

                <div className="flex items-center justify-between text-muted-foreground">
                  <span>Funds placed on temporary hold</span>
                  <span className="font-mono font-semibold text-amber-500">
                    {amountEtb > 0 ? amountEtb.toFixed(2) : "0.00"} ETB
                  </span>
                </div>

                <div className="pt-2 border-t border-border/60 flex items-center justify-between text-sm font-bold">
                  <span className="text-foreground">You Receive via {channelLabel}</span>
                  <span className="font-mono text-emerald-600 dark:text-emerald-400 font-extrabold">
                    {amountEtb > 0 ? amountEtb.toFixed(2) : "0.00"} ETB
                  </span>
                </div>
              </div>

              <div className="rounded-2xl bg-muted/40 border border-border/60 p-3 text-[11px] text-muted-foreground leading-relaxed flex items-start gap-2.5">
                <Info className="size-4 text-primary shrink-0 mt-0.5" />
                <span>
                  The requested amount will be placed on hold in your wallet until the transfer is sent. Abay Chess does not charge an internal fee. Provider network transfer charges, if any, are handled by the bank or telecom.
                </span>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center gap-3 py-6 text-center">
              <div className="rounded-full bg-amber-500/10 p-4 text-amber-500 ring-8 ring-amber-500/5">
                <Lock className="size-10" />
              </div>
              <h3 className="text-lg font-bold text-foreground">
                Withdrawal Submitted &amp; Funds Reserved
              </h3>
              <p className="max-w-sm text-xs text-muted-foreground leading-relaxed">
                Your request for <strong className="text-foreground">{amountEtb.toFixed(2)} ETB</strong> via{" "}
                <strong className="text-foreground">{channelLabel}</strong> ({accountNumber}) has been received.
              </p>
              <div className="w-full max-w-sm rounded-xl border border-border bg-muted/20 p-3 text-[11px] text-muted-foreground text-left space-y-1">
                <div className="flex justify-between">
                  <span>Recipient:</span>
                  <span className="font-semibold text-foreground">{accountHolderName}</span>
                </div>
                <div className="flex justify-between">
                  <span>Channel:</span>
                  <span className="font-semibold text-foreground">{channelLabel}</span>
                </div>
                <div className="flex justify-between">
                  <span>Amount:</span>
                  <span className="font-mono font-bold text-foreground">{amountEtb.toFixed(2)} ETB</span>
                </div>
                <div className="flex justify-between">
                  <span>Status:</span>
                  <span className="font-semibold text-amber-500">Pending Review</span>
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground">
                The requested amount has been placed on hold. Once our administrator confirms the transfer, the withdrawal will be marked complete.
              </p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-border/60 bg-card/95 shrink-0 space-y-2.5">
          {!isSubmittedSuccess ? (
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                className="flex-1 h-11 rounded-xl text-xs font-semibold cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleWithdraw}
                disabled={!hasSufficientFunds || isSubmitting || !accountNumber.trim() || !accountHolderName.trim()}
                className="flex-1 h-11 rounded-xl text-xs font-bold bg-amber-500 text-black hover:bg-amber-400 gap-2 shadow-xs transition-all cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    <span>Submitting Request...</span>
                  </>
                ) : (
                  <>
                    <span>Request Payout</span>
                    <ArrowRight className="size-4" />
                  </>
                )}
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              onClick={onClose}
              className="w-full h-11 rounded-xl text-xs font-bold bg-primary text-primary-foreground hover:brightness-110 cursor-pointer"
            >
              Done
            </Button>
          )}

          <div className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
            <ShieldCheck className="size-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>Secure Wallet Hold &bull; Immutable Ledger Accounting</span>
          </div>
        </div>
      </div>
    </div>
  );
}
