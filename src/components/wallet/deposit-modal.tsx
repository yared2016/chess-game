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
  Sparkles,
} from "lucide-react";
import { calculateDepositFee, formatEtb, toSantims } from "@/lib/payments/money";

interface DepositModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PRESET_AMOUNTS = [50, 100, 250, 500, 1000];

export function DepositModal({ isOpen, onClose }: DepositModalProps) {
  const [amountEtb, setAmountEtb] = useState<number>(100);
  const [customInput, setCustomInput] = useState<string>("100");
  const [isInitializing, setIsInitializing] = useState(false);

  if (!isOpen) return null;

  const santims = toSantims(amountEtb > 0 ? amountEtb : 0);
  const feeCalc = calculateDepositFee(santims > 0 ? santims : 1000);

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
    } catch (err: any) {
      toast.error(err.message || "Failed to start payment");
      setIsInitializing(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-border/90 bg-card p-6 shadow-2xl space-y-5 dark:border-border/60 dark:bg-zinc-950">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/60 pb-4">
          <div className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-xl bg-purple-500/15 text-purple-500">
              <CreditCard className="size-5" />
            </span>
            <div>
              <h2 className="text-lg font-black tracking-tight text-foreground">
                Deposit to Chess Wallet
              </h2>
              <p className="text-xs text-muted-foreground">
                Secure checkout via Chapa (Test Mode)
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

        {/* Test Mode Badge */}
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3.5 flex items-start gap-2.5">
          <AlertCircle className="size-4.5 text-amber-500 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <p className="text-xs font-bold text-amber-500">TEST MODE ACTIVATED</p>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              No real money is charged. Use test card <span className="font-mono font-bold text-foreground">4200 0000 0000 0000</span> (CVV: 123, Exp: 12/34).
            </p>
          </div>
        </div>

        {/* Amount Selector */}
        <div className="space-y-3">
          <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
            Select Amount to Add (ETB)
          </label>
          <div className="grid grid-cols-5 gap-2">
            {PRESET_AMOUNTS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => handleSelectPreset(preset)}
                className={`py-2 text-xs font-black rounded-xl border transition-all ${
                  amountEtb === preset
                    ? "bg-purple-600 text-white border-purple-600 shadow-xs"
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
              placeholder="Or enter custom amount..."
              className="w-full h-11 px-3.5 rounded-xl border border-border/80 bg-background text-foreground font-mono text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            <span className="absolute right-3.5 top-3 text-xs font-black text-muted-foreground">
              ETB
            </span>
          </div>
        </div>

        {/* Transparent Fee Breakdown */}
        <div className="rounded-2xl border border-border/80 bg-muted/20 p-4 space-y-2.5 text-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span>Wallet Credit</span>
            <span className="font-mono font-bold text-foreground">
              {formatEtb(feeCalc.walletCreditSantims)}
            </span>
          </div>
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span>Chapa Transaction Fee</span>
              <span className="text-[10px] text-purple-400 font-bold">(2.5%)</span>
            </span>
            <span className="font-mono font-bold text-foreground">
              {formatEtb(feeCalc.providerFeeSantims)}
            </span>
          </div>
          <div className="pt-2 border-t border-border/60 flex items-center justify-between text-sm font-black">
            <span className="text-foreground">Total Payment</span>
            <span className="font-mono text-purple-500">
              {formatEtb(feeCalc.grossPaymentSantims)}
            </span>
          </div>
        </div>

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
            className="flex-1 h-12 rounded-xl text-xs font-extrabold bg-purple-600 hover:bg-purple-700 text-white gap-2 shadow-xs"
          >
            {isInitializing ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Initializing...
              </>
            ) : (
              <>
                <ExternalLink className="size-4" />
                Pay with Chapa
              </>
            )}
          </Button>
        </div>

        <div className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
          <ShieldCheck className="size-3.5 text-emerald-500" />
          <span>Server-verified transaction ledger & 256-bit encryption</span>
        </div>
      </div>
    </div>
  );
}
