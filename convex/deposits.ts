// convex/deposits.ts
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requirePlayer, requireAdmin } from "./lib/auth";
import { MIN_DEPOSIT, DEPOSIT_CODE_PREFIX, DEPOSIT_CODE_LENGTH } from "./lib/constants";

function generateCode() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  for (let i = 0; i < DEPOSIT_CODE_LENGTH; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `${DEPOSIT_CODE_PREFIX}-${result}`;
}

export const create = mutation({
  args: { amount: v.number(), senderInfo: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const player = await requirePlayer(ctx);

    if (args.amount < MIN_DEPOSIT) {
      throw new Error(`Minimum deposit is ${MIN_DEPOSIT} ETB`);
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
      senderInfo: args.senderInfo?.trim() || undefined,
      status: "pending",
      createdAt: Date.now(),
    });

    return { code, depositId };
  },
});

export const uploadScreenshot = mutation({
  args: {
    depositId: v.id("deposits"),
    storageId: v.optional(v.id("_storage")),
    senderInfo: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const player = await requirePlayer(ctx);
    const deposit = await ctx.db.get(args.depositId);
    if (!deposit) throw new Error("deposit-not-found");
    if (deposit.userId !== player._id) throw new Error("unauthorized-deposit");
    
    const patchData: Record<string, any> = {};
    if (args.storageId) patchData.screenshotId = args.storageId;
    if (args.senderInfo !== undefined) patchData.senderInfo = args.senderInfo.trim() || undefined;

    if (Object.keys(patchData).length > 0) {
      await ctx.db.patch(args.depositId, patchData);
    }
  },
});

export const approve = mutation({
  args: { depositId: v.id("deposits") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const deposit = await ctx.db.get(args.depositId);
    if (!deposit) throw new Error("deposit-not-found");
    if (deposit.status !== "pending") throw new Error("deposit-not-pending");

    const wallet = await ctx.db.get(deposit.walletId);
    if (!wallet) throw new Error("wallet-not-found");

    await ctx.db.patch(deposit._id, {
      status: "approved",
      reviewedAt: Date.now(),
    });

    await ctx.db.patch(wallet._id, {
      availableBalance: wallet.availableBalance + deposit.amount,
      totalDeposited: wallet.totalDeposited + deposit.amount,
      updatedAt: Date.now(),
    });
  },
});

export const reject = mutation({
  args: { depositId: v.id("deposits"), reason: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const deposit = await ctx.db.get(args.depositId);
    if (!deposit) throw new Error("deposit-not-found");
    if (deposit.status !== "pending") throw new Error("deposit-not-pending");

    await ctx.db.patch(deposit._id, {
      status: "rejected",
      rejectionReason: args.reason ?? "Rejected by admin",
      reviewedAt: Date.now(),
    });
  },
});

export const myDeposits = query({
  args: {},
  handler: async (ctx) => {
    const player = await requirePlayer(ctx);
    const deposits = await ctx.db
      .query("deposits")
      .withIndex("by_userId", (q) => q.eq("userId", player._id))
      .order("desc")
      .take(50);
    return await Promise.all(
      deposits.map(async (d) => {
        const screenshotUrl = d.screenshotId ? await ctx.storage.getUrl(d.screenshotId) : null;
        return {
          ...d,
          screenshotUrl,
        };
      })
    );
  },
});

export const pendingDeposits = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const deposits = await ctx.db
      .query("deposits")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .order("asc")
      .collect();
      
    const results = [];
    for (const d of deposits) {
      const player = await ctx.db.get(d.userId);
      const screenshotUrl = d.screenshotId ? await ctx.storage.getUrl(d.screenshotId) : null;
      results.push({
        ...d,
        username: player?.username ?? "Unknown",
        screenshotUrl,
      });
    }
    return results;
  },
});
