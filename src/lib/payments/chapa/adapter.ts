// src/lib/payments/chapa/adapter.ts — Chapa Adapter implementing PaymentProvider
import crypto from "crypto";
import { ChapaClient } from "./client";
import {
  calculateDepositFee,
  calculateWithdrawalFee,
  getDepositFeeRateBps,
  getWithdrawalFeeRateBps,
  type DepositFeeCalculation,
  type WithdrawalFeeCalculation,
} from "../money";
import type {
  BankInfo,
  PaymentInitRequest,
  PaymentInitResponse,
  PaymentProvider,
  PaymentVerifyResult,
  PaymentWebhookEvent,
  TransferInitRequest,
  TransferInitResponse,
  TransferVerifyResult,
} from "../types";

export class ChapaAdapter implements PaymentProvider {
  readonly id = "chapa";
  readonly name = "Chapa Payment Gateway";

  private client: ChapaClient;
  private webhookSecret: string;
  private secretKey: string;

  constructor(
    clientOrConfig?: ChapaClient | { client?: ChapaClient; webhookSecret?: string; secretKey?: string; publicKey?: string },
    webhookSecret?: string
  ) {
    if (
      clientOrConfig &&
      !(clientOrConfig instanceof ChapaClient) &&
      typeof clientOrConfig === "object" &&
      !("initializeTransaction" in clientOrConfig)
    ) {
      this.client = clientOrConfig.client || new ChapaClient(clientOrConfig.secretKey);
      this.webhookSecret = clientOrConfig.webhookSecret || process.env.CHAPA_WEBHOOK_SECRET || "";
      this.secretKey =
        clientOrConfig.secretKey ||
        process.env.CHAPA_SECRET_KEY ||
        "CHASECK_TEST-7HfqijyE7K2Vuej6AKjDRpvN7cCt31hT";
    } else {
      this.client = (clientOrConfig as ChapaClient) || new ChapaClient();
      this.webhookSecret = webhookSecret || process.env.CHAPA_WEBHOOK_SECRET || "";
      this.secretKey =
        process.env.CHAPA_SECRET_KEY || "CHASECK_TEST-7HfqijyE7K2Vuej6AKjDRpvN7cCt31hT";
    }
  }

  calculateDepositFee(creditSantims: number): DepositFeeCalculation {
    const rateBps = getDepositFeeRateBps(); // default 251 bps (2.51% effective rate)
    return calculateDepositFee(creditSantims, rateBps, "additive");
  }

  async initializePayment(req: PaymentInitRequest): Promise<PaymentInitResponse> {
    try {
      const res = await this.client.initializeTransaction({
        amount: String(req.amountEtb),
        currency: req.currency || "ETB",
        email: req.email,
        first_name: req.firstName,
        last_name: req.lastName,
        tx_ref: req.internalTxRef,
        return_url: req.returnUrl,
        callback_url: req.callbackUrl,
        "customization[title]": req.title || "Abay Chess",
        "customization[description]": req.description || "Wallet Deposit",
      });

      if (res.status === "success" && res.data?.checkout_url) {
        return {
          success: true,
          checkoutUrl: res.data.checkout_url,
        };
      }

      return {
        success: false,
        error: res.message || "Failed to initialize payment with Chapa",
      };
    } catch (err: unknown) {
      console.error("[ChapaAdapter] Initialization exception:", err);
      return {
        success: false,
        error: err instanceof Error ? err.message : "Payment initialization network error",
      };
    }
  }

  async verifyPayment(txRef: string): Promise<PaymentVerifyResult> {
    try {
      const res = await this.client.verifyTransaction(txRef);
      if (res.status === "success" && res.data) {
        const rawStatus = (res.data.status || "").toLowerCase();
        let status: PaymentVerifyResult["status"] = "pending";
        if (rawStatus === "success") status = "success";
        else if (rawStatus === "failed" || rawStatus === "cancelled") status = "failed";

        const amountNum = typeof res.data.amount === "string" ? parseFloat(res.data.amount) : res.data.amount;

        return {
          status,
          internalTxRef: res.data.tx_ref || txRef,
          providerTxId: res.data.reference,
          amountEtb: amountNum,
          currency: res.data.currency,
          rawResponse: res as unknown as Record<string, unknown>,
        };
      }

      return {
        status: "pending",
        internalTxRef: txRef,
        error: res.message || "Verification response not confirmed",
      };
    } catch (err: unknown) {
      console.error("[ChapaAdapter] Verification error:", err);
      return {
        status: "pending",
        internalTxRef: txRef,
        error: err instanceof Error ? err.message : "Verification network error",
      };
    }
  }

  verifyWebhookSignature(
    rawBody: string,
    headersOrSignature: Headers | Record<string, string | undefined> | string
  ): boolean {
    let signature: string | null = null;
    if (typeof headersOrSignature === "string") {
      signature = headersOrSignature;
    } else if ("get" in headersOrSignature && typeof headersOrSignature.get === "function") {
      signature =
        headersOrSignature.get("x-chapa-signature") ||
        headersOrSignature.get("chapa-signature");
    } else {
      const rec = headersOrSignature as Record<string, string | undefined>;
      signature = rec["x-chapa-signature"] || rec["chapa-signature"] || null;
    }

    if (!signature) return false;

    const candidates = [this.webhookSecret, this.secretKey].filter(Boolean);
    if (candidates.length === 0) {
      console.warn("[ChapaAdapter] Webhook secret or Secret Key missing; cannot verify signature");
      return false;
    }

    const sigBuf = Buffer.from(signature);

    for (const secret of candidates) {
      const expected = crypto
        .createHmac("sha256", secret)
        .update(rawBody)
        .digest("hex");
      const expBuf = Buffer.from(expected);
      if (sigBuf.length === expBuf.length && crypto.timingSafeEqual(sigBuf, expBuf)) {
        return true;
      }
    }

    return false;
  }

  parseWebhookEvent(rawBody: string): PaymentWebhookEvent | null {
    try {
      const payload = JSON.parse(rawBody);
      const txRef = payload.tx_ref || payload.trx_ref || payload.reference;
      if (!txRef) return null;

      const eventName = (payload.event || "").toLowerCase();
      const rawStatus = (payload.status || "").toLowerCase();
      let status: PaymentWebhookEvent["status"] = "pending";

      if (
        rawStatus === "success" ||
        rawStatus === "completed" ||
        eventName === "payout.success" ||
        eventName === "charge.complete"
      ) {
        status = "success";
      } else if (
        rawStatus === "failed" ||
        rawStatus === "cancelled" ||
        rawStatus === "rejected" ||
        eventName.includes("fail") ||
        eventName.includes("cancel")
      ) {
        status = "failed";
      }

      const amountNum = payload.amount ? parseFloat(payload.amount) : undefined;

      return {
        event: payload.event || (txRef.startsWith("WDR_") ? "payout.status" : "charge.complete"),
        txRef,
        status,
        providerTxId: payload.reference || payload.id || payload.chapa_reference,
        amountEtb: amountNum,
        currency: payload.currency || "ETB",
        rawBody,
      };
    } catch {
      return null;
    }
  }

  calculateWithdrawalFee(receiveSantims: number): WithdrawalFeeCalculation {
    const rateBps = getWithdrawalFeeRateBps(); // Configured independently from deposits
    return calculateWithdrawalFee(receiveSantims, rateBps, "additive");
  }

  async initializeTransfer(req: TransferInitRequest): Promise<TransferInitResponse> {
    try {
      const isTestMode =
        (typeof process !== "undefined" && process.env?.CHAPA_MODE === "test") ||
        this.secretKey.startsWith("CHASECK_TEST-");

      const isSimulatedFailure =
        req.accountNumber.includes("fail") ||
        req.accountHolderName.toLowerCase().includes("fail") ||
        req.accountNumber.endsWith("2233"); // 0900112233 is Chapa standard test fail account

      const payload: any = {
        account_name: req.accountHolderName,
        account_number: req.accountNumber,
        amount: String(req.amountEtb),
        currency: req.currency || "ETB",
        reference: req.internalTransferRef,
        bank_code: req.bankCode,
      };

      if (isTestMode) {
        payload.status = isSimulatedFailure ? "failed" : "success";
      }

      const res = await this.client.initializeTransfer(payload);

      if (res.status === "success") {
        return {
          success: true,
          providerTransferId:
            (typeof res.data === "string" ? res.data : undefined) ||
            (res.data && typeof res.data === "object" && "id" in res.data ? String(res.data.id) : undefined) ||
            req.internalTransferRef,
          status: "pending",
        };
      }

      // Safely normalize structured error object into a clean string
      const errorMsg = formatChapaErrorMessage(res.message);
      return {
        success: false,
        status: "failed",
        error: errorMsg || "Failed to initialize transfer with Chapa",
      };
    } catch (err: unknown) {
      console.error("[ChapaAdapter] Transfer error:", err);
      return {
        success: false,
        status: "failed",
        error: err instanceof Error ? err.message : "Transfer network error",
      };
    }
  }

  async verifyTransfer(transferRef: string): Promise<TransferVerifyResult> {
    try {
      const isTestMode =
        (typeof process !== "undefined" && process.env?.CHAPA_MODE === "test") ||
        this.secretKey.startsWith("CHASECK_TEST-");

      const res = await this.client.verifyTransfer(transferRef);

      // Chapa test mode verification returns { message: "Transfer details (Test Mode)", status: "success", data: [null] }
      const isChapaTestVerify =
        isTestMode ||
        (typeof res.message === "string" && res.message.includes("Test Mode"));

      if (isChapaTestVerify && res.status === "success") {
        const isSimulatedFailure =
          transferRef.includes("fail") ||
          (typeof res.message === "string" && res.message.toLowerCase().includes("fail"));

        if (isSimulatedFailure) {
          return {
            status: "failed",
            internalTransferRef: transferRef,
            error: "Simulated Test Mode Failure",
            rawResponse: res as unknown as Record<string, unknown>,
          };
        }

        return {
          status: "completed",
          internalTransferRef: transferRef,
          providerTransferId:
            (typeof res.data === "string" ? res.data : undefined) || transferRef,
          rawResponse: res as unknown as Record<string, unknown>,
        };
      }

      // Live mode response inspection
      if (res.status === "success" && res.data) {
        const item: any = Array.isArray(res.data) ? res.data[0] : res.data;
        if (item) {
          const rawStatus = (item.status || "").toLowerCase();
          let status: TransferVerifyResult["status"] = "pending";
          if (rawStatus === "success" || rawStatus === "completed") status = "completed";
          else if (rawStatus === "failed" || rawStatus === "rejected") status = "failed";

          return {
            status,
            internalTransferRef: transferRef,
            providerTransferId: item.id || item.chapa_transfer_id || transferRef,
            amountEtb: item.amount ? parseFloat(String(item.amount)) : undefined,
            rawResponse: res as unknown as Record<string, unknown>,
          };
        }
      }

      if (res.status === "failed") {
        const errorMsg = formatChapaErrorMessage(res.message);
        return {
          status: "failed",
          internalTransferRef: transferRef,
          error: errorMsg || "Transfer failed at provider",
          rawResponse: res as unknown as Record<string, unknown>,
        };
      }

      const errorMsg = formatChapaErrorMessage(res.message);
      return {
        status: "pending",
        internalTransferRef: transferRef,
        error: errorMsg || undefined,
      };
    } catch (err: unknown) {
      return {
        status: "pending",
        internalTransferRef: transferRef,
        error: err instanceof Error ? err.message : "Transfer verification error",
      };
    }
  }

  async getSupportedBanks(): Promise<BankInfo[]> {
    return await this.client.getBanks();
  }
}

/**
 * Safely normalize any Chapa error response (string, object with arrays, etc.)
 * into a single clean human-readable string that strictly satisfies `v.string()`.
 */
export function formatChapaErrorMessage(messageOrError: unknown): string {
  if (!messageOrError) return "Failed to process transaction with Chapa";
  if (typeof messageOrError === "string") return messageOrError;
  if (typeof messageOrError === "object") {
    // If it's a validation error object like { bank_code: ["Invalid bank code selected."] }
    const entries = Object.entries(messageOrError as Record<string, unknown>);
    if (entries.length > 0) {
      const parts = entries.map(([field, errs]) => {
        const fieldLabel = field.replace(/_/g, " ");
        if (Array.isArray(errs)) {
          return `${errs.join(", ")}`;
        }
        if (typeof errs === "string") {
          return errs;
        }
        return `${fieldLabel}: ${JSON.stringify(errs)}`;
      });
      return parts.join("; ");
    }
    return JSON.stringify(messageOrError);
  }
  return String(messageOrError);
}
