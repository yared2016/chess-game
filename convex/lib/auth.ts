// convex/lib/auth.ts
//
// Identity always comes from `ctx.auth.getUserIdentity()` — never from a function
// argument (FR-5, Convex auth guidelines). `tokenIdentifier` ("<issuer>|<subject>")
// is the canonical key; `by_tokenIdentifier` is the only index auth paths use.
import type { UserIdentity } from "convex/server";
import type { Doc } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

export type AnyCtx = QueryCtx | MutationCtx;

/** Throws when the caller is not signed in. */
export async function requireIdentity(ctx: AnyCtx): Promise<UserIdentity> {
  const identity = await ctx.auth.getUserIdentity();
  if (identity === null) throw new Error("Not authenticated");
  return identity;
}

/** The `players` row for an identity, or null when `ensurePlayer` has not run yet. */
export async function playerForIdentity(
  ctx: AnyCtx,
  identity: UserIdentity,
): Promise<Doc<"players"> | null> {
  const byToken = await ctx.db
    .query("players")
    .withIndex("by_tokenIdentifier", (q) =>
      q.eq("tokenIdentifier", identity.tokenIdentifier),
    )
    .unique();
  if (byToken !== null) {
    return byToken;
  }

  const byClerkId = await ctx.db
    .query("players")
    .withIndex("by_clerkId", (q) =>
      q.eq("clerkId", identity.subject),
    )
    .unique();

  if (byClerkId !== null) {
    if ("patch" in ctx.db) {
      await (ctx as MutationCtx).db.patch(byClerkId._id, {
        tokenIdentifier: identity.tokenIdentifier,
        updatedAt: Date.now(),
      });
    }
    return byClerkId;
  }

  return null;
}

/** Signed in AND provisioned. The default gate for every mutation. */
export async function requirePlayer(ctx: AnyCtx): Promise<Doc<"players">> {
  const identity = await requireIdentity(ctx);
  const player = await playerForIdentity(ctx, identity);
  if (player === null) throw new Error("Player not provisioned");
  return player;
}

/** Signed in, provisioned, AND profile completed. Throws "profile-incomplete" if not completed. */
export async function requireCompletedPlayer(ctx: AnyCtx): Promise<Doc<"players">> {
  const player = await requirePlayer(ctx);
  if (!player.profileCompleted) {
    throw new Error("profile-incomplete");
  }
  return player;
}

/** `null` instead of a throw — for queries that render outside `<Authenticated>`. */
export async function optionalPlayer(ctx: AnyCtx): Promise<Doc<"players"> | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (identity === null) return null;
  return await playerForIdentity(ctx, identity);
}

export type AdminPermission =
  | "view_analytics"
  | "view_ledger"
  | "manage_games"
  | "approve_tier2_deposits"
  | "review_withdrawals"
  | "manage_tariffs"
  | "view_pii";

export const OWNER_EMAILS = new Set(["yaredusk0@gmail.com"]);
export const ADMIN_EMAILS = new Set(["yaredusk0@gmail.com"]);

export const DEFAULT_OWNER_CLERK_ID = "user_3JfrI7CJEW9GIMo1UsEAvK9M0Ki";

/** Retrieves canonical Owner Clerk Subject ID from systemConfig or server env. */
export async function getOwnerClerkId(ctx: AnyCtx): Promise<string | null> {
  try {
    const systemConfig = await (ctx.db as any)
      .query("systemConfig")
      .withIndex("by_key", (q: any) => q.eq("key", "system"))
      .first();
    if (systemConfig?.owner_identity) {
      return systemConfig.owner_identity;
    }
  } catch {
    // systemConfig table might not yet exist during initial setup
  }
  return process.env.OWNER_CLERK_ID || process.env.ADMIN_CLERK_ID || DEFAULT_OWNER_CLERK_ID;
}

/** Returns true if caller is the authenticated Owner. */
export async function isOwner(ctx: AnyCtx): Promise<boolean> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return false;
  if (identity.email && OWNER_EMAILS.has(identity.email.toLowerCase())) {
    return true;
  }
  const ownerId = await getOwnerClerkId(ctx);
  return Boolean(ownerId && identity.subject === ownerId);
}

/** Requires caller to be the platform Owner verified via Clerk Subject ID or authorized Owner email. */
export async function requireOwner(ctx: AnyCtx): Promise<{ identity: UserIdentity; player: Doc<"players"> }> {
  const identity = await requireIdentity(ctx);
  const ownerId = await getOwnerClerkId(ctx);
  const isEmailOwner = Boolean(identity.email && OWNER_EMAILS.has(identity.email.toLowerCase()));

  if (!isEmailOwner && (!ownerId || identity.subject !== ownerId)) {
    throw new Error("unauthorized-admin");
  }

  const player = await requirePlayer(ctx);
  return { identity, player };
}

/** Checks whether caller has a specific scoped administrative permission. */
export async function hasAdminPermission(
  ctx: AnyCtx,
  permission: AdminPermission
): Promise<boolean> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return false;

  if (identity.email && (OWNER_EMAILS.has(identity.email.toLowerCase()) || ADMIN_EMAILS.has(identity.email.toLowerCase()))) {
    return true; // Root owner/admin holds all permissions
  }

  const ownerId = await getOwnerClerkId(ctx);
  if (ownerId && identity.subject === ownerId) {
    return true; // Root owner holds all permissions
  }

  const player = await playerForIdentity(ctx, identity);
  if (!player) return false;

  const playerAny = player as any;
  if (playerAny.adminRole === "owner") return true;
  if (Array.isArray(playerAny.adminPermissions) && playerAny.adminPermissions.includes(permission)) {
    return true;
  }

  // Check systemConfig staff_permissions mapping
  try {
    const systemConfig = await (ctx.db as any)
      .query("systemConfig")
      .withIndex("by_key", (q: any) => q.eq("key", "system"))
      .first();
    const staffPerms = systemConfig?.staff_permissions?.[identity.subject];
    if (Array.isArray(staffPerms) && staffPerms.includes(permission)) {
      return true;
    }
  } catch {
    // systemConfig table might not yet exist
  }

  return false;
}

/** Requires caller to have a specific scoped administrative permission. */
export async function requireAdminPermission(
  ctx: AnyCtx,
  permission: AdminPermission
): Promise<{ identity: UserIdentity; player: Doc<"players"> }> {
  const identity = await requireIdentity(ctx);
  const allowed = await hasAdminPermission(ctx, permission);
  if (!allowed) {
    throw new Error(`ERR_UNAUTHORIZED_PERMISSION_REQUIRED: ${permission}`);
  }
  const player = await requirePlayer(ctx);
  return { identity, player };
}

/** Check if current user is an admin or owner. */
export async function requireAdmin(ctx: AnyCtx): Promise<Doc<"players">> {
  const identity = await requireIdentity(ctx);
  const player = await requirePlayer(ctx);
  const ownerId = await getOwnerClerkId(ctx);

  if (identity.email && (OWNER_EMAILS.has(identity.email.toLowerCase()) || ADMIN_EMAILS.has(identity.email.toLowerCase()))) {
    return player;
  }

  if (ownerId && (identity.subject === ownerId || player.clerkId === ownerId)) {
    return player;
  }

  const playerAny = player as any;
  if (playerAny.adminRole === "owner" || playerAny.adminRole === "staff_admin") {
    return player;
  }
  if (Array.isArray(playerAny.adminPermissions) && playerAny.adminPermissions.length > 0) {
    return player;
  }

  // Check systemConfig staff_permissions
  try {
    const systemConfig = await (ctx.db as any)
      .query("systemConfig")
      .withIndex("by_key", (q: any) => q.eq("key", "system"))
      .first();
    const staffPerms = systemConfig?.staff_permissions?.[identity.subject];
    if (Array.isArray(staffPerms) && staffPerms.length > 0) {
      return player;
    }
  } catch {
    // systemConfig table might not yet exist
  }

  throw new Error("unauthorized-admin");
}
