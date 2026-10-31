// src/lib/payments/verify-et/client.ts
// Client adapter for Verify.et (Automated Ethiopian Bank & Mobile Money Verification API)

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
  currency?: string;
  senderName?: string;
  receiverAccount?: string;
  reference?: string;
  requestId?: string;
  message?: string;
  raw?: unknown;
}

const DEFAULT_VERIFY_ET_API_KEY =
  "VERIFY_BANK_ET_uT8kUg_CIZIVM2X2GEwNq6vA77DqKDz3lOdiP3BHMZZgZNbxzileH0KROisrLXu1";

export function getVerifyEtApiKey(): string {
  return process.env.VERIFY_ET_API_KEY || DEFAULT_VERIFY_ET_API_KEY;
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
 * Call Verify.et API to verify a transaction reference.
 */
export async function verifyTransactionWithVerifyEt(
  params: VerifyEtParams,
): Promise<VerifyEtResult> {
  const apiKey = getVerifyEtApiKey();
  const baseUrl = getVerifyEtBaseUrl();
  const bank = normalizeVerifyEtBank(params.bank);
  const cleanReference = params.reference.trim();

  const endpoint = `${baseUrl}/api/verify`;

  const headers: Record<string, string> = {
    "x-api-key": apiKey,
    "Content-Type": "application/json",
  };

  if (params.idempotencyKey) {
    headers["Idempotency-Key"] = params.idempotencyKey;
  }

  const payload: Record<string, unknown> = {
    bank,
    reference: cleanReference,
  };

  if (params.amount !== undefined && params.amount > 0) {
    payload.amount = params.amount;
  }

  if (params.phone) {
    payload.phone = params.phone.trim();
  }

  if (params.accountSuffix) {
    payload.accountSuffix = params.accountSuffix.trim();
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    const res = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const json = await res.json().catch(() => null);

    if (!res.ok) {
      const errorMsg =
        json?.message || json?.error || `Verify.et request failed with status ${res.status}`;
      return {
        success: false,
        verified: false,
        status: res.status === 404 ? "not_found" : "failed",
        message: errorMsg,
        raw: json,
      };
    }

    // Parse success envelope
    // Verify.et typically returns { success: true, data: { ... } } or similar payload
    const data = json?.data || json;
    const processingStatus = (
      data?.processingStatus ||
      data?.status ||
      (json?.success ? "completed" : "pending")
    ).toLowerCase();

    const isCompleted =
      processingStatus === "completed" ||
      processingStatus === "success" ||
      processingStatus === "verified";
    const isProcessing =
      processingStatus === "processing" ||
      processingStatus === "pending" ||
      res.status === 202;

    const extractedAmount =
      typeof data?.amount === "number"
        ? data.amount
        : typeof data?.amount === "string"
          ? parseFloat(data.amount)
          : undefined;

    const extractedSender =
      data?.senderName ||
      data?.sender ||
      data?.payerName ||
      data?.payer ||
      data?.from ||
      undefined;

    const extractedReceiver =
      data?.receiverAccount ||
      data?.receiver ||
      data?.recipientAccount ||
      data?.beneficiary ||
      undefined;

    return {
      success: true,
      verified: isCompleted,
      status: isCompleted ? "completed" : isProcessing ? "processing" : "pending",
      amount: extractedAmount,
      currency: data?.currency || "ETB",
      senderName: extractedSender,
      receiverAccount: extractedReceiver,
      reference: data?.reference || cleanReference,
      requestId: data?.requestId || data?.id || json?.requestId,
      message: json?.message,
      raw: json,
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
