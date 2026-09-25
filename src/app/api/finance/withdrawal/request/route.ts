// src/app/api/finance/withdrawal/request/route.ts — Server-side withdrawal processing
import { auth, currentUser } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../../convex/_generated/api";
import { getPaymentProvider } from "@/lib/payments/provider";
import { formatChapaErrorMessage } from "@/lib/payments/chapa/adapter";
import { toSantims, toEtb } from "@/lib/payments/money";
import crypto from "crypto";

export const dynamic = "force-dynamic";

const KNOWN_BANK_SLUGS: Record<string, string> = {
  telebirr: "855",
  cbe: "946",
  cbe_bank: "946",
  cbebirr: "128",
  coop: "836",
  coop_bank: "836",
  hibret: "534",
  hibret_bank: "534",
  mpesa: "266",
  yaya: "867",
  zemen: "687",
  zemen_bank: "687",
  awash: "851",
  dashen: "963",
  abyssinia: "941",
};

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

  const normalizedBankCode =
    KNOWN_BANK_SLUGS[bankCode.trim().toLowerCase()] || bankCode.trim();

  if (!/^\d+$/.test(normalizedBankCode)) {
    return Response.json(
      { error: "Invalid bank code: must be a numeric provider bank ID." },
      { status: 400 }
    );
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
    const cleanAccount = accountNumber.trim();
    const cleanHolder = accountHolderName.trim();
    const maskedAccount =
      cleanAccount.length > 4
        ? `****${cleanAccount.slice(-4)}`
        : cleanAccount;

    // 1. Atomically reserve funds in Convex (moves from available to locked balance)
    await convex.mutation(api.financial.withdrawals.reserveWithdrawal, {
      clerkId: clerkUserId,
      internalTransferRef,
      requestedAmountSantims: feeCalc.userReceivesSantims,
      providerFeeSantims: feeCalc.providerFeeSantims,
      totalReservedSantims: feeCalc.totalDeductionSantims,
      chapaServiceFeeSantims: feeCalc.chapaServiceFeeSantims,
      chapaVatSantims: feeCalc.chapaVatSantims,
      effectiveRateBps: feeCalc.feeRateBps,
      provider: provider.id,
      bankName: bankName || "Bank Transfer",
      bankCode: normalizedBankCode,
      accountNumberMasked: maskedAccount,
      accountHolderName: cleanHolder,
    });

    // 2. Dispatch transfer to Chapa Transfer API
    let transferRes;
    try {
      transferRes = await provider.initializeTransfer({
        internalTransferRef,
        amountEtb: toEtb(feeCalc.userReceivesSantims),
        currency: "ETB",
        bankCode: normalizedBankCode,
        accountNumber: cleanAccount,
        accountHolderName: cleanHolder,
        beneficiaryEmail: user.emailAddresses[0]?.emailAddress,
      });
    } catch (initErr: unknown) {
      const errorMsg = formatChapaErrorMessage(
        initErr instanceof Error ? initErr.message : initErr
      );
      await convex.mutation(api.financial.withdrawals.settleWithdrawalOutcome, {
        internalTransferRef,
        outcome: "failed",
        failureReason: errorMsg,
      });
      return Response.json({ error: errorMsg }, { status: 502 });
    }

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
      // Transfer failed at provider — reverse reserved funds in Convex
      const errorMsg =
        formatChapaErrorMessage(transferRes.error) || "Provider rejected transfer request";

      await convex.mutation(api.financial.withdrawals.settleWithdrawalOutcome, {
        internalTransferRef,
        outcome: "failed",
        failureReason: errorMsg,
      });

      return Response.json({ error: errorMsg }, { status: 502 });
    }
  } catch (err: unknown) {
    console.error("[Withdrawal Request] Error:", err);
    const message = err instanceof Error ? err.message : "Withdrawal error";
    return Response.json({ error: message }, { status: 500 });
  }
}
