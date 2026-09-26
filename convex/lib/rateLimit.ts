import { MutationCtx } from "../_generated/server";

export interface RateLimitConfig {
  /** Max requests allowed in the window */
  limit: number;
  /** Window duration in milliseconds */
  windowMs: number;
}

/**
 * Check and consume a rate limit token.
 * Returns { allowed: true } if under limit, { allowed: false, retryAfterMs } if over.
 * 
 * Uses a simple window counter stored in the rateLimits table.
 */
export async function checkRateLimit(
  ctx: MutationCtx,
  identifier: string,
  config: RateLimitConfig,
): Promise<{ allowed: boolean; retryAfterMs?: number }> {
  const now = Date.now();
  const existing = await ctx.db
    .query("rateLimits")
    .withIndex("by_key", (q) => q.eq("key", identifier))
    .first();

  if (!existing) {
    await ctx.db.insert("rateLimits", {
      key: identifier,
      windowStart: now,
      count: 1,
    });
    return { allowed: true };
  }

  if (now > existing.windowStart + config.windowMs) {
    // Window expired, reset
    await ctx.db.patch(existing._id, {
      windowStart: now,
      count: 1,
    });
    return { allowed: true };
  }

  if (existing.count >= config.limit) {
    const retryAfterMs = existing.windowStart + config.windowMs - now;
    return { allowed: false, retryAfterMs };
  }

  await ctx.db.patch(existing._id, {
    count: existing.count + 1,
  });

  return { allowed: true };
}
