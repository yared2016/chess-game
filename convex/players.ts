// convex/players.ts — FR-1…FR-5, FR-15, FR-21e/j/k/l, FR-31
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import {
  optionalPlayer,
  playerForIdentity,
  requireIdentity,
  requirePlayer,
} from "./lib/auth";
import { MAX_ROOM_IMAGE_BYTES } from "./lib/constants";
import { START_RATING } from "./lib/elo";
import { vMe, vPlayerProfile } from "./lib/returns";
import {
  vBoardView,
  vQualityTier,
  vRoomColors,
  vRoomPreset,
} from "./lib/validators";
const HEX_COLOUR = /^#[0-9a-fA-F]{6}$/;

export const RESERVED_USERNAMES = new Set([
  "admin",
  "castle",
  "system",
  "moderator",
  "support",
]);

export function validateUsernameFormat(username: string): { valid: boolean; reason?: string } {
  if (username.length < 3) {
    return { valid: false, reason: "Username must be at least 3 characters." };
  }
  if (username.length > 20) {
    return { valid: false, reason: "Username must be at most 20 characters." };
  }
  if (RESERVED_USERNAMES.has(username.toLowerCase())) {
    return { valid: false, reason: "This username is reserved." };
  }
  if (!/^[a-z0-9_-]+$/.test(username)) {
    return {
      valid: false,
      reason: "Username can only contain lowercase letters, numbers, underscores, and hyphens.",
    };
  }
  return { valid: true };
}

export function validatePhoneNumber(phone: string): boolean {
  // E.164: + followed by 8 to 15 digits
  if (!/^\+[1-9]\d{7,14}$/.test(phone)) {
    return false;
  }
  // Ethiopian numbers: +251 followed by 9 digits starting with 7 or 9
  if (phone.startsWith("+251")) {
    return /^\+251[79]\d{8}$/.test(phone);
  }
  return true;
}

/**
 * `usernameLower` has to be collision-free: three public queries resolve a profile
 * through `by_usernameLower`, and two rows sharing a name would make all of them
 * throw. Clerk only guarantees uniqueness for the username claim — `name` (the
 * display name we fall back to) is not unique, so the candidate is checked here
 * and disambiguated with the Clerk subject before it is written.
 */
async function freeUsername(
  ctx: MutationCtx,
  candidate: string,
  identity: { subject: string; tokenIdentifier: string },
): Promise<string> {
  const suffix = identity.subject.slice(-6);
  const options = [candidate, `${candidate}-${suffix}`, `player${suffix}`];

  for (const option of options) {
    const taken: Doc<"players"> | null = await ctx.db
      .query("players")
      .withIndex("by_usernameLower", (q) => q.eq("usernameLower", option.toLowerCase()))
      .first();
    if (
      taken === null ||
      taken.tokenIdentifier === identity.tokenIdentifier ||
      taken.clerkId === identity.subject
    ) {
      return option;
    }
  }
  return options[options.length - 1];
}

function assertHexColours(colors: {
  background: string;
  lightSquare: string;
  darkSquare: string;
}): void {
  for (const value of [colors.background, colors.lightSquare, colors.darkSquare]) {
    if (!HEX_COLOUR.test(value)) throw new Error("invalid-colour");
  }
}

/**
 * Upsert the caller's row from their Clerk identity (FR-3). Idempotent — the
 * client calls it once per session. No client-supplied user id is ever accepted
 * (FR-5): everything comes from `ctx.auth.getUserIdentity()`.
 */
export const ensurePlayer = mutation({
  args: {},
  returns: v.id("players"),
  handler: async (ctx) => {
    const identity = await requireIdentity(ctx);
    const now = Date.now();

    // `nickname` is the Clerk username on this instance; the other claims are
    // usually null (clerk-setup.md §0, ARCHITECTURE §I-13).
    const candidate =
      identity.nickname ??
      identity.preferredUsername ??
      identity.name ??
      `player${identity.subject.slice(-6)}`;
    const username = await freeUsername(ctx, candidate, identity);
    const avatarUrl = identity.pictureUrl ?? "";
    const email = identity.email ? identity.email.toLowerCase() : undefined;

    const existing = await playerForIdentity(ctx, identity);
    if (existing !== null) {
      const patchData: Record<string, any> = {};
      if (!existing.profileCompleted && existing.username !== username) {
        patchData.username = username;
        patchData.usernameLower = username.toLowerCase();
      }
      if (existing.avatarUrl !== avatarUrl) {
        patchData.avatarUrl = avatarUrl;
      }
      if (email && existing.email !== email) {
        patchData.email = email;
      }
      if (Object.keys(patchData).length > 0) {
        patchData.updatedAt = now;
        await ctx.db.patch("players", existing._id, patchData);
      }
      return existing._id;
    }

    return await ctx.db.insert("players", {
      clerkId: identity.subject,
      tokenIdentifier: identity.tokenIdentifier,
      username,
      usernameLower: username.toLowerCase(),
      avatarUrl,
      email,
      rating: START_RATING,
      ratingHuman: START_RATING,
      ratingAi: START_RATING,
      wins: 0,
      losses: 0,
      draws: 0,
      roomPreset: "study",
      boardFlipEnabled: true,
      boardView: "3d",
      qualityTier: "auto",
      postFxEnabled: true,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/** The caller's own row. Returns null when unauthenticated so it is safe to
 *  render outside `<Authenticated>`. */
export const me = query({
  args: {},
  returns: v.union(vMe, v.null()),
  handler: async (ctx) => {
    const player = await optionalPlayer(ctx);
    if (player === null) return null;
    const roomImageUrl =
      player.roomImageStorageId === undefined
        ? null
        : await ctx.storage.getUrl(player.roomImageStorageId);
    return { ...player, roomImageUrl };
  },
});

/** Public profile projection — never leaks settings or `clerkId` (FR-53). */
export const getByUsername = query({
  args: { username: v.string() },
  returns: v.union(vPlayerProfile, v.null()),
  handler: async (ctx, args) => {
    // `.first()`, not `.unique()`: `ensurePlayer` keeps `usernameLower` unique, but
    // a legacy duplicate must degrade to one profile, never to a 500 for both.
    const player = await ctx.db
      .query("players")
      .withIndex("by_usernameLower", (q) =>
        q.eq("usernameLower", args.username.toLowerCase()),
      )
      .first();
    if (player === null) return null;
    return {
      _id: player._id,
      username: player.username,
      avatarUrl: player.avatarUrl,
      rating: player.rating,
      ratingHuman: player.ratingHuman,
      ratingAi: player.ratingAi,
      wins: player.wins,
      losses: player.losses,
      draws: player.draws,
      createdAt: player.createdAt,
      displayName: player.displayName,
    };
  },
});

/** Check whether a candidate username is available and valid for onboarding / renaming. */
export const checkUsernameAvailability = query({
  args: { username: v.string() },
  returns: v.object({
    available: v.boolean(),
    reason: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const formatCheck = validateUsernameFormat(args.username);
    if (!formatCheck.valid) {
      return { available: false, reason: formatCheck.reason };
    }

    const player = await optionalPlayer(ctx);
    const existing = await ctx.db
      .query("players")
      .withIndex("by_usernameLower", (q) =>
        q.eq("usernameLower", args.username.toLowerCase()),
      )
      .first();

    if (existing !== null) {
      if (player !== null && player._id === existing._id) {
        return { available: true };
      }
      return { available: false, reason: "Username is already taken." };
    }

    return { available: true };
  },
});

/** Complete onboarding profile mutation. */
export const completeProfile = mutation({
  args: {
    username: v.string(),
    displayName: v.string(),
    phoneNumber: v.string(),
    fullName: v.optional(v.string()),
    telebirrNumber: v.optional(v.string()),
    bankCode: v.optional(v.string()),
    bankName: v.optional(v.string()),
    bankAccountNumber: v.optional(v.string()),
    accountHolderName: v.optional(v.string()),
  },
  returns: v.object({
    success: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const player = await requirePlayer(ctx);
    const now = Date.now();

    // Validate username format & reserved words
    const formatCheck = validateUsernameFormat(args.username);
    if (!formatCheck.valid) {
      if (RESERVED_USERNAMES.has(args.username.toLowerCase())) {
        throw new Error("username-reserved");
      }
      throw new Error("invalid-username");
    }

    // Validate username collision
    const existing = await ctx.db
      .query("players")
      .withIndex("by_usernameLower", (q) =>
        q.eq("usernameLower", args.username.toLowerCase()),
      )
      .first();

    if (existing !== null && existing._id !== player._id) {
      throw new Error("username-taken");
    }

    // Validate displayName (min 2, max 30 chars)
    const displayName = args.displayName.trim();
    if (displayName.length < 2 || displayName.length > 30) {
      throw new Error("invalid-display-name");
    }

    // Validate phoneNumber (E.164, Ethiopian +251 rules)
    const phone = args.phoneNumber.trim();
    if (!validatePhoneNumber(phone)) {
      throw new Error("invalid-phone-number");
    }

    // Optional fullName validation (2 to 70 chars)
    const fullName = args.fullName ? args.fullName.trim() : undefined;
    if (fullName && (fullName.length < 2 || fullName.length > 70)) {
      throw new Error("invalid-full-name");
    }

    // Optional telebirr validation
    const telebirr = args.telebirrNumber ? args.telebirrNumber.trim() : undefined;
    if (telebirr && !validatePhoneNumber(telebirr)) {
      throw new Error("invalid-telebirr-number");
    }

    await ctx.db.patch("players", player._id, {
      username: args.username,
      usernameLower: args.username.toLowerCase(),
      displayName,
      phoneNumber: phone,
      fullName: fullName ?? player.fullName,
      telebirrNumber: telebirr ?? player.telebirrNumber,
      bankCode: args.bankCode ?? player.bankCode,
      bankName: args.bankName ?? player.bankName,
      bankAccountNumber: args.bankAccountNumber ?? player.bankAccountNumber,
      accountHolderName: args.accountHolderName ?? fullName ?? player.accountHolderName,
      profileCompleted: true,
      profileCompletedAt: player.profileCompletedAt ?? now,
      updatedAt: now,
    });

    return { success: true };
  },
});

/** Update withdrawal payout accounts anytime from settings or wallet. */
export const updatePayoutSettings = mutation({
  args: {
    fullName: v.optional(v.string()),
    telebirrNumber: v.optional(v.string()),
    bankCode: v.optional(v.string()),
    bankName: v.optional(v.string()),
    bankAccountNumber: v.optional(v.string()),
    accountHolderName: v.optional(v.string()),
  },
  returns: v.object({
    success: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const player = await requirePlayer(ctx);
    const now = Date.now();

    const fullName = args.fullName ? args.fullName.trim() : undefined;
    if (fullName && (fullName.length < 2 || fullName.length > 70)) {
      throw new Error("invalid-full-name");
    }

    const telebirr = args.telebirrNumber ? args.telebirrNumber.trim() : undefined;
    if (telebirr && !validatePhoneNumber(telebirr)) {
      throw new Error("invalid-telebirr-number");
    }

    await ctx.db.patch("players", player._id, {
      fullName: fullName ?? player.fullName,
      telebirrNumber: telebirr ?? player.telebirrNumber,
      bankCode: args.bankCode ?? player.bankCode,
      bankName: args.bankName ?? player.bankName,
      bankAccountNumber: args.bankAccountNumber ?? player.bankAccountNumber,
      accountHolderName: args.accountHolderName ?? fullName ?? player.accountHolderName,
      updatedAt: now,
    });

    return { success: true };
  },
});

/** Patch only the supplied keys. `roomColors: null` clears them. */
export const updateSettings = mutation({
  args: {
    boardView: v.optional(vBoardView),
    roomPreset: v.optional(vRoomPreset),
    roomColors: v.optional(v.union(vRoomColors, v.null())),
    boardFlipEnabled: v.optional(v.boolean()),
    qualityTier: v.optional(vQualityTier),
    postFxEnabled: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const player = await requirePlayer(ctx);
    const patch: {
      boardView?: "2d" | "3d";
      roomPreset?: "study" | "space" | "park" | "arcade" | "minimal" | "custom";
      roomColors?: { background: string; lightSquare: string; darkSquare: string };
      boardFlipEnabled?: boolean;
      qualityTier?: "auto" | "low" | "medium" | "high";
      postFxEnabled?: boolean;
      updatedAt: number;
    } = { updatedAt: Date.now() };

    if (args.boardView !== undefined) patch.boardView = args.boardView;
    if (args.roomPreset !== undefined) patch.roomPreset = args.roomPreset;
    if (args.boardFlipEnabled !== undefined) {
      patch.boardFlipEnabled = args.boardFlipEnabled;
    }
    if (args.qualityTier !== undefined) patch.qualityTier = args.qualityTier;
    if (args.postFxEnabled !== undefined) patch.postFxEnabled = args.postFxEnabled;
    if (args.roomColors !== undefined) {
      if (args.roomColors === null) {
        // `undefined` in a patch removes the field.
        patch.roomColors = undefined;
      } else {
        assertHexColours(args.roomColors);
        patch.roomColors = args.roomColors;
      }
    }

    await ctx.db.patch("players", player._id, patch);
    return null;
  },
});

/** FR-21k. The returned URL expires in one hour. */
export const generateUploadUrl = mutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    await requirePlayer(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

/** FR-21k. Enforces the 5 MB / `image/*` limits from the `_storage` metadata. */
export const setRoomImage = mutation({
  args: { storageId: v.id("_storage") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const player = await requirePlayer(ctx);
    const metadata = await ctx.db.system.get("_storage", args.storageId);
    if (metadata === null) throw new Error("upload-not-found");

    const contentType = metadata.contentType ?? "";
    if (metadata.size > MAX_ROOM_IMAGE_BYTES || !contentType.startsWith("image/")) {
      await ctx.storage.delete(args.storageId);
      throw new Error("invalid-room-image");
    }

    if (
      player.roomImageStorageId !== undefined &&
      player.roomImageStorageId !== args.storageId
    ) {
      await ctx.storage.delete(player.roomImageStorageId);
    }

    await ctx.db.patch("players", player._id, {
      roomImageStorageId: args.storageId,
      roomPreset: "custom",
      updatedAt: Date.now(),
    });
    return null;
  },
});

export const clearRoomImage = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const player = await requirePlayer(ctx);
    if (player.roomImageStorageId === undefined) return null;
    await ctx.storage.delete(player.roomImageStorageId);
    await ctx.db.patch("players", player._id, {
      roomImageStorageId: undefined,
      updatedAt: Date.now(),
    });
    return null;
  },
});
