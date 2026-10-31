// src/app/api/finance/deposit/verify-et/route.ts
// Server-side endpoint to verify deposits using Verify.et and auto-credit player wallets

import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../../convex/_generated/api";
import type { Id } from "../../../../../../convex/_generated/dataModel";
import {
  verifyTransactionWithVerifyEt,
  matchSenderName,
} from "@/lib/payments/verify-et/client";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const { userId: clerkUserId, getToken } = await auth();
  if (!clerkUserId) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: {
    depositId?: string;
    paymentMethod?: string;
    transactionReference?: string;
    amount?: number;
    senderName?: string;
  };

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid-json" }, { status: 400 });
  }

  const { depositId, paymentMethod, transactionReference, amount, senderName } = body;

  if (!depositId || !transactionReference?.trim() || !amount || amount <= 0) {
    return Response.json(
      { error: "Missing required fields (depositId, transactionReference, amount)" },
      { status: 400 },
    );
  }

  const cleanRef = transactionReference.trim();
  const channel = paymentMethod || "telebirr";

  const convexUrl =
    process.env.NEXT_PUBLIC_CONVEX_URL || "https://fast-oyster-971.convex.cloud";

  try {
    const convex = new ConvexHttpClient(convexUrl);
    const token = await getToken({ template: "convex" }).catch(() => null);
    if (token) convex.setAuth(token);

    // Call Verify.et API
    const verifyResult = await verifyTransactionWithVerifyEt({
      bank: channel,
      reference: cleanRef,
      amount,
      idempotencyKey: `verify_et_${depositId}_${cleanRef}`,
    });

    if (verifyResult.verified && verifyResult.status === "completed") {
      // Validate exact amount
      if (
        verifyResult.amount !== undefined &&
        Math.round(verifyResult.amount * 100) !== Math.round(amount * 100)
      ) {
        return Response.json(
          {
            success: false,
            verified: false,
            status: "failed",
            error: `Amount mismatch: Verify.et confirmed ${verifyResult.amount} ETB, but deposit request was for ${amount} ETB.`,
          },
          { status: 400 },
        );
      }

      // Validate sender name if exposed by bank
      if (senderName && verifyResult.senderName) {
        const isNameMatch = matchSenderName(senderName, verifyResult.senderName);
        if (!isNameMatch) {
          return Response.json(
            {
              success: false,
              verified: false,
              status: "failed",
              error: `Sender name mismatch: payment record indicates "${verifyResult.senderName}", but expected "${senderName}".`,
            },
            { status: 400 },
          );
        }
      }

      // Atomically credit wallet via Convex mutation
      const creditRes = await convex.mutation(api.deposits.autoCreditVerifyEt, {
        depositId: depositId as Id<"deposits">,
        transactionReference: cleanRef,
        verifiedAmount: verifyResult.amount ?? amount,
        provider: channel,
        senderName: verifyResult.senderName || senderName,
        rawVerifyData: JSON.stringify(verifyResult.raw || verifyResult),
        webhookSecret: process.env.EVE_SERVER_SECRET,
        clerkUserId: clerkUserId,
      });

      return Response.json({
        success: true,
        verified: true,
        status: "completed",
        depositId,
        amount: creditRes.amount ?? amount,
        alreadyCredited: creditRes.alreadyCredited ?? false,
      });
    }

    if (verifyResult.status === "processing" || verifyResult.status === "pending") {
      return Response.json({
        success: true,
        verified: false,
        status: "pending",
        message:
          verifyResult.message ||
          "Payment verification is in progress. The bank network is processing your transaction.",
      });
    }

    return Response.json({
      success: false,
      verified: false,
      status: "failed",
      error:
        verifyResult.message ||
        "Could not verify transaction with Verify.et. Please check your reference number.",
    });
  } catch (err: unknown) {
    console.error("[Verify.et Deposit API] Error:", err);
    const errorMessage = err instanceof Error ? err.message : "Verification service error";
    return Response.json({ error: errorMessage }, { status: 500 });
  }
}
