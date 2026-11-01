// src/lib/payments/verify-et/client.ts
// Real-time client adapter for Verify.et (Automated Ethiopian Bank & Mobile Money Verification API)

export interface VerifyEtParams {
  bank: "telebirr" | "cbe_bank" | "cbe" | "cbe_birr" | "cbebirr" | string;
  reference: string;
  amount?: number;
  phone?: string;
  accountSuffix?: string;
  idempotencyKey?: string;
}

export interface VerifyEtResult {
  success: boolean;
  verified: boolean;
  status: "completed" | "processing" | "pending" | "failed" | "not_found";
  amount?: number;
  settledAmount?: number;
  totalPaidAmount?: number;
  currency?: string;
  senderName?: string;
  senderPhone?: string;
  receiverName?: string;
  receiverAccount?: string;
  reference?: string;
  requestId?: string;
  message?: string;
  raw?: unknown;
}

// Beneficiary account reference info for Abay Chess
export const OFFICIAL_RECEIVER_NAME = "Yared Tekleye";
export const OFFICIAL_RECEIVER_PHONE = "0987678228";
export const OFFICIAL_CBE_ACCOUNT =
  process.env.NEXT_PUBLIC_CBE_ACCOUNT || "1000456789123";
export const OFFICIAL_CBE_BIRR_NUMBER =
  process.env.NEXT_PUBLIC_CBE_BIRR_ACCOUNT || "0987678228";

export function getVerifyEtApiKey(): string {
  const apiKey = process.env.VERIFY_ET_API_KEY;
  if (!apiKey || !apiKey.trim()) {
    throw new Error("system_misconfigured_missing_verify_et_api_key");
  }
  return apiKey.trim();
}

export function getVerifyEtWebhookSecret(): string {
  const webhookSecret = process.env.VERIFY_ET_WEBHOOK_SECRET;
  if (!webhookSecret || !webhookSecret.trim()) {
    throw new Error("system_misconfigured_missing_verify_et_webhook_secret");
  }
  return webhookSecret.trim();
}

export function getVerifyEtBaseUrl(): string {
  const url = process.env.VERIFY_ET_BASE_URL || "https://verify.et";
  return url.replace(/\/+$/, "");
}

/**
 * Normalizes payment channel to Verify.et expected bank identifier.
 */
export function normalizeVerifyEtBank(channel: string): string {
  const lower = channel.toLowerCase().trim();
  if (lower === "telebirr") return "telebirr";
  if (lower === "cbe" || lower === "cbe_bank") return "cbe";
  if (lower === "cbe_birr" || lower === "cbebirr") return "cbebirr";
  if (lower.includes("abyssinia") || lower === "boa") return "boa";
  if (lower === "awash") return "awash";
  if (lower === "dashen") return "dashen";
  return lower;
}

/**
 * Normalizes full name into clean uppercase/lowercase token words for fuzzy matching.
 */
export function tokenizeName(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/gi, " ")
    .split(/\s+/)
    .filter((part) => part.length >= 2);
}

/**
 * Compares expected player full name with the sender name returned by the bank/Verify.et.
 * Matches if any 2 tokens match or if one name string contains the other.
 */
export function matchSenderName(expectedName: string, actualName?: string): boolean {
  if (!actualName || !actualName.trim()) {
    // If bank did not expose sender name, don't hard-block; let amount and reference rule
    return true;
  }
  const expTokens = tokenizeName(expectedName);
  const actTokens = tokenizeName(actualName);

  if (expTokens.length === 0 || actTokens.length === 0) return true;

  // Direct token match count
  let matchCount = 0;
  for (const token of expTokens) {
    if (actTokens.includes(token)) {
      matchCount++;
    }
  }

  if (matchCount >= 2) return true;
  if (expTokens.length === 1 && matchCount >= 1) return true;

  // Substring fallback
  const cleanExp = expTokens.join(" ");
  const cleanAct = actTokens.join(" ");
  if (cleanAct.includes(cleanExp) || cleanExp.includes(cleanAct)) {
    return true;
  }

  return false;
}

/**
 * Normalizes an Ethiopian phone or account number for comparison.
 * Strips non-digits and normalizes national mobile format (last 9 digits).
 */
export function normalizePhoneOrAccount(input?: string): string {
  if (!input) return "";
  let digits = input.replace(/\D/g, "");
  // Strip Ethiopian country code (+251) or leading national trunk prefix (0)
  if (digits.startsWith("251")) {
    digits = digits.slice(3);
  } else if (digits.startsWith("0")) {
    digits = digits.slice(1);
  }
  return digits;
}

/**
 * Matches expected phone / account number against bank record.
 * Handles exact national phone match (last 9 digits), partial masks (e.g. 0933****90),
 * and bank account number matches.
 */
export function matchPhoneNumber(expectedPhone?: string, actualPhone?: string): boolean {
  if (!expectedPhone || !expectedPhone.trim()) {
    return false;
  }
  if (!actualPhone || !actualPhone.trim()) {
    // If bank record didn't expose phone number (e.g. some direct bank accounts), don't hard block
    return true;
  }

  const expClean = expectedPhone.trim();
  const actClean = actualPhone.trim();

  const normExp = normalizePhoneOrAccount(expClean);

  // If actual phone has mask characters (* or x)
  if (actClean.includes("*") || actClean.includes("x") || actClean.includes("X")) {
    const rawParts = actClean.split(/[*xX]+/).filter((p) => p.replace(/\D/g, "").length > 0);
    if (rawParts.length > 0) {
      // First part is the prefix
      const prefixDigits = normalizePhoneOrAccount(rawParts[0]);
      // Last part is the suffix
      const suffixDigits = rawParts[rawParts.length - 1].replace(/\D/g, "");

      // Suffix (e.g. 4790) MUST match the end of normExp
      if (suffixDigits && !normExp.endsWith(suffixDigits)) {
        return false;
      }
      // Prefix (e.g. 9 or 933) MUST match the start of normExp if present
      if (prefixDigits && !normExp.startsWith(prefixDigits)) {
        return false;
      }
      return true;
    }
  }

  const normAct = normalizePhoneOrAccount(actClean);

  if (!normExp || !normAct) return false;

  // Exact normalized match
  if (normExp === normAct) return true;

  // 9-digit Ethiopian mobile match (last 9 digits)
  if (normExp.length >= 9 && normAct.length >= 9) {
    if (normExp.slice(-9) === normAct.slice(-9)) {
      return true;
    }
  }

  // Account match (e.g. CBE account suffix/full)
  if (
    (normExp.length >= 7 && normAct.endsWith(normExp)) ||
    (normAct.length >= 7 && normExp.endsWith(normAct))
  ) {
    return true;
  }

  return false;
}

/**
 * Verifies that the recipient of the bank transfer matches Abay Chess's official account:
 * - Telebirr / CBE Birr: 0987678228, Name: Yared Tekleye (or Abay Chess)
 * - CBE Bank: 1000456789123 (or env config), Name: Yared Tekleye (or Abay Chess)
 */
export function matchReceiver(
  channel: string,
  actualReceiverName?: string,
  actualReceiverAccount?: string,
): { isMatch: boolean; reason?: string } {
  const normBank = normalizeVerifyEtBank(channel);
  const expectedPhone = OFFICIAL_RECEIVER_PHONE;
  const expectedAccount = normBank === "cbe" ? OFFICIAL_CBE_ACCOUNT : expectedPhone;

  // 1. Check receiver name if exposed by bank
  if (actualReceiverName && actualReceiverName.trim()) {
    const lower = actualReceiverName.toLowerCase();
    const isBrandMatch = lower.includes("abay") || lower.includes("chess");
    const isNameMatch = isBrandMatch || matchSenderName(OFFICIAL_RECEIVER_NAME, actualReceiverName);

    if (!isNameMatch) {
      return {
        isMatch: false,
        reason: "Receiver name does not match the official Abay Chess account (Yared Tekleye).",
      };
    }
  }

  // 2. Check receiver account / phone if exposed by bank
  if (actualReceiverAccount && actualReceiverAccount.trim()) {
    const isAccountMatch = matchPhoneNumber(expectedAccount, actualReceiverAccount);
    if (!isAccountMatch) {
      return {
        isMatch: false,
        reason: `Receiver account does not match the official Abay Chess recipient (${expectedAccount}).`,
      };
    }
  }

  return { isMatch: true };
}

/**
 * Calls Verify.et API in real-time to strictly verify a transaction reference.
 * Supports synchronous wait (waitMs=10000) and fallback status polling.
 */
export async function verifyTransactionWithVerifyEt(
  params: VerifyEtParams,
): Promise<VerifyEtResult> {
  const apiKey = getVerifyEtApiKey();
  const baseUrl = getVerifyEtBaseUrl();
  const bank = normalizeVerifyEtBank(params.bank);
  const cleanReference = params.reference.trim();

  // Request synchronous wait from Verify.et (up to 10 seconds)
  const endpoint = `${baseUrl}/api/verify?waitMs=10000`;

  const headers: Record<string, string> = {
    "x-api-key": apiKey,
    "Content-Type": "application/json",
  };

  const idempotencyKey =
    params.idempotencyKey || `verify_${bank}_${cleanReference}_${Date.now()}`;
  headers["Idempotency-Key"] = idempotencyKey;

  const payload: Record<string, unknown> = {
    bank,
    reference: cleanReference,
    transactionNumber: cleanReference,
    referenceNumber: cleanReference,
  };

  if (params.amount !== undefined && params.amount > 0) {
    payload.amount = params.amount;
  }

  // Provider-specific required parameters
  if (bank === "cbe") {
    // CBE requires 8-digit suffix
    const candidateSuffix =
      params.accountSuffix?.trim() ||
      (params.phone && params.phone.replace(/\D/g, "").slice(-8)) ||
      OFFICIAL_CBE_ACCOUNT.replace(/\D/g, "").slice(-8);

    if (candidateSuffix) {
      payload.accountSuffix = candidateSuffix;
      payload.suffix = candidateSuffix;
    }
  } else if (bank === "cbebirr") {
    payload.phone =
      params.phone?.trim() ||
      OFFICIAL_CBE_BIRR_NUMBER;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 14000);

    const res = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const initialJson = (await res.json().catch(() => null)) as Record<string, unknown> | null;

    if (!res.ok && res.status !== 202) {
      const errorMsg =
        (initialJson?.message as string) ||
        (initialJson?.error as { message?: string })?.message ||
        `Verify.et request failed with status ${res.status}`;
      return {
        success: false,
        verified: false,
        status: res.status === 404 ? "not_found" : "failed",
        message: errorMsg,
        raw: initialJson,
      };
    }

    let finalJson: Record<string, unknown> | null = initialJson;
    const initialVerification = initialJson?.verification as Record<string, unknown> | undefined;
    const requestId =
      (initialJson?.requestId as string) ||
      ((initialJson?.data as Record<string, unknown>)?.requestId as string) ||
      (initialVerification?.requestId as string);

    // If Verify.et responded with 202 or queued/processing, poll GET status up to 8s
    const isQueued =
      res.status === 202 ||
      initialVerification?.processingStatus === "queued" ||
      initialVerification?.processingStatus === "processing" ||
      initialVerification?.status === "pending";

    if (isQueued && requestId) {
      const pollStart = Date.now();
      while (Date.now() - pollStart < 8000) {
        await new Promise((r) => setTimeout(r, 1500));
        try {
          const pollRes = await fetch(`${baseUrl}/api/verify/${requestId}`, {
            method: "GET",
            headers: { "x-api-key": apiKey },
          });
          if (pollRes.ok) {
            const pollJson = (await pollRes.json()) as Record<string, unknown>;
            const pollData = pollJson?.data as Record<string, unknown> | undefined;
            const pollVerification = pollJson?.verification as Record<string, unknown> | undefined;

            const pollStatus = String(
              pollData?.processingStatus ||
                pollData?.status ||
                pollVerification?.processingStatus ||
                pollVerification?.status ||
                "",
            ).toLowerCase();

            if (
              pollStatus &&
              pollStatus !== "queued" &&
              pollStatus !== "processing" &&
              pollStatus !== "pending"
            ) {
              finalJson = pollJson;
              break;
            }
          }
        } catch {
          // continue polling until timeout
        }
      }
    }

    // -------------------------------------------------------------------------
    // STRICT VERIFICATION EVALUATION
    // -------------------------------------------------------------------------
    const finalData = finalJson?.data;
    const firstDataItem = Array.isArray(finalData) ? (finalData[0] as Record<string, unknown>) : (finalData as Record<string, unknown> | undefined);
    const vDoc =
      (finalJson?.verification as Record<string, unknown> | undefined) ||
      (firstDataItem?.verification as Record<string, unknown> | undefined) ||
      firstDataItem ||
      finalJson;

    const resultObj =
      vDoc?.result && typeof vDoc.result === "object"
        ? (vDoc.result as Record<string, unknown>)
        : vDoc;

    // 1. Explicit verification booleans
    const hasExplicitVerifiedTrue =
      vDoc?.verified === true ||
      resultObj?.verified === true ||
      finalJson?.verified === true;

    const hasExplicitVerifiedFalse =
      vDoc?.verified === false ||
      resultObj?.verified === false ||
      finalJson?.verified === false;

    // 2. Status string
    const statusStr = String(
      resultObj?.status || vDoc?.status || finalJson?.status || "",
    ).toLowerCase();

    const processingStatus = String(
      vDoc?.processingStatus || finalJson?.processingStatus || "",
    ).toLowerCase();

    // 3. Extracted verified amount
    const rawAmount =
      resultObj?.amount ??
      resultObj?.transactionAmount ??
      vDoc?.amount ??
      vDoc?.transactionAmount ??
      finalJson?.amount;

    const extractedAmount =
      typeof rawAmount === "number"
        ? rawAmount
        : typeof rawAmount === "string"
          ? parseFloat(rawAmount)
          : undefined;

    // 4. Extracted sender, phone & receiver details
    const extractedSender =
      (resultObj?.sender as string) ||
      (resultObj?.senderName as string) ||
      (resultObj?.payer as string) ||
      (resultObj?.payerName as string) ||
      (resultObj?.fromName as string) ||
      (resultObj?.accountName as string) ||
      (vDoc?.sender as string) ||
      (vDoc?.senderName as string) ||
      (vDoc?.payer as string) ||
      (vDoc?.payerName as string) ||
      (finalJson?.sender as string) ||
      (finalJson?.senderName as string) ||
      undefined;

    const metaObj = (resultObj?.metadata || vDoc?.metadata) as Record<string, unknown> | undefined;
    const bankSpecific = (resultObj?.bankSpecific ||
      vDoc?.bankSpecific ||
      firstDataItem?.bankSpecific) as Record<string, unknown> | undefined;

    const rawPhone =
      bankSpecific?.payerTelebirrNo ??
      bankSpecific?.senderAccount ??
      bankSpecific?.payerPhone ??
      bankSpecific?.senderPhoneNumber ??
      bankSpecific?.senderPhone ??
      bankSpecific?.fromAccount ??
      bankSpecific?.fromPhone ??
      bankSpecific?.phoneNumber ??
      resultObj?.phoneNumber ??
      resultObj?.phone ??
      resultObj?.senderPhone ??
      resultObj?.senderPhoneNumber ??
      resultObj?.payerPhone ??
      resultObj?.payerPhoneNumber ??
      resultObj?.fromPhone ??
      resultObj?.senderAccount ??
      resultObj?.payerTelebirrNo ??
      vDoc?.phoneNumber ??
      vDoc?.phone ??
      vDoc?.senderPhone ??
      vDoc?.senderPhoneNumber ??
      vDoc?.payerPhone ??
      vDoc?.fromPhone ??
      vDoc?.senderAccount ??
      firstDataItem?.phoneNumber ??
      firstDataItem?.phone ??
      firstDataItem?.senderPhone ??
      firstDataItem?.senderAccount ??
      metaObj?.phone ??
      metaObj?.phoneNumber ??
      metaObj?.senderPhone ??
      metaObj?.senderAccount ??
      finalJson?.phoneNumber ??
      finalJson?.phone;

    let extractedPhone =
      rawPhone !== undefined && rawPhone !== null ? String(rawPhone).trim() : undefined;

    if (!extractedPhone && extractedSender) {
      const phoneMatch = extractedSender.match(/(?:\+?251[79]\d{8}|0[79]\d{8}|\b[79]\d{8}\b)/);
      if (phoneMatch) {
        extractedPhone = phoneMatch[0];
      }
    }

    const extractedReceiverName =
      (resultObj?.receiverName as string) ||
      (resultObj?.receiver as string) ||
      (resultObj?.creditedPartyName as string) ||
      (resultObj?.beneficiaryName as string) ||
      (resultObj?.toName as string) ||
      (bankSpecific?.receiverName as string) ||
      (bankSpecific?.creditedPartyName as string) ||
      (bankSpecific?.toName as string) ||
      (bankSpecific?.beneficiaryName as string) ||
      (vDoc?.receiverName as string) ||
      (vDoc?.receiver as string) ||
      (finalJson?.receiverName as string) ||
      (finalJson?.receiver as string) ||
      undefined;

    const extractedReceiver =
      (resultObj?.receiverAccount as string) ||
      (resultObj?.receiverPhone as string) ||
      (resultObj?.creditedPartyAccountNo as string) ||
      (resultObj?.recipientAccount as string) ||
      (resultObj?.beneficiary as string) ||
      (bankSpecific?.receiverAccount as string) ||
      (bankSpecific?.creditedPartyAccountNo as string) ||
      (bankSpecific?.receiverPhone as string) ||
      (bankSpecific?.toAccount as string) ||
      (vDoc?.receiverAccount as string) ||
      (vDoc?.receiver as string) ||
      (finalJson?.receiverAccount as string) ||
      undefined;

    const rawSettled =
      bankSpecific?.settledAmountValue ??
      bankSpecific?.amountValue ??
      resultObj?.settledAmount ??
      resultObj?.settledAmountValue ??
      vDoc?.settledAmount;

    const settledAmount =
      typeof rawSettled === "number"
        ? rawSettled
        : typeof rawSettled === "string"
          ? parseFloat(rawSettled)
          : extractedAmount;

    const rawTotalPaid =
      bankSpecific?.totalPaidAmountValue ??
      resultObj?.totalPaidAmount ??
      vDoc?.totalPaidAmount;

    const totalPaidAmount =
      typeof rawTotalPaid === "number"
        ? rawTotalPaid
        : typeof rawTotalPaid === "string"
          ? parseFloat(rawTotalPaid)
          : undefined;

    // 5. Error messages from Verify.et
    const errorObj = finalJson?.error as { code?: string; message?: string } | undefined;
    const vDocError = vDoc?.error as { code?: string; message?: string } | undefined;
    const errorMsg =
      (finalJson?.errorMessage as string) ||
      errorObj?.message ||
      (vDoc?.errorMessage as string) ||
      vDocError?.message ||
      (resultObj?.errorMessage as string) ||
      (finalJson?.message as string);

    const isNotFound =
      statusStr === "not_found" ||
      errorObj?.code === "not_found" ||
      vDocError?.code === "not_found";

    // STRICT: Only true if explicitly verified, not failed/not_found, and amount is a valid positive number
    const isReallyVerified =
      hasExplicitVerifiedTrue === true &&
      hasExplicitVerifiedFalse !== true &&
      !isNotFound &&
      statusStr !== "failed" &&
      statusStr !== "error" &&
      statusStr !== "upstream_unavailable" &&
      (statusStr === "verified" || statusStr === "completed" || statusStr === "success") &&
      typeof extractedAmount === "number" &&
      extractedAmount > 0;

    const isStillProcessing =
      !isReallyVerified &&
      !isNotFound &&
      (processingStatus === "queued" ||
        processingStatus === "processing" ||
        statusStr === "pending" ||
        statusStr === "processing");

    let finalStatus: VerifyEtResult["status"] = "failed";
    if (isReallyVerified) {
      finalStatus = "completed";
    } else if (isNotFound) {
      finalStatus = "not_found";
    } else if (isStillProcessing) {
      finalStatus = "processing";
    } else {
      finalStatus = "failed";
    }

    const friendlyErrorMessage =
      errorMsg ||
      (isNotFound
        ? `No ${params.bank} transaction found for reference "${cleanReference}". Please verify your transaction number.`
        : finalStatus === "processing"
          ? "Payment verification is in progress on the bank network."
          : `Transaction verification failed (${statusStr || "unconfirmed"}).`);

    return {
      success: isReallyVerified,
      verified: isReallyVerified,
      status: finalStatus,
      amount: extractedAmount,
      settledAmount,
      totalPaidAmount,
      currency: (resultObj?.currency as string) || (vDoc?.currency as string) || "ETB",
      senderName: extractedSender,
      senderPhone: extractedPhone,
      receiverName: extractedReceiverName,
      receiverAccount: extractedReceiver,
      reference: (resultObj?.reference as string) || (vDoc?.reference as string) || cleanReference,
      requestId,
      message: friendlyErrorMessage,
      raw: finalJson,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Network error contacting Verify.et";
    return {
      success: false,
      verified: false,
      status: "failed",
      message: errorMsg,
    };
  }
}
