// src/lib/payments/chapa/adapter.ts — Chapa Adapter implementing PaymentProvider
import crypto from "crypto";
import { ChapaClient } from "./client";
import {
  calculateDepositFee,
  calculateWithdrawalFee,
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
    const rateBps = parseInt(process.env.CHAPA_DEPOSIT_FEE_BPS || "250", 10); // default 2.5%
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
        "customization[title]": req.title || "Castle Chess",
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
      const txRef = payload.tx_ref || payload.trx_ref;
      if (!txRef) return null;

      const rawStatus = (payload.status || "").toLowerCase();
      let status: PaymentWebhookEvent["status"] = "pending";
      if (rawStatus === "success") status = "success";
      else if (rawStatus === "failed" || rawStatus === "cancelled") status = "failed";

      const amountNum = payload.amount ? parseFloat(payload.amount) : undefined;

      return {
        event: payload.event || "charge.complete",
        txRef,
        status,
        providerTxId: payload.reference || payload.id,
        amountEtb: amountNum,
        currency: payload.currency || "ETB",
        rawBody,
      };
    } catch {
      return null;
    }
  }

  calculateWithdrawalFee(receiveSantims: number): WithdrawalFeeCalculation {
    const rateBps = parseInt(process.env.CHAPA_WITHDRAWAL_FEE_BPS || "250", 10);
    return calculateWithdrawalFee(receiveSantims, rateBps, "additive");
  }

  async initializeTransfer(req: TransferInitRequest): Promise<TransferInitResponse> {
    try {
      const res = await this.client.initializeTransfer({
        account_name: req.accountHolderName,
        account_number: req.accountNumber,
        amount: String(req.amountEtb),
        currency: req.currency || "ETB",
        reference: req.internalTransferRef,
        bank_code: req.bankCode,
      });

      if (res.status === "success") {
        return {
          success: true,
          providerTransferId: res.data?.id || res.data?.transfer_id,
          status: "pending",
        };
      }

      return {
        success: false,
        status: "failed",
        error: res.message || "Failed to initialize transfer with Chapa",
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
      const res = await this.client.verifyTransfer(transferRef);
      if (res.status === "success" && res.data) {
        const rawStatus = (res.data.status || "").toLowerCase();
        let status: TransferVerifyResult["status"] = "pending";
        if (rawStatus === "success" || rawStatus === "completed") status = "completed";
        else if (rawStatus === "failed" || rawStatus === "rejected") status = "failed";

        return {
          status,
          internalTransferRef: transferRef,
          providerTransferId: res.data.id,
          amountEtb: res.data.amount ? parseFloat(String(res.data.amount)) : undefined,
          rawResponse: res,
        };
      }

      return {
        status: "pending",
        internalTransferRef: transferRef,
        error: res.message,
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
