import { describe, expect, test } from "vitest";
import { api } from "../_generated/api";
import { requireCompletedPlayer } from "../lib/auth";
import { as, makeTest, signUp } from "./harness.setup";

describe("profile immutability & completed player rules", () => {
  describe("requireCompletedPlayer", () => {
    test("throws 'profile-incomplete' when profileCompleted is missing", async () => {
      const t = makeTest();
      const alice = await signUp(t, "alice");

      await expect(
        as(t, alice).run(async (ctx) => {
          return await requireCompletedPlayer(ctx);
        })
      ).rejects.toThrow("profile-incomplete");
    });

    test("throws 'profile-incomplete' when profileCompleted is false", async () => {
      const t = makeTest();
      const alice = await signUp(t, "alice");

      await t.run(async (ctx) => {
        await ctx.db.patch("players", alice.id, {
          profileCompleted: false,
        });
      });

      await expect(
        as(t, alice).run(async (ctx) => {
          return await requireCompletedPlayer(ctx);
        })
      ).rejects.toThrow("profile-incomplete");
    });

    test("returns player when profileCompleted is true", async () => {
      const t = makeTest();
      const alice = await signUp(t, "alice");

      await t.run(async (ctx) => {
        await ctx.db.patch("players", alice.id, {
          profileCompleted: true,
          profileCompletedAt: Date.now(),
        });
      });

      const player = await as(t, alice).run(async (ctx) => {
        return await requireCompletedPlayer(ctx);
      });

      expect(player._id).toBe(alice.id);
      expect(player.profileCompleted).toBe(true);
    });
  });

  describe("schema extensions", () => {
    test("userPresence table supports inserting and querying by playerId and lastSeen", async () => {
      const t = makeTest();
      const alice = await signUp(t, "presence_alice");
      const now = Date.now();

      const presenceId = await t.run(async (ctx) => {
        return await ctx.db.insert("userPresence", {
          playerId: alice.id,
          lastSeen: now,
          updatedAt: now,
        });
      });
      expect(presenceId).toBeDefined();

      const byPlayer = await t.run(async (ctx) => {
        return await ctx.db
          .query("userPresence")
          .withIndex("by_playerId", (q) => q.eq("playerId", alice.id))
          .unique();
      });
      expect(byPlayer).not.toBeNull();
      expect(byPlayer?.playerId).toBe(alice.id);

      const bySeen = await t.run(async (ctx) => {
        return await ctx.db
          .query("userPresence")
          .withIndex("by_lastSeen", (q) => q.eq("lastSeen", now))
          .unique();
      });
      expect(bySeen?._id).toBe(presenceId);
    });

    test("players table supports new profile fields and indexes", async () => {
      const t = makeTest();
      const alice = await signUp(t, "indexed_alice");
      const now = Date.now();

      await t.run(async (ctx) => {
        await ctx.db.patch("players", alice.id, {
          displayName: "Alice W.",
          phoneNumber: "+251911223344",
          profileCompleted: true,
          profileCompletedAt: now,
        });
      });

      const byCompleted = await t.run(async (ctx) => {
        return await ctx.db
          .query("players")
          .withIndex("by_profileCompleted", (q) => q.eq("profileCompleted", true))
          .collect();
      });
      expect(byCompleted.some((p) => p._id === alice.id)).toBe(true);

      const byName = await t.run(async (ctx) => {
        return await ctx.db
          .query("players")
          .withIndex("by_displayName", (q) => q.eq("displayName", "Alice W."))
          .collect();
      });
      expect(byName.some((p) => p._id === alice.id)).toBe(true);
    });
  });
});

