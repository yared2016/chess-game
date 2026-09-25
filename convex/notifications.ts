// convex/notifications.ts — In-app & push notification system
import { v } from "convex/values";
import { mutation, query, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { requirePlayer } from "./lib/auth";
import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

export type NotificationType =
  | "deposit_submitted"
  | "deposit_approved"
  | "deposit_rejected"
  | "withdrawal_submitted"
  | "withdrawal_completed"
  | "withdrawal_rejected"
  | "challenge_received"
  | "challenge_declined"
  | "challenge_accepted"
  | "chapa_payment_verified"
  | "chapa_payment_failed"
  | "system";

/** Helper function to create an in-app notification and schedule email dispatch */
export async function createNotification(
  ctx: MutationCtx,
  args: {
    userId: Id<"players">;
    type: NotificationType;
    title: string;
    message: string;
    link?: string;
  }
) {
  const notifId = await ctx.db.insert("notifications", {
    userId: args.userId,
    type: args.type,
    title: args.title,
    message: args.message,
    link: args.link,
    read: false,
    createdAt: Date.now(),
  });

  // Attempt transactional email delivery if user has an email recorded
  const recipient = await ctx.db.get(args.userId);
  if (recipient?.email) {
    try {
      await ctx.scheduler.runAfter(0, internal.notifications.sendEmailAction, {
        to: recipient.email,
        subject: args.title,
        title: args.title,
        message: args.message,
        link: args.link,
      });
    } catch (schedErr) {
      console.log(`[Notification Email Queued] To: ${recipient.email} | Subject: ${args.title}`);
    }
  }

  return notifId;
}

/** Convex Action capable of performing outbound network requests (fetch) */
export const sendEmailAction = internalAction({
  args: {
    to: v.string(),
    subject: v.string(),
    title: v.string(),
    message: v.string(),
    link: v.optional(v.string()),
  },
  handler: async (_ctx, args) => {
    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) {
      console.log(`[Email Mock Log] To: ${args.to} | Subject: ${args.subject} | RESEND_API_KEY not configured`);
      return;
    }

    try {
      const targetUrl = args.link
        ? args.link.startsWith("http")
          ? args.link
          : `https://chess-game-beta-mocha.vercel.app${args.link}`
        : "";

      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "Castle Chess <onboarding@resend.dev>",
          to: args.to,
          subject: args.subject,
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; background: #0f172a; color: #f8fafc; border-radius: 16px; border: 1px solid #334155;">
              <h2 style="color: #10b981; margin-top: 0; font-size: 20px;">${args.title}</h2>
              <p style="font-size: 15px; line-height: 1.6; color: #cbd5e1; margin-bottom: 20px;">${args.message}</p>
              ${targetUrl ? `<a href="${targetUrl}" style="display: inline-block; background: #10b981; color: #ffffff; text-decoration: none; padding: 10px 20px; border-radius: 8px; font-weight: bold; font-size: 14px;">View Details</a>` : ""}
              <hr style="border: 0; border-top: 1px solid #334155; margin: 24px 0;" />
              <p style="font-size: 12px; color: #64748b; margin: 0;">Castle 3D Chess Platform · Fair play, instant Ethiopian escrow</p>
            </div>
          `,
        }),
      });

      if (!res.ok) {
        const errorBody = await res.text();
        console.error("[Resend Delivery Error]", res.status, errorBody);
      }
    } catch (err) {
      console.error("[Email Notification Failed]", err);
    }
  },
});

export const getMyNotifications = query({
  args: {},
  handler: async (ctx) => {
    const player = await requirePlayer(ctx);
    const notifications = await ctx.db
      .query("notifications")
      .withIndex("by_userId", (q) => q.eq("userId", player._id))
      .order("desc")
      .take(30);

    return notifications;
  },
});

export const getUnreadCount = query({
  args: {},
  handler: async (ctx) => {
    const player = await requirePlayer(ctx);
    const unread = await ctx.db
      .query("notifications")
      .withIndex("by_userId_and_read", (q) => q.eq("userId", player._id).eq("read", false))
      .collect();

    return unread.length;
  },
});

export const markAsRead = mutation({
  args: { notificationId: v.id("notifications") },
  handler: async (ctx, args) => {
    const player = await requirePlayer(ctx);
    const notif = await ctx.db.get(args.notificationId);
    if (!notif) return;
    if (notif.userId !== player._id) throw new Error("unauthorized-notification");

    await ctx.db.patch(args.notificationId, {
      read: true,
    });
  },
});

export const markAllAsRead = mutation({
  args: {},
  handler: async (ctx) => {
    const player = await requirePlayer(ctx);
    const unread = await ctx.db
      .query("notifications")
      .withIndex("by_userId_and_read", (q) => q.eq("userId", player._id).eq("read", false))
      .collect();

    for (const notif of unread) {
      await ctx.db.patch(notif._id, {
        read: true,
      });
    }
  },
});

export const clearAll = mutation({
  args: {},
  handler: async (ctx) => {
    const player = await requirePlayer(ctx);
    const notifications = await ctx.db
      .query("notifications")
      .withIndex("by_userId", (q) => q.eq("userId", player._id))
      .collect();

    for (const notif of notifications) {
      await ctx.db.delete(notif._id);
    }
  },
});

export const deleteNotification = mutation({
  args: { notificationId: v.id("notifications") },
  handler: async (ctx, args) => {
    const player = await requirePlayer(ctx);
    const notif = await ctx.db.get(args.notificationId);
    if (!notif) return;
    if (notif.userId !== player._id) throw new Error("unauthorized-notification");

    await ctx.db.delete(args.notificationId);
  },
});
