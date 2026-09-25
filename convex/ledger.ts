// convex/ledger.ts — Authoritative Immutable Financial Ledger
import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { requireAdmin, requirePlayer, optionalPlayer } from "./lib/auth";
import { vLedgerEntryType } from "./lib/validators";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";

export interface PostEntryArgs {
  userId: Id<"players">;
  walletId: Id<"wallets">;
  entryType:
    | "deposit_credit"
    | "deposit_fee"
    | "chapa_vat"
    | "match_lock"
    | "match_unlock"
    | "match_payout"
    | "match_loss"
    | "platform_commission"
    | "withdrawal_reserve"
    | "withdrawal_fee"
    | "withdrawal_complete"
    | "withdrawal_reversal"
    | "admin_adjustment";
  amountSantims: number;
  balanceAfterSantims: number;
  lockedAfterSantims: number;
  referenceType: "deposit" | "withdrawal" | "match" | "admin" | "system";
  referenceId: string;
  idempotencyKey: string;
  description: string;
  metadata?: string;
  now?: number;
}

/**
 * Low-level atomic ledger posting helper.
 * Enforces idempotency via idempotencyKey index.
 */
export async function postLedgerEntry(
  ctx: MutationCtx,
  args: PostEntryArgs
): Promise<Id<"financialLedger">> {
  const existing = await ctx.db
    .query("financialLedger")
    .withIndex("by_idempotencyKey", (q) => q.eq("idempotencyKey", args.idempotencyKey))
    .unique();

  if (existing) {
    return existing._id;
  }

  const now = args.now ?? Date.now();
  return await ctx.db.insert("financialLedger", {
    userId: args.userId,
    walletId: args.walletId,
    entryType: args.entryType,
    amountSantims: args.amountSantims,
    balanceAfterSantims: args.balanceAfterSantims,
    lockedAfterSantims: args.lockedAfterSantims,
    referenceType: args.referenceType,
    referenceId: args.referenceId,
    idempotencyKey: args.idempotencyKey,
    description: args.description,
    metadata: args.metadata,
    createdAt: now,
  });
}

/**
 * Query user's own ledger history (immutable transaction records).
 */
export const myLedger = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const player = await optionalPlayer(ctx);
    if (!player) return [];
    const limit = args.limit ?? 50;

    return await ctx.db
      .query("financialLedger")
      .withIndex("by_userId", (q) => q.eq("userId", player._id))
      .order("desc")
      .take(limit);
  },
});

/**
 * Admin query for ledger exploration with filtering.
 */
export const adminLedger = query({
  args: {
    userId: v.optional(v.id("players")),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const limit = args.limit ?? 100;

    if (args.userId) {
      return await ctx.db
        .query("financialLedger")
        .withIndex("by_userId", (q) => q.eq("userId", args.userId!))
        .order("desc")
        .take(limit);
    }

    return await ctx.db
      .query("financialLedger")
      .withIndex("by_createdAt")
      .order("desc")
      .take(limit);
  },
});
