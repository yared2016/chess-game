// src/app/api/finance/deposit/initialize/route.ts — Server-side deposit initialization
import { auth, currentUser } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../../convex/_generated/api";
import { getPaymentProvider } from "@/lib/payments/provider";
import { toSantims, toEtb } from "@/lib/payments/money";
import crypto from "crypto";

export const dynamic = "force-dynamic";

function generateTxRef(clerkUserId: string): string {
  const timestamp = Date.now().toString(36);
  const random = crypto.randomBytes(5).toString("hex");
  return `DEP_${clerkUserId.replace(/[^a-zA-Z0-9]/g, "").slice(-8)}_${timestamp}_${random}`;
}

export async function POST(request: Request): Promise<Response> {
  const { userId: clerkUserId, getToken } = await auth();
  if (!clerkUserId) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const user = await currentUser();
  if (!user) {
    return Response.json({ error: "user-not-found" }, { status: 401 });
  }

  let body: { amountEtb?: number };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid-json" }, { status: 400 });
  }

  const requestedAmountEtb = body.amountEtb;
  if (!requestedAmountEtb || typeof requestedAmountEtb !== "number" || requestedAmountEtb < 10) {
    return Response.json({ error: "Minimum deposit is 10 ETB" }, { status: 400 });
  }
  if (requestedAmountEtb > 100000) {
    return Response.json({ error: "Maximum deposit is 100,000 ETB" }, { status: 400 });
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
    const requestedSantims = toSantims(requestedAmountEtb);
    const feeCalc = provider.calculateDepositFee(requestedSantims);

    const internalTxRef = generateTxRef(clerkUserId);
    const email = user.emailAddresses[0]?.emailAddress || "test@example.com";
    const firstName = user.firstName || "Player";
    const lastName = user.lastName || "Chess";

    const origin =
      process.env.NEXT_PUBLIC_APP_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
    const returnUrl = `${origin}/wallet?verifyRef=${encodeURIComponent(internalTxRef)}`;
    const callbackUrl = `${origin}/api/finance/webhook/chapa`;

    // 1. Initialize with Payment Provider
    const providerRes = await provider.initializePayment({
      internalTxRef,
      amountEtb: toEtb(feeCalc.grossPaymentSantims),
      currency: "ETB",
      email,
      firstName,
      lastName,
      returnUrl,
      callbackUrl,
      title: "Castle Chess Deposit",
      description: `Add ${requestedAmountEtb} ETB to Chess Wallet (Fee: ${toEtb(feeCalc.providerFeeSantims)} ETB)`,
    });

    if (!providerRes.success || !providerRes.checkoutUrl) {
      return Response.json(
        { error: providerRes.error || "Payment provider initialization failed" },
        { status: 502 }
      );
    }

    // 2. Record pending deposit in Convex
    await convex.mutation(api.financial.deposits.createPendingDeposit, {
      internalTxRef,
      requestedCreditSantims: feeCalc.walletCreditSantims,
      providerFeeSantims: feeCalc.providerFeeSantims,
      grossAmountSantims: feeCalc.grossPaymentSantims,
      provider: provider.id,
      feeMode: feeCalc.feeMode,
      checkoutUrl: providerRes.checkoutUrl,
      email,
      firstName,
      lastName,
    });

    return Response.json({
      checkoutUrl: providerRes.checkoutUrl,
      internalTxRef,
      requestedCreditEtb: toEtb(feeCalc.walletCreditSantims),
      providerFeeEtb: toEtb(feeCalc.providerFeeSantims),
      grossPaymentEtb: toEtb(feeCalc.grossPaymentSantims),
    });
  } catch (err: any) {
    console.error("[Deposit Initialize] Error:", err);
    return Response.json({ error: err.message || "Initialization error" }, { status: 500 });
  }
}
