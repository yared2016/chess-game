// src/app/api/finance/deposit/verify/route.ts — Server-side deposit verification
import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../../convex/_generated/api";
import { getPaymentProvider } from "@/lib/payments/provider";
import { toSantims } from "@/lib/payments/money";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const { userId: clerkUserId, getToken } = await auth();
  if (!clerkUserId) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { internalTxRef?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid-json" }, { status: 400 });
  }

  const internalTxRef = body.internalTxRef;
  if (!internalTxRef) {
    return Response.json({ error: "Missing internalTxRef" }, { status: 400 });
  }

  const convexUrl =
    process.env.NEXT_PUBLIC_CONVEX_URL || "https://fast-oyster-971.convex.cloud";

  try {
    const convex = new ConvexHttpClient(convexUrl);
    const token = await getToken({ template: "convex" }).catch(() => null);
    if (token) convex.setAuth(token);

    // 1. Fetch internal record
    const deposit = await convex.query(api.financial.deposits.getByRef, {
      internalTxRef,
      clerkId: clerkUserId,
    });
    if (!deposit) {
      return Response.json({ error: "Deposit record not found" }, { status: 404 });
    }

    if (deposit.status === "credited") {
      return Response.json({
        status: "success",
        alreadyCredited: true,
        creditEtb: deposit.requestedCreditSantims / 100,
      });
    }

    // 2. Query Payment Provider directly
    const provider = getPaymentProvider(deposit.provider);
    const verifyResult = await provider.verifyPayment(internalTxRef);

    if (verifyResult.status === "success" && verifyResult.amountEtb) {
      const verifiedSantims = toSantims(verifyResult.amountEtb);

      // 3. Atomically credit wallet in Convex
      await convex.mutation(api.financial.deposits.creditVerifiedDeposit, {
        internalTxRef,
        providerTxId: verifyResult.providerTxId,
        verifiedAmountSantims: verifiedSantims,
        verifiedCurrency: verifyResult.currency || "ETB",
      });

      return Response.json({
        status: "success",
        creditEtb: deposit.requestedCreditSantims / 100,
        providerTxId: verifyResult.providerTxId,
      });
    } else if (verifyResult.status === "failed") {
      return Response.json({
        status: "failed",
        error: "Payment was not completed by the provider.",
      });
    } else {
      return Response.json({
        status: "pending",
        message: "Payment is still being processed by the provider.",
      });
    }
  } catch (err: any) {
    console.error("[Deposit Verify] Error:", err);
    return Response.json({ error: err.message || "Verification error" }, { status: 500 });
  }
}
