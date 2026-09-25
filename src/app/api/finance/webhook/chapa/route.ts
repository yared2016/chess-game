// src/app/api/finance/webhook/chapa/route.ts — Webhook handler for Chapa payment events
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../../convex/_generated/api";
import { getPaymentProvider } from "@/lib/payments/provider";
import { toSantims } from "@/lib/payments/money";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const rawBody = await request.text();
  const provider = getPaymentProvider("chapa");

  // 1. Signature verification
  const isValidSignature = provider.verifyWebhookSignature(rawBody, request.headers);
  if (!isValidSignature && process.env.NODE_ENV === "production") {
    console.error("[Chapa Webhook] Invalid HMAC signature");
    return new Response("Invalid signature", { status: 401 });
  }

  // 2. Parse event
  const event = provider.parseWebhookEvent(rawBody);
  if (!event || !event.txRef) {
    console.warn("[Chapa Webhook] No txRef found in body:", rawBody);
    return new Response("Missing txRef", { status: 400 });
  }

  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) {
    return new Response("Server config error", { status: 500 });
  }

  try {
    // 3. Always verify directly with Chapa API (never rely on webhook body alone)
    const verified = await provider.verifyPayment(event.txRef);

    if (verified.status === "success" && verified.amountEtb) {
      const convex = new ConvexHttpClient(convexUrl);
      const verifiedSantims = toSantims(verified.amountEtb);

      await convex.mutation(api.financial.deposits.creditVerifiedDeposit, {
        internalTxRef: event.txRef,
        providerTxId: verified.providerTxId,
        verifiedAmountSantims: verifiedSantims,
        verifiedCurrency: verified.currency || "ETB",
        webhookSecret: process.env.CHAPA_WEBHOOK_SECRET,
      });

      console.log(`[Chapa Webhook] Successfully credited deposit: ${event.txRef}`);
    }

    // Always respond 200 OK to acknowledge receipt
    return new Response("OK", { status: 200 });
  } catch (err) {
    console.error("[Chapa Webhook] Error processing event:", err);
    // Return 200 so Chapa does not hammer retries on internal errors; user will verify on return
    return new Response("OK", { status: 200 });
  }
}
