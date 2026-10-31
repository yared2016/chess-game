// convex/deposits.ts
import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { requirePlayer, requireAdmin, optionalPlayer } from "./lib/auth";
import { MIN_DEPOSIT } from "./lib/constants";
import { vPayoutMethod, vVerificationMethod } from "./lib/validators";
import { createNotification } from "./notifications";
import { postLedgerEntry } from "./ledger";

const DEPOSIT_CODE_PREFIX = "ABAY";
const DEPOSIT_CODE_LENGTH = 6;

function generateCode() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  for (let i = 0; i < DEPOSIT_CODE_LENGTH; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `${DEPOSIT_CODE_PREFIX}-${result}`;
}

export const create = mutation({
  args: {
    amount: v.number(),
    paymentMethod: v.optional(vPayoutMethod),
    transactionReference: v.optional(v.string()),
    senderInfo: v.optional(v.string()),
    screenshotId: v.optional(v.id("_storage")),
    verificationMethod: v.optional(vVerificationMethod),
  },
  handler: async (ctx, args) => {
    const player = await requirePlayer(ctx);

    if (args.amount < MIN_DEPOSIT) {
      throw new Error(`Minimum deposit is ${MIN_DEPOSIT} ETB`);
    }

    const method = args.paymentMethod ?? "telebirr";

    const cleanRef = args.transactionReference?.trim();
    if (cleanRef) {
      const duplicate = await ctx.db
        .query("deposits")
        .filter((q) =>
          q.and(
            q.eq(q.field("transactionReference"), cleanRef),
            q.or(
              q.eq(q.field("status"), "pending"),
              q.eq(q.field("status"), "pending_review"),
              q.eq(q.field("status"), "approved"),
              q.eq(q.field("status"), "credited"),
            ),
          ),
        )
        .first();

      if (duplicate) {
        if (duplicate.status === "approved" || duplicate.status === "credited") {
          throw new Error("duplicate-reference");
        }
        if (duplicate.userId !== player._id) {
          throw new Error("duplicate-reference");
        }
        // Same user updating or retrying their pending deposit:
        // Safely update the pending record without duplicate crashes
        await ctx.db.patch(duplicate._id, {
          amount: args.amount,
          paymentMethod: method,
          senderInfo: args.senderInfo?.trim() || duplicate.senderInfo,
          screenshotId: args.screenshotId ?? duplicate.screenshotId,
          verificationMethod: args.verificationMethod ?? duplicate.verificationMethod,
        });
        return { code: duplicate.code, depositId: duplicate._id };
      }
    }

    let wallet = await ctx.db
      .query("wallets")
      .withIndex("by_userId", (q) => q.eq("userId", player._id))
      .unique();

    if (!wallet) {
      const now = Date.now();
      const walletId = await ctx.db.insert("wallets", {
        userId: player._id,
        availableBalance: 0,
        lockedBalance: 0,
        availableSantims: 0,
        lockedSantims: 0,
        totalDeposited: 0,
        totalWithdrawn: 0,
        totalWon: 0,
        totalLost: 0,
        createdAt: now,
        updatedAt: now,
      });
      wallet = await ctx.db.get(walletId);
    }

    let code = "";
    let isUnique = false;
    for (let i = 0; i < 20; i++) {
      code = generateCode();
      const existing = await ctx.db
        .query("deposits")
        .withIndex("by_code", (q) => q.eq("code", code))
        .first();
      if (!existing) {
        isUnique = true;
        break;
      }
    }

    if (!isUnique) throw new Error("deposit-code-failed");

    const depositId = await ctx.db.insert("deposits", {
      userId: player._id,
      walletId: wallet!._id,
      amount: args.amount,
      code,
      paymentMethod: method,
      transactionReference: cleanRef || undefined,
      senderInfo: args.senderInfo?.trim() || undefined,
      screenshotId: args.screenshotId,
      status: "pending_review",
      verificationMethod: args.verificationMethod ?? (args.screenshotId ? "manual" : "verify_et"),
      createdAt: Date.now(),
    });

    await createNotification(ctx, {
      userId: player._id,
      type: "deposit_submitted",
      title: "Deposit Submitted",
      message: `Your deposit request for ${args.amount} ETB (Ref: ${code}) has been received and is pending verification.`,
      link: `/wallet?tab=history&txId=${depositId}`,
    });

    return { code, depositId };
  },
});

export const uploadScreenshot = mutation({
  args: {
    depositId: v.id("deposits"),
    storageId: v.optional(v.id("_storage")),
    senderInfo: v.optional(v.string()),
    transactionReference: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const player = await requirePlayer(ctx);
    const deposit = await ctx.db.get(args.depositId);
    if (!deposit) throw new Error("deposit-not-found");
    if (deposit.userId !== player._id) throw new Error("unauthorized-deposit");

    const patchData: Record<string, any> = {};
    if (args.storageId) patchData.screenshotId = args.storageId;
    if (args.senderInfo !== undefined) patchData.senderInfo = args.senderInfo.trim() || undefined;
    if (args.transactionReference !== undefined) {
      patchData.transactionReference = args.transactionReference.trim() || undefined;
    }

    if (Object.keys(patchData).length > 0) {
      await ctx.db.patch(args.depositId, patchData);
    }
  },
});

export const approve = mutation({
  args: {
    depositId: v.id("deposits"),
    verificationNote: v.optional(v.string()),
    transactionReference: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const deposit = await ctx.db.get(args.depositId);
    if (!deposit) throw new Error("deposit-not-found");
    if (deposit.status !== "pending" && deposit.status !== "pending_review") {
      throw new Error("deposit-not-pending");
    }

    const wallet = await ctx.db.get(deposit.walletId);
    if (!wallet) throw new Error("wallet-not-found");

    const now = Date.now();
    const depositSantims = Math.round(deposit.amount * 100);
    const currentSantims =
      wallet.availableSantims ?? Math.round(wallet.availableBalance * 100);
    const newSantims = currentSantims + depositSantims;
    const lockedSantims =
      wallet.lockedSantims ?? Math.round((wallet.lockedBalance ?? 0) * 100);

    // Atomic ledger entry for auditability & idempotency
    await postLedgerEntry(ctx, {
      userId: deposit.userId,
      walletId: wallet._id,
      entryType: "deposit_credit",
      amountSantims: depositSantims,
      balanceAfterSantims: newSantims,
      lockedAfterSantims: lockedSantims,
      referenceType: "deposit",
      referenceId: deposit._id,
      idempotencyKey: `deposit_credit_${deposit._id}`,
      description: `Manual deposit verified & credited (${deposit.paymentMethod ?? "telebirr"})`,
      metadata: JSON.stringify({
        adminId: admin._id,
        code: deposit.code,
        transactionReference: args.transactionReference || deposit.transactionReference,
        verificationNote: args.verificationNote,
      }),
      now,
    });

    // Update deposit status atomically
    await ctx.db.patch(deposit._id, {
      status: "approved",
      reviewedBy: admin._id,
      reviewedAt: now,
      verificationNote: args.verificationNote?.trim() || deposit.verificationNote,
      transactionReference:
        args.transactionReference?.trim() || deposit.transactionReference,
    });

    // Update wallet available balance exactly by deposit amount
    await ctx.db.patch(wallet._id, {
      availableBalance: wallet.availableBalance + deposit.amount,
      availableSantims: newSantims,
      totalDeposited: (wallet.totalDeposited ?? 0) + deposit.amount,
      updatedAt: now,
    });

    await createNotification(ctx, {
      userId: deposit.userId,
      type: "deposit_approved",
      title: "Deposit Approved! 🎉",
      message: `Your deposit of ${deposit.amount} ETB has been verified and credited to your available balance.`,
      link: `/wallet?tab=history&txId=${deposit._id}`,
    });

    return { success: true, depositId: deposit._id };
  },
});

export const autoCreditVerifyEt = mutation({
  args: {
    depositId: v.id("deposits"),
    transactionReference: v.string(),
    verifiedAmount: v.number(),
    provider: v.string(),
    senderName: v.optional(v.string()),
    senderPhone: v.optional(v.string()),
    rawVerifyData: v.optional(v.string()),
    webhookSecret: v.optional(v.string()),
    clerkUserId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const deposit = await ctx.db.get(args.depositId);
    if (!deposit) throw new Error("deposit-not-found");

    const serverSecret =
      process.env.VERIFY_ET_WEBHOOK_SECRET || process.env.EVE_SERVER_SECRET;
    const isServerCall =
      args.webhookSecret && serverSecret && args.webhookSecret === serverSecret;

    if (isServerCall && args.clerkUserId) {
      const player = await ctx.db
        .query("players")
        .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkUserId!))
        .first();
      if (!player || deposit.userId !== player._id) {
        throw new Error("unauthorized-deposit");
      }
    } else if (!isServerCall) {
      const player = await requirePlayer(ctx);
      if (deposit.userId !== player._id) throw new Error("unauthorized-deposit");
    }

    if (deposit.status === "approved" || deposit.status === "credited") {
      return { success: true, alreadyCredited: true, depositId: deposit._id };
    }

    if (deposit.status !== "pending" && deposit.status !== "pending_review") {
      throw new Error("deposit-not-pending");
    }

    const cleanRef = args.transactionReference.trim();
    if (!cleanRef) throw new Error("duplicate-reference");

    // Check duplicate reference in approved or credited deposits
    const duplicate = await ctx.db
      .query("deposits")
      .filter((q) =>
        q.and(
          q.neq(q.field("_id"), deposit._id),
          q.eq(q.field("transactionReference"), cleanRef),
          q.or(
            q.eq(q.field("status"), "approved"),
            q.eq(q.field("status"), "credited"),
          ),
        ),
      )
      .first();

    if (duplicate) {
      throw new Error("duplicate-reference");
    }

    // Strict exact amount check
    const expectedSantims = Math.round(deposit.amount * 100);
    const verifiedSantims = Math.round(args.verifiedAmount * 100);
    if (expectedSantims !== verifiedSantims || verifiedSantims <= 0) {
      throw new Error("deposit-amount-mismatch");
    }

    const wallet = await ctx.db.get(deposit.walletId);
    if (!wallet) throw new Error("wallet-not-found");

    const now = Date.now();
    const currentSantims =
      wallet.availableSantims ?? Math.round(wallet.availableBalance * 100);
    const newSantims = currentSantims + expectedSantims;
    const lockedSantims =
      wallet.lockedSantims ?? Math.round((wallet.lockedBalance ?? 0) * 100);

    // Atomic ledger entry
    await postLedgerEntry(ctx, {
      userId: deposit.userId,
      walletId: wallet._id,
      entryType: "deposit_credit",
      amountSantims: expectedSantims,
      balanceAfterSantims: newSantims,
      lockedAfterSantims: lockedSantims,
      referenceType: "deposit",
      referenceId: deposit._id,
      idempotencyKey: `deposit_verify_et_${deposit._id}`,
      description: `Auto-verified via Verify.et (${args.provider})`,
      metadata: JSON.stringify({
        provider: args.provider,
        transactionReference: cleanRef,
        senderName: args.senderName,
        senderPhone: args.senderPhone,
        rawVerifyData: args.rawVerifyData,
        verifiedAt: now,
      }),
      now,
    });

    // Update deposit status
    await ctx.db.patch(deposit._id, {
      status: "approved",
      verificationMethod: "verify_et",
      verifiedBy: "verify_et",
      transactionReference: cleanRef,
      verificationNote: `Auto-verified by Verify.et (${args.provider})`,
      verifyEtData: args.rawVerifyData,
      reviewedAt: now,
    });

    // Credit wallet
    await ctx.db.patch(wallet._id, {
      availableBalance: wallet.availableBalance + deposit.amount,
      availableSantims: newSantims,
      totalDeposited: (wallet.totalDeposited ?? 0) + deposit.amount,
      updatedAt: now,
    });

    await createNotification(ctx, {
      userId: deposit.userId,
      type: "deposit_approved",
      title: "Deposit Auto-Verified! 🎉",
      message: `Your deposit of ${deposit.amount} ETB (${args.provider}) has been verified and instantly credited to your available balance.`,
      link: `/wallet?tab=history&txId=${deposit._id}`,
    });

    return { success: true, depositId: deposit._id, amount: deposit.amount };
  },
});

export const creditVerifyEtWebhook = mutation({
  args: {
    transactionReference: v.string(),
    verifiedAmount: v.number(),
    provider: v.string(),
    senderName: v.optional(v.string()),
    senderPhone: v.optional(v.string()),
    rawVerifyData: v.optional(v.string()),
    webhookSecret: v.string(),
  },
  handler: async (ctx, args) => {
    const serverSecret =
      process.env.VERIFY_ET_WEBHOOK_SECRET || process.env.EVE_SERVER_SECRET;
    if (!serverSecret || args.webhookSecret !== serverSecret) {
      throw new Error("unauthorized-webhook");
    }

    const cleanRef = args.transactionReference.trim();
    if (!cleanRef) return { success: false, reason: "missing-reference" };

    const deposit = await ctx.db
      .query("deposits")
      .filter((q) =>
        q.and(
          q.eq(q.field("transactionReference"), cleanRef),
          q.or(
            q.eq(q.field("status"), "pending"),
            q.eq(q.field("status"), "pending_review"),
          ),
        ),
      )
      .first();

    if (!deposit) return { success: false, reason: "deposit-not-found" };

    // Strict amount check
    const expectedSantims = Math.round(deposit.amount * 100);
    const verifiedSantims = Math.round(args.verifiedAmount * 100);
    if (expectedSantims !== verifiedSantims) {
      return { success: false, reason: "deposit-amount-mismatch" };
    }

    const wallet = await ctx.db.get(deposit.walletId);
    if (!wallet) return { success: false, reason: "wallet-not-found" };

    const now = Date.now();
    const currentSantims =
      wallet.availableSantims ?? Math.round(wallet.availableBalance * 100);
    const newSantims = currentSantims + expectedSantims;
    const lockedSantims =
      wallet.lockedSantims ?? Math.round((wallet.lockedBalance ?? 0) * 100);

    await postLedgerEntry(ctx, {
      userId: deposit.userId,
      walletId: wallet._id,
      entryType: "deposit_credit",
      amountSantims: expectedSantims,
      balanceAfterSantims: newSantims,
      lockedAfterSantims: lockedSantims,
      referenceType: "deposit",
      referenceId: deposit._id,
      idempotencyKey: `deposit_verify_et_${deposit._id}`,
      description: `Auto-verified via Verify.et Webhook (${args.provider})`,
      metadata: JSON.stringify({
        provider: args.provider,
        transactionReference: cleanRef,
        senderName: args.senderName,
        senderPhone: args.senderPhone,
        rawVerifyData: args.rawVerifyData,
        verifiedAt: now,
      }),
      now,
    });

    await ctx.db.patch(deposit._id, {
      status: "approved",
      verificationMethod: "verify_et",
      verifiedBy: "verify_et",
      verificationNote: `Auto-verified via Verify.et Webhook (${args.provider})`,
      verifyEtData: args.rawVerifyData,
      reviewedAt: now,
    });

    await ctx.db.patch(wallet._id, {
      availableBalance: wallet.availableBalance + deposit.amount,
      availableSantims: newSantims,
      totalDeposited: (wallet.totalDeposited ?? 0) + deposit.amount,
      updatedAt: now,
    });

    await createNotification(ctx, {
      userId: deposit.userId,
      type: "deposit_approved",
      title: "Deposit Auto-Verified! 🎉",
      message: `Your deposit of ${deposit.amount} ETB has been confirmed and credited to your wallet.`,
      link: `/wallet?tab=history&txId=${deposit._id}`,
    });

    return { success: true, depositId: deposit._id };
  },
});

export const reject = mutation({
  args: {
    depositId: v.id("deposits"),
    reason: v.string(),
    verificationNote: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const deposit = await ctx.db.get(args.depositId);
    if (!deposit) throw new Error("deposit-not-found");
    if (deposit.status !== "pending" && deposit.status !== "pending_review") {
      throw new Error("deposit-not-pending");
    }

    const reason = args.reason.trim();
    if (!reason) {
      throw new Error("reason-required");
    }

    const now = Date.now();
    await ctx.db.patch(deposit._id, {
      status: "rejected",
      rejectionReason: reason,
      verificationNote: args.verificationNote?.trim() || undefined,
      reviewedBy: admin._id,
      reviewedAt: now,
    });

    await createNotification(ctx, {
      userId: deposit.userId,
      type: "deposit_rejected",
      title: "Deposit Rejected",
      message: `Your deposit request for ${deposit.amount} ETB was declined. Reason: ${reason}`,
      link: `/wallet?tab=history&txId=${deposit._id}`,
    });

    return { success: true, depositId: deposit._id };
  },
});

export const myDeposits = query({
  args: {},
  handler: async (ctx) => {
    const player = await optionalPlayer(ctx);
    if (!player) return [];
    const deposits = await ctx.db
      .query("deposits")
      .withIndex("by_userId", (q) => q.eq("userId", player._id))
      .order("desc")
      .take(50);

    return await Promise.all(
      deposits.map(async (d) => {
        const screenshotUrl = d.screenshotId
          ? await ctx.storage.getUrl(d.screenshotId)
          : null;
        return {
          ...d,
          screenshotUrl,
        };
      }),
    );
  },
});

export const pendingDeposits = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const all = await ctx.db.query("deposits").order("desc").collect();

    const pending = all.filter(
      (d) => d.status === "pending" || d.status === "pending_review",
    );

    const results = [];
    for (const d of pending) {
      const player = await ctx.db.get(d.userId);
      const screenshotUrl = d.screenshotId
        ? await ctx.storage.getUrl(d.screenshotId)
        : null;
      results.push({
        ...d,
        username: player?.username ?? "Unknown",
        userEmail: player?.email,
        screenshotUrl,
      });
    }
    return results;
  },
});

export const listAdminDeposits = query({
  args: {
    status: v.optional(
      v.union(
        v.literal("all"),
        v.literal("pending"),
        v.literal("pending_review"),
        v.literal("approved"),
        v.literal("credited"),
        v.literal("rejected"),
      ),
    ),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const limit = args.limit ?? 100;
    const all = await ctx.db.query("deposits").order("desc").take(limit);

    let filtered = all;
    if (args.status && args.status !== "all") {
      if (args.status === "pending") {
        filtered = all.filter(
          (d) => d.status === "pending" || d.status === "pending_review",
        );
      } else if (args.status === "approved" || args.status === "credited") {
        filtered = all.filter(
          (d) => d.status === "approved" || d.status === "credited",
        );
      } else {
        filtered = all.filter((d) => d.status === args.status);
      }
    }

    return await Promise.all(
      filtered.map(async (d) => {
        const player = await ctx.db.get(d.userId);
        const screenshotUrl = d.screenshotId
          ? await ctx.storage.getUrl(d.screenshotId)
          : null;
        let reviewerName: string | undefined;
        if (d.reviewedBy) {
          const reviewer = await ctx.db.get(d.reviewedBy);
          reviewerName = reviewer?.username;
        }

        return {
          ...d,
          username: player?.username ?? "Unknown",
          userEmail: player?.email,
          userClerkId: player?.clerkId,
          screenshotUrl,
          reviewerName,
        };
      }),
    );
  },
});

export const cleanupTestDeposits = internalMutation({
  args: {
    references: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const refs = args.references ?? ["DJD3R2PK30", "DJD3R2PK3B"];
    let deletedCount = 0;
    for (const ref of refs) {
      const existing = await ctx.db
        .query("deposits")
        .filter((q) => q.eq(q.field("transactionReference"), ref.trim()))
        .collect();
      for (const d of existing) {
        await ctx.db.delete(d._id);
        deletedCount++;
      }
    }
    return { success: true, deletedCount };
  },
});
