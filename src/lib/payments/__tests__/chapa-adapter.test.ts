// @vitest-environment node
import { describe, expect, it } from "vitest";
import { ChapaAdapter } from "../chapa/adapter";
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
