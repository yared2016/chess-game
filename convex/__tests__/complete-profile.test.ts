import { describe, expect, test } from "vitest";
import { api } from "../_generated/api";
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

  describe("completeProfile mutation", () => {
    test("successfully completes profile", async () => {
      const t = makeTest();
      const alice = await signUp(t, "alice");

      const res = await as(t, alice).mutation(api.players.completeProfile, {
        username: "alice_chess",
        displayName: "Alice Wonder",
        phoneNumber: "+251911223344",
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
    });

    test("rejects invalid phone number", async () => {
      const t = makeTest();
      const alice = await signUp(t, "alice");

      await expect(
        as(t, alice).mutation(api.players.completeProfile, {
          username: "alice_chess",
          displayName: "Alice Wonder",
          phoneNumber: "0911223344", // missing + E.164 format
        })
      ).rejects.toThrow("invalid-phone-number");

      await expect(
        as(t, alice).mutation(api.players.completeProfile, {
          username: "alice_chess",
          displayName: "Alice Wonder",
          phoneNumber: "+251123456789", // +251 requires starting with 9 or 7
        })
      ).rejects.toThrow("invalid-phone-number");
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
        })
      ).rejects.toThrow("invalid-display-name");

      await expect(
        as(t, alice).mutation(api.players.completeProfile, {
          username: "alice_chess",
          displayName: "A".repeat(31), // too long
          phoneNumber: "+251911223344",
        })
      ).rejects.toThrow("invalid-display-name");
    });

    test("ensurePlayer preserves completed profile username across subsequent logins", async () => {
      const t = makeTest();
      const alice = await signUp(t, "alice");

      await as(t, alice).mutation(api.players.completeProfile, {
        username: "alice_custom_name",
        displayName: "Alice Wonder",
        phoneNumber: "+251911223344",
      });

      // Subsequent session login calls ensurePlayer with Clerk identity (which has nickname "alice")
      await t.withIdentity(alice.identity).mutation(api.players.ensurePlayer, {});

      const player = await t.run(async (ctx) => {
        return await ctx.db.get("players", alice.id);
      });
      expect(player?.username).toBe("alice_custom_name");
      expect(player?.usernameLower).toBe("alice_custom_name");
    });

    test("completeProfile preserves original profileCompletedAt timestamp on subsequent updates", async () => {
      const t = makeTest();
      const alice = await signUp(t, "alice");

      await as(t, alice).mutation(api.players.completeProfile, {
        username: "alice_chess",
        displayName: "Alice Wonder",
        phoneNumber: "+251911223344",
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
      });

      const secondPlayer = await t.run(async (ctx) => {
        return await ctx.db.get("players", alice.id);
      });
      expect(secondPlayer?.profileCompletedAt).toBe(originalCompletedAt);
      expect(secondPlayer?.displayName).toBe("Alice Wonder 2");
    });
  });

  describe("privacy: getByUsername profile redaction", () => {
    test("getByUsername exposes public profile data and display name but redacts phoneNumber", async () => {
      const t = makeTest();
      const bob = await signUp(t, "bob");

      await as(t, bob).mutation(api.players.completeProfile, {
        username: "bob_player",
        displayName: "Bob Player",
        phoneNumber: "+251912345678",
      });

      const profile = await t.query(api.players.getByUsername, {
        username: "bob_player",
      });

      expect(profile).not.toBeNull();
      expect(profile?.username).toBe("bob_player");
      expect(profile?.displayName).toBe("Bob Player");

      // Explicitly check that private contact/identity fields are never exposed
      expect((profile as any).phoneNumber).toBeUndefined();
      expect((profile as any).email).toBeUndefined();
      expect((profile as any).clerkId).toBeUndefined();
    });
  });
});
