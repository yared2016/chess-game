"use client";

import { useState } from "react";
import { useConvexAuth } from "convex/react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  CreditCard,
  Loader2,
  ShieldCheck,
  XCircle,
  Copy,
  RefreshCw,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { getChapaFeeRatePercent } from "@/lib/payments/money";

type PaymentState =
  | "idle"
  | "initializing"
  | "redirecting"
  | "verifying"
  | "success"
  | "pending"
  | "failed";

export function ChapaTestPayment() {
  const { isAuthenticated } = useConvexAuth();
  const [state, setState] = useState<PaymentState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [txRef, setTxRef] = useState<string | null>(null);
  const [verifyResult, setVerifyResult] = useState<any>(null);

  const searchParams = useSearchParams();
  const returnTxRef = searchParams?.get("tx_ref");
  const feePercent = getChapaFeeRatePercent();

  // Auto-verify on return
  const [hasVerified, setHasVerified] = useState(false);
  if (returnTxRef && !hasVerified && state === "idle") {
    setHasVerified(true);
    setTxRef(returnTxRef);
    setState("verifying");
    verifyPayment(returnTxRef);
  }

  async function verifyPayment(ref: string) {
    setState("verifying");
    setError(null);

    try {
      const res = await fetch("/api/finance/deposit/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ internalTxRef: ref }),
      });

      const data = await res.json();
      if (!res.ok && res.status !== 404) {
        throw new Error(data.error || "Verification failed");
      }

      setVerifyResult(data);

      if (data.status === "success") {
        setState("success");
        toast.success(`Payment verified! ${data.creditEtb} ETB credited to your wallet.`);
      } else if (data.status === "failed") {
        setState("failed");
        setError("Payment could not be verified with provider.");
      } else {
        setState("pending");
      }
    } catch (err: unknown) {
      console.error("[ChapaTestPayment] Verify error:", err);
      setError(err instanceof Error ? err.message : "Verification error");
      setState("failed");
    }
  }

  function handleReset() {
    setState("idle");
    setError(null);
    setTxRef(null);
    setVerifyResult(null);
    setHasVerified(false);
    window.history.replaceState({}, "", window.location.pathname);
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-6 sm:py-10 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border/80 pb-5">
        <Link
          href="/wallet"
          className="flex size-10 items-center justify-center rounded-2xl border border-border/80 bg-background hover:bg-muted text-muted-foreground hover:text-foreground transition-all shadow-xs group"
          title="Back to Wallet"
        >
          <ArrowLeft className="size-4.5 group-hover:-translate-x-0.5 transition-transform" />
        </Link>
        <div>
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg bg-amber-500/15 text-amber-500 font-bold">
              <CreditCard className="size-4" />
            </span>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
              Payment Status
            </h1>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Real-time server verification of Chapa checkout transactions.
          </p>
        </div>
      </div>

      {/* Payment Result Card */}
      <div className="rounded-3xl border border-border/80 bg-card overflow-hidden shadow-sm dark:border-border/60 dark:bg-[#0B0F17]">
        <div className="p-6 space-y-4">
          {state === "verifying" && (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <Loader2 className="size-10 text-amber-500 animate-spin" />
              <p className="text-base font-black text-foreground">Verifying with Chapa API...</p>
              <p className="text-xs text-muted-foreground">
                Authoritatively checking transaction status before crediting wallet
              </p>
            </div>
          )}

          {state === "success" && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-6 text-center space-y-2">
                <CheckCircle2 className="size-12 text-emerald-500 mx-auto" />
                <p className="text-xl font-black text-emerald-500">Deposit Credited Successfully!</p>
                <p className="text-xs text-muted-foreground">
                  Your payment of {verifyResult?.creditEtb} ETB has been confirmed and added to your available balance.
                </p>
              </div>

              {txRef && (
                <div className="flex items-center justify-between p-3.5 rounded-xl bg-muted/20 border border-border/80 text-xs">
                  <span className="font-bold text-muted-foreground">Transaction Ref</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-foreground truncate max-w-[200px]">{txRef}</span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(txRef);
                        toast.success("Reference copied!");
                      }}
                      className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
                    >
                      <Copy className="size-3.5" />
                    </button>
                  </div>
                </div>
              )}

              <Link
                href="/wallet"
                className="w-full h-12 flex items-center justify-center font-black text-xs bg-amber-500 hover:bg-amber-600 text-zinc-950 rounded-2xl gap-2 shadow-xs transition-all"
              >
                Return to Wallet
                <ArrowRight className="size-4" />
              </Link>
            </div>
          )}

          {state === "pending" && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-6 text-center space-y-2">
                <Clock className="size-12 text-amber-500 mx-auto" />
                <p className="text-xl font-black text-amber-500">Payment Still Processing</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Your transaction is being confirmed by the provider network.
                </p>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={() => txRef && verifyPayment(txRef)}
                  className="flex-1 h-12 font-bold text-xs bg-amber-500 hover:bg-amber-600 text-zinc-950 rounded-2xl gap-2"
                >
                  <RefreshCw className="size-4" />
                  Check Again
                </Button>
                <Link
                  href="/wallet"
                  className="flex-1 h-12 flex items-center justify-center font-bold text-xs border border-border/80 bg-background hover:bg-muted rounded-2xl"
                >
                  Back to Wallet
                </Link>
              </div>
            </div>
          )}

          {state === "failed" && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-6 text-center space-y-2">
                <XCircle className="size-12 text-destructive mx-auto" />
                <p className="text-xl font-black text-destructive">Payment Not Completed</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {error || "The transaction was cancelled or rejected by Chapa. No funds were debited."}
                </p>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={handleReset}
                  className="flex-1 h-12 font-bold text-xs bg-amber-500 hover:bg-amber-600 text-zinc-950 rounded-2xl gap-2"
                >
                  <RefreshCw className="size-4" />
                  Try Again
                </Button>
                <Link
                  href="/wallet"
                  className="flex-1 h-12 flex items-center justify-center font-bold text-xs border border-border/80 bg-background hover:bg-muted rounded-2xl"
                >
                  Back to Wallet
                </Link>
              </div>
            </div>
          )}

          {state === "idle" && (
            <div className="text-center py-6 space-y-3">
              <p className="text-xs text-muted-foreground">
                No active transaction reference detected in URL.
              </p>
              <Link
                href="/wallet"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 text-zinc-950 text-xs font-bold"
              >
                Go to Wallet
                <ArrowRight className="size-4" />
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Security Badge */}
      <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 flex items-center gap-3">
        <ShieldCheck className="size-5 text-emerald-500 shrink-0" />
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          Payments are secured via Chapa 256-bit encryption. Transactions are verified directly with the provider
          before funds are credited to your account.
        </p>
      </div>
    </div>
  );
}
