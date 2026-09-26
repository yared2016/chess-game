// src/app/api/finance/webhook/chapa/route.ts — Webhook handler for Chapa payment and transfer events
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../../convex/_generated/api";
import { getPaymentProvider } from "@/lib/payments/provider";
import { toSantims } from "@/lib/payments/money";
import { formatChapaErrorMessage } from "@/lib/payments/chapa/adapter";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > 512 * 1024) { // 512KB limit
    return new Response("Payload too large", { status: 413 });
  }

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

  const convex = new ConvexHttpClient(convexUrl);

  try {
    // 3. Handle Withdrawal Transfer Webhooks (prefixed with WDR_)
    if (event.txRef.startsWith("WDR_")) {
      const transferVerify = await provider.verifyTransfer(event.txRef);
      if (transferVerify.status === "completed") {
        await convex.mutation(api.financial.withdrawals.completeWithdrawal, {
          internalTransferRef: event.txRef,
          providerTransferId: transferVerify.providerTransferId,
          webhookSecret: process.env.CHAPA_WEBHOOK_SECRET,
        });
        console.log(`[Chapa Webhook] Successfully finalized withdrawal: ${event.txRef}`);
      } else if (transferVerify.status === "failed" || transferVerify.status === "rejected") {
        const errorMsg = formatChapaErrorMessage(transferVerify.error) || "Transfer rejected";
        await convex.mutation(api.financial.withdrawals.failWithdrawalAndReleaseReservation, {
          internalTransferRef: event.txRef,
          failureReason: errorMsg,
          webhookSecret: process.env.CHAPA_WEBHOOK_SECRET,
        });
        console.log(`[Chapa Webhook] Reconciled failed withdrawal: ${event.txRef}`);
      }
      return new Response("OK", { status: 200 });
    }

    // 4. Handle Deposit Payment Webhooks
    const verified = await provider.verifyPayment(event.txRef);

    if (verified.status === "success" && verified.amountEtb) {
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
    // Return 200 so Chapa does not hammer retries on transient errors
    return new Response("OK", { status: 200 });
  }
}
