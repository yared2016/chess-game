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
    this.secretKey =
      secretKey || process.env.CHAPA_SECRET_KEY || "CHASECK_TEST-7HfqijyE7K2Vuej6AKjDRpvN7cCt31hT";
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
   * Chapa Transfer API for single bank payouts.
   */
  async initializeTransfer(payload: ChapaTransferPayload): Promise<{
    status: string;
    message: unknown;
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
    message: unknown;
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
   * Note: In Chapa Transfer API, bank_code must be the bank's numeric ID (e.g. 946 for CBE, 855 for Telebirr).
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
          // Authoritative: Chapa transfers require the numeric bank ID as bank_code
          code: String(b.id),
          country: b.country_id ? String(b.country_id) : undefined,
          currency: b.currency ? String(b.currency) : "ETB",
          acctLength: typeof b.acct_length === "number" ? b.acct_length : undefined,
        }));
      }
      return [];
    } catch (err) {
      console.error("[ChapaClient] Failed to fetch bank list:", err);
      // Fallback authoritative Ethiopian banks from Chapa API
      return [
        { id: "855", name: "telebirr", code: "855", slug: "telebirr", acctLength: 10 },
        { id: "946", name: "Commercial Bank of Ethiopia (CBE)", code: "946", slug: "cbe_bank", acctLength: 13 },
        { id: "128", name: "CBEBirr", code: "128", slug: "cbebirr", acctLength: 10 },
        { id: "836", name: "Cooperative Bank of Oromia (COOP)", code: "836", slug: "coop_bank", acctLength: 13 },
        { id: "534", name: "Hibret Bank", code: "534", slug: "hibret_bank", acctLength: 16 },
        { id: "266", name: "M-Pesa", code: "266", slug: "mpesa", acctLength: 10 },
        { id: "867", name: "YaYaWallet", code: "867", slug: "yaya", acctLength: 12 },
        { id: "687", name: "Zemen Bank", code: "687", slug: "zemen_bank", acctLength: 16 },
      ];
    }
  }
}
