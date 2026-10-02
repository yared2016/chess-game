"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  CreditCard,
  Loader2,
  ShieldCheck,
  X,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import {
  calculateDepositFee,
  formatEtb,
  toSantims,
  getChapaFeeRatePercent,
} from "@/lib/payments/money";

interface DepositModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PRESET_AMOUNTS = [100, 500, 1000, 2500, 5000];

export function DepositModal({ isOpen, onClose }: DepositModalProps) {
  const [amountEtb, setAmountEtb] = useState<number>(1000);
  const [customInput, setCustomInput] = useState<string>("1000");
  const [isInitializing, setIsInitializing] = useState(false);

  if (!isOpen) return null;

  const santims = toSantims(amountEtb > 0 ? amountEtb : 0);
  const feeCalc = calculateDepositFee(santims > 0 ? santims : 100000);
  const feePercent = getChapaFeeRatePercent();

  function handleSelectPreset(val: number) {
    setAmountEtb(val);
    setCustomInput(String(val));
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

  async function handleProceed() {
    if (amountEtb < 10) {
      toast.error("Minimum deposit is 10 ETB");
      return;
    }

    setIsInitializing(true);
    try {
      const res = await fetch("/api/finance/deposit/initialize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountEtb }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Initialization failed");
      }

      if (data.checkoutUrl) {
        toast.info("Redirecting to secure Chapa checkout...");
        window.location.href = data.checkoutUrl;
      } else {
        throw new Error("No checkout URL returned");
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to start payment");
      setIsInitializing(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4 backdrop-blur-sm animate-in fade-in duration-150 overflow-y-auto">
      <div className="relative w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl border border-border/80 bg-card shadow-2xl flex flex-col max-h-[92vh] sm:max-h-[88vh] overflow-hidden my-auto transition-all animate-in slide-in-from-bottom-4 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/60 px-5 py-4 shrink-0 bg-card">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-2xl bg-primary/10 text-primary font-bold border border-primary/20 shadow-xs">
              <CreditCard className="size-5" />
            </span>
            <div>
              <h2 className="text-base sm:text-lg font-bold tracking-tight text-foreground">
                Deposit Funds
              </h2>
              <p className="text-[11px] text-muted-foreground">
                Instant checkout via Telebirr, CBE Birr & Banks
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            aria-label="Close modal"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto px-5 py-4 space-y-4 text-xs">
          {/* Amount Selector */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                Deposit Amount (ETB)
              </label>
              <span className="text-[11px] text-muted-foreground font-mono">
                Min: 10 ETB
              </span>
            </div>

            <div className="relative">
              <input
                type="number"
                min="10"
                max="100000"
                value={customInput}
                onChange={(e) => handleCustomChange(e.target.value)}
                placeholder="1,000.00"
                className="w-full h-12 px-4 pr-16 rounded-2xl border border-border/80 bg-background text-foreground font-mono text-base font-bold focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
              />
              <span className="absolute right-4 top-3.5 text-xs font-mono font-bold text-muted-foreground">
                ETB
              </span>
            </div>

            {/* Preset Amount Chips */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              {PRESET_AMOUNTS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => handleSelectPreset(preset)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                    amountEtb === preset
                      ? "bg-primary text-primary-foreground shadow-xs font-bold"
                      : "bg-muted/50 text-foreground hover:bg-muted border border-border/60"
                  }`}
                >
                  +{preset} ETB
                </button>
              ))}
            </div>
          </div>

          {/* Fee & Credit Breakdown Card */}
          <div className="rounded-2xl border border-border/70 bg-muted/30 p-4 space-y-2 text-xs">
            <div className="flex items-center justify-between text-muted-foreground">
              <span>Wallet credit</span>
              <span className="font-mono font-semibold text-foreground">
                {formatEtb(feeCalc.walletCreditSantims)}
              </span>
            </div>

            <div className="flex items-center justify-between text-muted-foreground">
              <span>Chapa gateway fee ({feePercent}%)</span>
              <span className="font-mono font-semibold text-muted-foreground">
                {formatEtb(feeCalc.providerFeeSantims)}
              </span>
            </div>

            <div className="pt-2 border-t border-border/60 flex items-center justify-between text-sm font-bold">
              <span className="text-foreground">Total Checkout Amount</span>
              <span className="font-mono text-primary font-bold">
                {formatEtb(feeCalc.grossPaymentSantims)}
              </span>
            </div>
          </div>

          <div className="rounded-2xl bg-primary/5 border border-primary/15 p-3 text-[11px] text-muted-foreground leading-relaxed flex items-start gap-2.5">
            <Sparkles className="size-4 text-primary shrink-0 mt-0.5" />
            <span>
              You will be redirected to Chapa&apos;s PCI-DSS compliant checkout to complete payment via Telebirr, CBE Birr, Awash, or Card. Funds credit automatically upon success.
            </span>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-border/60 bg-card/95 shrink-0 space-y-2.5">
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1 h-11 rounded-xl text-xs font-semibold"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleProceed}
              disabled={isInitializing || amountEtb < 10}
              className="flex-1 h-11 rounded-xl text-xs font-bold bg-primary text-primary-foreground hover:brightness-110 gap-2 shadow-xs transition-all"
            >
              {isInitializing ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  <span>Connecting...</span>
                </>
              ) : (
                <>
                  <span>Pay with Chapa</span>
                  <ArrowRight className="size-4" />
                </>
              )}
            </Button>
          </div>

          <div className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
            <ShieldCheck className="size-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>Official Chapa Payment Gateway • 256-bit SSL</span>
          </div>
        </div>
      </div>
    </div>
  );
}
