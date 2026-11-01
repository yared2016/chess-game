// convex/financial/channels.ts
// Payment Channel Configuration & Governance for Abay Chess v4.2.7-PROD
// Enforces channel status, operating limits, and OD-04 (CBE Birr Disabled).

import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { requireOwner, requireAdmin, AnyCtx } from "../lib/auth";
import {
  vPaymentChannelKey,
  vChannelStatus,
} from "./validators";

export type PaymentChannelKey = "telebirr" | "cbe_a2a" | "cbe_birr";

/**
 * Asserts that a channel is active and permitted for the requested direction.
 * Throws explicit error if channel is disabled (e.g. CBE Birr under OD-04) or in maintenance.
 */
export async function assertChannelActive(
  ctx: AnyCtx,
  channelKey: PaymentChannelKey,
  operation: "inflow" | "outflow"
): Promise<void> {
  // OD-04 / RB-49: CBE Birr channel is strictly disabled
  if (channelKey === "cbe_birr") {
    throw new Error("ERR_CHANNEL_DISABLED: CBE Birr channel is disabled pending official documentation (OD-04).");
  }

  const channel = await ctx.db
    .query("paymentChannels")
    .withIndex("by_channelKey", (q) => q.eq("channelKey", channelKey))
    .unique();

  if (!channel) {
    // If not seeded yet, fallback to known status
    if (channelKey === "telebirr" || channelKey === "cbe_a2a") {
      return;
    }
    throw new Error(`ERR_CHANNEL_NOT_FOUND: Payment channel ${channelKey} is not registered.`);
  }

  if (channel.status === "disabled") {
    throw new Error(`ERR_CHANNEL_DISABLED: Payment channel ${channelKey} is disabled.`);
  }

  if (channel.status === "maintenance") {
    throw new Error(`ERR_CHANNEL_MAINTENANCE: Payment channel ${channelKey} is temporarily undergoing maintenance.`);
  }

  if (operation === "inflow" && !channel.inflowEnabled) {
    throw new Error(`ERR_CHANNEL_INFLOW_DISABLED: Inbound deposits are currently disabled for ${channelKey}.`);
  }

  if (operation === "outflow" && !channel.outflowEnabled) {
    throw new Error(`ERR_CHANNEL_OUTFLOW_DISABLED: Outbound withdrawals are currently disabled for ${channelKey}.`);
  }
}

/** Seed payment channels master record with official status and limits. */
export const seedPaymentChannels = mutation({
  args: {},
  handler: async (ctx) => {
    await requireOwner(ctx);
    const now = Date.now();

    const channelsToSeed = [
      {
        channelKey: "telebirr" as const,
        displayName: "Telebirr Mobile Money",
        status: "active" as const,
        inflowEnabled: true,
        outflowEnabled: true,
        supportsAutomation: true,
        minDepositSantims: BigInt(1000),      // 10.00 ETB
        maxDepositSantims: BigInt(1000000),   // 10,000.00 ETB
        minWithdrawalSantims: BigInt(5000),   // 50.00 ETB
        maxWithdrawalSantims: BigInt(5000000),// 50,000.00 ETB (OD-10)
        updatedAt: now,
      },
      {
        channelKey: "cbe_a2a" as const,
        displayName: "Commercial Bank of Ethiopia (Account-to-Account)",
        status: "active" as const,
        inflowEnabled: true,
        outflowEnabled: true,
        supportsAutomation: false, // Manual disbursement with CBS voucher verification
        minDepositSantims: BigInt(1000),      // 10.00 ETB
        maxDepositSantims: BigInt(10000000),  // 100,000.00 ETB
        minWithdrawalSantims: BigInt(5000),   // 50.00 ETB
        maxWithdrawalSantims: BigInt(5000000),// 50,000.00 ETB (OD-10)
        updatedAt: now,
      },
      {
        channelKey: "cbe_birr" as const,
        displayName: "CBE Birr (Disabled per OD-04)",
        status: "disabled" as const, // Strictly disabled (OD-04)
        inflowEnabled: false,
        outflowEnabled: false,
        supportsAutomation: false,
        minDepositSantims: BigInt(0),
        maxDepositSantims: BigInt(0),
        minWithdrawalSantims: BigInt(0),
        maxWithdrawalSantims: BigInt(0),
        updatedAt: now,
      },
    ];

    let inserted = 0;
    for (const c of channelsToSeed) {
      const existing = await ctx.db
        .query("paymentChannels")
        .withIndex("by_channelKey", (q) => q.eq("channelKey", c.channelKey))
        .unique();

      if (!existing) {
        await ctx.db.insert("paymentChannels", c);
        inserted++;
      } else {
        await ctx.db.patch(existing._id, c);
      }
    }

    return { total: channelsToSeed.length, newlyInserted: inserted };
  },
});

/** Query list of payment channels and their current availability. */
export const listPaymentChannels = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("paymentChannels").collect();
  },
});
