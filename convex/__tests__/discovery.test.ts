import { describe, expect, test } from "vitest";
import { api } from "../_generated/api";
import { as, makeTest, setRatings, signUp } from "./harness.setup";

describe("discovery and recommendation system", () => {
  test("getRecommendedPlayers prioritizes similar ratings", async () => {
    const t = makeTest();
    const alice = await signUp(t, "alice");
    const bob = await signUp(t, "bob");
    const charlie = await signUp(t, "charlie");

    // Alice is rated 1450
    await setRatings(t, alice.id, { rating: 1450, ratingHuman: 1450 });
    // Bob is rated 1400 (diff: 50)
    await setRatings(t, bob.id, { rating: 1400, ratingHuman: 1400 });
    // Charlie is rated 2200 (diff: 750)
    await setRatings(t, charlie.id, { rating: 2200, ratingHuman: 2200 });

    // Both Bob and Charlie send a heartbeat right now
    await as(t, bob).mutation(api.presence.heartbeat, {});
    await as(t, charlie).mutation(api.presence.heartbeat, {});

    const recommendations = await as(t, alice).query(api.discovery.getRecommendedPlayers, {
      limit: 10,
    });

    expect(recommendations.length).toBeGreaterThanOrEqual(2);
    const bobIndex = recommendations.findIndex((p) => p._id === bob.id);
    const charlieIndex = recommendations.findIndex((p) => p._id === charlie.id);

    expect(bobIndex).toBeGreaterThanOrEqual(0);
    expect(charlieIndex).toBeGreaterThanOrEqual(0);
    // Bob should rank ahead of Charlie due to rating proximity
    expect(bobIndex).toBeLessThan(charlieIndex);
  });

  test("getRecommendedPlayers prioritizes online/active players", async () => {
    const t = makeTest();
    const alice = await signUp(t, "alice_active");
    const bobActive = await signUp(t, "bob_active");
    const charlieInactive = await signUp(t, "charlie_inactive");

    // All players have identical rating 1200
    await setRatings(t, alice.id, { rating: 1200, ratingHuman: 1200 });
    await setRatings(t, bobActive.id, { rating: 1200, ratingHuman: 1200 });
    await setRatings(t, charlieInactive.id, { rating: 1200, ratingHuman: 1200 });

    // Bob sends a heartbeat now
    await as(t, bobActive).mutation(api.presence.heartbeat, {});

    // Charlie was active 3 days ago
    const threeDaysAgo = Date.now() - 3 * 24 * 60 * 60 * 1000;
    await t.run(async (ctx) => {
      await ctx.db.insert("userPresence", {
        playerId: charlieInactive.id,
        lastSeen: threeDaysAgo,
        updatedAt: threeDaysAgo,
      });
    });

    const recommendations = await as(t, alice).query(api.discovery.getRecommendedPlayers, {
      limit: 6,
    });

    const bobIndex = recommendations.findIndex((p) => p._id === bobActive.id);
    const charlieIndex = recommendations.findIndex((p) => p._id === charlieInactive.id);

    expect(bobIndex).toBeGreaterThanOrEqual(0);
    expect(charlieIndex).toBeGreaterThanOrEqual(0);
    // Bob is online (1.0 availability score), Charlie is inactive (0.05), so Bob must rank ahead
    expect(bobIndex).toBeLessThan(charlieIndex);
  });

  test("getRecommendedPlayers excludes caller and mutual blocks", async () => {
    const t = makeTest();
    const alice = await signUp(t, "alice_blocks");
    const bobBlocked = await signUp(t, "bob_blocked");
    const charlieBlocker = await signUp(t, "charlie_blocker");
    const davidAllowed = await signUp(t, "david_allowed");

    // Alice blocks Bob
    await as(t, alice).mutation(api.friends.blockPlayer, {
      blockedId: bobBlocked.id,
    });

    // Charlie blocks Alice
    await as(t, charlieBlocker).mutation(api.friends.blockPlayer, {
      blockedId: alice.id,
    });

    const recommendations = await as(t, alice).query(api.discovery.getRecommendedPlayers, {});

    const ids = recommendations.map((p) => p._id);
    expect(ids).not.toContain(alice.id);
    expect(ids).not.toContain(bobBlocked.id);
    expect(ids).not.toContain(charlieBlocker.id);
    expect(ids).toContain(davidAllowed.id);
  });

  test("getRecommendedPlayers works for unauthenticated caller with 1200 base rating", async () => {
    const t = makeTest();
    const bob = await signUp(t, "bob_anon");
    const charlie = await signUp(t, "charlie_anon");

    await setRatings(t, bob.id, { rating: 1200, ratingHuman: 1200 });
    await setRatings(t, charlie.id, { rating: 2500, ratingHuman: 2500 });

    const recommendations = await t.query(api.discovery.getRecommendedPlayers, {});
    expect(recommendations.length).toBeGreaterThanOrEqual(2);

    // Unauthenticated uses 1200 base, so 1200 player is closer than 2500
    const bobIndex = recommendations.findIndex((p) => p._id === bob.id);
    const charlieIndex = recommendations.findIndex((p) => p._id === charlie.id);
    expect(bobIndex).toBeLessThan(charlieIndex);

    // Verify projected fields
    const first = recommendations[0];
    expect(first._id).toBeDefined();
    expect(first.username).toBeDefined();
    expect(first.displayName).toBeDefined();
    expect(first.avatarUrl).toBeDefined();
    expect(first.rating).toBeDefined();
    expect(first.ratingHuman).toBeDefined();
    expect(first.playerType).toBeDefined();
    expect(first.isOnline).toBeDefined();
    expect(first.lastSeen).toBeDefined();
    expect(first.recommendationScore).toBeDefined();
    expect("email" in first).toBe(false);
    expect("phoneNumber" in first).toBe(false);
    expect("studentId" in first).toBe(false);
    expect("clerkId" in first).toBe(false);
  });

  test("getOnlinePlayers returns only players seen within 60s sorted by proximity to caller", async () => {
    const t = makeTest();
    const alice = await signUp(t, "alice_online");
    const bobOnline = await signUp(t, "bob_online");
    const charlieStale = await signUp(t, "charlie_stale");
    const daveBlocked = await signUp(t, "dave_blocked");

    await setRatings(t, alice.id, { rating: 1500, ratingHuman: 1500 });
    await setRatings(t, bobOnline.id, { rating: 1520, ratingHuman: 1520 });
    await setRatings(t, charlieStale.id, { rating: 1505, ratingHuman: 1505 });
    await setRatings(t, daveBlocked.id, { rating: 1510, ratingHuman: 1510 });

    // Bob is online right now
    await as(t, bobOnline).mutation(api.presence.heartbeat, {});

    // Charlie was seen 90s ago
    const staleTime = Date.now() - 90_000;
    await t.run(async (ctx) => {
      await ctx.db.insert("userPresence", {
        playerId: charlieStale.id,
        lastSeen: staleTime,
        updatedAt: staleTime,
      });
    });

    // Dave is online right now, but Alice blocked him
    await as(t, daveBlocked).mutation(api.presence.heartbeat, {});
    await as(t, alice).mutation(api.friends.blockPlayer, {
      blockedId: daveBlocked.id,
    });

    const onlinePlayers = await as(t, alice).query(api.discovery.getOnlinePlayers, {});

    const ids = onlinePlayers.map((p) => p._id);
    expect(ids).toContain(bobOnline.id);
    expect(ids).not.toContain(charlieStale.id);
    expect(ids).not.toContain(daveBlocked.id);
    expect(ids).not.toContain(alice.id);

    expect(onlinePlayers[0].isOnline).toBe(true);
    expect(onlinePlayers[0].lastSeen).toBeGreaterThan(0);
    expect("email" in onlinePlayers[0]).toBe(false);
    expect("phoneNumber" in onlinePlayers[0]).toBe(false);
    expect("clerkId" in onlinePlayers[0]).toBe(false);
  });

  test("searchPlayers matches username and displayName, respects filters, and redacts PII", async () => {
    const t = makeTest();
    const alice = await signUp(t, "alice_searcher");
    const bob = await signUp(t, "bob_builder");
    const carol = await signUp(t, "carol_designer");
    const dave = await signUp(t, "dave_blocked");

    // Setup universities
    const unis = await t.run(async (ctx) => ctx.db.query("universities").collect());
    const uniA = unis[0]._id;

    // Bob: displayName "Robert Builder", rating 1400, university student at uniA
    await setRatings(t, bob.id, { rating: 1400, ratingHuman: 1400 });
    await t.run(async (ctx) => {
      await ctx.db.patch(bob.id, {
        displayName: "Robert Builder",
        playerType: "university_student",
        universityId: uniA,
        email: "bob@example.com",
        phoneNumber: "+251911223344",
        studentId: "UGR/1234/14",
      });
    });

    // Carol: displayName "Carol Boblover", rating 1800, public player
    await setRatings(t, carol.id, { rating: 1800, ratingHuman: 1800 });
    await t.run(async (ctx) => {
      await ctx.db.patch(carol.id, {
        displayName: "Carol Boblover",
        playerType: "public_player",
        email: "carol@example.com",
        phoneNumber: "+251922334455",
      });
    });

    // Dave: blocked by Alice
    await as(t, alice).mutation(api.friends.blockPlayer, {
      blockedId: dave.id,
    });
    await t.run(async (ctx) => {
      await ctx.db.patch(dave.id, {
        displayName: "Dave Bob",
      });
    });

    // 1. Matches username substring
    const byUsername = await as(t, alice).query(api.discovery.searchPlayers, {
      query: "builder",
    });
    expect(byUsername.map((p) => p._id)).toContain(bob.id);

    // 2. Matches displayName substring case-insensitively
    const byDisplayName = await as(t, alice).query(api.discovery.searchPlayers, {
      query: "boblover",
    });
    expect(byDisplayName.map((p) => p._id)).toContain(carol.id);

    // 3. Excludes mutual blocks and caller
    const byBob = await as(t, alice).query(api.discovery.searchPlayers, {
      query: "bob",
    });
    const bobSearchIds = byBob.map((p) => p._id);
    expect(bobSearchIds).toContain(bob.id);
    expect(bobSearchIds).toContain(carol.id);
    expect(bobSearchIds).not.toContain(dave.id); // blocked
    expect(bobSearchIds).not.toContain(alice.id); // caller

    // 4. Rating filter: minRating 1600 excludes Bob (1400)
    const ratingFiltered = await as(t, alice).query(api.discovery.searchPlayers, {
      query: "bob",
      minRating: 1600,
    });
    expect(ratingFiltered.map((p) => p._id)).toEqual([carol.id]);

    // 5. University filter
    const uniFiltered = await as(t, alice).query(api.discovery.searchPlayers, {
      query: "bob",
      universityId: uniA,
    });
    expect(uniFiltered.map((p) => p._id)).toEqual([bob.id]);

    // 6. PlayerType filter
    const typeFiltered = await as(t, alice).query(api.discovery.searchPlayers, {
      query: "bob",
      playerType: "public_player",
    });
    expect(typeFiltered.map((p) => p._id)).toEqual([carol.id]);

    // 7. Online only filter
    await as(t, bob).mutation(api.presence.heartbeat, {});
    const onlineFiltered = await as(t, alice).query(api.discovery.searchPlayers, {
      query: "bob",
      onlineOnly: true,
    });
    expect(onlineFiltered.map((p) => p._id)).toEqual([bob.id]);

    // 8. Verify STRICT NO PII
    for (const player of byBob) {
      expect("email" in player).toBe(false);
      expect("phoneNumber" in player).toBe(false);
      expect("studentId" in player).toBe(false);
      expect("clerkId" in player).toBe(false);
      expect("tokenIdentifier" in player).toBe(false);
    }
  });

  test("getRecommendedPlayers boosts same-university peers and accepted friends", async () => {
    const t = makeTest();
    const alice = await signUp(t, "alice_comm");
    const peerUni = await signUp(t, "peer_uni");
    const peerPublic = await signUp(t, "peer_pub");

    const unis = await t.run(async (ctx) => ctx.db.query("universities").collect());
    const uniA = unis[0]._id;

    // Both Alice and peerUni attend uniA
    await t.run(async (ctx) => {
      await ctx.db.patch(alice.id, {
        playerType: "university_student",
        universityId: uniA,
      });
      await ctx.db.patch(peerUni.id, {
        playerType: "university_student",
        universityId: uniA,
      });
      await ctx.db.patch(peerPublic.id, {
        playerType: "public_player",
      });
    });

    // Same ratings and heartbeats
    await setRatings(t, alice.id, { rating: 1200, ratingHuman: 1200 });
    await setRatings(t, peerUni.id, { rating: 1200, ratingHuman: 1200 });
    await setRatings(t, peerPublic.id, { rating: 1200, ratingHuman: 1200 });

    await as(t, peerUni).mutation(api.presence.heartbeat, {});
    await as(t, peerPublic).mutation(api.presence.heartbeat, {});

    const recsWithUni = await as(t, alice).query(api.discovery.getRecommendedPlayers, {});
    const uniIndex = recsWithUni.findIndex((p) => p._id === peerUni.id);
    const pubIndex = recsWithUni.findIndex((p) => p._id === peerPublic.id);

    // Same university (1.0 * 0.15 = 0.15) > public player (0.3 * 0.15 = 0.045) -> 0.105 boost, beats jitter (max 0.09)
    expect(uniIndex).toBeLessThan(pubIndex);

    // Social friend bonus: Alice friends peerPublic
    const reqId = await as(t, alice).mutation(api.friends.sendRequest, {
      toPlayerId: peerPublic.id,
    });
    await as(t, peerPublic).mutation(api.friends.respond, {
      friendshipId: reqId,
      accept: true,
    });

    const recsAfterFriend = await as(t, alice).query(api.discovery.getRecommendedPlayers, {});
    const friendCandidate = recsAfterFriend.find((p) => p._id === peerPublic.id);
    // Accepted friend gets 0.8 * 0.10 = 0.08 vs 0.4 * 0.10 = 0.04
    expect(friendCandidate).toBeDefined();
  });

  test("getOnlinePlayers sorts by rating proximity and respects limits", async () => {
    const t = makeTest();
    const alice = await signUp(t, "alice_sort");
    const bobNear = await signUp(t, "bob_near");
    const charlieFar = await signUp(t, "charlie_far");

    await setRatings(t, alice.id, { rating: 1500, ratingHuman: 1500 });
    await setRatings(t, bobNear.id, { rating: 1510, ratingHuman: 1510 }); // diff: 10
    await setRatings(t, charlieFar.id, { rating: 1700, ratingHuman: 1700 }); // diff: 200

    await as(t, bobNear).mutation(api.presence.heartbeat, {});
    await as(t, charlieFar).mutation(api.presence.heartbeat, {});

    const onlineList = await as(t, alice).query(api.discovery.getOnlinePlayers, { limit: 1 });
    expect(onlineList).toHaveLength(1);
    expect(onlineList[0]._id).toBe(bobNear.id);
  });

  test("excludes fair-play banned players from recommendations, online lobby, and search", async () => {
    const t = makeTest();
    const alice = await signUp(t, "alice_fairplay");
    const cheater = await signUp(t, "cheater_bob");

    await t.run(async (ctx) => {
      await ctx.db.patch(cheater.id, { isFairPlayBanned: true });
    });
    await as(t, cheater).mutation(api.presence.heartbeat, {});

    // 1. Not in recommendations
    const recs = await as(t, alice).query(api.discovery.getRecommendedPlayers, {});
    expect(recs.map((p) => p._id)).not.toContain(cheater.id);

    // 2. Not in online list
    const online = await as(t, alice).query(api.discovery.getOnlinePlayers, {});
    expect(online.map((p) => p._id)).not.toContain(cheater.id);

    // 3. Not in search
    const search = await as(t, alice).query(api.discovery.searchPlayers, { query: "cheater" });
    expect(search.map((p) => p._id)).not.toContain(cheater.id);
  });
});

