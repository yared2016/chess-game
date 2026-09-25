import { Metadata } from "next";
import { Suspense } from "react";
import { WalletView } from "@/components/wallet/wallet-view";

export const metadata: Metadata = {
  title: "Wallet",
  description: "Manage your ETB balance and transactions.",
};

export default function WalletPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-4xl px-4 py-12 flex flex-col items-center justify-center space-y-3">
          <div className="size-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-muted-foreground">Loading ETB Wallet...</p>
        </div>
      }
    >
      <WalletView />
    </Suspense>
  );
}
