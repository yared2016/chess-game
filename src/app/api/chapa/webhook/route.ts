// src/app/api/chapa/webhook/route.ts
//
// Handles Chapa webhook POST events. Validates the x-chapa-signature header
// using HMAC SHA256 of the raw body with the secret key.
import crypto from "crypto";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../convex/_generated/api";

export const dynamic = "force-dynamic";

const CHAPA_VERIFY_URL = "https://api.chapa.co/v1/transaction/verify";

export async function POST(request: Request): Promise<Response> {
  const chapaSecretKey = process.env.CHAPA_SECRET_KEY;
  const webhookSecret = process.env.CHAPA_WEBHOOK_SECRET;

  if (!chapaSecretKey) {
    console.error("[Chapa Webhook] CHAPA_SECRET_KEY not configured");
    return new Response("Config error", { status: 503 });
  }

  // 1. Read raw body for signature verification
  const rawBody = await request.text();

  // 2. Verify webhook signature
  const signature = request.headers.get("x-chapa-signature");
  if (signature && webhookSecret) {
    const expectedSig = crypto
      .createHmac("sha256", webhookSecret)
      .update(rawBody)
      .digest("hex");

    if (signature !== expectedSig) {
      console.error("[Chapa Webhook] Signature mismatch");
      return new Response("Invalid signature", { status: 401 });
    }
  } else if (!signature) {
    // If no signature header, also check chapa-signature (HMAC of secret with secret)
    const altSignature = request.headers.get("chapa-signature");
    if (altSignature && webhookSecret) {
      const expectedAlt = crypto
        .createHmac("sha256", webhookSecret)
        .update(webhookSecret)
        .digest("hex");
      if (altSignature !== expectedAlt) {
        console.error("[Chapa Webhook] Alt signature mismatch");
        return new Response("Invalid signature", { status: 401 });
      }
    }
  }

  // 3. Parse the webhook payload
  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const event = payload.event || payload.type;
  const txRef = payload.tx_ref || payload.trx_ref;

  if (!txRef) {
    console.error("[Chapa Webhook] No tx_ref in payload:", payload);
    return new Response("Missing tx_ref", { status: 400 });
  }

  console.log(`[Chapa Webhook] Event: ${event}, tx_ref: ${txRef}`);

  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) {
    return new Response("Config error", { status: 500 });
  }

  try {
    // 4. Always verify with Chapa API (don't trust webhook payload alone)
    const chapaRes = await fetch(`${CHAPA_VERIFY_URL}/${encodeURIComponent(txRef)}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${chapaSecretKey}` },
    });

    const chapaBody = await chapaRes.json();
    const chapaStatus = chapaBody.data?.status;
    const chapaAmount = parseFloat(chapaBody.data?.amount);
    const chapaCurrency = chapaBody.data?.currency;
    const chapaRef = chapaBody.data?.reference;

    let finalStatus: "success" | "failed" | "pending" = "pending";
    if (chapaStatus === "success") finalStatus = "success";
    else if (chapaStatus === "failed" || chapaStatus === "cancelled") finalStatus = "failed";

    if (finalStatus !== "pending") {
      const convex = new ConvexHttpClient(convexUrl);
      await convex.mutation(api.chapaPayments.finalizeFromCallback, {
        txRef,
        status: finalStatus,
        chapaRef: chapaRef ?? undefined,
        verifiedAmount: isNaN(chapaAmount) ? undefined : chapaAmount,
        verifiedCurrency: chapaCurrency ?? undefined,
        webhookSecret: webhookSecret ?? "",
      });
    }

    // Chapa expects 200 OK
    return new Response("OK", { status: 200 });
  } catch (error) {
    console.error("[Chapa Webhook] Processing error:", error);
    // Return 200 anyway to prevent Chapa retries for our internal errors.
    // The payment will be verified on the return URL check.
    return new Response("OK", { status: 200 });
  }
}
