"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function WithdrawFlow() {
  const [step, setStep] = useState<"form" | "status">("form");
  const [amount, setAmount] = useState("");
  const [payoutMethod, setPayoutMethod] = useState("Telebirr");
  const [payoutAccount, setPayoutAccount] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const balance = useQuery(api.wallets?.getBalance as any);
  const requestWithdrawal = useMutation(api.withdrawals?.request as any);

  const maxAmount = balance?.available ?? 0;

  const handleSubmit = async () => {
    const amt = parseInt(amount);
    if (isNaN(amt) || amt < 50) {
      toast.error("Minimum withdrawal is 50 ETB");
      return;
    }
    if (amt > maxAmount) {
      toast.error("Insufficient available balance");
      return;
    }
    if (!payoutAccount.trim()) {
      toast.error("Please enter your account number");
      return;
    }

    try {
      setIsSubmitting(true);
      await requestWithdrawal({
        amount: amt,
        payoutMethod,
        payoutAccount,
      });
      setStep("status");
    } catch (error: any) {
      toast.error(error.message || "Withdrawal request failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (step === "status") {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-8 text-center">
        <div className="rounded-full bg-green-500/20 p-4 text-green-500">
          ✓
        </div>
        <h3 className="text-xl font-medium">Withdrawal Requested</h3>
        <p className="text-muted-foreground">
          Your request is pending and will be processed soon.
        </p>
        <Button variant="outline" onClick={() => {
          setStep("form");
          setAmount("");
        }}>
          Request another withdrawal
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-between items-center text-sm">
        <span className="text-muted-foreground">Available Balance</span>
        <span className="font-medium text-green-500">{maxAmount} ETB</span>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Amount (ETB)</label>
          <input
            type="number"
            min={50}
            max={maxAmount}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            placeholder="Min 50 ETB"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Payout Method</label>
          <select
            value={payoutMethod}
            onChange={(e) => setPayoutMethod(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <option value="Telebirr">Telebirr</option>
            <option value="CBE">CBE</option>
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">
            {payoutMethod === "Telebirr" ? "Phone Number" : "Account Number"}
          </label>
          <input
            type="text"
            value={payoutAccount}
            onChange={(e) => setPayoutAccount(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            placeholder={payoutMethod === "Telebirr" ? "09..." : "1000..."}
          />
        </div>

        <Button 
          className="w-full" 
          onClick={handleSubmit} 
          disabled={isSubmitting || !amount || parseInt(amount) < 50 || parseInt(amount) > maxAmount}
        >
          {isSubmitting ? "Requesting..." : "Request Withdrawal"}
        </Button>
      </div>
    </div>
  );
}
