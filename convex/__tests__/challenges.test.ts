import { describe, expect, test } from "vitest";
import { api } from "../_generated/api";
import { as, makeTest, signUp } from "./harness.setup";

describe("challenges with time control", () => {
  test("creates a challenge with time control and initializes game clocks upon acceptance", async () => {
    const t = makeTest();
    const alice = await signUp(t, "alice");
    const bob = await signUp(t, "bob");

    // Alice challenges Bob with a 5+0 Blitz time control
    const { challengeId } = await as(t, alice).mutation(api.challenges.createChallenge, {
      toPlayerId: bob.id,
      timeControlKey: "blitz_5_0",
    });

    expect(challengeId).toBeDefined();

    // Verify Bob received the challenge with time control details
    const incoming = await as(t, bob).query(api.challenges.myIncomingChallenges, {});
    expect(incoming).toHaveLength(1);
    expect(incoming[0]._id).toBe(challengeId);
    expect(incoming[0].timeControlKey).toBe("blitz_5_0");
    expect(incoming[0].fromPlayer?.username).toBe("alice");

    // Bob accepts the challenge
    const res = await as(t, bob).mutation(api.challenges.respond, {
      challengeId,
      accept: true,
    });

    expect(res.status).toBe("accepted");
    expect(res.gameId).toBeDefined();

    // Verify game was created with authoritative clock fields matching 5+0 Blitz
    const game = await t.run(async (ctx) => ctx.db.get(res.gameId!));
    expect(game).not.toBeNull();
    expect(game?.status).toBe("active");
    expect(game?.timeControlKey).toBe("blitz_5_0");
    expect(game?.baseTimeMs).toBe(300000); // 5 minutes = 300,000 ms
    expect(game?.whiteTimeMs).toBe(300000);
    expect(game?.blackTimeMs).toBe(300000);
    expect(game?.incrementMs).toBe(0);
    expect(game?.clockMode).toBe("fischer");
    expect(game?.timeCategory).toBe("blitz");
    expect(game?.firstMoveDeadlineAt).toBeGreaterThan(Date.now());
  });

  test("creates a challenge with 3+2 Blitz increment time control", async () => {
    const t = makeTest();
    const alice = await signUp(t, "alice_blitz");
    const bob = await signUp(t, "bob_blitz");

    const { challengeId } = await as(t, alice).mutation(api.challenges.createChallenge, {
      toPlayerId: bob.id,
      timeControlKey: "blitz_3_2",
    });

    const res = await as(t, bob).mutation(api.challenges.respond, {
      challengeId,
      accept: true,
    });

    const game = await t.run(async (ctx) => ctx.db.get(res.gameId!));
    expect(game?.timeControlKey).toBe("blitz_3_2");
    expect(game?.baseTimeMs).toBe(180000); // 3 minutes = 180,000 ms
    expect(game?.incrementMs).toBe(2000); // 2 seconds increment = 2,000 ms
    expect(game?.timeCategory).toBe("blitz");
  });

  test("declining challenge marks it declined without creating a game", async () => {
    const t = makeTest();
    const alice = await signUp(t, "alice_dec");
    const bob = await signUp(t, "bob_dec");

    const { challengeId } = await as(t, alice).mutation(api.challenges.createChallenge, {
      toPlayerId: bob.id,
      timeControlKey: "rapid_10_0",
    });

    const res = await as(t, bob).mutation(api.challenges.respond, {
      challengeId,
      accept: false,
    });

    expect(res.status).toBe("declined");

    const challenge = await t.run(async (ctx) => ctx.db.get(challengeId));
    expect(challenge?.status).toBe("declined");
    expect(challenge?.gameId).toBeUndefined();
  });

  test("cannot challenge a player who blocked you or whom you blocked", async () => {
    const t = makeTest();
    const alice = await signUp(t, "alice_block_c");
    const bob = await signUp(t, "bob_block_c");

    // Alice blocks Bob
    await as(t, alice).mutation(api.friends.blockPlayer, {
      blockedId: bob.id,
    });

    // Bob tries to challenge Alice -> rejected with player-blocked-you
    await expect(
      as(t, bob).mutation(api.challenges.createChallenge, {
        toPlayerId: alice.id,
      })
    ).rejects.toThrow(/player-blocked-you/);

    // Alice tries to challenge Bob -> rejected with you-blocked-this-player
    await expect(
      as(t, alice).mutation(api.challenges.createChallenge, {
        toPlayerId: bob.id,
      })
    ).rejects.toThrow(/you-blocked-this-player/);

    // Search results should not show blocked users in either direction
    const aliceSearch = await as(t, alice).query(api.challenges.searchPlayers, {
      query: "bob_block_c",
    });
    expect(aliceSearch).toHaveLength(0);

    const bobSearch = await as(t, bob).query(api.challenges.searchPlayers, {
      query: "alice_block_c",
    });
    expect(bobSearch).toHaveLength(0);
  });
});
