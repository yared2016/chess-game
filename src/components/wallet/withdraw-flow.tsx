"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ArrowDownLeft, Building2, CheckCircle2, Phone, Wallet } from "lucide-react";

export function WithdrawFlow() {
  const [step, setStep] = useState<"form" | "status">("form");
  const [amount, setAmount] = useState("");
  const [payoutMethod, setPayoutMethod] = useState<"telebirr" | "cbe">("telebirr");
  const [payoutAccount, setPayoutAccount] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const balance = useQuery(api.wallets?.getBalance as any);
  const requestWithdrawal = useMutation(api.withdrawals?.request as any);

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
    if (!payoutAccount.trim()) {
      toast.error(
        payoutMethod === "telebirr"
          ? "Please enter your Telebirr phone number"
          : "Please enter your CBE account number"
      );
      return;
    }

    try {
      setIsSubmitting(true);
      await requestWithdrawal({
        amount: amt,
        payoutMethod: payoutMethod, // "telebirr" | "cbe"
        payoutAccount: payoutAccount.trim(),
      });
      setStep("status");
      toast.success("Withdrawal request submitted successfully");
    } catch (error: any) {
      toast.error(error.message || "Withdrawal request failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (step === "status") {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-8 text-center rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="rounded-full bg-green-500/10 p-4 text-green-500 ring-8 ring-green-500/5">
          <CheckCircle2 className="size-10" />
        </div>
        <h3 className="text-xl font-bold text-foreground">Withdrawal Submitted</h3>
        <p className="max-w-md text-sm text-muted-foreground leading-relaxed">
          Your request for <strong>{amount} ETB</strong> via{" "}
          <strong className="capitalize">{payoutMethod === "cbe" ? "CBE Bank" : "Telebirr"}</strong> has been sent to the admin. Funds will be transferred shortly.
        </p>
        <div className="mt-4 flex flex-col sm:flex-row gap-3 w-full max-w-xs">
          <Button
            variant="outline"
            className="w-full"
            onClick={() => {
              setStep("form");
              setAmount("");
              setPayoutAccount("");
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
            Transfer funds directly to your Telebirr or Commercial Bank of Ethiopia (CBE) account.
          </p>
        </div>
        <div className="text-right">
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground block">Available</span>
          <span className="text-base font-bold text-green-500">{maxAmount} ETB</span>
        </div>
      </div>

      <div className="space-y-4">
        {/* Method Picker */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Select Payout Method
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setPayoutMethod("telebirr")}
              className={`flex items-center justify-center gap-2 rounded-xl border p-3.5 text-sm font-semibold transition-all ${
                payoutMethod === "telebirr"
                  ? "border-primary bg-primary/10 text-primary shadow-sm"
                  : "border-border bg-muted/30 text-muted-foreground hover:bg-muted/60"
              }`}
            >
              <Phone className="size-4" />
              Telebirr
            </button>
            <button
              type="button"
              onClick={() => setPayoutMethod("cbe")}
              className={`flex items-center justify-center gap-2 rounded-xl border p-3.5 text-sm font-semibold transition-all ${
                payoutMethod === "cbe"
                  ? "border-primary bg-primary/10 text-primary shadow-sm"
                  : "border-border bg-muted/30 text-muted-foreground hover:bg-muted/60"
              }`}
            >
              <Building2 className="size-4" />
              CBE Bank
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
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary hover:bg-primary/20 disabled:opacity-40 transition-colors"
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
                className={`rounded-lg border px-3 py-1 text-xs font-medium transition-colors ${
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

        {/* Account Details */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            {payoutMethod === "telebirr" ? "Telebirr Phone Number" : "CBE Account Number"}
          </label>
          <input
            type="text"
            value={payoutAccount}
            onChange={(e) => setPayoutAccount(e.target.value)}
            placeholder={
              payoutMethod === "telebirr"
                ? "e.g. 0912345678"
                : "e.g. 1000123456789 (13 digits)"
            }
            className="flex h-11 w-full rounded-xl border border-input bg-background px-4 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
          />
        </div>

        {/* Submission */}
        <div className="pt-2">
          {maxAmount < 50 ? (
            <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-3.5 text-xs text-amber-500 leading-relaxed">
              Your available balance ({maxAmount} ETB) is below the minimum withdrawal limit of 50 ETB. Win staked matches or deposit to withdraw.
            </div>
          ) : (
            <Button
              className="w-full h-11 text-base font-semibold"
              onClick={handleSubmit}
              disabled={isSubmitting || !isValidAmount || !payoutAccount.trim()}
            >
              {isSubmitting
                ? "Submitting Request..."
                : `Withdraw ${numAmount > 0 ? numAmount + " ETB" : "Funds"}`}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
