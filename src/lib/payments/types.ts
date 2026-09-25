// src/lib/payments/types.ts — Provider-agnostic payment gateway abstraction

import type { DepositFeeCalculation, WithdrawalFeeCalculation } from "./money";

export type PaymentStatus = "pending" | "success" | "failed" | "cancelled" | "expired";
export type TransferStatus = "pending" | "completed" | "failed" | "rejected";

export interface PaymentInitRequest {
  internalTxRef: string;
  amountEtb: number;
  currency: string; // "ETB"
  email: string;
  firstName: string;
  lastName: string;
  returnUrl: string;
  callbackUrl: string;
  title?: string;
  description?: string;
}

export interface PaymentInitResponse {
  success: boolean;
  checkoutUrl?: string;
  providerTxId?: string;
  error?: string;
}

export interface PaymentVerifyResult {
  status: PaymentStatus;
  providerTxId?: string;
  internalTxRef: string;
  amountEtb?: number;
  currency?: string;
  rawResponse?: Record<string, unknown>;
  error?: string;
}

export interface TransferInitRequest {
  internalTransferRef: string;
  amountEtb: number;
  currency: string;
  bankCode: string;
  accountNumber: string;
  accountHolderName: string;
  beneficiaryEmail?: string;
}

export interface TransferInitResponse {
  success: boolean;
  providerTransferId?: string;
  status: TransferStatus;
  error?: string;
}

export interface TransferVerifyResult {
  status: TransferStatus;
  providerTransferId?: string;
  internalTransferRef: string;
  amountEtb?: number;
  error?: string;
  rawResponse?: Record<string, unknown>;
}

export interface BankInfo {
  id: string;
  name: string;
  slug?: string;
  code: string;
  country?: string;
  currency?: string;
}

export interface PaymentWebhookEvent {
  event: string;
  txRef: string;
  status: PaymentStatus;
  providerTxId?: string;
  amountEtb?: number;
  currency?: string;
  rawBody: string;
}

/**
 * Pluggable Payment Provider Interface.
 * Allows Chapa, ArifPay, SantimPay or any future provider to be plugged
 * in without rewriting internal wallet, match, or ledger logic.
 */
export interface PaymentProvider {
  readonly id: string;
  readonly name: string;

  // Deposit flow
  calculateDepositFee(creditSantims: number): DepositFeeCalculation;
  initializePayment(req: PaymentInitRequest): Promise<PaymentInitResponse>;
  verifyPayment(txRef: string): Promise<PaymentVerifyResult>;
  verifyWebhookSignature(
    rawBody: string,
    headers: Headers | Record<string, string | undefined> | string
  ): boolean;
  parseWebhookEvent(rawBody: string): PaymentWebhookEvent | null;

  // Withdrawal / Transfer flow
  calculateWithdrawalFee(receiveSantims: number): WithdrawalFeeCalculation;
  initializeTransfer(req: TransferInitRequest): Promise<TransferInitResponse>;
  verifyTransfer(transferRef: string): Promise<TransferVerifyResult>;
  getSupportedBanks(): Promise<BankInfo[]>;
}
