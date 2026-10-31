// src/app/api/finance/webhook/verify-et/route.ts
// Asynchronous Webhook listener for Verify.et payment confirmations

import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../../convex/_generated/api";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > 512 * 1024) {
    return new Response("Payload too large", { status: 413 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  // Extract event payload from Verify.et format
  const data = (body.data as Record<string, unknown>) || body;

  const reference =
    (data.reference as string) ||
    (data.referenceNumber as string) ||
    (data.transactionNumber as string) ||
    (data.receiptNumber as string);
  const status = String(data.status || data.processingStatus || "").toLowerCase();
  const rawAmount = data.amount;
  const verifiedAmount =
    typeof rawAmount === "number" ? rawAmount : parseFloat(String(rawAmount || "0"));
  const provider = String(data.bank || data.provider || "telebirr").toLowerCase();
  const senderName = (data.senderName as string) || (data.sender as string) || (data.payerName as string);

  if (!reference) {
    return new Response("Missing reference", { status: 400 });
  }

  // If status is not verified or completed, return 200 acknowledging reception
  if (status !== "completed" && status !== "verified" && status !== "success") {
    return Response.json({ received: true, status });
  }

  const convexUrl =
    process.env.NEXT_PUBLIC_CONVEX_URL || "https://fast-oyster-971.convex.cloud";
  const convex = new ConvexHttpClient(convexUrl);

  const webhookSecret =
    process.env.VERIFY_ET_WEBHOOK_SECRET || process.env.EVE_SERVER_SECRET || "";

  try {
    const result = await convex.mutation(api.deposits.creditVerifyEtWebhook, {
      transactionReference: reference,
      verifiedAmount,
      provider,
      senderName,
      rawVerifyData: JSON.stringify(body),
      webhookSecret,
    });

    return Response.json({ success: true, result });
  } catch (err: unknown) {
    console.error("[Verify.et Webhook] Error:", err);
    return Response.json({ error: "Webhook processing error" }, { status: 500 });
  }
}
