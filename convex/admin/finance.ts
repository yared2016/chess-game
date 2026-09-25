// convex/admin/finance.ts — Administrative financial command center and audit controls
import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { requireAdmin } from "../lib/auth";
import { vFeeMode } from "../lib/validators";

/**
 * Freeze a user's wallet. Blocks deposits, withdrawals, and match entries.
 */
export const freezeWallet = mutation({
  args: {
    targetUserId: v.id("players"),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const now = Date.now();

    const wallet = await ctx.db
      .query("wallets")
      .withIndex("by_userId", (q) => q.eq("userId", args.targetUserId))
      .unique();

    if (!wallet) throw new Error("wallet-not-found");

    await ctx.db.patch(wallet._id, {
      status: "frozen",
      freezeReason: args.reason,
      updatedAt: now,
    });

    await ctx.db.insert("financialAuditLogs", {
      adminId: admin._id,
      action: "freeze_wallet",
      targetUserId: args.targetUserId,
      reason: args.reason,
      createdAt: now,
    });

    return { success: true };
  },
});

/**
 * Unfreeze a user's wallet.
 */
export const unfreezeWallet = mutation({
  args: {
    targetUserId: v.id("players"),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const now = Date.now();

    const wallet = await ctx.db
      .query("wallets")
      .withIndex("by_userId", (q) => q.eq("userId", args.targetUserId))
      .unique();

    if (!wallet) throw new Error("wallet-not-found");

    await ctx.db.patch(wallet._id, {
      status: "active",
      freezeReason: undefined,
      updatedAt: now,
    });

    await ctx.db.insert("financialAuditLogs", {
      adminId: admin._id,
      action: "unfreeze_wallet",
      targetUserId: args.targetUserId,
      reason: args.reason,
      createdAt: now,
    });

    return { success: true };
  },
});

/**
 * Administrative Financial Dashboard Aggregates.
 */
export const financialOverview = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);

    const wallets = await ctx.db.query("wallets").collect();
    let totalAvailableSantims = 0;
    let totalLockedSantims = 0;
    let frozenCount = 0;

    for (const w of wallets) {
      totalAvailableSantims += w.availableSantims ?? Math.round(w.availableBalance * 100);
      totalLockedSantims += w.lockedSantims ?? Math.round(w.lockedBalance * 100);
      if (w.status === "frozen") frozenCount++;
    }

    const deposits = await ctx.db.query("financialDeposits").collect();
    let creditedDepositsSantims = 0;
    let providerFeeDepositsSantims = 0;
    let pendingDepositsCount = 0;
    let failedDepositsCount = 0;

    for (const d of deposits) {
      if (d.status === "credited") {
        creditedDepositsSantims += d.requestedCreditSantims;
        providerFeeDepositsSantims += d.providerFeeSantims;
      } else if (d.status === "pending_provider" || d.status === "verifying") {
        pendingDepositsCount++;
      } else if (d.status === "failed") {
        failedDepositsCount++;
      }
    }

    const withdrawals = await ctx.db.query("financialWithdrawals").collect();
    let completedWithdrawalsSantims = 0;
    let providerFeeWithdrawalsSantims = 0;
    let pendingWithdrawalsCount = 0;
    let failedWithdrawalsCount = 0;

    for (const w of withdrawals) {
      if (w.status === "completed") {
        completedWithdrawalsSantims += w.requestedAmountSantims;
        providerFeeWithdrawalsSantims += w.providerFeeSantims;
      } else if (w.status === "reserved" || w.status === "provider_submitted" || w.status === "provider_pending") {
        pendingWithdrawalsCount++;
      } else if (w.status === "failed" || w.status === "reversed") {
        failedWithdrawalsCount++;
      }
    }

    const commissions = await ctx.db.query("commissions").collect();
    const totalCommissionEtb = commissions.reduce((sum, c) => sum + c.amount, 0);

    const auditLogs = await ctx.db
      .query("financialAuditLogs")
      .withIndex("by_createdAt")
      .order("desc")
      .take(15);

    return {
      totalLiabilityEtb: totalAvailableSantims / 100,
      totalLockedEtb: totalLockedSantims / 100,
      totalDepositedEtb: creditedDepositsSantims / 100,
      totalWithdrawnEtb: completedWithdrawalsSantims / 100,
      totalCommissionEtb,
      totalProviderFeesEtb: (providerFeeDepositsSantims + providerFeeWithdrawalsSantims) / 100,
      pendingDepositsCount,
      failedDepositsCount,
      pendingWithdrawalsCount,
      failedWithdrawalsCount,
      frozenWalletsCount: frozenCount,
      recentAuditLogs: auditLogs,
    };
  },
});

/**
 * Administrative Financial Reconciliation Query.
 */
export const financialReconciliation = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const limit = args.limit ?? 50;

    const deposits = await ctx.db
      .query("financialDeposits")
      .withIndex("by_status")
      .order("desc")
      .take(limit);

    const withdrawals = await ctx.db
      .query("financialWithdrawals")
      .withIndex("by_status")
      .order("desc")
      .take(limit);

    return {
      deposits: deposits.map((d) => ({
        id: d._id,
        ref: d.internalTxRef,
        providerRef: d.providerTxId,
        creditEtb: d.requestedCreditSantims / 100,
        feeEtb: d.providerFeeSantims / 100,
        grossEtb: d.grossAmountSantims / 100,
        status: d.status,
        createdAt: d.createdAt,
      })),
      withdrawals: withdrawals.map((w) => ({
        id: w._id,
        ref: w.internalTransferRef,
        providerRef: w.providerTransferId,
        amountEtb: w.requestedAmountSantims / 100,
        feeEtb: w.providerFeeSantims / 100,
        status: w.status,
        bankName: w.bankName,
        createdAt: w.createdAt,
      })),
    };
  },
});
