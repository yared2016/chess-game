import { describe, expect, test } from "vitest";
import { api } from "../_generated/api";
import { ETHIOPIAN_UNIVERSITIES_SEED } from "../universities";
import { as, makeTest, signUp } from "./harness.setup";

describe("complete-profile & username availability", () => {
  describe("checkUsernameAvailability query", () => {
    test("returns available for a valid unused username", async () => {
      const t = makeTest();
      const res = await t.query(api.players.checkUsernameAvailability, {
        username: "grandmaster_99",
      });
      expect(res.available).toBe(true);
      expect(res.reason).toBeUndefined();
    });

    test("returns unavailable when username is already taken by another player", async () => {
      const t = makeTest();
      await signUp(t, "alice");

      const res = await t.query(api.players.checkUsernameAvailability, {
        username: "alice",
      });
      expect(res.available).toBe(false);
      expect(res.reason).toContain("taken");
    });

    test("returns available when taken by the calling authenticated player", async () => {
      const t = makeTest();
      const alice = await signUp(t, "alice");

      const res = await as(t, alice).query(api.players.checkUsernameAvailability, {
        username: "alice",
      });
      expect(res.available).toBe(true);
    });

    test("returns unavailable for invalid characters", async () => {
      const t = makeTest();
      const res = await t.query(api.players.checkUsernameAvailability, {
        username: "bad username!",
      });
      expect(res.available).toBe(false);
      expect(res.reason).toBeDefined();

      const uppercaseRes = await t.query(api.players.checkUsernameAvailability, {
        username: "InvalidCase",
      });
      expect(uppercaseRes.available).toBe(false);
    });

    test("returns unavailable when username is too short or too long", async () => {
      const t = makeTest();
      const shortRes = await t.query(api.players.checkUsernameAvailability, {
        username: "ab",
      });
      expect(shortRes.available).toBe(false);

      const longRes = await t.query(api.players.checkUsernameAvailability, {
        username: "a".repeat(21),
      });
      expect(longRes.available).toBe(false);
    });

    test("returns unavailable for reserved words", async () => {
      const t = makeTest();
      for (const word of ["admin", "Admin", "ADMIN", "castle", "Castle", "system", "moderator", "support"]) {
        const res = await t.query(api.players.checkUsernameAvailability, {
          username: word,
        });
        expect(res.available).toBe(false);
        expect(res.reason).toContain("reserved");
      }
    });
  });

  describe("ensurePlayer auto-seeding universities", () => {
    test("seeds universities table on first user sign up if empty", async () => {
      const t = makeTest();
      const countBefore = await t.run(async (ctx) => {
        return (await ctx.db.query("universities").collect()).length;
      });
      expect(countBefore).toBe(0);

      await signUp(t, "first_user");

      const countAfter = await t.run(async (ctx) => {
        return (await ctx.db.query("universities").collect()).length;
      });
      expect(countAfter).toBe(ETHIOPIAN_UNIVERSITIES_SEED.length);
    });
  });

  describe("completeProfile mutation", () => {
    test("successfully completes profile as public_player", async () => {
      const t = makeTest();
      const alice = await signUp(t, "alice");

      const res = await as(t, alice).mutation(api.players.completeProfile, {
        username: "alice_chess",
        displayName: "Alice Wonder",
        phoneNumber: "+251911223344",
        playerType: "public_player",
      });
      expect(res.success).toBe(true);

      const player = await t.run(async (ctx) => {
        return await ctx.db.get("players", alice.id);
      });
      expect(player?.profileCompleted).toBe(true);
      expect(player?.profileCompletedAt).toBeGreaterThan(0);
      expect(player?.username).toBe("alice_chess");
      expect(player?.usernameLower).toBe("alice_chess");
      expect(player?.displayName).toBe("Alice Wonder");
      expect(player?.phoneNumber).toBe("+251911223344");
      expect(player?.playerType).toBe("public_player");
      expect(player?.verificationStatus).toBe("none");
      expect(player?.universityId).toBeUndefined();
      expect(player?.studentId).toBeUndefined();
    });

    test("successfully completes profile as university_student and updates university stats", async () => {
      const t = makeTest();
      const bob = await signUp(t, "bob");

      const unis = await t.query(api.universities.listUniversities, {});
      const aau = unis.find((u) => u.shortName === "AAU")!;
      const initialPlayers = aau.totalPlayers;

      const res = await as(t, bob).mutation(api.players.completeProfile, {
        username: "bob_student",
        displayName: "Bob Scholar",
        phoneNumber: "+251912345678",
        playerType: "university_student",
        universityId: aau._id,
        studentId: "UGR/1234/14",
      });
      expect(res.success).toBe(true);

      const player = await t.run(async (ctx) => {
        return await ctx.db.get("players", bob.id);
      });
      expect(player?.profileCompleted).toBe(true);
      expect(player?.playerType).toBe("university_student");
      expect(player?.verificationStatus).toBe("pending");
      expect(player?.universityId).toBe(aau._id);
      expect(player?.universityName).toBe(aau.name);
      expect(player?.studentId).toBe("UGR/1234/14");

      const updatedUni = await t.run(async (ctx) => {
        return await ctx.db.get("universities", aau._id);
      });
      expect(updatedUni?.totalPlayers).toBe(initialPlayers + 1);
    });

    test("rejects invalid phone number", async () => {
      const t = makeTest();
      const alice = await signUp(t, "alice");

      await expect(
        as(t, alice).mutation(api.players.completeProfile, {
          username: "alice_chess",
          displayName: "Alice Wonder",
          phoneNumber: "0911223344", // missing + E.164 format
          playerType: "public_player",
        })
      ).rejects.toThrow("invalid-phone-number");

      await expect(
        as(t, alice).mutation(api.players.completeProfile, {
          username: "alice_chess",
          displayName: "Alice Wonder",
          phoneNumber: "+251123456789", // +251 requires starting with 9 or 7
          playerType: "public_player",
        })
      ).rejects.toThrow("invalid-phone-number");
    });

    test("rejects university_student missing universityId or studentId", async () => {
      const t = makeTest();
      const bob = await signUp(t, "bob");
      const unis = await t.query(api.universities.listUniversities, {});
      const aau = unis[0];

      await expect(
        as(t, bob).mutation(api.players.completeProfile, {
          username: "bob_student",
          displayName: "Bob Scholar",
          phoneNumber: "+251912345678",
          playerType: "university_student",
          studentId: "UGR/1234/14",
          // missing universityId
        })
      ).rejects.toThrow("university-required");

      await expect(
        as(t, bob).mutation(api.players.completeProfile, {
          username: "bob_student",
          displayName: "Bob Scholar",
          phoneNumber: "+251912345678",
          playerType: "university_student",
          universityId: aau._id,
          // missing studentId
        })
      ).rejects.toThrow("student-id-required");

      await expect(
        as(t, bob).mutation(api.players.completeProfile, {
          username: "bob_student",
          displayName: "Bob Scholar",
          phoneNumber: "+251912345678",
          playerType: "university_student",
          universityId: aau._id,
          studentId: "1", // too short (min 2)
        })
      ).rejects.toThrow("invalid-student-id");
    });

    test("rejects public_player with universityId or studentId provided", async () => {
      const t = makeTest();
      const alice = await signUp(t, "alice");
      const unis = await t.query(api.universities.listUniversities, {});
      const aau = unis[0];

      await expect(
        as(t, alice).mutation(api.players.completeProfile, {
          username: "alice_chess",
          displayName: "Alice Wonder",
          phoneNumber: "+251911223344",
          playerType: "public_player",
          universityId: aau._id,
        })
      ).rejects.toThrow("public-player-cannot-have-university");
    });

    test("rejects taken username", async () => {
      const t = makeTest();
      await signUp(t, "alice");
      const bob = await signUp(t, "bob");

      await expect(
        as(t, bob).mutation(api.players.completeProfile, {
          username: "alice",
          displayName: "Bob Smith",
          phoneNumber: "+251912345678",
          playerType: "public_player",
        })
      ).rejects.toThrow("username-taken");
    });

    test("rejects invalid display name", async () => {
      const t = makeTest();
      const alice = await signUp(t, "alice");

      await expect(
        as(t, alice).mutation(api.players.completeProfile, {
          username: "alice_chess",
          displayName: "A", // too short
          phoneNumber: "+251911223344",
          playerType: "public_player",
        })
      ).rejects.toThrow("invalid-display-name");

      await expect(
        as(t, alice).mutation(api.players.completeProfile, {
          username: "alice_chess",
          displayName: "A".repeat(31), // too long
          phoneNumber: "+251911223344",
          playerType: "public_player",
        })
      ).rejects.toThrow("invalid-display-name");
    });

    test("rejects modifying universityId, studentId, or playerType once profileCompleted: true", async () => {
      const t = makeTest();
      const alice = await signUp(t, "alice");
      const unis = await t.query(api.universities.listUniversities, {});
      const aau = unis[0];

      await as(t, alice).mutation(api.players.completeProfile, {
        username: "alice_chess",
        displayName: "Alice Wonder",
        phoneNumber: "+251911223344",
        playerType: "public_player",
      });

      // Subsequent attempt to change playerType or join university via completeProfile
      await expect(
        as(t, alice).mutation(api.players.completeProfile, {
          username: "alice_chess",
          displayName: "Alice Wonder",
          phoneNumber: "+251911223344",
          playerType: "university_student",
          universityId: aau._id,
          studentId: "UGR/999/14",
        })
      ).rejects.toThrow("university-immutable-after-profile-completion");

      // Subsequent attempt to join university via joinUniversity
      await expect(
        as(t, alice).mutation(api.universities.joinUniversity, {
          universityId: aau._id,
        })
      ).rejects.toThrow("university-immutable-after-profile-completion");
    });

    test("ensurePlayer preserves completed profile username across subsequent logins", async () => {
      const t = makeTest();
      const alice = await signUp(t, "alice");

      await as(t, alice).mutation(api.players.completeProfile, {
        username: "alice_custom_name",
        displayName: "Alice Wonder",
        phoneNumber: "+251911223344",
        playerType: "public_player",
      });

      // Subsequent session login calls ensurePlayer with Clerk identity (which has nickname "alice")
      await t.withIdentity(alice.identity).mutation(api.players.ensurePlayer, {});

      const player = await t.run(async (ctx) => {
        return await ctx.db.get("players", alice.id);
      });
      expect(player?.username).toBe("alice_custom_name");
      expect(player?.usernameLower).toBe("alice_custom_name");
    });

    test("completeProfile preserves 'verified' status on subsequent updates", async () => {
      const t = makeTest();
      const bob = await signUp(t, "bob");
      const unis = await t.query(api.universities.listUniversities, {});
      const aau = unis[0];

      await as(t, bob).mutation(api.players.completeProfile, {
        username: "bob_student",
        displayName: "Bob Scholar",
        phoneNumber: "+251912345678",
        playerType: "university_student",
        universityId: aau._id,
        studentId: "UGR/1234/14",
      });

      // Simulate admin verification
      await t.run(async (ctx) => {
        await ctx.db.patch("players", bob.id, {
          verificationStatus: "verified",
        });
      });

      // User updates display name / phone without changing university / playerType
      await as(t, bob).mutation(api.players.completeProfile, {
        username: "bob_student",
        displayName: "Bob Scholar Updated",
        phoneNumber: "+251912345679",
        playerType: "university_student",
        universityId: aau._id,
        studentId: "UGR/1234/14",
      });

      const updated = await t.run(async (ctx) => {
        return await ctx.db.get("players", bob.id);
      });
      expect(updated?.verificationStatus).toBe("verified");
      expect(updated?.displayName).toBe("Bob Scholar Updated");
    });

    test("completeProfile preserves original profileCompletedAt timestamp on subsequent updates", async () => {
      const t = makeTest();
      const alice = await signUp(t, "alice");

      await as(t, alice).mutation(api.players.completeProfile, {
        username: "alice_chess",
        displayName: "Alice Wonder",
        phoneNumber: "+251911223344",
        playerType: "public_player",
      });

      const firstPlayer = await t.run(async (ctx) => {
        return await ctx.db.get("players", alice.id);
      });
      const originalCompletedAt = firstPlayer?.profileCompletedAt;
      expect(originalCompletedAt).toBeDefined();

      // Subsequent update
      await as(t, alice).mutation(api.players.completeProfile, {
        username: "alice_chess",
        displayName: "Alice Wonder 2",
        phoneNumber: "+251911223344",
        playerType: "public_player",
      });

      const secondPlayer = await t.run(async (ctx) => {
        return await ctx.db.get("players", alice.id);
      });
      expect(secondPlayer?.profileCompletedAt).toBe(originalCompletedAt);
      expect(secondPlayer?.displayName).toBe("Alice Wonder 2");
    });
  });

  describe("privacy: getByUsername profile redaction", () => {
    test("getByUsername exposes public profile data and display name but redacts phoneNumber and studentId", async () => {
      const t = makeTest();
      const bob = await signUp(t, "bob");
      const unis = await t.query(api.universities.listUniversities, {});
      const aau = unis[0];

      await as(t, bob).mutation(api.players.completeProfile, {
        username: "bob_student",
        displayName: "Bob Scholar",
        phoneNumber: "+251912345678",
        playerType: "university_student",
        universityId: aau._id,
        studentId: "UGR/1234/14",
      });

      const profile = await t.query(api.players.getByUsername, {
        username: "bob_student",
      });

      expect(profile).not.toBeNull();
      expect(profile?.username).toBe("bob_student");
      expect(profile?.displayName).toBe("Bob Scholar");
      expect(profile?.playerType).toBe("university_student");
      expect(profile?.verificationStatus).toBe("pending");
      expect(profile?.universityName).toBe(aau.name);
      expect(profile?.universityId).toBe(aau._id);

      // Explicitly check that private contact/identity fields are never exposed
      expect((profile as any).phoneNumber).toBeUndefined();
      expect((profile as any).studentId).toBeUndefined();
      expect((profile as any).email).toBeUndefined();
      expect((profile as any).clerkId).toBeUndefined();
    });
  });
});
