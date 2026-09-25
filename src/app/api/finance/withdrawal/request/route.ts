// src/app/api/finance/withdrawal/request/route.ts — Server-side withdrawal processing
import { auth, currentUser } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../../convex/_generated/api";
import { getPaymentProvider } from "@/lib/payments/provider";
import { toSantims, toEtb } from "@/lib/payments/money";
import crypto from "crypto";

export const dynamic = "force-dynamic";

function generateTransferRef(clerkUserId: string): string {
  const timestamp = Date.now().toString(36);
  const random = crypto.randomBytes(5).toString("hex");
  return `WDR_${clerkUserId.replace(/[^a-zA-Z0-9]/g, "").slice(-8)}_${timestamp}_${random}`;
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

  let body: {
    amountEtb?: number;
    bankName?: string;
    bankCode?: string;
    accountNumber?: string;
    accountHolderName?: string;
  };

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid-json" }, { status: 400 });
  }

  const { amountEtb, bankName, bankCode, accountNumber, accountHolderName } = body;

  if (!amountEtb || typeof amountEtb !== "number" || amountEtb < 50) {
    return Response.json({ error: "Minimum withdrawal is 50 ETB" }, { status: 400 });
  }
  if (!bankCode || !accountNumber || !accountHolderName) {
    return Response.json({ error: "Bank and account details are required" }, { status: 400 });
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
    const requestedSantims = toSantims(amountEtb);
    const feeCalc = provider.calculateWithdrawalFee(requestedSantims);

    const internalTransferRef = generateTransferRef(clerkUserId);
    const maskedAccount =
      accountNumber.length > 4
        ? `****${accountNumber.slice(-4)}`
        : accountNumber;

    // 1. Atomically reserve funds in Convex (moves from available to locked balance)
    await convex.mutation(api.financial.withdrawals.reserveWithdrawal, {
      internalTransferRef,
      requestedAmountSantims: feeCalc.userReceivesSantims,
      providerFeeSantims: feeCalc.providerFeeSantims,
      totalReservedSantims: feeCalc.totalDeductionSantims,
      provider: provider.id,
      bankName: bankName || "Bank Transfer",
      bankCode,
      accountNumberMasked: maskedAccount,
      accountHolderName,
    });

    // 2. Dispatch transfer to Chapa Transfer API
    const transferRes = await provider.initializeTransfer({
      internalTransferRef,
      amountEtb: toEtb(feeCalc.userReceivesSantims),
      currency: "ETB",
      bankCode,
      accountNumber,
      accountHolderName,
      beneficiaryEmail: user.emailAddresses[0]?.emailAddress,
    });

    if (transferRes.success) {
      return Response.json({
        success: true,
        internalTransferRef,
        providerTransferId: transferRes.providerTransferId,
        receivedEtb: toEtb(feeCalc.userReceivesSantims),
        feeEtb: toEtb(feeCalc.providerFeeSantims),
        totalDeductedEtb: toEtb(feeCalc.totalDeductionSantims),
      });
    } else {
      // Transfer failed immediately at provider — reverse reserved funds in Convex
      await convex.mutation(api.financial.withdrawals.settleWithdrawalOutcome, {
        internalTransferRef,
        outcome: "failed",
        failureReason: transferRes.error || "Provider rejected transfer request",
      });

      return Response.json(
        { error: transferRes.error || "Transfer failed with provider" },
        { status: 502 }
      );
    }
  } catch (err: any) {
    console.error("[Withdrawal Request] Error:", err);
    return Response.json({ error: err.message || "Withdrawal error" }, { status: 500 });
  }
}
