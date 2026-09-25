// src/app/api/chapa/initialize/route.ts
import { auth, currentUser } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../convex/_generated/api";
import crypto from "crypto";

export const dynamic = "force-dynamic";

const TEST_PAYMENT_AMOUNT_ETB = 10;
const CHAPA_INIT_URL = "https://api.chapa.co/v1/transaction/initialize";

function generateTxRef(clerkUserId: string): string {
  const timestamp = Date.now().toString(36);
  const random = crypto.randomBytes(6).toString("hex");
  return `chapa_${clerkUserId}_${timestamp}_${random}`;
}

export async function POST(): Promise<Response> {
  const { userId: clerkUserId, getToken } = await auth();
  if (!clerkUserId) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const user = await currentUser();
  if (!user) {
    return Response.json({ error: "user-not-found" }, { status: 401 });
  }

  const chapaSecretKey = process.env.CHAPA_SECRET_KEY;
  if (!chapaSecretKey) {
    console.error("[Chapa] CHAPA_SECRET_KEY not configured");
    return Response.json({ error: "payment-service-unavailable" }, { status: 503 });
  }

  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) {
    console.error("[Chapa] NEXT_PUBLIC_CONVEX_URL not configured");
    return Response.json({ error: "server-config-error" }, { status: 500 });
  }

  try {
    const convex = new ConvexHttpClient(convexUrl);
    const token = await getToken({ template: "convex" });
    if (token) convex.setAuth(token);

    // Verify player exists in Convex
    const player = await convex.query(api.players.me, {});
    if (!player) {
      return Response.json({ error: "player-not-provisioned" }, { status: 403 });
    }

    const txRef = generateTxRef(clerkUserId);
    const email = user.emailAddresses[0]?.emailAddress || "test@example.com";
    const firstName = user.firstName || "Test";
    const lastName = user.lastName || "User";

    const origin =
      process.env.NEXT_PUBLIC_APP_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
    const returnUrl = `${origin}/wallet/chapa/return?tx_ref=${encodeURIComponent(txRef)}`;
    const callbackUrl = `${origin}/api/chapa/callback`;

    // Call Chapa API
    const chapaRes = await fetch(CHAPA_INIT_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${chapaSecretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: String(TEST_PAYMENT_AMOUNT_ETB),
        currency: "ETB",
        email,
        first_name: firstName,
        last_name: lastName,
        tx_ref: txRef,
        return_url: returnUrl,
        callback_url: callbackUrl,
        "customization[title]": "Castle Chess",
        "customization[description]": "Test Payment — 10 ETB",
      }),
    });

    const chapaBody = await chapaRes.json();

    if (!chapaRes.ok || chapaBody.status !== "success") {
      console.error("[Chapa] Init failed:", chapaBody.message ?? chapaBody);
      return Response.json(
        { error: "chapa-init-failed", detail: chapaBody.message ?? "Unknown error" },
        { status: 502 },
      );
    }

    const checkoutUrl = chapaBody.data?.checkout_url;
    if (!checkoutUrl) {
      console.error("[Chapa] No checkout_url in response");
      return Response.json({ error: "chapa-no-checkout-url" }, { status: 502 });
    }

    // Create pending payment in Convex (auth-gated mutation)
    await convex.mutation(api.chapaPayments.createPendingFromServer, {
      txRef,
      amount: TEST_PAYMENT_AMOUNT_ETB,
      currency: "ETB",
      checkoutUrl,
      email,
      firstName,
      lastName,
    });

    return Response.json({ checkoutUrl, txRef });
  } catch (error) {
    console.error("[Chapa] Unexpected error:", error);
    return Response.json({ error: "payment-init-error" }, { status: 500 });
  }
}
