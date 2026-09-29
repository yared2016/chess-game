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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 p-0 sm:p-4 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto">
      <div className="relative w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl border border-border/80 bg-card shadow-2xl dark:border-border/60 dark:bg-zinc-950 flex flex-col max-h-[92vh] sm:max-h-[88vh] overflow-hidden my-auto">
        {/* Fixed Header */}
        <div className="flex items-center justify-between border-b border-border/60 px-5 py-4 shrink-0 bg-card dark:bg-zinc-950">
          <div className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-xl bg-amber-500/15 text-amber-500 font-bold border border-amber-500/30 shadow-xs">
              <CreditCard className="size-5" />
            </span>
            <div>
              <h2 className="text-base sm:text-lg font-black tracking-tight text-foreground">
                Deposit Funds
              </h2>
              <p className="text-[11px] text-muted-foreground">
                Instant deposit via Chapa ({feePercent}% fee incl. VAT)
              </p>
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
                className="w-full h-12 px-4 pr-14 rounded-xl border border-border/80 bg-background text-foreground font-mono text-base sm:text-sm font-bold focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all"
              />
              <span className="absolute right-4 top-3 text-xs font-bold text-amber-500 font-mono">
                ETB
              </span>
            </div>

            {/* Preset Amount Chips */}
            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
              {PRESET_AMOUNTS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => handleSelectPreset(preset)}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-colors ${
                    amountEtb === preset
                      ? "bg-amber-500 text-zinc-950 shadow-xs"
                      : "bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground border border-border/40"
                  }`}
                >
                  {preset} ETB
                </button>
              ))}
            </div>
          </div>

          {/* Fee & Credit Breakdown Card */}
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

          <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-3 text-[11px] text-amber-500 leading-relaxed">
            You will be safely redirected to Chapa to pay via Telebirr, CBE Birr, Awash, or Card. Your wallet is credited instantly upon completion.
          </div>
        </div>

        {/* Fixed Footer Actions */}
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
              onClick={handleProceed}
              disabled={isInitializing || amountEtb < 10}
              className="flex-1 h-11 sm:h-12 rounded-xl text-xs font-extrabold bg-amber-500 hover:bg-amber-600 text-zinc-950 gap-2 shadow-xs transition-all"
            >
              {isInitializing ? (
                <>
                  <Loader2 className="size-4 animate-spin text-zinc-950" />
                  <span>Connecting...</span>
                </>
              ) : (
                <>
                  <span>Continue to Chapa</span>
                  <ArrowRight className="size-4" />
                </>
              )}
            </Button>
          </div>

          <div className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
            <ShieldCheck className="size-3.5 text-emerald-500 shrink-0" />
            <span>Secure Checkout • Powered by Chapa</span>
          </div>
        </div>
      </div>
    </div>
  );
}
