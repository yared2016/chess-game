import { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Wallet } from "lucide-react";

export const metadata: Metadata = {
  title: "Payment Result | Abay Chess",
  description: "Direct manual transfer via Telebirr and CBE is active.",
};

export default function ChapaReturnPage() {
  return (
    <div className="mx-auto max-w-md px-4 py-12 sm:py-20 text-center space-y-6">
      <div className="flex size-14 mx-auto items-center justify-center rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-500 shadow-sm">
        <Wallet className="size-7" />
      </div>

      <div className="space-y-2">
        <h1 className="text-2xl font-black tracking-tight text-foreground">
          Deposit Verification
        </h1>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Online payment checkout has transitioned to manual verification. You can track all your deposit requests directly in your Wallet history.
        </p>
      </div>

      <div className="pt-2">
        <Link
          href="/wallet?tab=history"
          className="inline-flex items-center justify-center gap-2 h-11 px-6 rounded-2xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs transition-colors shadow-sm"
        >
          <ArrowLeft className="size-4" />
          <span>View Wallet History</span>
        </Link>
      </div>
    </div>
  );
}
