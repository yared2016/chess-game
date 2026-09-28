import { describe, expect, test } from "vitest";
import { api, internal } from "../_generated/api";
import { as, makeTest, signUp } from "./harness.setup";

async function signUpAdmin(t: ReturnType<typeof makeTest>, username: string = "admin_yared") {
  const identity = {
    subject: "user_3JfrI7CJEW9GIMo1UsEAvK9M0Ki",
    nickname: username,
    email: "yaredusk@gmail.com",
    pictureUrl: `https://img.clerk.com/${username}.png`,
  };
  const id = await t.withIdentity(identity).mutation(api.players.ensurePlayer, {});
  return { id, identity };
}

describe("feedback.generateUploadUrl", () => {
  test("rejects unauthenticated callers", async () => {
    const t = makeTest();
    await expect(t.mutation(api.feedback.generateUploadUrl, {})).rejects.toThrow();
  });

  test("generates upload url for authenticated players", async () => {
    const t = makeTest();
    const alice = await signUp(t, "alice");
    const uploadUrl = await as(t, alice).mutation(api.feedback.generateUploadUrl, {});
    expect(uploadUrl).toBeDefined();
    expect(typeof uploadUrl).toBe("string");
  });
});

async function createTestGame(t: ReturnType<typeof makeTest>, whiteId: any, blackId: any) {
  return await t.run(async (ctx) =>
    ctx.db.insert("games", {
      whiteId,
      blackId,
      mode: "online",
      fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
      moves: [],
      pgn: "",
      turn: "w",
      status: "active",
      rated: false,
      undoCount: 0,
      hintsUsed: 0,
      createdAt: Date.now(),
      lastMoveAt: Date.now(),
    })
  );
}

async function createTestTournament(t: ReturnType<typeof makeTest>, title: string = "Spring Arena") {
  return await t.run(async (ctx) =>
    ctx.db.insert("tournaments", {
      title,
      description: "Spring Blitz Arena",
      format: "arena",
      status: "active",
      timeControlKey: "3+0",
      baseTimeMs: 180000,
      incrementMs: 0,
      durationMinutes: 60,
      startsAt: Date.now(),
      endsAt: Date.now() + 3600000,
      createdAt: Date.now(),
    })
  );
}

describe("feedback.submit", () => {
  test("rejects unauthenticated callers", async () => {
    const t = makeTest();
    await expect(
      t.mutation(api.feedback.submit, {
        category: "chess_game",
        description: "Encountered a clock desync issue in endgame",
        attachments: [],
      })
    ).rejects.toThrow();
  });

  test("rejects descriptions shorter than 10 characters", async () => {
    const t = makeTest();
    const alice = await signUp(t, "alice");

    await expect(
      as(t, alice).mutation(api.feedback.submit, {
        category: "chess_game",
        description: "Too short",
        attachments: [],
      })
    ).rejects.toThrow(/feedback-description-too-short/);
  });

  test("rejects submissions with more than 5 attachments", async () => {
    const t = makeTest();
    const alice = await signUp(t, "alice");

    const storageId = await t.run(async (ctx) =>
      ctx.storage.store(new Blob(["data"], { type: "image/png" }))
    );

    const attachments = Array.from({ length: 6 }, (_, i) => ({
      storageId,
      fileName: `attachment_${i}.png`,
      fileType: "image/png",
      fileSize: 1024,
      uploadedAt: Date.now(),
    }));

    await expect(
      as(t, alice).mutation(api.feedback.submit, {
        category: "report_problem",
        description: "Here are too many attachments for this issue report",
        attachments,
      })
    ).rejects.toThrow(/too-many-attachments/);
  });

  test("accepts valid submission with chess context, derives identity server-side, and queues email + notification", async () => {
    const t = makeTest();
    const alice = await signUp(t, "alice");
    const bob = await signUp(t, "grandmaster_bob");
    const gameId = await createTestGame(t, alice.id, bob.id);

    const storageId = await t.run(async (ctx) =>
      ctx.storage.store(new Blob(["screenshot data"], { type: "image/png" }))
    );

    const feedbackId = await as(t, alice).mutation(api.feedback.submit, {
      category: "chess_game",
      description: "My pawn was unable to move forward on turn 14 despite no block.",
      gameId,
      opponentUsername: "grandmaster_bob",
      matchId: gameId,
      attachments: [
        {
          storageId,
          fileName: "pawn_freeze.png",
          fileType: "image/png",
          fileSize: 2048,
          uploadedAt: Date.now(),
        },
      ],
    });

    expect(feedbackId).toBeDefined();

    // Verify stored record in db
    const record = await t.run(async (ctx) => ctx.db.get(feedbackId));
    expect(record).not.toBeNull();
    expect(record?.status).toBe("NEW");
    expect(record?.emailStatus).toBe("NOT_SENT");
    expect(record?.category).toBe("chess_game");
    expect(record?.gameId).toBe(gameId);
    expect(record?.opponentUsername).toBe("grandmaster_bob");
    expect(record?.attachments).toHaveLength(1);
    expect(record?.attachments[0].fileName).toBe("pawn_freeze.png");

    // Server-side identity derivation verification
    expect(record?.userId).toEqual(alice.id);
    expect(record?.clerkId).toBe(alice.identity.subject);
    expect(record?.userName).toBe("alice");

    // Check in-app notification creation
    const notifs = await t.run(async (ctx) =>
      ctx.db
        .query("notifications")
        .withIndex("by_userId", (q) => q.eq("userId", alice.id))
        .collect()
    );
    expect(notifs.length).toBeGreaterThanOrEqual(1);
    expect(notifs.some((n) => n.title.toLowerCase().includes("feedback"))).toBe(true);
  });

  test("accepts submission without any optional chess context fields", async () => {
    const t = makeTest();
    const alice = await signUp(t, "alice");

    const feedbackId = await as(t, alice).mutation(api.feedback.submit, {
      category: "general_feedback",
      description: "Loving the new 3D chess pieces and lighting system!",
      attachments: [],
    });

    expect(feedbackId).toBeDefined();
    const record = await t.run(async (ctx) => ctx.db.get(feedbackId));
    expect(record).not.toBeNull();
    expect(record?.gameId).toBeUndefined();
    expect(record?.opponentUsername).toBeUndefined();
  });

  test("accepts submission with a subset of valid fields (e.g. only opponentUsername)", async () => {
    const t = makeTest();
    const alice = await signUp(t, "alice");
    await signUp(t, "magnus");

    const feedbackId = await as(t, alice).mutation(api.feedback.submit, {
      category: "report_problem",
      description: "Player seemed to disconnect unexpectedly during our game.",
      opponentUsername: "@magnus",
      attachments: [],
    });

    expect(feedbackId).toBeDefined();
  });

  test("accepts submission with URL-based gameId and stores clean ID", async () => {
    const t = makeTest();
    const alice = await signUp(t, "alice");
    const bob = await signUp(t, "bob");
    const gameId = await createTestGame(t, alice.id, bob.id);

    const feedbackId = await as(t, alice).mutation(api.feedback.submit, {
      category: "chess_game",
      description: "Encountered a visual glitch when pawn moved forward.",
      gameId: `https://chess-game-beta-mocha.vercel.app/game/${gameId}?view=3d`,
      opponentUsername: "https://chess-game-beta-mocha.vercel.app/profile/bob",
      attachments: [],
    });

    expect(feedbackId).toBeDefined();
    const doc = await t.run(async (ctx) => ctx.db.get(feedbackId));
    expect(doc?.gameId).toBe(gameId);
    expect(doc?.opponentUsername).toBe("bob");
  });

  test("rejects submission if gameId does not exist", async () => {
    const t = makeTest();
    const alice = await signUp(t, "alice");

    await expect(
      as(t, alice).mutation(api.feedback.submit, {
        category: "chess_game",
        description: "Encountered a glitch during an endgame match.",
        gameId: "non_existent_game_id_12345",
        attachments: [],
      })
    ).rejects.toThrow(/game-not-found/);
  });

  test("rejects submission if opponentUsername does not exist", async () => {
    const t = makeTest();
    const alice = await signUp(t, "alice");

    await expect(
      as(t, alice).mutation(api.feedback.submit, {
        category: "chess_game",
        description: "Encountered an opponent who seemed suspicious.",
        opponentUsername: "player_who_does_not_exist_at_all",
        attachments: [],
      })
    ).rejects.toThrow(/opponent-not-found/);
  });

  test("rejects submission if matchId does not exist", async () => {
    const t = makeTest();
    const alice = await signUp(t, "alice");

    await expect(
      as(t, alice).mutation(api.feedback.submit, {
        category: "chess_game",
        description: "Wager settlement seemed delayed for this match.",
        matchId: "fake_match_ref_9999",
        attachments: [],
      })
    ).rejects.toThrow(/match-not-found/);
  });

  test("rejects submission if tournamentId does not exist", async () => {
    const t = makeTest();
    const alice = await signUp(t, "alice");

    await expect(
      as(t, alice).mutation(api.feedback.submit, {
        category: "tournaments",
        description: "Could not see my rank on the tournament leaderboard.",
        tournamentId: "non_existent_tourney_888",
        attachments: [],
      })
    ).rejects.toThrow(/tournament-not-found/);
  });
});

describe("feedback.validateMatchContext", () => {
  test("returns allValid when no optional fields are passed", async () => {
    const t = makeTest();
    const alice = await signUp(t, "alice");

    const result = await as(t, alice).query(api.feedback.validateMatchContext, {});
    expect(result.allValid).toBe(true);
    expect(result.game.provided).toBe(false);
    expect(result.opponent.provided).toBe(false);
    expect(result.match.provided).toBe(false);
    expect(result.tournament.provided).toBe(false);
  });

  test("validates existing entities and reports not found for non-existent ones", async () => {
    const t = makeTest();
    const alice = await signUp(t, "alice");
    const bob = await signUp(t, "bob");
    const gameId = await createTestGame(t, alice.id, bob.id);
    const tournamentId = await createTestTournament(t, "Arena Blitz");

    // 1. All valid
    const validCheck = await as(t, alice).query(api.feedback.validateMatchContext, {
      gameId,
      opponentUsername: "bob",
      matchId: gameId,
      tournamentId,
    });
    expect(validCheck.allValid).toBe(true);
    expect(validCheck.game.valid).toBe(true);
    expect(validCheck.opponent.valid).toBe(true);
    expect(validCheck.match.valid).toBe(true);
    expect(validCheck.tournament.valid).toBe(true);

    // 2. Opponent with @ prefix
    const atCheck = await as(t, alice).query(api.feedback.validateMatchContext, {
      opponentUsername: "@bob",
    });
    expect(atCheck.allValid).toBe(true);
    expect(atCheck.opponent.valid).toBe(true);

    // 3. Tournament by title
    const titleCheck = await as(t, alice).query(api.feedback.validateMatchContext, {
      tournamentId: "Arena Blitz",
    });
    expect(titleCheck.allValid).toBe(true);
    expect(titleCheck.tournament.valid).toBe(true);

    // 4. Invalid opponent and game
    const invalidCheck = await as(t, alice).query(api.feedback.validateMatchContext, {
      gameId: "does_not_exist",
      opponentUsername: "nobody_here",
    });
    expect(invalidCheck.allValid).toBe(false);
    expect(invalidCheck.game.valid).toBe(false);
    expect(invalidCheck.opponent.valid).toBe(false);
    expect(invalidCheck.game.error).toBeDefined();
    expect(invalidCheck.opponent.error).toContain("nobody_here");

    // 5. Full URL game link
    const urlCheck = await as(t, alice).query(api.feedback.validateMatchContext, {
      gameId: `https://chess-game-beta-mocha.vercel.app/game/${gameId}?tab=moves`,
    });
    expect(urlCheck.allValid).toBe(true);
    expect(urlCheck.game.valid).toBe(true);
    expect(urlCheck.game.label).toContain(gameId.slice(0, 8));

    // 6. Relative path game link
    const pathCheck = await as(t, alice).query(api.feedback.validateMatchContext, {
      gameId: `/game/${gameId}`,
    });
    expect(pathCheck.allValid).toBe(true);
    expect(pathCheck.game.valid).toBe(true);

    // 7. PGN filename game link
    const pgnCheck = await as(t, alice).query(api.feedback.validateMatchContext, {
      gameId: `match_${gameId}_bob.pgn`,
    });
    expect(pgnCheck.allValid).toBe(true);
    expect(pgnCheck.game.valid).toBe(true);

    // 8. Opponent profile URL
    const profileUrlCheck = await as(t, alice).query(api.feedback.validateMatchContext, {
      opponentUsername: "https://chess-game-beta-mocha.vercel.app/profile/bob",
    });
    expect(profileUrlCheck.allValid).toBe(true);
    expect(profileUrlCheck.opponent.valid).toBe(true);
    expect(profileUrlCheck.opponent.label).toContain("@bob");

    // 9. Unauthenticated caller can query validateMatchContext safely without error
    const unauthCheck = await t.query(api.feedback.validateMatchContext, {
      gameId,
    });
    expect(unauthCheck.allValid).toBe(true);
    expect(unauthCheck.game.valid).toBe(true);
  });
});

describe("feedback.getMyFeedback", () => {
  test("returns only feedback belonging to calling player and strips adminNotes", async () => {
    const t = makeTest();
    const alice = await signUp(t, "alice");
    const bob = await signUp(t, "bob");

    const f1 = await as(t, alice).mutation(api.feedback.submit, {
      category: "website_app",
      description: "Dark mode toggle flickers on mobile layout.",
      attachments: [],
    });

    await as(t, bob).mutation(api.feedback.submit, {
      category: "feature_request",
      description: "Please add board coordinate training minigame.",
      attachments: [],
    });

    // Admin adds internal notes to Alice's feedback
    await t.run(async (ctx) => {
      await ctx.db.patch(f1, { adminNotes: "CONFIDENTIAL: Investigated by engineering." });
    });

    // Alice queries her feedback
    const aliceItems = await as(t, alice).query(api.feedback.getMyFeedback, {});
    expect(aliceItems).toHaveLength(1);
    expect(aliceItems[0]._id).toEqual(f1);
    expect(aliceItems[0].category).toBe("website_app");
    // Ensure adminNotes is strictly stripped
    expect((aliceItems[0] as { adminNotes?: string }).adminNotes).toBeUndefined();

    // Bob queries his feedback
    const bobItems = await as(t, bob).query(api.feedback.getMyFeedback, {});
    expect(bobItems).toHaveLength(1);
    expect(bobItems[0].category).toBe("feature_request");
    expect((bobItems[0] as { adminNotes?: string }).adminNotes).toBeUndefined();
  });
});

describe("feedback.getAttachmentUrl", () => {
  test("allows owner player and admin, rejects unauthorized player", async () => {
    const t = makeTest();
    const alice = await signUp(t, "alice");
    const bob = await signUp(t, "bob");
    const admin = await signUpAdmin(t, "super_admin");

    const storageId = await t.run(async (ctx) =>
      ctx.storage.store(new Blob(["image data"], { type: "image/png" }))
    );

    const feedbackId = await as(t, alice).mutation(api.feedback.submit, {
      category: "report_problem",
      description: "Board textures failed to load properly here.",
      attachments: [
        {
          storageId,
          fileName: "screenshot.png",
          fileType: "image/png",
          fileSize: 100,
          uploadedAt: Date.now(),
        },
      ],
    });

    // Owner (Alice) can access attachment URL
    const aliceUrl = await as(t, alice).query(api.feedback.getAttachmentUrl, {
      feedbackId,
      storageId,
    });
    expect(aliceUrl).toBeDefined();

    // Admin can access attachment URL
    const adminUrl = await as(t, admin).query(api.feedback.getAttachmentUrl, {
      feedbackId,
      storageId,
    });
    expect(adminUrl).toBeDefined();

    // Unauthorized player (Bob) cannot access Alice's attachment
    await expect(
      as(t, bob).query(api.feedback.getAttachmentUrl, {
        feedbackId,
        storageId,
      })
    ).rejects.toThrow(/unauthorized-attachment/);
  });
});

describe("feedback admin operations", () => {
  test("adminList and adminGetStats reject non-admin players and work for admin", async () => {
    const t = makeTest();
    const alice = await signUp(t, "alice");
    const admin = await signUpAdmin(t, "admin_user");

    // Alice creates feedback items
    await as(t, alice).mutation(api.feedback.submit, {
      category: "chess_game",
      description: "Engine evaluation took too long on move 22.",
      attachments: [],
    });
    await as(t, alice).mutation(api.feedback.submit, {
      category: "feature_request",
      description: "Would love to have sound theme options.",
      attachments: [],
    });

    // Alice (non-admin) should be rejected
    await expect(as(t, alice).query(api.feedback.adminList, {})).rejects.toThrow(
      /unauthorized-admin/
    );
    await expect(as(t, alice).query(api.feedback.adminGetStats, {})).rejects.toThrow(
      /unauthorized-admin/
    );

    // Admin queries list and stats
    const list = await as(t, admin).query(api.feedback.adminList, {});
    expect(list).toHaveLength(2);

    const stats = await as(t, admin).query(api.feedback.adminGetStats, {});
    expect(stats.total).toBe(2);
    expect(stats.newCount).toBe(2);
    expect(stats.inReviewCount).toBe(0);
    expect(stats.resolvedCount).toBe(0);
    expect(stats.featureRequestsCount).toBe(1);

    // Filter by category
    const featureItems = await as(t, admin).query(api.feedback.adminList, {
      category: "feature_request",
    });
    expect(featureItems).toHaveLength(1);
    expect(featureItems[0].category).toBe("feature_request");

    // Filter by search query
    const searchItems = await as(t, admin).query(api.feedback.adminList, {
      search: "Engine evaluation",
    });
    expect(searchItems).toHaveLength(1);
    expect(searchItems[0].category).toBe("chess_game");
  });

  test("adminUpdateStatus and adminUpdateNotes modify records correctly", async () => {
    const t = makeTest();
    const alice = await signUp(t, "alice");
    const admin = await signUpAdmin(t, "admin_user");

    const feedbackId = await as(t, alice).mutation(api.feedback.submit, {
      category: "report_problem",
      description: "Audio crackles when capturing pieces fast.",
      attachments: [],
    });

    // Non-admin cannot update status or notes
    await expect(
      as(t, alice).mutation(api.feedback.adminUpdateStatus, {
        feedbackId,
        status: "IN_REVIEW",
      })
    ).rejects.toThrow(/unauthorized-admin/);

    await expect(
      as(t, alice).mutation(api.feedback.adminUpdateNotes, {
        feedbackId,
        adminNotes: "Malicious note injection attempt",
      })
    ).rejects.toThrow(/unauthorized-admin/);

    // Admin moves to IN_REVIEW
    await as(t, admin).mutation(api.feedback.adminUpdateStatus, {
      feedbackId,
      status: "IN_REVIEW",
    });
    let record = await t.run(async (ctx) => ctx.db.get(feedbackId));
    expect(record?.status).toBe("IN_REVIEW");
    expect(record?.resolvedAt).toBeUndefined();

    // Admin updates internal notes
    await as(t, admin).mutation(api.feedback.adminUpdateNotes, {
      feedbackId,
      adminNotes: "Reproduced on Safari audio context.",
    });
    record = await t.run(async (ctx) => ctx.db.get(feedbackId));
    expect(record?.adminNotes).toBe("Reproduced on Safari audio context.");

    // Admin marks RESOLVED -> sets resolvedAt and resolvedBy
    await as(t, admin).mutation(api.feedback.adminUpdateStatus, {
      feedbackId,
      status: "RESOLVED",
    });
    record = await t.run(async (ctx) => ctx.db.get(feedbackId));
    expect(record?.status).toBe("RESOLVED");
    expect(record?.resolvedAt).toBeDefined();
    expect(record?.resolvedBy).toBe("admin_user");
  });

  test("adminRetryEmail resets status and reschedules", async () => {
    const t = makeTest();
    const alice = await signUp(t, "alice");
    const admin = await signUpAdmin(t, "admin_user");

    const feedbackId = await as(t, alice).mutation(api.feedback.submit, {
      category: "general_feedback",
      description: "Platform looks and feels amazing, keep it up!",
      attachments: [],
    });

    await t.run(async (ctx) => {
      await ctx.db.patch(feedbackId, {
        emailStatus: "FAILED",
        emailError: "Network timeout",
      });
    });

    await as(t, admin).mutation(api.feedback.adminRetryEmail, { feedbackId });

    const record = await t.run(async (ctx) => ctx.db.get(feedbackId));
    expect(record?.emailStatus).toBe("NOT_SENT");
    expect(record?.emailError).toBeUndefined();
  });
});

describe("email resilience and internal functions", () => {
  test("when email action simulates or fails, feedback document is NEVER deleted", async () => {
    const t = makeTest();
    const alice = await signUp(t, "alice");

    const feedbackId = await as(t, alice).mutation(api.feedback.submit, {
      category: "tournamentId" in {} ? "tournaments" : "website_app",
      description: "Tournament bracket did not display the 3rd place match.",
      attachments: [],
    });

    // Test internalGetFeedback
    const fetched = await t.query(internal.feedback.internalGetFeedback, { feedbackId });
    expect(fetched).not.toBeNull();
    expect(fetched?._id).toEqual(feedbackId);

    // Test internalUpdateEmailStatus with FAILED
    await t.mutation(internal.feedback.internalUpdateEmailStatus, {
      feedbackId,
      emailStatus: "FAILED",
      emailError: "Simulated SMTP timeout",
    });

    let doc = await t.run(async (ctx) => ctx.db.get(feedbackId));
    expect(doc).not.toBeNull();
    expect(doc?.emailStatus).toBe("FAILED");
    expect(doc?.emailError).toBe("Simulated SMTP timeout");

    // Test internalUpdateEmailStatus with SENT
    const sentTime = Date.now();
    await t.mutation(internal.feedback.internalUpdateEmailStatus, {
      feedbackId,
      emailStatus: "SENT",
      emailSentAt: sentTime,
    });

    doc = await t.run(async (ctx) => ctx.db.get(feedbackId));
    expect(doc).not.toBeNull();
    expect(doc?.emailStatus).toBe("SENT");
    expect(doc?.emailSentAt).toBe(sentTime);

    // Test sendConfirmationEmailAction execution without RESEND_API_KEY
    delete process.env.RESEND_API_KEY;
    await t.action(internal.feedback.sendConfirmationEmailAction, { feedbackId });

    doc = await t.run(async (ctx) => ctx.db.get(feedbackId));
    expect(doc).not.toBeNull();
    expect(doc?.emailStatus).toBe("SENT");
  });

  test("sendConfirmationEmailAction with RESEND_API_KEY dispatches email and handles failure gracefully without deleting feedback", async () => {
    const t = makeTest();
    const alice = await signUp(t, "alice");

    // Ensure feedback has email
    const feedbackId = await as(t, alice).mutation(api.feedback.submit, {
      category: "report_problem",
      description: "Sound effect plays twice when queen moves diagonally.",
      attachments: [],
    });

    await t.run(async (ctx) => {
      await ctx.db.patch(feedbackId, { userEmail: "alice@example.com" });
    });

    process.env.RESEND_API_KEY = "re_test_key_123";

    const originalFetch = global.fetch;
    try {
      // 1. Success case: Mock global fetch returning 200
      global.fetch = async () =>
        new Response(JSON.stringify({ id: "resend_msg_123" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });

      await t.action(internal.feedback.sendConfirmationEmailAction, { feedbackId });
      let doc = await t.run(async (ctx) => ctx.db.get(feedbackId));
      expect(doc).not.toBeNull();
      expect(doc?.emailStatus).toBe("SENT");
      expect(doc?.emailSentAt).toBeDefined();

      // Test idempotency: calling sendConfirmationEmailAction again when already SENT skips
      let callCount = 0;
      global.fetch = async () => {
        callCount++;
        return new Response(JSON.stringify({ id: "resend_msg_dup" }), { status: 200 });
      };
      await t.action(internal.feedback.sendConfirmationEmailAction, { feedbackId });
      expect(callCount).toBe(0);

      // 2. Failure case: Mock global fetch returning 500 error
      await t.run(async (ctx) => {
        await ctx.db.patch(feedbackId, { emailStatus: "NOT_SENT" });
      });

      global.fetch = async () =>
        new Response("Internal Server Error at Resend", {
          status: 500,
        });

      await t.action(internal.feedback.sendConfirmationEmailAction, { feedbackId });
      doc = await t.run(async (ctx) => ctx.db.get(feedbackId));
      expect(doc).not.toBeNull();
      expect(doc?.emailStatus).toBe("FAILED");
      expect(doc?.emailError).toContain("500");

      // 3. Exception case: Mock global fetch throwing network error
      await t.run(async (ctx) => {
        await ctx.db.patch(feedbackId, { emailStatus: "NOT_SENT" });
      });

      global.fetch = async () => {
        throw new Error("DNS resolution failed");
      };

      await t.action(internal.feedback.sendConfirmationEmailAction, { feedbackId });
      doc = await t.run(async (ctx) => ctx.db.get(feedbackId));
      expect(doc).not.toBeNull();
      expect(doc?.emailStatus).toBe("FAILED");
      expect(doc?.emailError).toContain("DNS resolution failed");
    } finally {
      global.fetch = originalFetch;
      delete process.env.RESEND_API_KEY;
    }
  });
});
