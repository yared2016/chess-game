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

/**
 * Robustly extracts the clean entity ID from various user inputs:
 * - Full URLs: https://domain.com/game/kd7b1q5r0w1k?tab=moves
 * - Relative paths: /game/kd7b1q5r0w1k or /tournaments/k57df...
 * - Prefixed strings: #kd7b1q5r0w1k, Game #kd7b..., match_kd7b...
 * - Query parameters: ?gameId=kd7b1q5r0w1k
 */
export function extractCleanId(input?: string): string {
  if (!input) return "";
  let s = input.trim();

  // If input contains a URL or path
  if (s.includes("://") || s.includes("/game/") || s.includes("/tournaments/") || s.includes("/match/")) {
    try {
      const dummyBase = "https://castlechess.internal";
      const parsed = new URL(s.startsWith("http") ? s : `${dummyBase}${s.startsWith("/") ? "" : "/"}${s}`);
      const queryId =
        parsed.searchParams.get("gameId") ||
        parsed.searchParams.get("id") ||
        parsed.searchParams.get("matchId") ||
        parsed.searchParams.get("tournamentId");

      if (queryId) {
        s = queryId;
      } else {
        const parts = parsed.pathname.split("/").filter(Boolean);
        const gameIdx = parts.lastIndexOf("game");
        const tourneyIdx = parts.lastIndexOf("tournaments");
        const matchIdx = parts.lastIndexOf("match");
        const targetIdx = Math.max(gameIdx, tourneyIdx, matchIdx);
        if (targetIdx !== -1 && targetIdx + 1 < parts.length) {
          s = parts[targetIdx + 1];
        } else if (parts.length > 0) {
          s = parts[parts.length - 1];
        }
      }
    } catch {
      const match = s.match(/(?:game|tournaments|match)\/([a-z0-9_-]+)/i);
      if (match) {
        s = match[1];
      }
    }
  }

  // Handle strings like "match_k57df..._bob.pgn"
  const pgnMatch = s.match(/^match_([a-z0-9]+)/i);
  if (pgnMatch) {
    s = pgnMatch[1];
  }

  // Strip prefixes like "Game #", "Match #", "Tournament #", "#", "@"
  s = s.replace(/^(?:(?:game|match|tourney|tournament)(?:\s*#|\s*:\s*|\s+)|\s*[#@])+/i, "").trim();

  // Strip any remaining query or hash
  s = s.split(/[?#/]/)[0].trim();

  return s;
}

/** Robustly extracts clean username from @username or /profile/username URL */
export function extractCleanUsername(input?: string): string {
  if (!input) return "";
  let s = input.trim();
  if (s.includes("/profile/")) {
    const after = s.substring(s.indexOf("/profile/") + "/profile/".length);
    s = decodeURIComponent(after.split(/[?#/]/)[0].trim());
  }
  s = s.replace(/^@/, "").trim();
  return s;
}

export type MatchContextValidationResult = {
  game: {
    provided: boolean;
    valid: boolean;
    error?: string;
    label?: string;
  };
  opponent: {
    provided: boolean;
    valid: boolean;
    error?: string;
    label?: string;
    rating?: number;
  };
  match: {
    provided: boolean;
    valid: boolean;
    error?: string;
    label?: string;
  };
  tournament: {
    provided: boolean;
    valid: boolean;
    error?: string;
    label?: string;
  };
  allValid: boolean;
};

/**
 * Validates chess match details (gameId, opponentUsername, matchId, tournamentId)
 * against the database. If a field is not provided, it is considered valid (optional).
 * If a field is provided, the referenced entity must exist.
 */
export async function checkMatchContext(
  ctx: { db: any },
  args: {
    gameId?: string;
    opponentUsername?: string;
    matchId?: string;
    tournamentId?: string;
  }
): Promise<MatchContextValidationResult> {
  const result: MatchContextValidationResult = {
    game: { provided: false, valid: true },
    opponent: { provided: false, valid: true },
    match: { provided: false, valid: true },
    tournament: { provided: false, valid: true },
    allValid: true,
  };

  // 1. Game ID validation
  const rawGame = args.gameId?.trim();
  if (rawGame) {
    result.game.provided = true;
    const cleanGameId = extractCleanId(rawGame);
    if (!cleanGameId || cleanGameId.length < 6) {
      result.game.valid = false;
      result.game.error = "Please enter a valid Game ID or match link";
      result.allValid = false;
    } else {
      let foundGame: any = null;
      let gameMode: string | undefined;

      const normalizedGameId = ctx.db.normalizeId("games", cleanGameId);
      if (normalizedGameId) {
        foundGame = await ctx.db.get("games", normalizedGameId);
        if (foundGame) gameMode = foundGame.mode;
      }

      // Check challenges as fallback
      if (!foundGame) {
        const asChallenge = ctx.db.normalizeId("challenges", cleanGameId);
        if (asChallenge) {
          const ch = await ctx.db.get("challenges", asChallenge);
          if (ch) {
            foundGame = ch;
            gameMode = "challenge";
          }
        }
      }

      // Check tournamentMatches as fallback
      if (!foundGame) {
        const asTm = ctx.db.normalizeId("tournamentMatches", cleanGameId);
        if (asTm) {
          const tm = await ctx.db.get("tournamentMatches", asTm);
          if (tm) {
            foundGame = tm;
            gameMode = "tournament match";
          }
        }
      }

      if (!foundGame) {
        result.game.valid = false;
        result.game.error = "Game ID not found in system";
        result.allValid = false;
      } else {
        result.game.valid = true;
        result.game.label = `Game #${cleanGameId.slice(0, 8)}${gameMode ? ` (${gameMode})` : ""}`;
      }
    }
  }

  // 2. Opponent Username validation
  const rawOpponent = args.opponentUsername?.trim();
  if (rawOpponent) {
    result.opponent.provided = true;
    const cleanUsername = extractCleanUsername(rawOpponent);
    if (!cleanUsername) {
      result.opponent.valid = false;
      result.opponent.error = "Opponent username cannot be empty";
      result.allValid = false;
    } else {
      const player = await ctx.db
        .query("players")
        .withIndex("by_usernameLower", (q: any) =>
          q.eq("usernameLower", cleanUsername.toLowerCase())
        )
        .first();
      if (!player) {
        result.opponent.valid = false;
        result.opponent.error = `Player "@${cleanUsername}" does not exist`;
        result.allValid = false;
      } else {
        result.opponent.valid = true;
        result.opponent.label = `@${player.username} (${player.ratingHuman ?? player.rating} Elo)`;
        result.opponent.rating = player.ratingHuman ?? player.rating;
      }
    }
  }

  // 3. Match / Wager ID validation
  const rawMatch = args.matchId?.trim();
  if (rawMatch) {
    result.match.provided = true;
    const cleanMatchId = extractCleanId(rawMatch);

    let found = false;
    // Check games table
    const asGame = ctx.db.normalizeId("games", cleanMatchId);
    if (asGame && (await ctx.db.get("games", asGame))) {
      found = true;
      result.match.label = `Match Game #${cleanMatchId.slice(0, 8)}`;
    }

    // Check challenges table
    if (!found) {
      const asChallenge = ctx.db.normalizeId("challenges", cleanMatchId);
      if (asChallenge && (await ctx.db.get("challenges", asChallenge))) {
        found = true;
        result.match.label = `Challenge #${cleanMatchId.slice(0, 8)}`;
      }
    }

    // Check tournamentMatches table
    if (!found) {
      const asTm = ctx.db.normalizeId("tournamentMatches", cleanMatchId);
      if (asTm && (await ctx.db.get("tournamentMatches", asTm))) {
        found = true;
        result.match.label = `Tournament Match #${cleanMatchId.slice(0, 8)}`;
      }
    }

    // Check financialLedger by referenceId where referenceType == "match"
    if (!found) {
      const ledgerEntry = await ctx.db
        .query("financialLedger")
        .withIndex("by_referenceType_and_referenceId", (q: any) =>
          q.eq("referenceType", "match").eq("referenceId", cleanMatchId)
        )
        .first();
      if (ledgerEntry) {
        found = true;
        result.match.label = `Wager / Match Ledger #${cleanMatchId.slice(0, 8)}`;
      }
    }

    // Check financialLedger by idempotencyKey
    if (!found) {
      const ledgerKey = await ctx.db
        .query("financialLedger")
        .withIndex("by_idempotencyKey", (q: any) => q.eq("idempotencyKey", cleanMatchId))
        .first();
      if (ledgerKey) {
        found = true;
        result.match.label = `Ledger Ref #${cleanMatchId.slice(0, 8)}`;
      }
    }

    if (!found) {
      result.match.valid = false;
      result.match.error = "Match or wager ID was not found";
      result.allValid = false;
    } else {
      result.match.valid = true;
    }
  }

  // 4. Tournament ID validation
  const rawTourney = args.tournamentId?.trim();
  if (rawTourney) {
    result.tournament.provided = true;
    const cleanTourneyId = extractCleanId(rawTourney);

    let tourney = null;
    const asTourney = ctx.db.normalizeId("tournaments", cleanTourneyId);
    if (asTourney) {
      tourney = await ctx.db.get("tournaments", asTourney);
    }
    if (!tourney) {
      tourney = await ctx.db
        .query("tournaments")
        .filter((q: any) => q.eq(q.field("title"), cleanTourneyId))
        .first();
    }

    if (!tourney) {
      result.tournament.valid = false;
      result.tournament.error = "Tournament was not found";
      result.allValid = false;
    } else {
      result.tournament.valid = true;
      result.tournament.label = `Tournament: ${tourney.title}`;
    }
  }

  return result;
}

/** Query to validate optional chess match details in real time */
export const validateMatchContext = query({
  args: {
    gameId: v.optional(v.string()),
    opponentUsername: v.optional(v.string()),
    matchId: v.optional(v.string()),
    tournamentId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Read-only existence check does not require player provisioning
    try {
      return await checkMatchContext(ctx, args);
    } catch (err) {
      console.warn("checkMatchContext error:", err);
      return {
        game: { provided: Boolean(args.gameId), valid: false, error: "Validation temporarily unavailable" },
        opponent: { provided: Boolean(args.opponentUsername), valid: false, error: "Validation temporarily unavailable" },
        match: { provided: Boolean(args.matchId), valid: false, error: "Validation temporarily unavailable" },
        tournament: { provided: Boolean(args.tournamentId), valid: false, error: "Validation temporarily unavailable" },
        allValid: false,
      };
    }
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
      throw new Error("feedback-description-too-short");
    }
    if (trimmedDescription.length > 4000) {
      throw new Error("feedback-description-too-long");
    }

    if (args.attachments.length > 5) {
      throw new Error("too-many-attachments");
    }

    // Clean all context fields
    const cleanGameId = args.gameId ? extractCleanId(args.gameId) : undefined;
    const cleanMatchId = args.matchId ? extractCleanId(args.matchId) : undefined;
    const cleanTournamentId = args.tournamentId ? extractCleanId(args.tournamentId) : undefined;
    const cleanOpponent = args.opponentUsername ? extractCleanUsername(args.opponentUsername) : undefined;

    // Validate optional chess match details if any are provided
    const matchCheck = await checkMatchContext(ctx, {
      gameId: cleanGameId,
      opponentUsername: cleanOpponent,
      matchId: cleanMatchId,
      tournamentId: cleanTournamentId,
    });

    if (matchCheck.game.provided && !matchCheck.game.valid) {
      throw new Error("game-not-found");
    }
    if (matchCheck.opponent.provided && !matchCheck.opponent.valid) {
      throw new Error("opponent-not-found");
    }
    if (matchCheck.match.provided && !matchCheck.match.valid) {
      throw new Error("match-not-found");
    }
    if (matchCheck.tournament.provided && !matchCheck.tournament.valid) {
      throw new Error("tournament-not-found");
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
      gameId: cleanGameId ? cleanGameId.slice(0, 128) : undefined,
      matchId: cleanMatchId ? cleanMatchId.slice(0, 128) : undefined,
      tournamentId: cleanTournamentId ? cleanTournamentId.slice(0, 128) : undefined,
      opponentUsername: cleanOpponent ? cleanOpponent.slice(0, 128) : undefined,
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

    return items.map((item) => {
      const copy = { ...item };
      delete (copy as { adminNotes?: string }).adminNotes;
      return copy;
    });
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
      throw new Error("feedback-not-found");
    }

    let isAuthorized = false;

    // Check owner authorization first
    try {
      const player = await requirePlayer(ctx);
      if (feedback.userId === player._id) {
        isAuthorized = true;
      }
    } catch {
      // Not an authenticated player
    }

    // If not owner, check admin authorization
    if (!isAuthorized) {
      try {
        await requireAdmin(ctx);
        isAuthorized = true;
      } catch {
        // Not admin
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

    const total = all.length;
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
      throw new Error("feedback-not-found");
    }

    const now = Date.now();
    const patch: Record<string, unknown> = {
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
      throw new Error("feedback-not-found");
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
      throw new Error("feedback-not-found");
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

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

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

    // Idempotency: skip if already sent
    if (feedback.emailStatus === "SENT") {
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
        emailStatus: "NOT_SENT",
        emailError: "No email address on file",
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
      const safeUserName = escapeHtml(feedback.userName || "Player");
      const safeDescription = escapeHtml(feedback.description);

      const html = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 28px; background: #0f172a; color: #f8fafc; border-radius: 16px; border: 1px solid #334155;">
          <div style="display: flex; align-items: center; margin-bottom: 20px;">
            <h1 style="color: #10b981; margin: 0; font-size: 22px; font-weight: 700; letter-spacing: -0.5px;">Castle Chess</h1>
          </div>
          <h2 style="color: #ffffff; font-size: 18px; margin-top: 0; margin-bottom: 12px;">Thanks for your feedback ♟</h2>
          <p style="font-size: 15px; line-height: 1.6; color: #cbd5e1; margin-bottom: 16px;">
            Hi <strong>${safeUserName}</strong>, thank you for sharing your feedback with the Castle team! We review every submission closely to keep improving our chess experience.
          </p>
          <div style="background: #1e293b; border: 1px solid #334155; border-radius: 10px; padding: 16px; margin-bottom: 20px;">
            <p style="font-size: 13px; text-transform: uppercase; color: #94a3b8; font-weight: 600; margin: 0 0 6px 0;">Category: ${categoryLabel}</p>
            <p style="font-size: 14px; line-height: 1.5; color: #f1f5f9; margin: 0; white-space: pre-wrap;">${safeDescription}</p>
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
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error("[Feedback Email Action Error]", err);
      await ctx.runMutation(internal.feedback.internalUpdateEmailStatus, {
        feedbackId: args.feedbackId,
        emailStatus: "FAILED",
        emailError: errorMessage,
      });
    }
  },
});
