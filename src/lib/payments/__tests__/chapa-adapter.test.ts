// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { ChapaAdapter } from "../chapa/adapter";
import { ChapaClient } from "../chapa/client";
import { createHmac } from "node:crypto";

describe("ChapaAdapter HMAC Webhook Signature Verification", () => {
  const secretKey = "test-secret-key-123";
  const webhookSecret = "test-webhook-secret-456";
  const adapter = new ChapaAdapter({
    secretKey,
    publicKey: "test-public-key-789",
    webhookSecret,
  });

  it("verifies matching HMAC SHA256 signature against webhook secret", () => {
    const payload = JSON.stringify({ event: "charge.complete", tx_ref: "DEP-12345" });
    const signature = createHmac("sha256", webhookSecret).update(payload).digest("hex");

    expect(adapter.verifyWebhookSignature(payload, signature)).toBe(true);
  });

  it("verifies matching HMAC SHA256 signature against secret key fallback", () => {
    const payload = JSON.stringify({ event: "charge.complete", tx_ref: "DEP-12345" });
    const signature = createHmac("sha256", secretKey).update(payload).digest("hex");

    expect(adapter.verifyWebhookSignature(payload, signature)).toBe(true);
  });

  it("rejects tampered payload with invalid signature", () => {
    const payload = JSON.stringify({ event: "charge.complete", tx_ref: "DEP-12345" });
    const tamperedPayload = JSON.stringify({ event: "charge.complete", tx_ref: "DEP-HACKED" });
    const signature = createHmac("sha256", webhookSecret).update(payload).digest("hex");

    expect(adapter.verifyWebhookSignature(tamperedPayload, signature)).toBe(false);
  });

  it("rejects invalid signature string", () => {
    const payload = JSON.stringify({ event: "charge.complete" });
    expect(adapter.verifyWebhookSignature(payload, "invalid-hex-string")).toBe(false);
    expect(adapter.verifyWebhookSignature(payload, "")).toBe(false);
  });
});

describe("ChapaAdapter Webhook Parsing for Payouts", () => {
  const adapter = new ChapaAdapter({
    secretKey: "CHASECK_TEST-123",
    webhookSecret: "whsec-123",
  });

  it("parses payout.success webhook payload", () => {
    const raw = JSON.stringify({
      event: "payout.success",
      type: "Payout",
      reference: "WDR_12345",
      status: "success",
      amount: "500.00",
      currency: "ETB",
    });

    const parsed = adapter.parseWebhookEvent(raw);
    expect(parsed).not.toBeNull();
    expect(parsed?.status).toBe("success");
    expect(parsed?.txRef).toBe("WDR_12345");
    expect(parsed?.amountEtb).toBe(500);
  });

  it("parses payout.failed/cancelled webhook payload", () => {
    const raw = JSON.stringify({
      event: "payout.failed/cancelled",
      type: "Payout",
      reference: "WDR_99999",
      status: "failed",
      amount: "200.00",
      currency: "ETB",
    });

    const parsed = adapter.parseWebhookEvent(raw);
    expect(parsed).not.toBeNull();
    expect(parsed?.status).toBe("failed");
    expect(parsed?.txRef).toBe("WDR_99999");
  });
});

describe("ChapaAdapter Transfer Verification & Test Mode Handling", () => {
  it("resolves completed when Chapa test mode returns data: [null]", async () => {
    const mockClient = new ChapaClient("CHASECK_TEST-key");
    vi.spyOn(mockClient, "verifyTransfer").mockResolvedValue({
      message: "Transfer details (Test Mode)",
      status: "success",
      data: [null] as any,
    });

    const adapter = new ChapaAdapter({
      client: mockClient,
      secretKey: "CHASECK_TEST-key",
    });

    const result = await adapter.verifyTransfer("WDR_valid_test_123");
    expect(result.status).toBe("completed");
    expect(result.internalTransferRef).toBe("WDR_valid_test_123");
  });

  it("resolves failed when simulated failure account is tested", async () => {
    const mockClient = new ChapaClient("CHASECK_TEST-key");
    vi.spyOn(mockClient, "verifyTransfer").mockResolvedValue({
      message: "Transfer details (Test Mode)",
      status: "success",
      data: [null] as any,
    });

    const adapter = new ChapaAdapter({
      client: mockClient,
      secretKey: "CHASECK_TEST-key",
    });

    const result = await adapter.verifyTransfer("WDR_fail_test_456");
    expect(result.status).toBe("failed");
    expect(result.error).toContain("Simulated Test Mode Failure");
  });

  it("parses live mode object response with success status", async () => {
    const mockClient = new ChapaClient("CHASECK_LIVE_key");
    vi.spyOn(mockClient, "verifyTransfer").mockResolvedValue({
      message: "Transfer details",
      status: "success",
      data: {
        id: "tx-live-999",
        status: "success",
        amount: "1000",
        currency: "ETB",
      } as any,
    });

    const adapter = new ChapaAdapter({
      client: mockClient,
      secretKey: "CHASECK_LIVE_key",
    });

    const result = await adapter.verifyTransfer("WDR_live_123");
    expect(result.status).toBe("completed");
    expect(result.providerTransferId).toBe("tx-live-999");
    expect(result.amountEtb).toBe(1000);
  });

  it("parses live mode array response with failed status", async () => {
    const mockClient = new ChapaClient("CHASECK_LIVE_key");
    vi.spyOn(mockClient, "verifyTransfer").mockResolvedValue({
      message: "Transfer details",
      status: "success",
      data: [
        {
          id: "tx-live-888",
          status: "failed",
          amount: "500",
          currency: "ETB",
        },
      ] as any,
    });

    const adapter = new ChapaAdapter({
      client: mockClient,
      secretKey: "CHASECK_LIVE_key",
    });

    const result = await adapter.verifyTransfer("WDR_live_fail");
    expect(result.status).toBe("failed");
  });
});
