// src/lib/payments/verify-et/__tests__/client.test.ts
import { describe, expect, test, vi } from "vitest";
import {
  tokenizeName,
  matchSenderName,
  normalizePhoneOrAccount,
  matchPhoneNumber,
  normalizeVerifyEtBank,
  verifyTransactionWithVerifyEt,
} from "../client";

describe("Verify.et Client Adapter", () => {
  test("normalizeVerifyEtBank maps channels to Verify.et identifiers", () => {
    expect(normalizeVerifyEtBank("telebirr")).toBe("telebirr");
    expect(normalizeVerifyEtBank("Telebirr")).toBe("telebirr");
    expect(normalizeVerifyEtBank("cbe_bank")).toBe("cbe");
    expect(normalizeVerifyEtBank("cbe")).toBe("cbe");
    expect(normalizeVerifyEtBank("cbe_birr")).toBe("cbebirr");
    expect(normalizeVerifyEtBank("cbebirr")).toBe("cbebirr");
    expect(normalizeVerifyEtBank("BOA")).toBe("boa");
  });

  test("tokenizeName extracts clean multi-token words", () => {
    expect(tokenizeName("Abebe Bikila Kebede")).toEqual(["abebe", "bikila", "kebede"]);
    expect(tokenizeName("Yared Fikadu")).toEqual(["yared", "fikadu"]);
  });

  test("matchSenderName handles fuzzy matches correctly", () => {
    expect(matchSenderName("Yared Fikadu", "Yared Fikadu Tekleye")).toBe(true);
    expect(matchSenderName("Yared Fikadu", "Tekleye Yared Fikadu")).toBe(true);
    expect(matchSenderName("Yared Fikadu", "Solomon Abebe")).toBe(false);
    expect(matchSenderName("Yared Fikadu", undefined)).toBe(true); // Graceful when bank doesn't expose name
  });

  test("normalizePhoneOrAccount strips country code and leading zeros for Ethiopian numbers", () => {
    expect(normalizePhoneOrAccount("0933074790")).toBe("933074790");
    expect(normalizePhoneOrAccount("+251933074790")).toBe("933074790");
    expect(normalizePhoneOrAccount("251933074790")).toBe("933074790");
    expect(normalizePhoneOrAccount("0712345678")).toBe("712345678");
    expect(normalizePhoneOrAccount("1000456789123")).toBe("1000456789123");
  });

  test("matchPhoneNumber matches various Ethiopian phone formats and masks", () => {
    // Exact formats
    expect(matchPhoneNumber("0933074790", "0933074790")).toBe(true);
    expect(matchPhoneNumber("0933074790", "+251933074790")).toBe(true);
    expect(matchPhoneNumber("+251933074790", "0933074790")).toBe(true);
    expect(matchPhoneNumber("0933074790", "251933074790")).toBe(true);

    // Masked bank representations (e.g. 0933****90)
    expect(matchPhoneNumber("0933074790", "0933****90")).toBe(true);
    expect(matchPhoneNumber("0933074790", "251933***790")).toBe(true);

    // Mismatches
    expect(matchPhoneNumber("0933074790", "0911223344")).toBe(false);
    expect(matchPhoneNumber("0933074790", "0912****90")).toBe(false);

    // Bank account numbers
    expect(matchPhoneNumber("1000456789123", "1000456789123")).toBe(true);
    expect(matchPhoneNumber("1000456789123", "456789123")).toBe(true);
  });

  test("verifyTransactionWithVerifyEt strictly rejects not_found responses", async () => {
    // Mock fetch returning Verify.et not_found payload (exact format from real API)
    const mockNotFoundResponse = {
      success: false,
      message: "No Telebirr transaction found.",
      data: [
        {
          bank: "telebirr",
          status: "not_found",
          verified: false,
          transactionNumber: "DJD3R2PK30",
        },
      ],
      error: { code: "not_found", message: "No Telebirr transaction found.", retryable: false },
      verification: {
        processingStatus: "completed",
        status: "not_found",
        verified: false,
      },
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockNotFoundResponse,
    });

    const result = await verifyTransactionWithVerifyEt({
      bank: "telebirr",
      reference: "DJD3R2PK30",
      amount: 1000,
    });

    expect(result.verified).toBe(false);
    expect(result.success).toBe(false);
    expect(result.status).toBe("not_found");
    expect(result.amount).toBeUndefined();
    expect(result.message).toContain("No Telebirr transaction found");
  });

  test("verifyTransactionWithVerifyEt strictly rejects queued 202 responses without completion", async () => {
    const mockQueuedResponse = {
      success: true,
      message: "Verification queued.",
      data: [],
      requestId: "mock-req-123",
      verification: {
        requestId: "mock-req-123",
        bank: "telebirr",
        processingStatus: "queued",
        status: "pending",
        verified: false,
      },
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 202,
      json: async () => mockQueuedResponse,
    });

    const result = await verifyTransactionWithVerifyEt({
      bank: "telebirr",
      reference: "PENDING_REF",
      amount: 500,
    });

    expect(result.verified).toBe(false);
    expect(result.status).toBe("processing");
  });

  test("verifyTransactionWithVerifyEt accepts verified responses with valid positive amounts", async () => {
    const mockSuccessResponse = {
      success: true,
      status: "verified",
      data: {
        amount: 1000.0,
        currency: "ETB",
        sender: "Yared Fikadu",
        phoneNumber: "0933074790",
        provider: "telebirr",
        verified: true,
        status: "verified",
      },
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockSuccessResponse,
    });

    const result = await verifyTransactionWithVerifyEt({
      bank: "telebirr",
      reference: "REAL_TX_001",
      amount: 1000,
    });

    expect(result.verified).toBe(true);
    expect(result.success).toBe(true);
    expect(result.status).toBe("completed");
    expect(result.amount).toBe(1000);
    expect(result.senderName).toBe("Yared Fikadu");
    expect(result.senderPhone).toBe("0933074790");
  });
});
