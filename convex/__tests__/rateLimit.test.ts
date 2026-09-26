import { describe, expect, test, vi, beforeEach, afterEach } from "vitest";
import { api } from "../_generated/api";
import { makeTest } from "./harness.setup";

describe("rate limiting", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("allows requests within limit and blocks over limit", async () => {
    const t = makeTest();

    // Initial request - should be allowed
    const res1 = await t.mutation(api.rateLimit.checkAndConsume, {
      identifier: "test_identifier",
      limit: 2,
      windowMs: 1000,
    });
    expect(res1.allowed).toBe(true);

    // Second request - should be allowed (limit is 2)
    const res2 = await t.mutation(api.rateLimit.checkAndConsume, {
      identifier: "test_identifier",
      limit: 2,
      windowMs: 1000,
    });
    expect(res2.allowed).toBe(true);

    // Third request - should be blocked
    const res3 = await t.mutation(api.rateLimit.checkAndConsume, {
      identifier: "test_identifier",
      limit: 2,
      windowMs: 1000,
    });
    expect(res3.allowed).toBe(false);
    expect(res3.retryAfterMs).toBeGreaterThan(0);
    expect(res3.retryAfterMs).toBeLessThanOrEqual(1000);
  });

  test("resets counter after window expiry", async () => {
    const t = makeTest();

    // Consume all tokens
    await t.mutation(api.rateLimit.checkAndConsume, {
      identifier: "test_identifier_2",
      limit: 1,
      windowMs: 1000,
    });

    // Verify blocked
    const blockedRes = await t.mutation(api.rateLimit.checkAndConsume, {
      identifier: "test_identifier_2",
      limit: 1,
      windowMs: 1000,
    });
    expect(blockedRes.allowed).toBe(false);

    // Fast-forward time past window
    vi.advanceTimersByTime(1100);

    // Should be allowed again
    const allowedRes = await t.mutation(api.rateLimit.checkAndConsume, {
      identifier: "test_identifier_2",
      limit: 1,
      windowMs: 1000,
    });
    expect(allowedRes.allowed).toBe(true);
  });

  test("different identifiers do not interfere", async () => {
    const t = makeTest();

    // Consume all tokens for identifier 1
    await t.mutation(api.rateLimit.checkAndConsume, {
      identifier: "id1",
      limit: 1,
      windowMs: 1000,
    });

    // Identifier 1 should be blocked
    const res1 = await t.mutation(api.rateLimit.checkAndConsume, {
      identifier: "id1",
      limit: 1,
      windowMs: 1000,
    });
    expect(res1.allowed).toBe(false);

    // Identifier 2 should be allowed
    const res2 = await t.mutation(api.rateLimit.checkAndConsume, {
      identifier: "id2",
      limit: 1,
      windowMs: 1000,
    });
    expect(res2.allowed).toBe(true);
  });
});
