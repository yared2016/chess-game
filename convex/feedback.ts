// convex/feedback.ts — Feedback collection, admin management, and email confirmation
import { v } from "convex/values";
import {
  mutation,
  query,
  internalMutation,
  internalQuery,
  internalAction,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { requireAdmin, requireIdentity, requirePlayer } from "./lib/auth";
import {
  vFeedbackCategory,
  vFeedbackStatus,
  vFeedbackAttachment,
  vEmailStatus,
} from "./lib/validators";

/** Generate a presigned storage upload URL for feedback attachments */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requirePlayer(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

/** Submit a new feedback ticket with attachments and optional chess context */
export const submit = mutation({
  args: {
    category: vFeedbackCategory,
    description: v.string(),
    gameId: v.optional(v.string()),
    matchId: v.optional(v.string()),
    tournamentId: v.optional(v.string()),
    opponentUsername: v.optional(v.string()),
    attachments: v.array(vFeedbackAttachment),
  },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const player = await requirePlayer(ctx);

    const trimmedDescription = args.description.trim();
    if (trimmedDescription.length < 10) {
      throw new Error("Description must be at least 10 characters long");
    }
    if (trimmedDescription.length > 4000) {
      throw new Error("Description must not exceed 4000 characters");
    }

    if (args.attachments.length > 5) {
      throw new Error("Maximum 5 attachments allowed");
    }

    const now = Date.now();
    const userEmail = player.email ?? identity.email ?? "";

    const feedbackId = await ctx.db.insert("feedback", {
      userId: player._id,
      clerkId: player.clerkId,
      userName: player.username,
      userEmail,
      userAvatarUrl: player.avatarUrl,
      category: args.category,
      description: trimmedDescription,
      gameId: args.gameId,
      matchId: args.matchId,
      tournamentId: args.tournamentId,
      opponentUsername: args.opponentUsername,
      attachments: args.attachments,
      status: "NEW",
      emailStatus: "NOT_SENT",
      createdAt: now,
      updatedAt: now,
    });

    // Schedule email confirmation
    await ctx.scheduler.runAfter(0, internal.feedback.sendConfirmationEmailAction, {
      feedbackId,
    });

    // Insert in-app notification for the player
    await ctx.db.insert("notifications", {
      userId: player._id,
      type: "system",
      title: "Feedback Received",
      message: "Thank you for helping us improve Castle! We have received your feedback.",
      link: "/feedback",
      read: false,
      createdAt: now,
    });

    return feedbackId;
  },
});

/** Query tickets submitted by the authenticated player with adminNotes stripped */
export const getMyFeedback = query({
  args: {},
  handler: async (ctx) => {
    const player = await requirePlayer(ctx);

    const items = await ctx.db
      .query("feedback")
      .withIndex("by_userId", (q) => q.eq("userId", player._id))
      .order("desc")
      .collect();

    return items.map(({ adminNotes: _adminNotes, ...item }) => item);
  },
});

/** Retrieve presigned download URL for an attachment if owner or admin */
export const getAttachmentUrl = query({
  args: {
    feedbackId: v.id("feedback"),
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    const feedback = await ctx.db.get(args.feedbackId);
    if (!feedback) {
      throw new Error("Feedback not found");
    }

    let isAuthorized = false;

    // Admin authorization check
    try {
      await requireAdmin(ctx);
      isAuthorized = true;
    } catch {
      // Not admin
    }

    // Owner authorization check
    if (!isAuthorized) {
      try {
        const player = await requirePlayer(ctx);
        if (feedback.userId === player._id) {
          isAuthorized = true;
        }
      } catch {
        // Not player
      }
    }

    if (!isAuthorized) {
      throw new Error("unauthorized-attachment");
    }

    const hasAttachment = feedback.attachments.some(
      (att) => att.storageId === args.storageId
    );
    if (!hasAttachment) {
      throw new Error("attachment-not-found");
    }

    return await ctx.storage.getUrl(args.storageId);
  },
});

/** Admin: list feedback tickets with filtering and search */
export const adminList = query({
  args: {
    category: v.optional(vFeedbackCategory),
    status: v.optional(vFeedbackStatus),
    search: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    let items;
    if (args.status) {
      items = await ctx.db
        .query("feedback")
        .withIndex("by_status_and_createdAt", (q) => q.eq("status", args.status!))
        .order("desc")
        .collect();
    } else {
      items = await ctx.db
        .query("feedback")
        .withIndex("by_createdAt")
        .order("desc")
        .collect();
    }

    if (args.category) {
      items = items.filter((item) => item.category === args.category);
    }

    if (args.search) {
      const q = args.search.toLowerCase().trim();
      if (q) {
        items = items.filter(
          (item) =>
            item.description.toLowerCase().includes(q) ||
            item.userName.toLowerCase().includes(q) ||
            item.userEmail.toLowerCase().includes(q) ||
            (item.opponentUsername && item.opponentUsername.toLowerCase().includes(q)) ||
            (item.gameId && item.gameId.toLowerCase().includes(q))
        );
      }
    }

    if (args.limit && args.limit > 0) {
      items = items.slice(0, args.limit);
    }

    return items;
  },
});

/** Admin: aggregate feedback statistics */
export const adminGetStats = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);

    const all = await ctx.db.query("feedback").collect();

    let total = all.length;
    let newCount = 0;
    let inReviewCount = 0;
    let resolvedCount = 0;
    let featureRequestsCount = 0;

    for (const item of all) {
      if (item.status === "NEW") newCount++;
      else if (item.status === "IN_REVIEW") inReviewCount++;
      else if (item.status === "RESOLVED") resolvedCount++;

      if (item.category === "feature_request") featureRequestsCount++;
    }

    return {
      total,
      newCount,
      inReviewCount,
      resolvedCount,
      featureRequestsCount,
    };
  },
});

/** Admin: update feedback status and record resolution metadata */
export const adminUpdateStatus = mutation({
  args: {
    feedbackId: v.id("feedback"),
    status: vFeedbackStatus,
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const feedback = await ctx.db.get(args.feedbackId);
    if (!feedback) {
      throw new Error("Feedback not found");
    }

    const now = Date.now();
    const patch: Record<string, any> = {
      status: args.status,
      updatedAt: now,
    };

    if (args.status === "RESOLVED" || args.status === "CLOSED") {
      patch.resolvedAt = now;
      patch.resolvedBy = admin.username;
    }

    await ctx.db.patch(args.feedbackId, patch);
  },
});

/** Admin: update internal notes */
export const adminUpdateNotes = mutation({
  args: {
    feedbackId: v.id("feedback"),
    adminNotes: v.string(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const feedback = await ctx.db.get(args.feedbackId);
    if (!feedback) {
      throw new Error("Feedback not found");
    }

    await ctx.db.patch(args.feedbackId, {
      adminNotes: args.adminNotes,
      updatedAt: Date.now(),
    });
  },
});

/** Admin: retry confirmation email delivery */
export const adminRetryEmail = mutation({
  args: {
    feedbackId: v.id("feedback"),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const feedback = await ctx.db.get(args.feedbackId);
    if (!feedback) {
      throw new Error("Feedback not found");
    }

    await ctx.db.patch(args.feedbackId, {
      emailStatus: "NOT_SENT",
      emailError: undefined,
      updatedAt: Date.now(),
    });

    await ctx.scheduler.runAfter(0, internal.feedback.sendConfirmationEmailAction, {
      feedbackId: args.feedbackId,
    });
  },
});

/** Internal query to fetch a feedback record */
export const internalGetFeedback = internalQuery({
  args: { feedbackId: v.id("feedback") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.feedbackId);
  },
});

/** Internal mutation to update email delivery state */
export const internalUpdateEmailStatus = internalMutation({
  args: {
    feedbackId: v.id("feedback"),
    emailStatus: vEmailStatus,
    emailError: v.optional(v.string()),
    emailSentAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const feedback = await ctx.db.get(args.feedbackId);
    if (!feedback) return;

    await ctx.db.patch(args.feedbackId, {
      emailStatus: args.emailStatus,
      emailError: args.emailError,
      emailSentAt: args.emailSentAt,
      updatedAt: Date.now(),
    });
  },
});

/** Internal action to dispatch confirmation email via Resend */
export const sendConfirmationEmailAction = internalAction({
  args: {
    feedbackId: v.id("feedback"),
  },
  handler: async (ctx, args) => {
    const feedback = await ctx.runQuery(internal.feedback.internalGetFeedback, {
      feedbackId: args.feedbackId,
    });

    if (!feedback) {
      console.warn(`[Feedback Email] Feedback item not found: ${args.feedbackId}`);
      return;
    }

    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) {
      console.log(
        `[Email Simulation] RESEND_API_KEY not configured. To: ${feedback.userEmail || "none"} | Feedback: ${args.feedbackId}`
      );
      await ctx.runMutation(internal.feedback.internalUpdateEmailStatus, {
        feedbackId: args.feedbackId,
        emailStatus: "SENT",
        emailSentAt: Date.now(),
      });
      return;
    }

    if (!feedback.userEmail) {
      console.log(
        `[Feedback Email Skipped] No user email available for feedback: ${args.feedbackId}`
      );
      await ctx.runMutation(internal.feedback.internalUpdateEmailStatus, {
        feedbackId: args.feedbackId,
        emailStatus: "SENT",
        emailSentAt: Date.now(),
      });
      return;
    }

    try {
      const categoryLabels: Record<string, string> = {
        chess_game: "Chess Game",
        matchmaking: "Matchmaking",
        tournaments: "Tournaments",
        wallet_payments: "Wallet & Payments",
        account_profile: "Account & Profile",
        website_app: "Website & App",
        feature_request: "Feature Request",
        report_problem: "Report a Problem",
        general_feedback: "General Feedback",
      };

      const categoryLabel = categoryLabels[feedback.category] || feedback.category;

      const html = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 28px; background: #0f172a; color: #f8fafc; border-radius: 16px; border: 1px solid #334155;">
          <div style="display: flex; align-items: center; margin-bottom: 20px;">
            <h1 style="color: #10b981; margin: 0; font-size: 22px; font-weight: 700; letter-spacing: -0.5px;">Castle Chess</h1>
          </div>
          <h2 style="color: #ffffff; font-size: 18px; margin-top: 0; margin-bottom: 12px;">Thanks for your feedback ♟</h2>
          <p style="font-size: 15px; line-height: 1.6; color: #cbd5e1; margin-bottom: 16px;">
            Hi <strong>${feedback.userName}</strong>, thank you for sharing your feedback with the Castle team! We review every submission closely to keep improving our chess experience.
          </p>
          <div style="background: #1e293b; border: 1px solid #334155; border-radius: 10px; padding: 16px; margin-bottom: 20px;">
            <p style="font-size: 13px; text-transform: uppercase; color: #94a3b8; font-weight: 600; margin: 0 0 6px 0;">Category: ${categoryLabel}</p>
            <p style="font-size: 14px; line-height: 1.5; color: #f1f5f9; margin: 0; white-space: pre-wrap;">${feedback.description}</p>
          </div>
          <p style="font-size: 13px; color: #94a3b8; line-height: 1.5; margin-bottom: 24px;">
            Our team will investigate and update you if further details are needed.
          </p>
          <hr style="border: 0; border-top: 1px solid #334155; margin: 24px 0 16px 0;" />
          <p style="font-size: 12px; color: #64748b; margin: 0;">
            Castle 3D Chess Platform · Fair play &amp; instant matchmaking
          </p>
        </div>
      `;

      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "Castle Chess <feedback@resend.dev>",
          to: feedback.userEmail,
          subject: "Thanks for your feedback ♟",
          html,
        }),
      });

      if (res.ok) {
        await ctx.runMutation(internal.feedback.internalUpdateEmailStatus, {
          feedbackId: args.feedbackId,
          emailStatus: "SENT",
          emailSentAt: Date.now(),
        });
      } else {
        const errorText = await res.text();
        console.error("[Resend Feedback Delivery Error]", res.status, errorText);
        await ctx.runMutation(internal.feedback.internalUpdateEmailStatus, {
          feedbackId: args.feedbackId,
          emailStatus: "FAILED",
          emailError: `HTTP ${res.status}: ${errorText}`,
        });
      }
    } catch (err: any) {
      console.error("[Feedback Email Action Error]", err);
      await ctx.runMutation(internal.feedback.internalUpdateEmailStatus, {
        feedbackId: args.feedbackId,
        emailStatus: "FAILED",
        emailError: err.message || String(err),
      });
    }
  },
});
