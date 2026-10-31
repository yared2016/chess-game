// src/app/api/finance/deposit/verify-et/route.ts
// Server-side endpoint to verify deposits using Verify.et and auto-credit player wallets

import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../../convex/_generated/api";
import type { Id } from "../../../../../../convex/_generated/dataModel";
import {
  verifyTransactionWithVerifyEt,
  matchSenderName,
  matchPhoneNumber,
  matchReceiver,
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
    senderPhone?: string;
  };

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid-json" }, { status: 400 });
  }

  const { depositId, paymentMethod, transactionReference, amount, senderName, senderPhone } = body;

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
      phone: senderPhone?.trim(),
      idempotencyKey: `verify_et_${depositId}_${cleanRef}`,
    });

    if (verifyResult.verified && verifyResult.status === "completed") {
      // 1. Strictly validate receiver is the official Abay Chess account (0987678228 / Yared Tekleye)
      const receiverCheck = matchReceiver(
        channel,
        verifyResult.receiverName,
        verifyResult.receiverAccount,
      );
      if (!receiverCheck.isMatch) {
        return Response.json(
          {
            success: false,
            verified: false,
            status: "failed",
            error:
              "Verification failed: This transfer was not sent to the official Abay Chess account (0987678228 / Yared Tekleye).",
          },
          { status: 400 },
        );
      }

      // 2. Strictly validate exact net amount returned from bank (without leaking actual amount or fee)
      const verifiedNet = verifyResult.settledAmount ?? verifyResult.amount;
      if (
        !verifiedNet ||
        Math.round(verifiedNet * 100) !== Math.round(amount * 100)
      ) {
        return Response.json(
          {
            success: false,
            verified: false,
            status: "failed",
            error:
              "Deposit amount mismatch. Please enter the exact deposit amount without any provider transfer fees (e.g. 1000 ETB, not 1005 ETB).",
          },
          { status: 400 },
        );
      }

      // 2. Validate sender name if exposed by bank (without leaking bank sender name)
      if (verifyResult.senderName) {
        if (!senderName || !senderName.trim()) {
          return Response.json(
            {
              success: false,
              verified: false,
              status: "failed",
              error: "Sender full name is required to verify this payment.",
            },
            { status: 400 },
          );
        }
        const isNameMatch = matchSenderName(senderName, verifyResult.senderName);
        if (!isNameMatch) {
          return Response.json(
            {
              success: false,
              verified: false,
              status: "failed",
              error: "Sender name mismatch. The name entered does not match the account holder on this bank transfer.",
            },
            { status: 400 },
          );
        }
      }

      // 3. Validate phone number / sender account if exposed by bank (without leaking phone number)
      if (verifyResult.senderPhone) {
        if (!senderPhone || !senderPhone.trim()) {
          return Response.json(
            {
              success: false,
              verified: false,
              status: "failed",
              error: "Sender phone number or account is required to verify this payment.",
            },
            { status: 400 },
          );
        }
        const isPhoneMatch = matchPhoneNumber(senderPhone, verifyResult.senderPhone);
        if (!isPhoneMatch) {
          return Response.json(
            {
              success: false,
              verified: false,
              status: "failed",
              error: "Sender phone number mismatch. The phone/account entered does not match the transfer record.",
            },
            { status: 400 },
          );
        }
      }

      // Atomically credit wallet via Convex mutation
      const creditRes = await convex.mutation(api.deposits.autoCreditVerifyEt, {
        depositId: depositId as Id<"deposits">,
        transactionReference: cleanRef,
        verifiedAmount: verifiedNet ?? verifyResult.amount ?? amount,
        provider: channel,
        senderName: verifyResult.senderName || senderName,
        senderPhone: verifyResult.senderPhone || senderPhone?.trim(),
        rawVerifyData: JSON.stringify(verifyResult.raw || verifyResult),
        webhookSecret: process.env.EVE_SERVER_SECRET,
        clerkUserId: clerkUserId,
      });

      if (creditRes.alreadyCredited) {
        return Response.json(
          {
            success: false,
            verified: false,
            status: "failed",
            error: "This transaction reference has already been credited to a wallet. Each transfer can only be credited once.",
          },
          { status: 400 },
        );
      }

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

    return Response.json(
      {
        success: false,
        verified: false,
        status: verifyResult.status || "failed",
        error:
          verifyResult.message ||
          "Could not verify transaction with Verify.et. Please check your reference number.",
      },
      { status: 400 },
    );
  } catch (err: unknown) {
    console.error("[Verify.et Deposit API] Error:", err);
    const errorMessage = err instanceof Error ? err.message : "Verification service error";
    return Response.json({ error: errorMessage }, { status: 500 });
  }
}
