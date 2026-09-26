// convex/financial/reconciliation.ts — Automated reconciliation for stuck withdrawals
import { v } from "convex/values";
import { internalAction, internalMutation, internalQuery, mutation, query } from "../_generated/server";
import { internal } from "../_generated/api";

/**
 * Sweeps all pending/reserved withdrawals and reconciles them.
 * Run automatically every minute by convex/crons.ts.
 */
export const reconcilePendingWithdrawals = internalAction({
  args: {},
  handler: async (ctx) => {
    // 1. Fetch stuck/pending withdrawals via internal query
    const pending = await ctx.runQuery(internal.financial.reconciliation.getPendingForReconciliation, {});
    const now = Date.now();
    const chapaSecretKey =
      process.env.CHAPA_SECRET_KEY || "CHASECK_TEST-7HfqijyE7K2Vuej6AKjDRpvN7cCt31hT";

    for (const wdr of pending) {
      const ageMs = now - wdr.createdAt;

      // Case A: Stuck in "reserved" without providerTransferId for > 5 minutes
      // (means API process crashed or disconnected before Chapa call)
      if (wdr.status === "reserved" && !wdr.providerTransferId && ageMs > 5 * 60 * 1000) {
        console.log(`[Reconciliation] Auto-releasing orphan reservation: ${wdr.internalTransferRef}`);
        await ctx.runMutation(internal.financial.reconciliation.releaseStuckReservation, {
          internalTransferRef: wdr.internalTransferRef,
          reason: "Reservation timed out before provider transfer was registered. Funds restored.",
        });
        continue;
      }

      // Case B: In "processing" or "reserved" with providerTransferId
      if (ageMs > 30 * 1000) {
        try {
          const res = await fetch(`https://api.chapa.co/v1/transfers/verify/${wdr.internalTransferRef}`, {
            method: "GET",
            headers: {
              Authorization: `Bearer ${chapaSecretKey}`,
              "Content-Type": "application/json",
            },
          });

          if (!res.ok && res.status !== 404) {
            continue;
          }

          const data = await res.json();
          if (data && data.status === "success" && data.data) {
            const rawStatus = (data.data.status || "").toLowerCase();
            if (rawStatus === "success" || rawStatus === "completed") {
              console.log(`[Reconciliation] Finalizing completed withdrawal: ${wdr.internalTransferRef}`);
              await ctx.runMutation(internal.financial.reconciliation.completeWithdrawalInternal, {
                internalTransferRef: wdr.internalTransferRef,
                providerTransferId: data.data.id || wdr.providerTransferId,
              });
            } else if (rawStatus === "failed" || rawStatus === "rejected") {
              console.log(`[Reconciliation] Reversing failed withdrawal: ${wdr.internalTransferRef}`);
              await ctx.runMutation(internal.financial.reconciliation.failWithdrawalInternal, {
                internalTransferRef: wdr.internalTransferRef,
                reason: data.message || "Provider transfer failed",
              });
            }
          }
        } catch (fetchErr) {
          console.warn(`[Reconciliation] Error verifying transfer ${wdr.internalTransferRef}:`, fetchErr);
        }
      }
    }
  },
});

/**
 * Internal query to fetch active withdrawals requiring reconciliation.
 */
export const getPendingForReconciliation = internalQuery({
  args: {},
  handler: async (ctx) => {
    const reserved = await ctx.db
      .query("financialWithdrawals")
      .withIndex("by_status", (q) => q.eq("status", "reserved"))
      .take(20);

    const processing = await ctx.db
      .query("financialWithdrawals")
      .withIndex("by_status", (q) => q.eq("status", "processing"))
      .take(20);

    return [...reserved, ...processing];
  },
});

export const completeWithdrawalInternal = internalMutation({
  args: {
    internalTransferRef: v.string(),
    providerTransferId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const wdr = await ctx.db
      .query("financialWithdrawals")
      .withIndex("by_internalTransferRef", (q) => q.eq("internalTransferRef", args.internalTransferRef))
      .unique();

    if (!wdr || wdr.status === "completed") return;
    const wallet = await ctx.db.get(wdr.walletId);
    if (!wallet) return;

    const now = Date.now();
    const currentLockedSantims = wallet.lockedSantims ?? Math.round(wallet.lockedBalance * 100);
    const newLockedSantims = Math.max(0, currentLockedSantims - wdr.totalReservedSantims);

    await ctx.db.patch(wallet._id, {
      lockedSantims: newLockedSantims,
      lockedBalance: newLockedSantims / 100,
      totalWithdrawn: wallet.totalWithdrawn + wdr.requestedAmountSantims / 100,
      updatedAt: now,
    });

    await ctx.db.patch(wdr._id, {
      status: "completed",
      providerTransferId: args.providerTransferId ?? wdr.providerTransferId,
      completedAt: now,
      updatedAt: now,
    });
  },
});

export const failWithdrawalInternal = internalMutation({
  args: {
    internalTransferRef: v.string(),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const wdr = await ctx.db
      .query("financialWithdrawals")
      .withIndex("by_internalTransferRef", (q) => q.eq("internalTransferRef", args.internalTransferRef))
      .unique();

    if (!wdr || wdr.status === "completed" || wdr.status === "failed" || wdr.status === "reversed") return;
    const wallet = await ctx.db.get(wdr.walletId);
    if (!wallet) return;

    const now = Date.now();
    const currentAvailableSantims = wallet.availableSantims ?? Math.round(wallet.availableBalance * 100);
    const currentLockedSantims = wallet.lockedSantims ?? Math.round(wallet.lockedBalance * 100);

    const newLockedSantims = Math.max(0, currentLockedSantims - wdr.totalReservedSantims);
    const newAvailableSantims = currentAvailableSantims + wdr.totalReservedSantims;

    await ctx.db.patch(wallet._id, {
      availableSantims: newAvailableSantims,
      availableBalance: newAvailableSantims / 100,
      lockedSantims: newLockedSantims,
      lockedBalance: newLockedSantims / 100,
      updatedAt: now,
    });

    await ctx.db.patch(wdr._id, {
      status: "failed",
      failureReason: args.reason,
      updatedAt: now,
    });
  },
});

export const releaseStuckReservation = internalMutation({
  args: {
    internalTransferRef: v.string(),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const wdr = await ctx.db
      .query("financialWithdrawals")
      .withIndex("by_internalTransferRef", (q) => q.eq("internalTransferRef", args.internalTransferRef))
      .unique();

    if (!wdr || wdr.status !== "reserved") return;
    const wallet = await ctx.db.get(wdr.walletId);
    if (!wallet) return;

    const now = Date.now();
    const currentAvailableSantims = wallet.availableSantims ?? Math.round(wallet.availableBalance * 100);
    const currentLockedSantims = wallet.lockedSantims ?? Math.round(wallet.lockedBalance * 100);

    const newLockedSantims = Math.max(0, currentLockedSantims - wdr.totalReservedSantims);
    const newAvailableSantims = currentAvailableSantims + wdr.totalReservedSantims;

    await ctx.db.patch(wallet._id, {
      availableSantims: newAvailableSantims,
      availableBalance: newAvailableSantims / 100,
      lockedSantims: newLockedSantims,
      lockedBalance: newLockedSantims / 100,
      updatedAt: now,
    });

    await ctx.db.patch(wdr._id, {
      status: "reversed",
      failureReason: args.reason,
      updatedAt: now,
    });
  },
});
