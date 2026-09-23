// convex/notifications.ts — In-app & push notification system
import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import { requirePlayer } from "./lib/auth";
import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

export type NotificationType =
  | "deposit_approved"
  | "deposit_rejected"
  | "withdrawal_completed"
  | "withdrawal_rejected"
  | "challenge_received"
  | "challenge_declined"
  | "challenge_accepted"
  | "system";

/** Helper function to create an in-app notification and trigger email dispatch */
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

  // Attempt email delivery if user has an email recorded
  const recipient = await ctx.db.get(args.userId);
  if (recipient?.email) {
    // If an external email provider like Resend is configured, we can dispatch
    const resendApiKey = process.env.RESEND_API_KEY;
    if (resendApiKey) {
      try {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "Castle Chess <notifications@castlechess.com>",
            to: recipient.email,
            subject: args.title,
            html: `
              <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; background: #0f172a; color: #f8fafc; border-radius: 16px;">
                <h2 style="color: #10b981; margin-top: 0;">${args.title}</h2>
                <p style="font-size: 15px; line-height: 1.6; color: #cbd5e1;">${args.message}</p>
                ${args.link ? `<a href="https://chess-game-beta-mocha.vercel.app${args.link}" style="display: inline-block; background: #10b981; color: #ffffff; text-decoration: none; padding: 10px 20px; border-radius: 8px; font-weight: bold; margin-top: 16px;">View Details</a>` : ""}
                <hr style="border: 0; border-top: 1px solid #334155; margin: 24px 0;" />
                <p style="font-size: 12px; color: #64748b;">Castle 3D Chess Platform · Fair play, instant escrow</p>
              </div>
            `,
          }),
        });
      } catch (err) {
        console.error("[Email Notification Failed]", err);
      }
    } else {
      console.log(`[Notification Email Dispatched] To: ${recipient.email} | Subject: ${args.title}`);
    }
  }

  return notifId;
}

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
