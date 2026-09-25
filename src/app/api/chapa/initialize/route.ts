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

  const chapaSecretKey =
    process.env.CHAPA_SECRET_KEY || "CHASECK_TEST-7HfqijyE7K2Vuej6AKjDRpvN7cCt31hT";

  const convexUrl =
    process.env.NEXT_PUBLIC_CONVEX_URL || "https://fast-oyster-971.convex.cloud";

  try {
    const txRef = generateTxRef(clerkUserId);
    const email = user.emailAddresses[0]?.emailAddress || "test@example.com";
    const firstName = user.firstName || "Test";
    const lastName = user.lastName || "User";

    const origin =
      process.env.NEXT_PUBLIC_APP_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://chess-game-beta-mocha.vercel.app");
    const returnUrl = `${origin}/wallet/chapa/return?tx_ref=${encodeURIComponent(txRef)}`;
    const callbackUrl = `${origin}/api/chapa/callback`;

    // 1. Call Chapa API to get hosted checkout URL
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
        { error: "chapa-init-failed", detail: chapaBody.message ?? "Unknown error from Chapa" },
        { status: 502 },
      );
    }

    const checkoutUrl = chapaBody.data?.checkout_url;
    if (!checkoutUrl) {
      console.error("[Chapa] No checkout_url in response:", chapaBody);
      return Response.json({ error: "chapa-no-checkout-url" }, { status: 502 });
    }

    // 2. Record pending payment in Convex
    try {
      const convex = new ConvexHttpClient(convexUrl);
      const token = await getToken({ template: "convex" }).catch(() => null);
      if (token) convex.setAuth(token);

      await convex.mutation(api.chapaPayments.createPendingFromServer, {
        clerkId: clerkUserId,
        txRef,
        amount: TEST_PAYMENT_AMOUNT_ETB,
        currency: "ETB",
        checkoutUrl,
        email,
        firstName,
        lastName,
      });
    } catch (convexErr) {
      console.warn("[Chapa] Warning storing pending payment in Convex:", convexErr);
    }

    return Response.json({ checkoutUrl, txRef });
  } catch (error: any) {
    console.error("[Chapa] Unexpected error:", error);
    return Response.json({ error: "payment-init-error", detail: error?.message }, { status: 500 });
  }
}
