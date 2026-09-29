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

/** `null` instead of a throw — for queries that render outside `<Authenticated>`. */
export async function optionalPlayer(ctx: AnyCtx): Promise<Doc<"players"> | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (identity === null) return null;
  return await playerForIdentity(ctx, identity);
}

const ADMIN_EMAILS = new Set([
  "yaredusk@gmail.com",
]);

const ADMIN_CLERK_IDS = new Set([
  "user_3JfrI7CJEW9GIMo1UsEAvK9M0Ki", // yaredusk@gmail.com
]);

/** Check if current user is an admin. */
export async function requireAdmin(ctx: AnyCtx): Promise<Doc<"players">> {
  const identity = await requireIdentity(ctx);
  const player = await requirePlayer(ctx);
  const adminId = process.env.ADMIN_CLERK_ID;
  
  if (adminId && player.clerkId === adminId) {
    return player;
  }

  if (ADMIN_CLERK_IDS.has(player.clerkId)) {
    return player;
  }

  const email = (player.email ?? identity.email ?? "").toLowerCase();
  if (email && ADMIN_EMAILS.has(email)) {
    return player;
  }

  throw new Error("unauthorized-admin");
}
