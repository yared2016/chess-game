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
  Wallet,
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

const PRESET_AMOUNTS = [100, 250, 500, 1000];

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
  const [isTestMode, setIsTestMode] = useState(false);

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
        if (typeof data.isTestMode === "boolean") {
          setIsTestMode(data.isTestMode);
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
  const remainingBalanceEtb = Math.max(0, availableBalanceEtb - totalRequiredEtb);

  // Active bank code based on method
  const effectiveBankCode = method === "telebirr" ? "855" : selectedBank;
  const selectedBankObj = banks.find((b) => b.code === effectiveBankCode);

  function handleQuickAmount(val: number) {
    if (val === -1) {
      // Max calculation: find max amount where amount + 2.6% fee <= availableBalanceEtb
      const maxPossibleReceive = Math.floor(availableBalanceEtb / (1 + feePercent / 100));
      setAmountEtb(Math.max(50, maxPossibleReceive));
    } else {
      setAmountEtb(val);
    }
  }

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
          toast.success("Withdrawal queued. Funds remain reserved and will finalize automatically.");
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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 p-0 sm:p-4 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto">
      <div className="relative w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl border border-border/80 bg-card shadow-2xl dark:border-border/60 dark:bg-zinc-950 flex flex-col max-h-[92vh] sm:max-h-[88vh] overflow-hidden my-auto">
        {/* Fixed Header */}
        <div className="flex items-center justify-between border-b border-border/60 px-5 py-4 shrink-0 bg-card dark:bg-zinc-950">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-500 font-bold border border-amber-500/30 shadow-xs">
              <ArrowDownLeft className="size-5" />
            </span>
            <div>
              <h2 className="text-base sm:text-lg font-black tracking-tight text-foreground flex items-center gap-2">
                <span>Withdraw Funds</span>
              </h2>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Wallet className="size-3 text-amber-500" />
                <span>Available:</span>
                <span className="font-mono font-bold text-foreground">
                  {availableBalanceEtb.toFixed(2)} ETB
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="overflow-y-auto px-5 py-4 space-y-4 text-xs">
          {/* Test Mode Banner */}
          {isTestMode && (
            <div className="rounded-2xl bg-amber-500/10 border border-amber-500/25 p-3 text-[11px] text-amber-500 flex items-start gap-2.5">
              <span className="text-base shrink-0">🧪</span>
              <div className="space-y-0.5 leading-relaxed">
                <span className="font-bold block">Chapa Test Mode Active</span>
                <span>
                  Transfers are simulated without real money movement. Use account ending in{" "}
                  <strong className="font-mono font-semibold">2233</strong> or containing{" "}
                  <strong className="font-mono font-semibold">fail</strong> to simulate payout rejection.
                </span>
              </div>
            </div>
          )}

          {/* Method Toggle: Telebirr vs Bank */}
          <div className="space-y-1.5">
            <label className="font-bold text-muted-foreground uppercase tracking-wider text-[11px] block">
              Payout Destination
            </label>
            <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-muted/30 border border-border/60">
              <button
                type="button"
                onClick={() => setMethod("telebirr")}
                className={`flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold transition-all text-xs ${
                  method === "telebirr"
                    ? "bg-amber-500 text-zinc-950 shadow-xs"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                }`}
              >
                <Smartphone className="size-4 shrink-0" />
                <span>Telebirr</span>
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
                className={`flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold transition-all text-xs ${
                  method === "bank"
                    ? "bg-amber-500 text-zinc-950 shadow-xs"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                }`}
              >
                <Building2 className="size-4 shrink-0" />
                <span>Bank Account</span>
              </button>
            </div>
          </div>

          {/* Amount to Receive + Quick Chips */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="font-bold text-muted-foreground uppercase tracking-wider text-[11px]">
                Amount to receive (ETB)
              </label>
              <span className="text-[11px] text-muted-foreground font-mono">
                Min: 50 ETB
              </span>
            </div>
            <div className="relative">
              <input
                type="number"
                min="50"
                step="1"
                value={amountEtb || ""}
                onChange={(e) => setAmountEtb(parseFloat(e.target.value) || 0)}
                placeholder="500"
                className="w-full h-12 px-4 rounded-xl border border-border/80 bg-background text-foreground font-mono text-base sm:text-sm font-bold focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all"
              />
              <span className="absolute right-4 top-3 text-xs font-bold text-amber-500 font-mono">
                ETB
              </span>
            </div>

            {/* Quick Preset Amount Chips */}
            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
              {PRESET_AMOUNTS.map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => handleQuickAmount(amt)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors ${
                    amountEtb === amt
                      ? "bg-amber-500 text-zinc-950"
                      : "bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground border border-border/40"
                  }`}
                >
                  {amt} ETB
                </button>
              ))}
              <button
                type="button"
                onClick={() => handleQuickAmount(-1)}
                className="px-2.5 py-1 rounded-lg text-[11px] font-extrabold bg-amber-500/10 text-amber-500 border border-amber-500/30 hover:bg-amber-500/20 transition-colors ml-auto"
              >
                Max
              </button>
            </div>
          </div>

          {/* Destination Details */}
          <div className="space-y-3">
            {method === "bank" && (
              <div>
                <label className="font-bold text-muted-foreground uppercase tracking-wider text-[11px] block mb-1.5">
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
                    className="w-full h-11 px-3.5 rounded-xl border border-border/80 bg-background text-foreground text-xs font-medium focus:outline-none focus:ring-2 focus:ring-amber-500"
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
              <label className="font-bold text-muted-foreground uppercase tracking-wider text-[11px] block mb-1.5">
                {method === "telebirr" ? "Telebirr Phone Number" : "Account Number"}
              </label>
              <div className="relative">
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder={
                    method === "telebirr"
                      ? "e.g. 0912345678 (10 digits)"
                      : selectedBankObj?.acctLength
                        ? `Enter ${selectedBankObj.acctLength}-digit account`
                        : "Account number"
                  }
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  className="w-full h-11 pl-9 pr-3.5 rounded-xl border border-border/80 bg-background text-foreground font-mono text-sm sm:text-xs focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all"
                />
                {method === "telebirr" ? (
                  <Phone className="size-4 text-muted-foreground absolute left-3 top-3.5" />
                ) : (
                  <Hash className="size-4 text-muted-foreground absolute left-3 top-3.5" />
                )}
              </div>
            </div>

            <div>
              <label className="font-bold text-muted-foreground uppercase tracking-wider text-[11px] block mb-1.5">
                Account Holder Full Name
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Full name as registered on account"
                  value={accountHolderName}
                  onChange={(e) => setAccountHolderName(e.target.value)}
                  className="w-full h-11 pl-9 pr-3.5 rounded-xl border border-border/80 bg-background text-foreground text-sm sm:text-xs focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all"
                />
                <User className="size-4 text-muted-foreground absolute left-3 top-3.5" />
              </div>
            </div>
          </div>

          {/* Fee & Deduction Breakdown Card */}
          <div className="rounded-2xl border border-border/80 bg-muted/20 p-4 space-y-2.5">
            <div className="flex items-center justify-between text-muted-foreground">
              <span>Amount to receive</span>
              <span className="font-mono font-bold text-foreground">
                {formatEtb(feeCalc.userReceivesSantims)}
              </span>
            </div>
            <div className="flex items-center justify-between text-muted-foreground">
              <span>Chapa provider fee ({feePercent}%)</span>
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
            {hasSufficientFunds ? (
              <div className="flex items-center justify-between pt-1 text-[11px] text-muted-foreground">
                <span>Remaining available balance</span>
                <span className="font-mono text-emerald-500 font-semibold">
                  {remainingBalanceEtb.toFixed(2)} ETB
                </span>
              </div>
            ) : (
              <p className="text-[11px] text-destructive font-bold pt-1 text-center">
                Insufficient available balance for this withdrawal and fee.
              </p>
            )}
          </div>
        </div>

        {/* Fixed Footer with Actions */}
        <div className="p-4 border-t border-border/60 bg-card/95 dark:bg-zinc-950/95 shrink-0 space-y-2.5">
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1 h-11 sm:h-12 rounded-xl text-xs font-bold"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleWithdraw}
              disabled={isSubmitting || !hasSufficientFunds || amountEtb < 50}
              className="flex-1 h-11 sm:h-12 rounded-xl text-xs font-extrabold bg-amber-500 hover:bg-amber-600 text-zinc-950 gap-2 shadow-xs transition-all"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="size-4 animate-spin text-zinc-950" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <span>Confirm Withdrawal</span>
                  <ArrowRight className="size-4" />
                </>
              )}
            </Button>
          </div>

          <div className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
            <ShieldCheck className="size-3.5 text-emerald-500 shrink-0" />
            <span>
              {isTestMode
                ? "Chapa Test Simulation • Safe Practice Environment"
                : "Real Chapa Payout Gateway • Instant Telebirr & Banks"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
