// src/app/api/chapa/verify/route.ts
import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../convex/_generated/api";

export const dynamic = "force-dynamic";

const CHAPA_VERIFY_URL = "https://api.chapa.co/v1/transaction/verify";

export async function POST(request: Request): Promise<Response> {
  const { userId: clerkUserId, getToken } = await auth();
  if (!clerkUserId) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const chapaSecretKey =
    process.env.CHAPA_SECRET_KEY || "CHASECK_TEST-7HfqijyE7K2Vuej6AKjDRpvN7cCt31hT";

  const convexUrl =
    process.env.NEXT_PUBLIC_CONVEX_URL || "https://fast-oyster-971.convex.cloud";

  let body: { txRef?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid-body" }, { status: 400 });
  }

  const txRef = body.txRef;
  if (!txRef || typeof txRef !== "string" || txRef.length > 200) {
    return Response.json({ error: "invalid-tx-ref" }, { status: 400 });
  }

  try {
    const convex = new ConvexHttpClient(convexUrl);
    const token = await getToken({ template: "convex" }).catch(() => null);
    if (token) convex.setAuth(token);

    // Get the stored payment (supporting clerkId fallback)
    const payment = await convex.query(api.chapaPayments.getMyPaymentByTxRef, {
      txRef,
      clerkId: clerkUserId,
    });

    // If already finalized, return current status
    if (payment && (payment.status === "success" || payment.status === "failed")) {
      return Response.json({
        status: payment.status,
        txRef: payment.txRef,
        amount: payment.amount,
        currency: payment.currency,
        verifiedAt: payment.verifiedAt,
      });
    }

    // Verify with Chapa API
    const chapaRes = await fetch(`${CHAPA_VERIFY_URL}/${encodeURIComponent(txRef)}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${chapaSecretKey}` },
    });

    const chapaBody = await chapaRes.json();

    if (!chapaRes.ok) {
      console.error("[Chapa Verify] API error:", chapaBody);
      return Response.json({
        status: "pending",
        txRef,
        detail: "Verification pending",
      });
    }

    const chapaStatus = chapaBody.data?.status;
    const chapaAmount = parseFloat(chapaBody.data?.amount);
    const chapaCurrency = chapaBody.data?.currency;
    const chapaRef = chapaBody.data?.reference;

    let finalStatus: "success" | "failed" | "pending" = "pending";

    if (chapaStatus === "success") {
      // Verify amount & currency match if payment record exists
      if (payment && !isNaN(chapaAmount) && chapaAmount !== payment.amount) {
        console.error(`[Chapa Verify] Amount mismatch: expected ${payment.amount}, got ${chapaAmount}`);
        finalStatus = "failed";
      } else if (payment && chapaCurrency && chapaCurrency !== payment.currency) {
        console.error(`[Chapa Verify] Currency mismatch: expected ${payment.currency}, got ${chapaCurrency}`);
        finalStatus = "failed";
      } else {
        finalStatus = "success";
      }
    } else if (chapaStatus === "failed" || chapaStatus === "cancelled") {
      finalStatus = "failed";
    }

    if (finalStatus !== "pending") {
      await convex.mutation(api.chapaPayments.finalizeFromServer, {
        clerkId: clerkUserId,
        txRef,
        status: finalStatus,
        chapaRef: chapaRef ?? undefined,
        verifiedAmount: isNaN(chapaAmount) ? undefined : chapaAmount,
        verifiedCurrency: chapaCurrency ?? undefined,
      });
    }

    return Response.json({
      status: finalStatus,
      txRef,
      amount: payment?.amount ?? chapaAmount,
      currency: payment?.currency ?? chapaCurrency ?? "ETB",
      chapaRef,
    });
  } catch (error) {
    console.error("[Chapa Verify] Error:", error);
    return Response.json({ error: "verification-error" }, { status: 500 });
  }
}
