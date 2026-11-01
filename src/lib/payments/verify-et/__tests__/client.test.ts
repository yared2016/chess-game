// src/lib/payments/verify-et/__tests__/client.test.ts
import { describe, expect, test, vi, beforeEach } from "vitest";
import {
  tokenizeName,
  matchSenderName,
  normalizePhoneOrAccount,
  matchPhoneNumber,
  matchReceiver,
  OFFICIAL_RECEIVER_NAME,
  OFFICIAL_RECEIVER_PHONE,
  normalizeVerifyEtBank,
  verifyTransactionWithVerifyEt,
} from "../client";

describe("Verify.et Client Adapter", () => {
  beforeEach(() => {
    process.env.VERIFY_ET_API_KEY = "test_verify_et_api_key_valid";
  });
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
    expect(matchPhoneNumber("0933074790", "2519****4790")).toBe(true);

    // Mismatches
    expect(matchPhoneNumber("+251958588585", "2519****4790")).toBe(false);
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

  test("verifyTransactionWithVerifyEt extracts payerTelebirrNo from bankSpecific", async () => {
    const mockTelebirrResponse = {
      success: true,
      message: "Verification completed.",
      data: [
        {
          bank: "telebirr",
          status: "success",
          verified: true,
          amount: 1496,
          currency: "ETB",
          senderName: "Yared Fikadu Bekele",
          referenceNumber: "DJN888R5XW",
          bankSpecific: {
            payerTelebirrNo: "2519****4790",
            senderAccount: "2519****4790",
            payerName: "Yared Fikadu Bekele",
          },
        },
      ],
      verification: {
        status: "success",
        verified: true,
        result: {
          amount: 1496,
          status: "success",
          verified: true,
        },
      },
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockTelebirrResponse,
    });

    const result = await verifyTransactionWithVerifyEt({
      bank: "telebirr",
      reference: "DJN888R5XW",
      amount: 1496,
      phone: "0933074790",
    });

    expect(result.verified).toBe(true);
    expect(result.status).toBe("completed");
    expect(result.senderPhone).toBe("2519****4790");
    expect(matchPhoneNumber("0933074790", result.senderPhone)).toBe(true);
    expect(matchPhoneNumber("+251958588585", result.senderPhone)).toBe(false);
  });

  test("matchReceiver strictly verifies official Abay Chess recipient", () => {
    // Official telebirr / cbebirr receiver: 0987678228 / Yared Tekleye
    expect(matchReceiver("telebirr", "Yared Tekleye", "0987678228").isMatch).toBe(true);
    expect(matchReceiver("telebirr", "Yared Tekleye Bekele", "2519****8228").isMatch).toBe(true);
    expect(matchReceiver("telebirr", "Abay Chess", "0987678228").isMatch).toBe(true);
    expect(matchReceiver("cbebirr", "Yared Tekleye", "0987678228").isMatch).toBe(true);

    // Official CBE Bank receiver: 1000456789123 / Yared Tekleye
    expect(matchReceiver("cbe", "Yared Tekleye", "1000456789123").isMatch).toBe(true);
    expect(matchReceiver("cbe", "Yared Tekleye", "1000****9123").isMatch).toBe(true);

    // Reject scammers transferring to other individuals
    const badReceiverName = matchReceiver("telebirr", "Michael Temesgen Mekonen", "0987678228");
    expect(badReceiverName.isMatch).toBe(false);
    expect(badReceiverName.reason).toContain("Yared Tekleye");

    const badReceiverAccount = matchReceiver("telebirr", "Yared Tekleye", "2519****7532");
    expect(badReceiverAccount.isMatch).toBe(false);
    expect(badReceiverAccount.reason).toContain("0987678228");

    const bothMismatched = matchReceiver("telebirr", "Michael Temesgen Mekonen", "2519****7532");
    expect(bothMismatched.isMatch).toBe(false);
  });

  test("verifyTransactionWithVerifyEt extracts net settled amount and receiver details from payload", async () => {
    const payloadWithFee = {
      success: true,
      data: [
        {
          bank: "telebirr",
          status: "success",
          verified: true,
          amount: 1000,
          receiverName: "Yared Tekleye",
          receiverAccount: "2519****8228",
          referenceNumber: "TX_NET_1000",
          bankSpecific: {
            payerTelebirrNo: "2519****4790",
            receiverName: "Yared Tekleye",
            receiverAccount: "2519****8228",
            settledAmountValue: 1000,
            amountValue: 1000,
            totalPaidAmountValue: 1005, // 1000 + 5 birr provider fee
          },
        },
      ],
      verification: {
        status: "success",
        verified: true,
        result: {
          amount: 1000,
          status: "success",
          verified: true,
        },
      },
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => payloadWithFee,
    });

    const result = await verifyTransactionWithVerifyEt({
      bank: "telebirr",
      reference: "TX_NET_1000",
      amount: 1000,
    });

    expect(result.verified).toBe(true);
    expect(result.amount).toBe(1000);
    expect(result.settledAmount).toBe(1000);
    expect(result.totalPaidAmount).toBe(1005);
    expect(result.receiverName).toBe("Yared Tekleye");
    expect(result.receiverAccount).toBe("2519****8228");

    const receiverMatch = matchReceiver("telebirr", result.receiverName, result.receiverAccount);
    expect(receiverMatch.isMatch).toBe(true);
  });
});
