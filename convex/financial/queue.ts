// convex/financial/queue.ts
// Scoped FIFO Durable Queue, Lease Locks, Exponential Backoff & DLQ (Abay Chess v4.2.7-PROD Phase 8)

import { v } from "convex/values";
import { mutation, query, internalMutation, internalQuery, MutationCtx, QueryCtx } from "../_generated/server";
import { requireAdmin, requireOwner, AnyCtx } from "../lib/auth";
import type { Id } from "../_generated/dataModel";

export const LEASE_DURATION_MS = 30_000; // 30-second lease timeout (RB-25, RB-26)
export const MAX_QUEUE_RETRIES = 5; // DLQ after 5 attempts (RB-28)

/**
 * TSK-801: Enqueue a background financial or operational task.
 * Scoped by scopeKey (e.g. `user:<id>` or `game:<id>`) for strict FIFO execution.
 */
export const enqueueTask = mutation({
  args: {
    scopeKey: v.string(),
    taskType: v.string(),
    payload: v.string(), // JSON serialized
    maxAttempts: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const queueId = `q_${now}_${Math.random().toString(36).substring(2, 9)}`;

    await ctx.db.insert("durableQueue", {
      queueId,
      scopeKey: args.scopeKey,
      taskType: args.taskType,
      payload: args.payload,
      status: "pending",
      attemptCount: 0,
      maxAttempts: args.maxAttempts ?? MAX_QUEUE_RETRIES,
      createdAt: now,
    });

    return { success: true, queueId };
  },
});

/**
 * TSK-801: Acquire the next eligible task under strict FIFO per scopeKey.
 * Enforces sequential lease locking: a scope cannot process task N+1 while task N is in flight.
 */
export const acquireNextQueueTask = mutation({
  args: {
    scopeKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // 1. If scopeKey is provided, check if that specific scope currently holds an active lease
    if (args.scopeKey) {
      const activeLease = await ctx.db
        .query("durableQueue")
        .withIndex("by_scopeKey_and_status", (q) =>
          q.eq("scopeKey", args.scopeKey!).eq("status", "processing")
        )
        .first();

      if (activeLease && activeLease.leaseExpiresAt && activeLease.leaseExpiresAt > now) {
        return {
          acquired: false,
          reason: "active_lease_exists",
          activeQueueId: activeLease.queueId,
          leaseExpiresAt: activeLease.leaseExpiresAt,
        };
      }

      // Find oldest pending/retryable task for this scopeKey (Strict FIFO)
      const tasks = await ctx.db
        .query("durableQueue")
        .withIndex("by_scopeKey_and_status", (q) =>
          q.eq("scopeKey", args.scopeKey!).eq("status", "pending")
        )
        .collect();

      // Also check failed tasks ready for retry
      const failedTasks = await ctx.db
        .query("durableQueue")
        .withIndex("by_scopeKey_and_status", (q) =>
          q.eq("scopeKey", args.scopeKey!).eq("status", "failed")
        )
        .collect();

      const retryableFailed = failedTasks.filter(
        (t) =>
          t.attemptCount < t.maxAttempts &&
          t.nextRetryAt &&
          t.nextRetryAt <= now
      );

      const candidate = [...tasks, ...retryableFailed].sort(
        (a, b) => a.createdAt - b.createdAt
      )[0];

      if (!candidate) {
        return { acquired: false, reason: "no_tasks_available" };
      }

      // Grant 30s lease
      const newAttempts = candidate.attemptCount + 1;
      await ctx.db.patch(candidate._id, {
        status: "processing",
        attemptCount: newAttempts,
        leaseExpiresAt: now + LEASE_DURATION_MS,
      });

      return {
        acquired: true,
        task: {
          queueId: candidate.queueId,
          scopeKey: candidate.scopeKey,
          taskType: candidate.taskType,
          payload: candidate.payload,
          attemptCount: newAttempts,
          maxAttempts: candidate.maxAttempts,
          leaseExpiresAt: now + LEASE_DURATION_MS,
        },
      };
    }

    // 2. Global scan across all pending tasks
    const pendingTasks = await ctx.db
      .query("durableQueue")
      .withIndex("by_status_and_nextRetryAt", (q) => q.eq("status", "pending"))
      .collect();

    // Sort by createdAt for FIFO ordering
    pendingTasks.sort((a, b) => a.createdAt - b.createdAt);

    for (const candidate of pendingTasks) {
      // Check if candidate's scopeKey is currently locked
      const activeLease = await ctx.db
        .query("durableQueue")
        .withIndex("by_scopeKey_and_status", (q) =>
          q.eq("scopeKey", candidate.scopeKey).eq("status", "processing")
        )
        .first();

      if (activeLease && activeLease.leaseExpiresAt && activeLease.leaseExpiresAt > now) {
        // Scope is busy, move to next task with a different scope
        continue;
      }

      // Scope is free: acquire lease
      const newAttempts = candidate.attemptCount + 1;
      await ctx.db.patch(candidate._id, {
        status: "processing",
        attemptCount: newAttempts,
        leaseExpiresAt: now + LEASE_DURATION_MS,
      });

      return {
        acquired: true,
        task: {
          queueId: candidate.queueId,
          scopeKey: candidate.scopeKey,
          taskType: candidate.taskType,
          payload: candidate.payload,
          attemptCount: newAttempts,
          maxAttempts: candidate.maxAttempts,
          leaseExpiresAt: now + LEASE_DURATION_MS,
        },
      };
    }

    return { acquired: false, reason: "no_tasks_available" };
  },
});

/**
 * TSK-802: Mark an enqueued task successfully completed.
 * Records postedTransactionId to ensure Directive #9 double-counting prevention.
 */
export const completeQueueTask = mutation({
  args: {
    queueId: v.string(),
    postedTransactionId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const task = await ctx.db
      .query("durableQueue")
      .withIndex("by_queueId", (q) => q.eq("queueId", args.queueId))
      .unique();

    if (!task) {
      throw new Error(`ERR_TASK_NOT_FOUND: Queue task ${args.queueId} not found.`);
    }

    const now = Date.now();
    await ctx.db.patch(task._id, {
      status: "completed",
      completedAt: now,
      postedTransactionId: args.postedTransactionId ?? task.postedTransactionId,
      leaseExpiresAt: undefined,
    });

    return { success: true, queueId: args.queueId };
  },
});

/**
 * TSK-802: Fail an enqueued task and schedule exponential backoff or dead-letter queue.
 * DLQ is triggered after maxAttempts (default 5) (RB-28).
 */
export const failQueueTask = mutation({
  args: {
    queueId: v.string(),
    errorMessage: v.string(),
  },
  handler: async (ctx, args) => {
    const task = await ctx.db
      .query("durableQueue")
      .withIndex("by_queueId", (q) => q.eq("queueId", args.queueId))
      .unique();

    if (!task) {
      throw new Error(`ERR_TASK_NOT_FOUND: Queue task ${args.queueId} not found.`);
    }

    const now = Date.now();

    // Check if retry limit reached (RB-28 Dead-Letter Queue)
    if (task.attemptCount >= task.maxAttempts) {
      await ctx.db.patch(task._id, {
        status: "dead_letter",
        lastError: args.errorMessage,
        leaseExpiresAt: undefined,
      });

      return {
        success: true,
        queueId: args.queueId,
        status: "dead_letter" as const,
        attemptCount: task.attemptCount,
        maxAttempts: task.maxAttempts,
      };
    }

    // Exponential backoff: 1s, 2s, 4s, 8s, 16s... capped at 5 minutes
    const backoffMs = Math.min(300_000, 1000 * Math.pow(2, task.attemptCount));
    const nextRetryAt = now + backoffMs;

    await ctx.db.patch(task._id, {
      status: "failed",
      lastError: args.errorMessage,
      nextRetryAt,
      leaseExpiresAt: undefined,
    });

    return {
      success: true,
      queueId: args.queueId,
      status: "failed" as const,
      nextRetryAt,
      backoffMs,
      attemptCount: task.attemptCount,
    };
  },
});

/**
 * RB-27: Pre-replay entity validation helper.
 * Asserts fresh database state before executing or retrying a financial action.
 */
export const validateEntityBeforeReplay = query({
  args: {
    taskType: v.string(),
    entityId: v.string(),
  },
  handler: async (ctx, args) => {
    if (args.taskType === "process_match_settlement") {
      const game = await ctx.db.get(args.entityId as Id<"games">);
      if (!game) return { isValid: false, reason: "game_not_found" };
      if (game.escrowSettled) return { isValid: false, reason: "game_already_settled" };
      return { isValid: true };
    }

    if (args.taskType === "execute_withdrawal_transfer") {
      const withdrawal = await ctx.db
        .query("withdrawalRequests")
        .withIndex("by_withdrawalId", (q) => q.eq("withdrawalId", args.entityId))
        .unique();
      if (!withdrawal) return { isValid: false, reason: "withdrawal_not_found" };
      if (withdrawal.status === "settled") return { isValid: false, reason: "already_settled" };
      if (withdrawal.status === "cancelled" || withdrawal.status === "failed") {
        return { isValid: false, reason: "withdrawal_cancelled_or_failed" };
      }
      return { isValid: true };
    }

    return { isValid: true };
  },
});

/**
 * Monitoring query for queue health metrics.
 */
export const getQueueHealth = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const now = Date.now();
    const all = await ctx.db.query("durableQueue").collect();

    let pending = 0;
    let processing = 0;
    let completed = 0;
    let failed = 0;
    let deadLetter = 0;
    let activeLeases = 0;

    for (const t of all) {
      if (t.status === "pending") pending++;
      else if (t.status === "processing") {
        processing++;
        if (t.leaseExpiresAt && t.leaseExpiresAt > now) activeLeases++;
      } else if (t.status === "completed") completed++;
      else if (t.status === "failed") failed++;
      else if (t.status === "dead_letter") deadLetter++;
    }

    return {
      totalTasks: all.length,
      pending,
      processing,
      completed,
      failed,
      deadLetter,
      activeLeases,
    };
  },
});
