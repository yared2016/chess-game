import { describe, expect, test } from "vitest";
import { api } from "../_generated/api";
import { as, makeTest, signUp } from "./harness.setup";

describe("platform presence", () => {
  describe("presence.heartbeat", () => {
    test("rejects unauthenticated caller", async () => {
      const t = makeTest();
      await expect(t.mutation(api.presence.heartbeat, {})).rejects.toThrow(/Not authenticated/);
    });

    test("inserts new userPresence row on first heartbeat and returns null", async () => {
      const t = makeTest();
      const alice = await signUp(t, "alice");

      const result = await as(t, alice).mutation(api.presence.heartbeat, {});
      expect(result).toBeNull();

      const presence = await t.run(async (ctx) => {
        return await ctx.db
          .query("userPresence")
          .withIndex("by_playerId", (q) => q.eq("playerId", alice.id))
          .unique();
      });

      expect(presence).not.toBeNull();
      expect(presence?.playerId).toBe(alice.id);
      expect(presence?.lastSeen).toBeGreaterThan(0);
      expect(presence?.updatedAt).toBe(presence?.lastSeen);
    });

    test("patches existing userPresence row on subsequent heartbeats without creating duplicate rows", async () => {
      const t = makeTest();
      const alice = await signUp(t, "alice");

      await as(t, alice).mutation(api.presence.heartbeat, {});

      const firstPresence = await t.run(async (ctx) => {
        return await ctx.db
          .query("userPresence")
          .withIndex("by_playerId", (q) => q.eq("playerId", alice.id))
          .unique();
      });
      expect(firstPresence).not.toBeNull();

      // Backdate the first presence record
      await t.run(async (ctx) => {
        await ctx.db.patch(firstPresence!._id, {
          lastSeen: Date.now() - 30_000,
          updatedAt: Date.now() - 30_000,
        });
      });

      // Second heartbeat
      await as(t, alice).mutation(api.presence.heartbeat, {});

      const rows = await t.run(async (ctx) => {
        return await ctx.db
          .query("userPresence")
          .withIndex("by_playerId", (q) => q.eq("playerId", alice.id))
          .collect();
      });

      expect(rows).toHaveLength(1);
      expect(rows[0]._id).toBe(firstPresence!._id);
      expect(rows[0].lastSeen).toBeGreaterThan(firstPresence!.lastSeen);
      expect(rows[0].updatedAt).toBe(rows[0].lastSeen);
    });
  });

  describe("presence.getPresence", () => {
    test("returns { isOnline: false, lastSeen: 0 } when player has no presence record", async () => {
      const t = makeTest();
      const bob = await signUp(t, "bob");

      const res = await t.query(api.presence.getPresence, { playerId: bob.id });
      expect(res).toEqual({ isOnline: false, lastSeen: 0 });
    });

    test("returns { isOnline: true, lastSeen } when lastSeen is <= 60 seconds", async () => {
      const t = makeTest();
      const alice = await signUp(t, "alice");

      await as(t, alice).mutation(api.presence.heartbeat, {});

      const res = await t.query(api.presence.getPresence, { playerId: alice.id });
      expect(res.isOnline).toBe(true);
      expect(res.lastSeen).toBeGreaterThan(0);
    });

    test("returns { isOnline: false, lastSeen } when lastSeen is older than 60 seconds", async () => {
      const t = makeTest();
      const alice = await signUp(t, "alice");

      await as(t, alice).mutation(api.presence.heartbeat, {});

      const presence = await t.run(async (ctx) => {
        return await ctx.db
          .query("userPresence")
          .withIndex("by_playerId", (q) => q.eq("playerId", alice.id))
          .unique();
      });

      // Backdate lastSeen past 60s threshold (e.g. 61s ago)
      const staleTime = Date.now() - 65_000;
      await t.run(async (ctx) => {
        await ctx.db.patch(presence!._id, {
          lastSeen: staleTime,
          updatedAt: staleTime,
        });
      });

      const res = await t.query(api.presence.getPresence, { playerId: alice.id });
      expect(res.isOnline).toBe(false);
      expect(res.lastSeen).toBe(staleTime);
    });
  });

  describe("presence.getBatchPresence", () => {
    test("returns empty map when playerIds array is empty", async () => {
      const t = makeTest();
      const res = await t.query(api.presence.getBatchPresence, { playerIds: [] });
      expect(res).toEqual({});
    });

    test("returns presence map for multiple players with mixed online/offline/unrecorded statuses", async () => {
      const t = makeTest();
      const alice = await signUp(t, "alice");
      const bob = await signUp(t, "bob");
      const charlie = await signUp(t, "charlie");

      // Alice is online
      await as(t, alice).mutation(api.presence.heartbeat, {});

      // Bob is offline (last seen 5 minutes ago)
      await as(t, bob).mutation(api.presence.heartbeat, {});
      const bobPresence = await t.run(async (ctx) => {
        return await ctx.db
          .query("userPresence")
          .withIndex("by_playerId", (q) => q.eq("playerId", bob.id))
          .unique();
      });
      const bobStaleTime = Date.now() - 300_000;
      await t.run(async (ctx) => {
        await ctx.db.patch(bobPresence!._id, {
          lastSeen: bobStaleTime,
          updatedAt: bobStaleTime,
        });
      });

      // Charlie has no presence record

      const res = await t.query(api.presence.getBatchPresence, {
        playerIds: [alice.id, bob.id, charlie.id],
      });

      expect(res[alice.id]).toBeDefined();
      expect(res[alice.id].isOnline).toBe(true);
      expect(res[alice.id].lastSeen).toBeGreaterThan(0);

      expect(res[bob.id]).toBeDefined();
      expect(res[bob.id].isOnline).toBe(false);
      expect(res[bob.id].lastSeen).toBe(bobStaleTime);

      expect(res[charlie.id]).toBeDefined();
      expect(res[charlie.id]).toEqual({ isOnline: false, lastSeen: 0 });
    });
  });
});
