// src/lib/payments/chapa/client.ts — Centralized HTTP client for Chapa Payment & Transfer API
// Documentation: https://developer.chapa.co/

import type { BankInfo } from "../types";

export interface ChapaInitPayload {
  amount: string;
  currency: string;
  email: string;
  first_name: string;
  last_name: string;
  tx_ref: string;
  return_url: string;
  callback_url: string;
  "customization[title]"?: string;
  "customization[description]"?: string;
}

export interface ChapaTransferPayload {
  account_name: string;
  account_number: string;
  amount: string;
  currency: string;
  reference: string;
  bank_code: string;
}

export interface ChapaTransferResponseData {
  id?: string;
  transfer_id?: string;
  status?: string;
  amount?: string | number;
  currency?: string;
  reference?: string;
  [key: string]: unknown;
}

export class ChapaClient {
  private secretKey: string;
  private baseUrl: string;

  constructor(secretKey?: string, baseUrl = "https://api.chapa.co/v1") {
    this.secretKey = secretKey || process.env.CHAPA_SECRET_KEY || "";
    this.baseUrl = baseUrl;
  }

  private getHeaders(): HeadersInit {
    if (!this.secretKey) {
      throw new Error("CHAPA_SECRET_KEY is not configured");
    }
    return {
      Authorization: `Bearer ${this.secretKey}`,
      "Content-Type": "application/json",
    };
  }

  /**
   * POST /v1/transaction/initialize
   */
  async initializeTransaction(payload: ChapaInitPayload): Promise<{
    status: string;
    message: string;
    data?: { checkout_url: string };
  }> {
    const res = await fetch(`${this.baseUrl}/transaction/initialize`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    });

    const body = await res.json();
    if (!res.ok) {
      console.error("[ChapaClient] Transaction initialization failed:", body.message ?? body);
    }
    return body;
  }

  /**
   * GET /v1/transaction/verify/:tx_ref
   */
  async verifyTransaction(txRef: string): Promise<{
    status: string;
    message: string;
    data?: {
      status: string;
      amount: string | number;
      currency: string;
      reference?: string;
      tx_ref?: string;
      email?: string;
      first_name?: string;
      last_name?: string;
    };
  }> {
    const res = await fetch(`${this.baseUrl}/transaction/verify/${encodeURIComponent(txRef)}`, {
      method: "GET",
      headers: this.getHeaders(),
    });

    const body = await res.json();
    return body;
  }

  /**
   * POST /v1/transfers
   * Chapa Transfer API for bulk or single bank payouts.
   */
  async initializeTransfer(payload: ChapaTransferPayload): Promise<{
    status: string;
    message: string;
    data?: ChapaTransferResponseData;
  }> {
    const res = await fetch(`${this.baseUrl}/transfers`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    });

    const body = await res.json();
    return body;
  }

  /**
   * GET /v1/transfers/verify/:reference
   */
  async verifyTransfer(reference: string): Promise<{
    status: string;
    message: string;
    data?: ChapaTransferResponseData;
  }> {
    const res = await fetch(`${this.baseUrl}/transfers/verify/${encodeURIComponent(reference)}`, {
      method: "GET",
      headers: this.getHeaders(),
    });

    const body = await res.json();
    return body;
  }

  /**
   * GET /v1/banks
   * List supported Ethiopian banks for transfer payouts.
   */
  async getBanks(): Promise<BankInfo[]> {
    try {
      const res = await fetch(`${this.baseUrl}/banks`, {
        method: "GET",
        headers: this.getHeaders(),
      });

      const body = await res.json();
      if (body.data && Array.isArray(body.data)) {
        return body.data.map((b: Record<string, unknown>) => ({
          id: String(b.id),
          name: String(b.name || ""),
          slug: b.slug ? String(b.slug) : undefined,
          code: String(b.code || b.acct_length || b.id),
          country: b.country_id ? String(b.country_id) : undefined,
          currency: b.currency ? String(b.currency) : "ETB",
        }));
      }
      return [];
    } catch (err) {
      console.error("[ChapaClient] Failed to fetch bank list:", err);
      // Fallback standard Ethiopian banks for test environment
      return [
        { id: "1", name: "Commercial Bank of Ethiopia (CBE)", code: "cbe" },
        { id: "2", name: "Telebirr", code: "telebirr" },
        { id: "3", name: "Awash Bank", code: "awash" },
        { id: "4", name: "Bank of Abyssinia", code: "abyssinia" },
        { id: "5", name: "Dashen Bank", code: "dashen" },
      ];
    }
  }
}
