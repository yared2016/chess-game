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

  describe("joinUniversity & leaveUniversity immutability", () => {
    test("joinUniversity throws 'university-immutable-after-profile-completion' when player is a university student with profileCompleted: true", async () => {
      const t = makeTest();
      const student = await signUp(t, "student_user");

      const uniId = await t.run(async (ctx) => {
        return await ctx.db.insert("universities", {
          name: "Addis Ababa University",
          shortName: "AAU",
          city: "Addis Ababa",
          totalPlayers: 0,
          averageRating: 1400,
          totalWins: 0,
          totalGames: 0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      await t.run(async (ctx) => {
        await ctx.db.patch("players", student.id, {
          playerType: "university_student",
          profileCompleted: true,
        });
      });

      await expect(
        as(t, student).mutation(api.universities.joinUniversity, {
          universityId: uniId,
        })
      ).rejects.toThrow("university-immutable-after-profile-completion");
    });

    test("leaveUniversity throws 'university-immutable-after-profile-completion' when player is a university student with profileCompleted: true", async () => {
      const t = makeTest();
      const student = await signUp(t, "student_user_2");

      const uniId = await t.run(async (ctx) => {
        return await ctx.db.insert("universities", {
          name: "Addis Ababa University",
          shortName: "AAU",
          city: "Addis Ababa",
          totalPlayers: 1,
          averageRating: 1400,
          totalWins: 0,
          totalGames: 0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      await t.run(async (ctx) => {
        await ctx.db.patch("players", student.id, {
          playerType: "university_student",
          profileCompleted: true,
          universityId: uniId,
          universityName: "Addis Ababa University",
        });
      });

      await expect(
        as(t, student).mutation(api.universities.leaveUniversity, {})
      ).rejects.toThrow("university-immutable-after-profile-completion");
    });

    test("joinUniversity succeeds when player has profileCompleted: false", async () => {
      const t = makeTest();
      const student = await signUp(t, "student_user_3");

      const uniId = await t.run(async (ctx) => {
        return await ctx.db.insert("universities", {
          name: "Jimma University",
          shortName: "JU",
          city: "Jimma",
          totalPlayers: 0,
          averageRating: 1400,
          totalWins: 0,
          totalGames: 0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      await t.run(async (ctx) => {
        await ctx.db.patch("players", student.id, {
          playerType: "university_student",
          profileCompleted: false,
        });
      });

      const res = await as(t, student).mutation(api.universities.joinUniversity, {
        universityId: uniId,
      });
      expect(res.success).toBe(true);
    });

    test("joinUniversity throws 'university-immutable-after-profile-completion' when player is public_player with profileCompleted: true", async () => {
      const t = makeTest();
      const publicPlayer = await signUp(t, "public_user");

      const uniId = await t.run(async (ctx) => {
        return await ctx.db.insert("universities", {
          name: "Hawassa University",
          shortName: "HU",
          city: "Hawassa",
          totalPlayers: 0,
          averageRating: 1400,
          totalWins: 0,
          totalGames: 0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      await t.run(async (ctx) => {
        await ctx.db.patch("players", publicPlayer.id, {
          playerType: "public_player",
          profileCompleted: true,
        });
      });

      await expect(
        as(t, publicPlayer).mutation(api.universities.joinUniversity, {
          universityId: uniId,
        })
      ).rejects.toThrow("university-immutable-after-profile-completion");
    });
  });

  describe("universities listing & seeding", () => {
    test("listUniversities returns projected seed list when database is unseeded", async () => {
      const t = makeTest();
      const countBefore = await t.run(async (ctx) => {
        return (await ctx.db.query("universities").collect()).length;
      });
      expect(countBefore).toBe(0);

      const unis = await t.query(api.universities.listUniversities, {});
      expect(unis.length).toBeGreaterThan(0);
      expect(unis[0].shortName).toBeDefined();
    });

    test("listUniversities returns real database records when seeded", async () => {
      const t = makeTest();
      await t.mutation(api.universities.seedUniversities, {});

      const unis = await t.query(api.universities.listUniversities, {});
      expect(unis.length).toBeGreaterThan(0);
      expect(unis[0]._id).toBeDefined();
      expect(unis[0]._id).not.toContain("seed_");
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
          playerType: "university_student",
          studentId: "UGR/001/14",
          verificationStatus: "verified",
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

      const byType = await t.run(async (ctx) => {
        return await ctx.db
          .query("players")
          .withIndex("by_playerType", (q) => q.eq("playerType", "university_student"))
          .collect();
      });
      expect(byType.some((p) => p._id === alice.id)).toBe(true);

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
