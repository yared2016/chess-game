import { Metadata } from "next";
import { ChapaTestPayment } from "@/components/wallet/chapa-test-payment";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: "Chapa Test Payment",
  description: "Test the Chapa payment integration.",
};

export default function ChapaPaymentPage() {
  return (
    <Suspense fallback={
      <div className="flex flex-col items-center justify-center min-h-[380px] p-8 text-center space-y-3">
        <div className="size-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Loading payment...
        </p>
      </div>
    }>
      <ChapaTestPayment />
    </Suspense>
  );
}
