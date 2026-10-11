"use client";

import { useState } from "react";
import { useMutation, useQuery, useConvexAuth } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  ArrowDownLeft,
  Building2,
  CheckCircle2,
  Smartphone,
  Loader2,
} from "lucide-react";

export function WithdrawFlow() {
  const { isAuthenticated } = useConvexAuth();
  const [step, setStep] = useState<"form" | "status">("form");
  const [amount, setAmount] = useState("");
  const [payoutMethod, setPayoutMethod] = useState<"telebirr" | "cbe_bank" | "cbe_birr">("telebirr");
  const [payoutAccount, setPayoutAccount] = useState("");
  const [accountHolderName, setAccountHolderName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const balance = useQuery(api.wallets.getBalance, isAuthenticated ? {} : "skip");
  const requestWithdrawal = useMutation(api.withdrawals.request);

  const maxAmount = balance?.available ?? 0;

  const handleSelectPreset = (val: number) => {
    const target = Math.min(val, maxAmount);
    setAmount(target > 0 ? target.toString() : val.toString());
  };

  const handleSelectMax = () => {
    setAmount(maxAmount.toString());
  };

  const handleSubmit = async () => {
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt < 50) {
      toast.error("Minimum withdrawal is 50 ETB");
      return;
    }
    if (amt > maxAmount) {
      toast.error("Insufficient available balance");
      return;
    }
    const cleanAccount = payoutAccount.trim();
    if (!cleanAccount) {
      toast.error(
        payoutMethod === "cbe_bank"
          ? "Please enter your CBE account number"
          : "Please enter your phone number",
      );
      return;
    }
    if (!accountHolderName.trim()) {
      toast.error("Please enter the account holder name");
      return;
    }

    try {
      setIsSubmitting(true);
      await requestWithdrawal({
        amount: amt,
        payoutMethod,
        payoutAccount: cleanAccount,
        accountHolderName: accountHolderName.trim(),
      });
      setStep("status");
      toast.success("Withdrawal request submitted successfully");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Withdrawal request failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const channelLabel =
    payoutMethod === "telebirr"
      ? "Telebirr"
      : payoutMethod === "cbe_bank"
        ? "CBE Bank"
        : "CBE Birr";

  if (step === "status") {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-8 text-center rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="rounded-full bg-emerald-500/10 p-4 text-emerald-500 ring-8 ring-emerald-500/5">
          <CheckCircle2 className="size-10" />
        </div>
        <h3 className="text-xl font-bold text-foreground">Withdrawal Submitted</h3>
        <p className="max-w-md text-sm text-muted-foreground leading-relaxed">
          Your request for <strong>{amount} ETB</strong> via <strong>{channelLabel}</strong> ({payoutAccount}) has been submitted. The requested funds have been placed on hold and will be transferred upon administrator review.
        </p>
        <div className="mt-4 flex flex-col sm:flex-row gap-3 w-full max-w-xs">
          <Button
            variant="outline"
            className="w-full cursor-pointer"
            onClick={() => {
              setStep("form");
              setAmount("");
              setPayoutAccount("");
              setAccountHolderName("");
            }}
          >
            New Withdrawal
          </Button>
        </div>
      </div>
    );
  }

  const numAmount = parseFloat(amount) || 0;
  const isValidAmount = numAmount >= 50 && numAmount <= maxAmount;

  return (
    <div className="flex flex-col gap-5 rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-sm">
      <div className="flex items-center justify-between border-b border-border/60 pb-4">
        <div>
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <ArrowDownLeft className="size-5 text-primary" />
            Withdraw ETB
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Transfer funds directly to your Telebirr, CBE Bank, or CBE Birr account.
          </p>
        </div>
        <div className="text-right">
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground block">Available</span>
          <span className="text-base font-bold text-emerald-500">{maxAmount.toFixed(2)} ETB</span>
        </div>
      </div>

      <div className="space-y-4">
        {/* Method Picker */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Select Payout Method
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setPayoutMethod("telebirr")}
              className={`flex items-center justify-center gap-2 rounded-xl border p-3 text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                payoutMethod === "telebirr"
                  ? "border-primary bg-primary/10 text-primary shadow-sm"
                  : "border-border bg-muted/30 text-muted-foreground hover:bg-muted/60"
              }`}
            >
              <Smartphone className="size-4" />
              Telebirr
            </button>
            <button
              type="button"
              onClick={() => setPayoutMethod("cbe_bank")}
              className={`flex items-center justify-center gap-2 rounded-xl border p-3 text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                payoutMethod === "cbe_bank"
                  ? "border-primary bg-primary/10 text-primary shadow-sm"
                  : "border-border bg-muted/30 text-muted-foreground hover:bg-muted/60"
              }`}
            >
              <Building2 className="size-4" />
              CBE Bank
            </button>
            <button
              type="button"
              onClick={() => setPayoutMethod("cbe_birr")}
              className={`flex items-center justify-center gap-2 rounded-xl border p-3 text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                payoutMethod === "cbe_birr"
                  ? "border-primary bg-primary/10 text-primary shadow-sm"
                  : "border-border bg-muted/30 text-muted-foreground hover:bg-muted/60"
              }`}
            >
              <Smartphone className="size-4" />
              CBE Birr
            </button>
          </div>
        </div>

        {/* Amount Input & Presets */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Amount to Withdraw (ETB)
            </label>
            <span className="text-xs text-muted-foreground">Min: 50 ETB</span>
          </div>

          <div className="relative">
            <input
              type="number"
              min={50}
              max={maxAmount}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Enter amount (min 50 ETB)"
              className="flex h-11 w-full rounded-xl border border-input bg-background px-4 py-2 text-base font-medium placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
            />
            <button
              type="button"
              onClick={handleSelectMax}
              disabled={maxAmount < 50}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary hover:bg-primary/20 disabled:opacity-40 transition-colors cursor-pointer"
            >
              MAX
            </button>
          </div>

          {/* Quick presets */}
          <div className="flex flex-wrap gap-2 pt-1">
            {[50, 100, 250, 500].map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => handleSelectPreset(preset)}
                className={`rounded-lg border px-3 py-1 text-xs font-medium transition-colors cursor-pointer ${
                  amount === preset.toString()
                    ? "border-primary bg-primary/15 text-primary"
                    : "border-border bg-background hover:bg-muted text-muted-foreground"
                }`}
              >
                {preset} ETB
              </button>
            ))}
          </div>
        </div>

        {/* Recipient Account Details */}
        <div className="space-y-3 pt-1">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">
              Account Holder Full Name
            </label>
            <input
              type="text"
              value={accountHolderName}
              onChange={(e) => setAccountHolderName(e.target.value)}
              placeholder="e.g. Abebe Bikila Kebede"
              className="flex h-11 w-full rounded-xl border border-input bg-background px-4 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">
              {payoutMethod === "cbe_bank" ? "CBE Bank Account Number" : "Phone / Account Number"}
            </label>
            <input
              type="text"
              value={payoutAccount}
              onChange={(e) => setPayoutAccount(e.target.value)}
              placeholder={payoutMethod === "cbe_bank" ? "e.g. 1000123456789" : "e.g. 0912345678"}
              className="flex h-11 w-full rounded-xl border border-input bg-background px-4 py-2 text-sm font-mono placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
            />
          </div>
        </div>

        {/* Submit Button */}
        <div className="pt-2">
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={!isValidAmount || !payoutAccount.trim() || !accountHolderName.trim() || isSubmitting}
            className="w-full h-11 rounded-xl text-sm font-bold bg-primary text-primary-foreground hover:brightness-110 gap-2 cursor-pointer shadow-xs"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                <span>Submitting Request...</span>
              </>
            ) : (
              <span>Request Payout of {numAmount > 0 ? numAmount.toFixed(2) : "0.00"} ETB</span>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
