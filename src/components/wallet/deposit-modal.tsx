"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  CreditCard,
  Loader2,
  ShieldCheck,
  AlertCircle,
  X,
  ExternalLink,
  ArrowRight,
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
        toast.info("Redirecting to Chapa checkout...");
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-border/80 bg-card p-6 shadow-2xl space-y-5 dark:border-border/60 dark:bg-zinc-950">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/60 pb-4">
          <div className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-xl bg-amber-500/15 text-amber-500 font-bold">
              <CreditCard className="size-5" />
            </span>
            <div>
              <h2 className="text-lg font-black tracking-tight text-foreground">
                Deposit Funds
              </h2>
              <p className="text-xs text-muted-foreground">
                Add money using Chapa. {feePercent}% fee (including VAT) applies.
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
          <span className="flex items-center gap-1.5">
            <span className="flex size-5 items-center justify-center rounded-full bg-muted text-muted-foreground text-[11px]">
              2
            </span>
            Payment
          </span>
          <span className="h-0.5 w-8 bg-border" />
          <span className="flex items-center gap-1.5">
            <span className="flex size-5 items-center justify-center rounded-full bg-muted text-muted-foreground text-[11px]">
              3
            </span>
            Complete
          </span>
        </div>

        {/* Amount Selector */}
        <div className="space-y-3">
          <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
            How much would you like to add?
          </label>
          <div className="grid grid-cols-5 gap-2">
            {PRESET_AMOUNTS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => handleSelectPreset(preset)}
                className={`py-2 text-xs font-black rounded-xl border transition-all ${
                  amountEtb === preset
                    ? "bg-amber-500 text-zinc-950 border-amber-500 shadow-xs"
                    : "border-border/80 bg-background text-foreground hover:bg-muted"
                }`}
              >
                {preset}
              </button>
            ))}
          </div>

          <div className="relative mt-2">
            <input
              type="number"
              min="10"
              max="100000"
              value={customInput}
              onChange={(e) => handleCustomChange(e.target.value)}
              placeholder="1,000.00"
              className="w-full h-11 px-3.5 pr-14 rounded-xl border border-border/80 bg-background text-foreground font-mono text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
            <span className="absolute right-3.5 top-3 text-xs font-black text-muted-foreground">
              ETB
            </span>
          </div>
        </div>

        {/* Clear 2.6% Fee Breakdown */}
        <div className="rounded-2xl border border-border/80 bg-muted/20 p-4 space-y-2.5 text-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="font-semibold">Wallet credit</span>
            <span className="font-mono font-bold text-foreground">
              {formatEtb(feeCalc.walletCreditSantims)}
            </span>
          </div>

          <div className="flex items-center justify-between text-muted-foreground">
            <span>Chapa fee ({feePercent}%)</span>
            <span className="font-mono font-bold text-foreground">
              {formatEtb(feeCalc.providerFeeSantims)}
            </span>
          </div>

          <div className="pt-2 border-t border-border/60 flex items-center justify-between text-sm font-black">
            <span className="text-foreground">Total payment</span>
            <span className="font-mono text-amber-500">
              {formatEtb(feeCalc.grossPaymentSantims)}
            </span>
          </div>
        </div>

        <p className="text-[11px] text-muted-foreground text-center">
          You will be redirected to Chapa to complete your payment.
        </p>

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
            onClick={handleProceed}
            disabled={isInitializing || amountEtb < 10}
            className="flex-1 h-12 rounded-xl text-xs font-extrabold bg-amber-500 hover:bg-amber-600 text-zinc-950 gap-2 shadow-xs"
          >
            {isInitializing ? (
              <>
                <Loader2 className="size-4 animate-spin text-zinc-950" />
                Connecting...
              </>
            ) : (
              <>
                Continue to Chapa
                <ArrowRight className="size-4" />
              </>
            )}
          </Button>
        </div>

        <div className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
          <ShieldCheck className="size-3.5 text-emerald-500" />
          <span>Secure & Trusted • Powered by Chapa</span>
        </div>
      </div>
    </div>
  );
}
