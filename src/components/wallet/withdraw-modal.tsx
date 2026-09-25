"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  ArrowDownLeft,
  Loader2,
  ShieldCheck,
  User,
  Hash,
  X,
} from "lucide-react";
import { calculateWithdrawalFee, formatEtb, toSantims } from "@/lib/payments/money";
import type { BankInfo } from "@/lib/payments/types";

interface WithdrawModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableBalanceEtb: number;
}

export function WithdrawModal({
  isOpen,
  onClose,
  availableBalanceEtb,
}: WithdrawModalProps) {
  const [amountEtb, setAmountEtb] = useState<number>(100);
  const [banks, setBanks] = useState<BankInfo[]>([]);
  const [selectedBank, setSelectedBank] = useState<string>("");
  const [accountNumber, setAccountNumber] = useState<string>("");
  const [accountHolderName, setAccountHolderName] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingBanks, setIsLoadingBanks] = useState(true);

  useEffect(() => {
    if (!isOpen) return;
    let isSubscribed = true;
    fetch("/api/finance/banks")
      .then((res) => res.json())
      .then((data) => {
        if (!isSubscribed) return;
        if (data.banks && Array.isArray(data.banks)) {
          setBanks(data.banks);
          if (data.banks.length > 0) setSelectedBank(data.banks[0].code);
        }
      })
      .catch((err) => console.error("Failed to load banks:", err))
      .finally(() => {
        if (isSubscribed) setIsLoadingBanks(false);
      });

    return () => {
      isSubscribed = false;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const santims = toSantims(amountEtb > 0 ? amountEtb : 0);
  const feeCalc = calculateWithdrawalFee(santims > 0 ? santims : 5000);
  const totalRequiredEtb = feeCalc.totalDeductionSantims / 100;
  const hasSufficientFunds = availableBalanceEtb >= totalRequiredEtb;

  async function handleWithdraw() {
    if (amountEtb < 50) {
      toast.error("Minimum withdrawal is 50 ETB");
      return;
    }
    if (!hasSufficientFunds) {
      toast.error(`Insufficient balance. You need ${totalRequiredEtb.toFixed(2)} ETB including fee.`);
      return;
    }
    if (!selectedBank || !accountNumber || !accountHolderName) {
      toast.error("Please complete all bank and account fields");
      return;
    }

    const bankObj = banks.find((b) => b.code === selectedBank);
    const bankName = bankObj ? bankObj.name : "Bank Transfer";

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/finance/withdrawal/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amountEtb,
          bankName,
          bankCode: selectedBank,
          accountNumber,
          accountHolderName,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Withdrawal request failed");
      }

      toast.success("Withdrawal submitted! Funds reserved in wallet.");
      onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to process withdrawal");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-border/90 bg-card p-6 shadow-2xl space-y-5 dark:border-border/60 dark:bg-zinc-950">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/60 pb-4">
          <div className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-500">
              <ArrowDownLeft className="size-5" />
            </span>
            <div>
              <h2 className="text-lg font-black tracking-tight text-foreground">
                Withdraw to Ethiopian Bank
              </h2>
              <p className="text-xs text-muted-foreground">
                Available: {availableBalanceEtb.toFixed(2)} ETB
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Inputs */}
        <div className="space-y-3.5 text-xs">
          <div>
            <label className="font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">
              Withdrawal Amount (ETB)
            </label>
            <input
              type="number"
              min="50"
              value={amountEtb}
              onChange={(e) => setAmountEtb(parseFloat(e.target.value) || 0)}
              className="w-full h-11 px-3.5 rounded-xl border border-border/80 bg-background text-foreground font-mono text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">
              Destination Bank / Service
            </label>
            {isLoadingBanks ? (
              <div className="flex items-center gap-2 h-11 px-3.5 rounded-xl border border-border/80 bg-muted/20 text-muted-foreground">
                <Loader2 className="size-4 animate-spin text-emerald-500" />
                <span>Loading supported banks...</span>
              </div>
            ) : (
              <select
                value={selectedBank}
                onChange={(e) => setSelectedBank(e.target.value)}
                className="w-full h-11 px-3.5 rounded-xl border border-border/80 bg-background text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {banks.map((b) => (
                  <option key={b.code} value={b.code}>
                    {b.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">
              Account Number / Phone
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="e.g. 1000123456789 or 0911..."
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                className="w-full h-11 pl-9 pr-3.5 rounded-xl border border-border/80 bg-background text-foreground font-mono text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <Hash className="size-4 text-muted-foreground absolute left-3 top-3.5" />
            </div>
          </div>

          <div>
            <label className="font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">
              Account Holder Full Name
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="Full name as registered on account"
                value={accountHolderName}
                onChange={(e) => setAccountHolderName(e.target.value)}
                className="w-full h-11 pl-9 pr-3.5 rounded-xl border border-border/80 bg-background text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <User className="size-4 text-muted-foreground absolute left-3 top-3.5" />
            </div>
          </div>
        </div>

        {/* Fee & Deduction Breakdown */}
        <div className="rounded-2xl border border-border/80 bg-muted/20 p-4 space-y-2 text-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span>You Receive</span>
            <span className="font-mono font-bold text-foreground">
              {formatEtb(feeCalc.userReceivesSantims)}
            </span>
          </div>
          <div className="flex items-center justify-between text-muted-foreground">
            <span>Chapa Transfer Fee (2.5%)</span>
            <span className="font-mono font-bold text-foreground">
              {formatEtb(feeCalc.providerFeeSantims)}
            </span>
          </div>
          <div className="pt-2 border-t border-border/60 flex items-center justify-between text-sm font-black">
            <span className="text-foreground">Total Wallet Deduction</span>
            <span
              className={`font-mono ${
                hasSufficientFunds ? "text-emerald-500" : "text-destructive"
              }`}
            >
              {formatEtb(feeCalc.totalDeductionSantims)}
            </span>
          </div>
        </div>

        {!hasSufficientFunds && (
          <p className="text-xs text-destructive font-bold text-center">
            Insufficient available balance for this withdrawal and fee.
          </p>
        )}

        {/* Actions */}
        <div className="pt-1 flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="flex-1 h-12 rounded-xl text-xs font-bold"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleWithdraw}
            disabled={isSubmitting || !hasSufficientFunds || amountEtb < 50}
            className="flex-1 h-12 rounded-xl text-xs font-extrabold bg-emerald-600 hover:bg-emerald-700 text-white gap-2 shadow-xs"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Reserving Payout...
              </>
            ) : (
              "Confirm Withdrawal"
            )}
          </Button>
        </div>

        <div className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
          <ShieldCheck className="size-3.5 text-emerald-500" />
          <span>Funds reserved safely before provider transfer verification</span>
        </div>
      </div>
    </div>
  );
}
