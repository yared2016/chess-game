// src/app/api/chapa/callback/route.ts
//
// Chapa sends a GET request to this callback URL with query params:
// ?trx_ref=xxx&ref_id=xxx&status=xxx
// This triggers server-side verification.
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../convex/_generated/api";

export const dynamic = "force-dynamic";

const CHAPA_VERIFY_URL = "https://api.chapa.co/v1/transaction/verify";

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const txRef = url.searchParams.get("trx_ref") ?? url.searchParams.get("tx_ref");

  if (!txRef) {
    return Response.json({ error: "missing-tx-ref" }, { status: 400 });
  }

  const chapaSecretKey =
    process.env.CHAPA_SECRET_KEY || "CHASECK_TEST-7HfqijyE7K2Vuej6AKjDRpvN7cCt31hT";

  const convexUrl =
    process.env.NEXT_PUBLIC_CONVEX_URL || "https://fast-oyster-971.convex.cloud";

  try {
    // Verify with Chapa API
    const chapaRes = await fetch(`${CHAPA_VERIFY_URL}/${encodeURIComponent(txRef)}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${chapaSecretKey}` },
    });

    const chapaBody = await chapaRes.json();
    const chapaStatus = chapaBody.data?.status;
    const chapaAmount = parseFloat(chapaBody.data?.amount);
    const chapaCurrency = chapaBody.data?.currency;
    const chapaRef = chapaBody.data?.reference;

    // Use unauthenticated Convex client — callback has no user session.
    // We must use a mutation that does NOT require auth (an admin/system mutation).
    // For this, we use the server-side finalize mutation.
    // Since ConvexHttpClient can't call internalMutation, we need a system mutation.
    // We'll use `finalizeFromCallback` which is a mutation without auth requirement
    // but requires a webhook secret as a parameter for validation.
    const convex = new ConvexHttpClient(convexUrl);

    const webhookSecret = process.env.CHAPA_WEBHOOK_SECRET;

    await convex.mutation(api.chapaPayments.finalizeFromCallback, {
      txRef,
      status: chapaStatus === "success" ? "success" : chapaStatus === "failed" ? "failed" : "pending",
      chapaRef: chapaRef ?? undefined,
      verifiedAmount: isNaN(chapaAmount) ? undefined : chapaAmount,
      verifiedCurrency: chapaCurrency ?? undefined,
      webhookSecret: webhookSecret ?? "",
    });

    return Response.json({ received: true });
  } catch (error) {
    console.error("[Chapa Callback] Error:", error);
    return Response.json({ error: "callback-processing-error" }, { status: 500 });
  }
}
