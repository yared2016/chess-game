import { describe, expect, test } from "vitest";
import { api } from "../_generated/api";
import { as, makeTest, signUp } from "./harness.setup";

describe("friends system", () => {
  test("sendRequest, accept, and list friends", async () => {
    const t = makeTest();
    const alice = await signUp(t, "alice");
    const bob = await signUp(t, "bob");

    // Alice sends friend request to Bob
    const friendshipId = await as(t, alice).mutation(api.friends.sendRequest, {
      toPlayerId: bob.id,
    });
    expect(friendshipId).toBeDefined();

    // Check incoming for Bob
    const incoming = await as(t, bob).query(api.friends.myIncomingRequests, {});
    expect(incoming).toHaveLength(1);
    expect(incoming[0].username).toBe("alice");

    // Check outgoing for Alice
    const outgoing = await as(t, alice).query(api.friends.myOutgoingRequests, {});
    expect(outgoing).toHaveLength(1);
    expect(outgoing[0].username).toBe("bob");

    // Check isFriend status
    const statusBefore = await as(t, alice).query(api.friends.isFriend, {
      playerId: bob.id,
    });
    expect(statusBefore.status).toBe("request_sent");

    // Bob accepts
    await as(t, bob).mutation(api.friends.respond, {
      friendshipId,
      accept: true,
    });

    // Check friends list for both
    const aliceFriends = await as(t, alice).query(api.friends.myFriends, {});
    expect(aliceFriends).toHaveLength(1);
    expect(aliceFriends[0].username).toBe("bob");

    const bobFriends = await as(t, bob).query(api.friends.myFriends, {});
    expect(bobFriends).toHaveLength(1);
    expect(bobFriends[0].username).toBe("alice");

    // Check isFriend status after accept
    const statusAfter = await as(t, alice).query(api.friends.isFriend, {
      playerId: bob.id,
    });
    expect(statusAfter.status).toBe("friends");
  });

  test("cannot friend self", async () => {
    const t = makeTest();
    const alice = await signUp(t, "alice");

    await expect(
      as(t, alice).mutation(api.friends.sendRequest, {
        toPlayerId: alice.id,
      })
    ).rejects.toThrow(/cannot-friend-self/);
  });

  test("block and unblock player", async () => {
    const t = makeTest();
    const alice = await signUp(t, "alice");
    const bob = await signUp(t, "bob");

    // Alice blocks Bob
    await as(t, alice).mutation(api.friends.blockPlayer, {
      blockedId: bob.id,
    });

    const blocks = await as(t, alice).query(api.friends.myBlocks, {});
    expect(blocks).toHaveLength(1);
    expect(blocks[0].username).toBe("bob");

    // Bob cannot send friend request to Alice
    await expect(
      as(t, bob).mutation(api.friends.sendRequest, {
        toPlayerId: alice.id,
      })
    ).rejects.toThrow(/player-blocked-you/);

    // Alice unblocks Bob
    await as(t, alice).mutation(api.friends.unblockPlayer, {
      blockedId: bob.id,
    });

    const blocksAfter = await as(t, alice).query(api.friends.myBlocks, {});
    expect(blocksAfter).toHaveLength(0);
  });

  test("remove friend", async () => {
    const t = makeTest();
    const alice = await signUp(t, "alice");
    const bob = await signUp(t, "bob");

    const friendshipId = await as(t, alice).mutation(api.friends.sendRequest, {
      toPlayerId: bob.id,
    });
    await as(t, bob).mutation(api.friends.respond, {
      friendshipId,
      accept: true,
    });

    // Alice removes Bob
    await as(t, alice).mutation(api.friends.removeFriend, {
      friendshipId,
    });

    const aliceFriends = await as(t, alice).query(api.friends.myFriends, {});
    expect(aliceFriends).toHaveLength(0);

    // Re-friend and remove by playerId
    const newFriendshipId = await as(t, alice).mutation(api.friends.sendRequest, {
      toPlayerId: bob.id,
    });
    await as(t, bob).mutation(api.friends.respond, {
      friendshipId: newFriendshipId,
      accept: true,
    });
    expect(await as(t, alice).query(api.friends.myFriends, {})).toHaveLength(1);

    // Remove by playerId
    await as(t, alice).mutation(api.friends.removeFriend, {
      playerId: bob.id,
    });
    expect(await as(t, alice).query(api.friends.myFriends, {})).toHaveLength(0);
  });

  test("blocking friend immediately removes them from myFriends and lists in myBlocks", async () => {
    const t = makeTest();
    const alice = await signUp(t, "alice");
    const bob = await signUp(t, "bob");

    const fid = await as(t, alice).mutation(api.friends.sendRequest, {
      toPlayerId: bob.id,
    });
    await as(t, bob).mutation(api.friends.respond, {
      friendshipId: fid,
      accept: true,
    });
    expect(await as(t, alice).query(api.friends.myFriends, {})).toHaveLength(1);

    // Alice blocks Bob
    await as(t, alice).mutation(api.friends.blockPlayer, {
      blockedId: bob.id,
    });

    // Bob is removed from friends and listed in blocks
    expect(await as(t, alice).query(api.friends.myFriends, {})).toHaveLength(0);
    const blocks = await as(t, alice).query(api.friends.myBlocks, {});
    expect(blocks).toHaveLength(1);
    expect(blocks[0].username).toBe("bob");
  });

  test("blocking cancels pending challenges between players and isFriend reports blocked", async () => {
    const t = makeTest();
    const alice = await signUp(t, "alice_ch_block");
    const bob = await signUp(t, "bob_ch_block");

    // Alice creates a challenge for Bob
    const { challengeId } = await as(t, alice).mutation(api.challenges.createChallenge, {
      toPlayerId: bob.id,
      timeControlKey: "blitz_5_0",
    });

    const bobIncomingBefore = await as(t, bob).query(api.challenges.myIncomingChallenges, {});
    expect(bobIncomingBefore).toHaveLength(1);

    // Bob blocks Alice
    await as(t, bob).mutation(api.friends.blockPlayer, {
      blockedId: alice.id,
    });

    // Challenge should be cancelled
    const challenge = await t.run(async (ctx) => ctx.db.get(challengeId));
    expect(challenge?.status).toBe("cancelled");

    // Bob's incoming should now be empty
    const bobIncomingAfter = await as(t, bob).query(api.challenges.myIncomingChallenges, {});
    expect(bobIncomingAfter).toHaveLength(0);

    // Verify isFriend statuses
    const bobStatus = await as(t, bob).query(api.friends.isFriend, {
      playerId: alice.id,
    });
    expect(bobStatus.status).toBe("blocked");

    const aliceStatus = await as(t, alice).query(api.friends.isFriend, {
      playerId: bob.id,
    });
    expect(aliceStatus.status).toBe("blocked_by");
  });
});
