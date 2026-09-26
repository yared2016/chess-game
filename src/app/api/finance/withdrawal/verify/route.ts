// src/app/api/finance/withdrawal/verify/route.ts — Verify transfer status with Chapa
import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../../convex/_generated/api";
import { getPaymentProvider } from "@/lib/payments/provider";
import { formatChapaErrorMessage } from "@/lib/payments/chapa/adapter";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const { userId: clerkUserId, getToken } = await auth();
  if (!clerkUserId) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { internalTransferRef?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid-json" }, { status: 400 });
  }

  const { internalTransferRef } = body;
  if (!internalTransferRef) {
    return Response.json({ error: "internalTransferRef is required" }, { status: 400 });
  }

  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) {
    return Response.json({ error: "server-config-error" }, { status: 500 });
  }

  try {
    const convex = new ConvexHttpClient(convexUrl);
    const token = await getToken({ template: "convex" });
    if (token) convex.setAuth(token);

    const provider = getPaymentProvider("chapa");
    const verifyRes = await provider.verifyTransfer(internalTransferRef);

    if (verifyRes.status === "completed") {
      await convex.mutation(api.financial.withdrawals.completeWithdrawal, {
        internalTransferRef,
        providerTransferId: verifyRes.providerTransferId,
      });

      return Response.json({
        status: "completed",
        internalTransferRef,
        providerTransferId: verifyRes.providerTransferId,
      });
    } else if (verifyRes.status === "failed" || verifyRes.status === "rejected") {
      const errorMsg = formatChapaErrorMessage(verifyRes.error) || "Transfer rejected by provider";
      await convex.mutation(api.financial.withdrawals.failWithdrawalAndReleaseReservation, {
        internalTransferRef,
        failureReason: errorMsg,
      });

      return Response.json({
        status: "failed",
        error: errorMsg,
      });
    }

    return Response.json({
      status: "processing",
      internalTransferRef,
    });
  } catch (err: unknown) {
    console.error("[Withdrawal Verify] Error:", err);
    const message = err instanceof Error ? err.message : "Verification error";
    return Response.json({ error: message }, { status: 500 });
  }
}
