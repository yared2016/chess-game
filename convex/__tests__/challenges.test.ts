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

  test("rematch alternates colors and starts new game upon opponent acceptance", async () => {
    const t = makeTest();
    const alice = await signUp(t, "alice_rm");
    const bob = await signUp(t, "bob_rm");

    // Create an initial direct challenge and accept
    const { challengeId: initChallengeId } = await as(t, alice).mutation(api.challenges.createChallenge, {
      toPlayerId: bob.id,
      timeControlKey: "blitz_5_0",
    });
    const initRes = await as(t, bob).mutation(api.challenges.respond, {
      challengeId: initChallengeId,
      accept: true,
    });
    const game1Id = initRes.gameId!;

    // Initial game is active
    let game1 = await t.run(async (ctx) => ctx.db.get(game1Id));
    expect(game1?.status).toBe("active");

    // Trying to rematch an active game fails
    await expect(
      as(t, alice).mutation(api.challenges.requestRematch, {
        parentGameId: game1Id,
      })
    ).rejects.toThrow(/game-still-active/);

    // Conclude game 1 via resignation
    await as(t, alice).mutation(api.games.resign, { gameId: game1Id });
    game1 = await t.run(async (ctx) => ctx.db.get(game1Id));
    expect(game1?.status).toBe("resigned");

    const game1WhiteId = game1?.whiteId;
    const game1BlackId = game1?.blackId;

    // Alice requests a rematch with 3+2 blitz time control
    const rematchRes = await as(t, alice).mutation(api.challenges.requestRematch, {
      parentGameId: game1Id,
      timeControlKey: "blitz_3_2",
    });
    expect(rematchRes.status).toBe("pending");
    const rematchChallengeId = rematchRes.challengeId;

    // Both players check rematch status via getRematchForGame
    const aliceRematch = await as(t, alice).query(api.challenges.getRematchForGame, {
      gameId: game1Id,
    });
    expect(aliceRematch).not.toBeNull();
    expect(aliceRematch?.isSender).toBe(true);
    expect(aliceRematch?.timeControlKey).toBe("blitz_3_2");

    const bobRematch = await as(t, bob).query(api.challenges.getRematchForGame, {
      gameId: game1Id,
    });
    expect(bobRematch).not.toBeNull();
    expect(bobRematch?.isSender).toBe(false);
    expect(bobRematch?.status).toBe("pending");
    // Verify Bob's projected color in rematch is the opposite of game 1
    const expectedBobColor = bob.id === game1WhiteId ? "b" : "w";
    expect(bobRematch?.viewerColor).toBe(expectedBobColor);

    // Bob accepts the rematch
    const acceptRes = await as(t, bob).mutation(api.challenges.respond, {
      challengeId: rematchChallengeId,
      accept: true,
    });
    expect(acceptRes.status).toBe("accepted");
    const game2Id = acceptRes.gameId!;
    expect(game2Id).not.toBe(game1Id);

    // Verify game 2 alternates colors strictly!
    const game2 = await t.run(async (ctx) => ctx.db.get(game2Id));
    expect(game2?.status).toBe("active");
    expect(game2?.whiteId).toBe(game1BlackId);
    expect(game2?.blackId).toBe(game1WhiteId);
    expect(game2?.timeControlKey).toBe("blitz_3_2");
  });

  test("honors preferredColor when creating direct challenge", async () => {
    const t = makeTest();
    const alice = await signUp(t, "alice_pref");
    const bob = await signUp(t, "bob_pref");

    // Alice requests white
    const { challengeId } = await as(t, alice).mutation(api.challenges.createChallenge, {
      toPlayerId: bob.id,
      preferredColor: "white",
    });

    const res = await as(t, bob).mutation(api.challenges.respond, {
      challengeId,
      accept: true,
    });

    expect(res.status).toBe("accepted");
    const game = await t.run(async (ctx) => ctx.db.get(res.gameId!));
    expect(game?.whiteId).toBe(alice.id);
    expect(game?.blackId).toBe(bob.id);
  });
});
