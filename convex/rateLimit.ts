import { mutation, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { checkRateLimit, RateLimitConfig } from "./lib/rateLimit";

export const checkAndConsume = mutation({
  args: {
    identifier: v.string(),
    limit: v.number(),
    windowMs: v.number(),
  },
  handler: async (ctx, args) => {
    return await checkRateLimit(ctx, args.identifier, {
      limit: args.limit,
      windowMs: args.windowMs,
    });
  },
});

/**
 * Helper that checks and consumes a rate limit.
 * Throws an error if the limit is exceeded.
 */
export async function withRateLimit(
  ctx: MutationCtx,
  userId: string,
  action: string,
  config: RateLimitConfig
): Promise<void> {
  const identifier = `${action}:${userId}`;
  const result = await checkRateLimit(ctx, identifier, config);
  if (!result.allowed) {
    throw new Error("rate-limit-exceeded");
  }
}
