import { Metadata } from "next";
import Link from "next/link";
import { AlertCircle, ArrowLeft, ArrowRight, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Payment Gateway Paused | Abay Chess",
  description: "Direct manual transfer via Telebirr and CBE is active.",
};

export default function ChapaPaymentPage() {
  return (
    <div className="mx-auto max-w-md px-4 py-12 sm:py-20 text-center space-y-6">
      <div className="flex size-14 mx-auto items-center justify-center rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-500 shadow-sm">
        <Wallet className="size-7" />
      </div>

      <div className="space-y-2">
        <h1 className="text-2xl font-black tracking-tight text-foreground">
          Online Gateway Paused
        </h1>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Automated online payment gateway checkout is currently disabled. Please use our direct transfer methods (Telebirr, CBE Bank, CBE Birr) with manual receipt verification from your wallet.
        </p>
      </div>

      <div className="pt-2">
        <Link
          href="/wallet"
          className="inline-flex items-center justify-center gap-2 h-11 px-6 rounded-2xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs transition-colors shadow-sm"
        >
          <ArrowLeft className="size-4" />
          <span>Return to Wallet</span>
        </Link>
      </div>
    </div>
  );
}
