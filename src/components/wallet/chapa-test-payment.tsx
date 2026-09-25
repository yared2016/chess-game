"use client";

import { useState } from "react";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  CreditCard,
  ExternalLink,
  Loader2,
  ShieldCheck,
  XCircle,
  Sparkles,
  Copy,
  RefreshCw,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

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

  // If returning from Chapa, verify automatically
  const [hasVerified, setHasVerified] = useState(false);

  // Auto-verify on return
  if (returnTxRef && !hasVerified && state === "idle") {
    setHasVerified(true);
    setTxRef(returnTxRef);
    setState("verifying");
    verifyPayment(returnTxRef);
  }

  async function handleInitialize() {
    setState("initializing");
    setError(null);
    setVerifyResult(null);

    try {
      const res = await fetch("/api/chapa/initialize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || data.error || "Payment initialization failed");
      }

      if (!data.checkoutUrl) {
        throw new Error("No checkout URL received");
      }

      setTxRef(data.txRef);
      setState("redirecting");
      toast.info("Opening Chapa Checkout...");

      // Redirect to Chapa hosted checkout page
      window.location.href = data.checkoutUrl;
    } catch (err: any) {
      console.error("[ChapaTestPayment] Init error:", err);
      setError(err.message || "Failed to initialize payment");
      setState("failed");
      toast.error(err.message || "Payment initialization failed");
    }
  }

  async function verifyPayment(ref: string) {
    setState("verifying");
    setError(null);

    try {
      const res = await fetch("/api/chapa/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ txRef: ref }),
      });

      const data = await res.json();

      if (!res.ok && res.status !== 404) {
        throw new Error(data.error || "Verification failed");
      }

      setVerifyResult(data);

      if (data.status === "success") {
        setState("success");
        toast.success("Payment verified successfully!");
      } else if (data.status === "failed") {
        setState("failed");
        setError("Payment was not completed.");
      } else {
        setState("pending");
      }
    } catch (err: any) {
      console.error("[ChapaTestPayment] Verify error:", err);
      setError(err.message || "Verification failed");
      setState("failed");
    }
  }

  function handleReset() {
    setState("idle");
    setError(null);
    setTxRef(null);
    setVerifyResult(null);
    setHasVerified(false);
    // Clean URL params
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
            <span className="flex size-7 items-center justify-center rounded-lg bg-purple-500/15 text-purple-500">
              <CreditCard className="size-4" />
            </span>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
              Chapa Test Payment
            </h1>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Test the Chapa payment integration. No real money is charged.
          </p>
        </div>
      </div>

      {/* Test Mode Banner */}
      <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 flex items-start gap-3">
        <AlertCircle className="size-5 text-amber-500 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="text-sm font-bold text-amber-500">TEST MODE</p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            This uses Chapa&apos;s sandbox environment. No real money will be charged.
            Use test card <span className="font-mono font-bold text-foreground">4200 0000 0000 0000</span> with
            CVV <span className="font-mono font-bold text-foreground">123</span> and
            expiry <span className="font-mono font-bold text-foreground">12/34</span>.
          </p>
        </div>
      </div>

      {/* Payment Card */}
      <div className="rounded-3xl border border-border bg-card overflow-hidden shadow-sm">
        {/* Amount Section */}
        <div className="p-6 sm:p-8 text-center border-b border-border/60 bg-gradient-to-br from-card via-card to-purple-500/5">
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground">
            Test Payment Amount
          </span>
          <div className="flex items-baseline justify-center gap-2 mt-2">
            <span className="text-5xl sm:text-6xl font-black tracking-tight text-purple-500">
              10
            </span>
            <span className="text-2xl font-extrabold text-foreground">ETB</span>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Fixed test amount controlled by the server
          </p>
        </div>

        {/* Status / Action Section */}
        <div className="p-6 space-y-4">
          {state === "idle" && (
            <Button
              onClick={handleInitialize}
              disabled={!isAuthenticated}
              className="w-full h-12 font-extrabold text-sm bg-purple-600 hover:bg-purple-700 text-white rounded-xl gap-2 shadow-xs"
            >
              <CreditCard className="size-5" />
              Pay with Chapa
            </Button>
          )}

          {state === "initializing" && (
            <div className="flex flex-col items-center gap-3 py-4">
              <Loader2 className="size-8 text-purple-500 animate-spin" />
              <p className="text-sm font-bold text-foreground">Initializing payment...</p>
              <p className="text-xs text-muted-foreground">Creating secure transaction</p>
            </div>
          )}

          {state === "redirecting" && (
            <div className="flex flex-col items-center gap-3 py-4">
              <Loader2 className="size-8 text-purple-500 animate-spin" />
              <p className="text-sm font-bold text-foreground">Redirecting to Chapa...</p>
              <p className="text-xs text-muted-foreground">You&apos;ll be taken to the secure checkout</p>
            </div>
          )}

          {state === "verifying" && (
            <div className="flex flex-col items-center gap-3 py-4">
              <Loader2 className="size-8 text-emerald-500 animate-spin" />
              <p className="text-sm font-bold text-foreground">Verifying payment...</p>
              <p className="text-xs text-muted-foreground">Confirming with Chapa servers</p>
            </div>
          )}

          {state === "success" && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5 text-center space-y-2">
                <CheckCircle2 className="size-10 text-emerald-500 mx-auto" />
                <p className="text-lg font-black text-emerald-500">Payment Verified Successfully</p>
                <p className="text-xs text-muted-foreground">
                  Your test payment of 10 ETB has been verified and credited.
                </p>
              </div>
              {verifyResult && (
                <div className="space-y-2 text-xs">
                  {txRef && (
                    <div className="flex items-center justify-between p-3 rounded-xl bg-background border border-border/80">
                      <span className="font-semibold text-muted-foreground">Transaction Ref</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-foreground text-[11px] truncate max-w-[180px]">{txRef}</span>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(txRef);
                            toast.success("Copied!");
                          }}
                          className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-muted"
                        >
                          <Copy className="size-3" />
                        </button>
                      </div>
                    </div>
                  )}
                  {verifyResult.chapaRef && (
                    <div className="flex items-center justify-between p-3 rounded-xl bg-background border border-border/80">
                      <span className="font-semibold text-muted-foreground">Chapa Reference</span>
                      <span className="font-mono font-bold text-foreground">{verifyResult.chapaRef}</span>
                    </div>
                  )}
                </div>
              )}
              <Button
                onClick={handleReset}
                variant="outline"
                className="w-full h-11 font-bold text-xs rounded-xl gap-2"
              >
                <RefreshCw className="size-4" />
                Make Another Test Payment
              </Button>
            </div>
          )}

          {state === "pending" && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5 text-center space-y-2">
                <Clock className="size-10 text-amber-500 mx-auto" />
                <p className="text-lg font-black text-amber-500">Payment Still Processing</p>
                <p className="text-xs text-muted-foreground">
                  Your payment is still being processed by Chapa. It may take a moment.
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => txRef && verifyPayment(txRef)}
                  className="flex-1 h-11 font-bold text-xs bg-amber-600 hover:bg-amber-700 text-white rounded-xl gap-2"
                >
                  <RefreshCw className="size-4" />
                  Check Again
                </Button>
                <Button
                  onClick={handleReset}
                  variant="outline"
                  className="flex-1 h-11 font-bold text-xs rounded-xl"
                >
                  Start Over
                </Button>
              </div>
            </div>
          )}

          {state === "failed" && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-5 text-center space-y-2">
                <XCircle className="size-10 text-destructive mx-auto" />
                <p className="text-lg font-black text-destructive">Payment Not Completed</p>
                <p className="text-xs text-muted-foreground">
                  {error || "The payment was not completed. No charges were made."}
                </p>
              </div>
              <Button
                onClick={handleReset}
                className="w-full h-11 font-bold text-xs bg-purple-600 hover:bg-purple-700 text-white rounded-xl gap-2"
              >
                <RefreshCw className="size-4" />
                Try Again
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Security Badge */}
      <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 flex items-center gap-3">
        <ShieldCheck className="size-5 text-emerald-500 shrink-0" />
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          Payments are processed securely via Chapa. Your card details are never stored on our servers.
          All transactions are verified server-side before crediting.
        </p>
      </div>
    </div>
  );
}
