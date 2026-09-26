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
  Phone,
  Building2,
  Smartphone,
  ArrowRight,
} from "lucide-react";
import {
  calculateWithdrawalFee,
  formatEtb,
  toSantims,
  getChapaFeeRatePercent,
} from "@/lib/payments/money";
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
  const [method, setMethod] = useState<"telebirr" | "bank">("telebirr");
  const [amountEtb, setAmountEtb] = useState<number>(500);
  const [banks, setBanks] = useState<BankInfo[]>([]);
  const [selectedBank, setSelectedBank] = useState<string>("855"); // default Telebirr
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
  const feeCalc = calculateWithdrawalFee(santims > 0 ? santims : 50000);
  const totalRequiredEtb = feeCalc.totalDeductionSantims / 100;
  const hasSufficientFunds = availableBalanceEtb >= totalRequiredEtb;
  const feePercent = getChapaFeeRatePercent();

  // Active bank code based on method
  const effectiveBankCode = method === "telebirr" ? "855" : selectedBank;
  const selectedBankObj = banks.find((b) => b.code === effectiveBankCode);

  async function handleWithdraw() {
    if (amountEtb < 50) {
      toast.error("Minimum withdrawal is 50 ETB");
      return;
    }
    if (!hasSufficientFunds) {
      toast.error(`Insufficient balance. You need ${totalRequiredEtb.toFixed(2)} ETB including fee.`);
      return;
    }
    if (!accountNumber.trim() || !accountHolderName.trim()) {
      toast.error("Please fill out all recipient account fields");
      return;
    }

    const cleanAcc = accountNumber.trim().replace(/\s/g, "");

    if (method === "telebirr") {
      if (!/^(09|07|\+2519|\+2517)\d{8}$/.test(cleanAcc) && cleanAcc.length !== 10) {
        toast.error("Telebirr phone number must be 10 digits (e.g. 0912345678 or 0712345678)");
        return;
      }
    } else {
      if (selectedBankObj?.acctLength && cleanAcc.length !== selectedBankObj.acctLength) {
        toast.error(
          `${selectedBankObj.name} account number must be exactly ${selectedBankObj.acctLength} digits.`
        );
        return;
      }
    }

    const bankName =
      method === "telebirr" ? "telebirr" : (selectedBankObj ? selectedBankObj.name : "Bank Transfer");

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/finance/withdrawal/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amountEtb,
          bankName,
          bankCode: effectiveBankCode,
          accountNumber: cleanAcc,
          accountHolderName: accountHolderName.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Withdrawal request failed");
      }

      if (data.status === "completed") {
        toast.success("Payout completed! Funds successfully sent.");
        onClose();
        return;
      }

      // If processing, poll verification endpoint
      if (data.internalTransferRef) {
        toast.info("Transfer registered with Chapa. Confirming status...");
        let settled = false;
        for (let attempt = 0; attempt < 4; attempt++) {
          await new Promise((resolve) => setTimeout(resolve, 2000));
          try {
            const vRes = await fetch("/api/finance/withdrawal/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ internalTransferRef: data.internalTransferRef }),
            });
            const vData = await vRes.json();
            if (vData.status === "completed") {
              toast.success("Withdrawal completed! Funds successfully transferred.");
              settled = true;
              break;
            } else if (vData.status === "failed") {
              toast.error(`Transfer rejected: ${vData.error || "Provider error"}. Funds restored to wallet.`);
              settled = true;
              break;
            }
          } catch {
            // Polling attempt failed, retry
          }
        }
        if (!settled) {
          toast.success("Withdrawal processing. Funds remain reserved and will finalize automatically.");
        }
      } else {
        toast.success("Withdrawal initiated! Transfer queued with Chapa.");
      }
      onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to process withdrawal");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-border/80 bg-card p-6 shadow-2xl space-y-5 dark:border-border/60 dark:bg-zinc-950">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/60 pb-4">
          <div className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-xl bg-amber-500/15 text-amber-500 font-bold">
              <ArrowDownLeft className="size-5" />
            </span>
            <div>
              <h2 className="text-lg font-black tracking-tight text-foreground">
                Withdraw Funds
              </h2>
              <p className="text-xs text-muted-foreground">
                Transfer to Telebirr or Bank. Available: {availableBalanceEtb.toFixed(2)} ETB
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

        {/* Stepper */}
        <div className="flex items-center justify-between px-2 text-xs font-bold text-muted-foreground border-b border-border/40 pb-3">
          <span className="flex items-center gap-1.5 text-amber-500">
            <span className="flex size-5 items-center justify-center rounded-full bg-amber-500 text-zinc-950 text-[11px] font-black">
              1
            </span>
            Amount
          </span>
          <span className="h-0.5 w-8 bg-border" />
          <span className="flex items-center gap-1.5 text-amber-500">
            <span className="flex size-5 items-center justify-center rounded-full bg-amber-500 text-zinc-950 text-[11px] font-black">
              2
            </span>
            Destination
          </span>
          <span className="h-0.5 w-8 bg-border" />
          <span className="flex items-center gap-1.5">
            <span className="flex size-5 items-center justify-center rounded-full bg-muted text-muted-foreground text-[11px]">
              3
            </span>
            Confirm
          </span>
        </div>

        {/* Method Toggle */}
        <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-muted/30 border border-border/60">
          <button
            type="button"
            onClick={() => setMethod("telebirr")}
            className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all ${
              method === "telebirr"
                ? "bg-amber-500 text-zinc-950 shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Smartphone className="size-4" />
            Telebirr
          </button>
          <button
            type="button"
            onClick={() => {
              setMethod("bank");
              if (banks.length > 0 && selectedBank === "855") {
                const firstNonTele = banks.find((b) => b.code !== "855");
                if (firstNonTele) setSelectedBank(firstNonTele.code);
              }
            }}
            className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all ${
              method === "bank"
                ? "bg-amber-500 text-zinc-950 shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Building2 className="size-4" />
            Bank Account
          </button>
        </div>

        {/* Inputs */}
        <div className="space-y-3 text-xs">
          <div>
            <label className="font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">
              Amount to receive (ETB)
            </label>
            <input
              type="number"
              min="50"
              value={amountEtb}
              onChange={(e) => setAmountEtb(parseFloat(e.target.value) || 0)}
              className="w-full h-11 px-3.5 rounded-xl border border-border/80 bg-background text-foreground font-mono text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          {method === "bank" && (
            <div>
              <label className="font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">
                Destination Bank
              </label>
              {isLoadingBanks ? (
                <div className="flex items-center gap-2 h-11 px-3.5 rounded-xl border border-border/80 bg-muted/20 text-muted-foreground">
                  <Loader2 className="size-4 animate-spin text-amber-500" />
                  <span>Loading supported banks...</span>
                </div>
              ) : (
                <select
                  value={selectedBank}
                  onChange={(e) => setSelectedBank(e.target.value)}
                  className="w-full h-11 px-3.5 rounded-xl border border-border/80 bg-background text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  {banks
                    .filter((b) => b.code !== "855")
                    .map((b) => (
                      <option key={b.code} value={b.code}>
                        {b.name} {b.acctLength ? `(${b.acctLength} digits)` : ""}
                      </option>
                    ))}
                </select>
              )}
            </div>
          )}

          <div>
            <label className="font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">
              {method === "telebirr" ? "Telebirr Phone Number" : "Account Number"}
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder={
                  method === "telebirr"
                    ? "e.g. 0912345678 (10 digits)"
                    : selectedBankObj?.acctLength
                      ? `Enter ${selectedBankObj.acctLength}-digit account`
                      : "Account number"
                }
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                className="w-full h-11 pl-9 pr-3.5 rounded-xl border border-border/80 bg-background text-foreground font-mono text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
              {method === "telebirr" ? (
                <Phone className="size-4 text-muted-foreground absolute left-3 top-3.5" />
              ) : (
                <Hash className="size-4 text-muted-foreground absolute left-3 top-3.5" />
              )}
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
                className="w-full h-11 pl-9 pr-3.5 rounded-xl border border-border/80 bg-background text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
              <User className="size-4 text-muted-foreground absolute left-3 top-3.5" />
            </div>
          </div>
        </div>

        {/* Fee & Deduction Breakdown */}
        <div className="rounded-2xl border border-border/80 bg-muted/20 p-4 space-y-2 text-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span>Amount to receive</span>
            <span className="font-mono font-bold text-foreground">
              {formatEtb(feeCalc.userReceivesSantims)}
            </span>
          </div>
          <div className="flex items-center justify-between text-muted-foreground">
            <span>Chapa fee ({feePercent}%)</span>
            <span className="font-mono font-bold text-foreground">
              {formatEtb(feeCalc.providerFeeSantims)}
            </span>
          </div>
          <div className="pt-2 border-t border-border/60 flex items-center justify-between text-sm font-black">
            <span className="text-foreground">Total wallet deduction</span>
            <span
              className={`font-mono ${
                hasSufficientFunds ? "text-amber-500" : "text-destructive"
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
            className="flex-1 h-12 rounded-xl text-xs font-extrabold bg-amber-500 hover:bg-amber-600 text-zinc-950 gap-2 shadow-xs"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="size-4 animate-spin text-zinc-950" />
                Dispatching Payout...
              </>
            ) : (
              <>
                Confirm Withdrawal
                <ArrowRight className="size-4" />
              </>
            )}
          </Button>
        </div>

        <div className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
          <ShieldCheck className="size-3.5 text-emerald-500" />
          <span>Real Chapa Payout • Instant Telebirr & Bank Transfers</span>
        </div>
      </div>
    </div>
  );
}
