// convex/schema.ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import {
  vBoardView,
  vColour,
  vCommentarySource,
  vDifficulty,
  vEndReason,
  vGameMode,
  vGameStatus,
  vLastMove,
  vPresenceRole,
  vQualityTier,
  vRatingPool,
  vRoomColors,
  vRoomPreset,
  vWinner,
  vDepositStatus,
  vWithdrawalStatus,
  vPayoutMethod,
  vChapaPaymentStatus,
  vLedgerEntryType,
  vFinancialDepositStatus,
  vFinancialWithdrawalStatus,
  vWalletStatus,
  vFeeMode,
  vFeedbackCategory,
  vFeedbackStatus,
  vEmailStatus,
  vFeedbackAttachment,
} from "./lib/validators";

export default defineSchema({
  // ---------------------------------------------------------------- players
  players: defineTable({
    clerkId: v.string(), // identity.subject, e.g. "user_2ab…"  (FR-3)
    tokenIdentifier: v.string(), // "<issuer>|<subject>" — the canonical auth key (Convex guidelines)
    username: v.string(), // identity.nickname (Clerk username, always set)
    usernameLower: v.string(), // lowercase, for case-insensitive /profile/[username] lookups
    avatarUrl: v.string(), // identity.pictureUrl

    rating: v.number(), // overall Elo, starts at 1200 (FR-48)
    ratingHuman: v.number(), // online games only  (FR-51)
    ratingAi: v.number(), // vs-AI games only     (FR-51)
    ratingPuzzle: v.optional(v.number()), // puzzle rating (defaults to 1200)
    puzzleStreak: v.optional(v.number()), // current streak
    bestPuzzleStreak: v.optional(v.number()), // best streak
    puzzlesSolved: v.optional(v.number()), // count of solved puzzles
    wins: v.number(),
    losses: v.number(),
    draws: v.number(),

    roomPreset: vRoomPreset, // FR-21l
    roomColors: v.optional(vRoomColors), // FR-21j
    roomImageStorageId: v.optional(v.id("_storage")), // FR-21k stretch
    boardFlipEnabled: v.boolean(), // FR-21e
    boardView: vBoardView, // FR-15
    qualityTier: vQualityTier, // FR-31
    postFxEnabled: v.boolean(), // FR-29 toggle
    proUntil: v.optional(v.number()), // Pro membership expiration timestamp (ETB subscription)
    email: v.optional(v.string()),
    universityId: v.optional(v.id("universities")),
    universityName: v.optional(v.string()),
    isFairPlayBanned: v.optional(v.boolean()),
    fairPlayFlags: v.optional(v.number()),
    fairPlayWarning: v.optional(v.string()),

    displayName: v.optional(v.string()),
    phoneNumber: v.optional(v.string()),
    playerType: v.optional(v.union(v.literal("university_student"), v.literal("public_player"))),
    studentId: v.optional(v.string()),
    verificationStatus: v.optional(v.union(v.literal("none"), v.literal("pending"), v.literal("verified"))),
    profileCompleted: v.optional(v.boolean()),
    profileCompletedAt: v.optional(v.number()),

    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_clerkId", ["clerkId"])
    .index("by_tokenIdentifier", ["tokenIdentifier"])
    .index("by_usernameLower", ["usernameLower"])
    .index("by_email", ["email"])
    .index("by_rating", ["rating"])
    .index("by_ratingHuman", ["ratingHuman"])
    .index("by_ratingAi", ["ratingAi"])
    .index("by_ratingPuzzle", ["ratingPuzzle"])
    .index("by_universityId", ["universityId"])
    .index("by_isFairPlayBanned", ["isFairPlayBanned"])
    .index("by_profileCompleted", ["profileCompleted"])
    .index("by_playerType", ["playerType"])
    .index("by_displayName", ["displayName"]),

  // ------------------------------------------------------------------ queue
  queue: defineTable({
    playerId: v.id("players"),
    rating: v.number(), // ratingHuman snapshot at join time
    joinedAt: v.number(),
    stake: v.optional(v.number()),
    timeControlKey: v.optional(v.string()),
  })
    .index("by_joinedAt", ["joinedAt"])
    .index("by_playerId", ["playerId"]),

  // ------------------------------------------------------------------ games
  games: defineTable({
    whiteId: v.union(v.id("players"), v.null()), // null when the AI plays white
    blackId: v.union(v.id("players"), v.null()), // null for AI side and for "Player 2" in local mode
    mode: vGameMode,
    localPlayerTwoName: v.optional(v.string()), // FR-21a
    difficulty: v.optional(vDifficulty), // FR-39, ai mode only
    aiColor: v.optional(vColour), // ai mode only

    fen: v.string(), // FR-12
    moves: v.array(v.string()), // SAN list — the source of truth for replay/undo (FR-44)
    pgn: v.string(), // FR-47
    turn: vColour,
    lastMove: v.optional(vLastMove), // denormalised for board highlighting

    status: vGameStatus, // FR-13
    winner: v.optional(vWinner),
    endReason: v.optional(vEndReason),
    drawOffer: v.optional(vColour), // FR-31: the colour that offered

    rated: v.boolean(), // false for local, and flipped to false by the first take-back (FR-49)
    undoCount: v.number(), // FR-45
    hintsUsed: v.number(), // FR-40, max 3
    // docs/PRO_TUTOR.md §5.3: a spend guard on the tutor, capped by
    // MAX_TUTOR_TURNS_PER_GAME. Optional so every row written before the tutor
    // existed stays valid; `?? 0` is the only way it is read.
    tutorTurnsUsed: v.optional(v.number()),
    spectatorCount: v.optional(v.number()), // denormalised by the presence cron
    peakSpectators: v.optional(v.number()), // peak live audience observed
    totalViews: v.optional(v.number()),     // all unique spectator views recorded

    eveSessionId: v.optional(v.string()), // durable Eve session for this game (eve-agent.md §3.3)
    playerChatThreadId: v.optional(v.string()), // private conversation between the two online players

    createdAt: v.number(),
    lastMoveAt: v.number(),
    endedAt: v.optional(v.number()),
    stake: v.optional(v.number()),       // ETB per player, null = free
    escrowTotal: v.optional(v.number()), // total pool e.g. 200
    commission: v.optional(v.number()), // platform cut e.g. 20
    payout: v.optional(v.number()),     // winner gets e.g. 180
    escrowSettled: v.optional(v.boolean()),

    // Time control
    timeControlKey: v.optional(v.string()),
    baseTimeMs: v.optional(v.number()),
    incrementMs: v.optional(v.number()),
    delayMs: v.optional(v.number()),
    timeCategory: v.optional(v.union(
      v.literal('bullet'),
      v.literal('blitz'),
      v.literal('rapid'),
      v.literal('classical'),
      v.literal('correspondence'),
      v.literal('unlimited')
    )),
    clockMode: v.optional(v.union(
      v.literal('fischer'),
      v.literal('bronstein'),
      v.literal('none')
    )),

    // Clock state
    whiteTimeMs: v.optional(v.number()),
    blackTimeMs: v.optional(v.number()),
    lastTickAt: v.optional(v.number()),
    clockVersion: v.optional(v.number()),
    firstMoveDeadlineAt: v.optional(v.number()),
  })
    // `mode` leads so ai/local rows can never occupy the window listLive and the
    // abandon sweep read — an idle vs-AI game must not hide a live online one.
    .index("by_mode_and_status_and_lastMoveAt", ["mode", "status", "lastMoveAt"])
    .index("by_whiteId_and_createdAt", ["whiteId", "createdAt"])
    .index("by_blackId_and_createdAt", ["blackId", "createdAt"])
    // (owner, status): the FR-26 active-game lookup, O(1) instead of a 100-row scan.
    .index("by_whiteId_and_status", ["whiteId", "status"])
    .index("by_blackId_and_status", ["blackId", "status"]),

  // --------------------------------------------------------------- presence
  // Heartbeats and spectator tracking live here, NOT on `games`: patching the game
  // document every 15 s would push a new doc to every subscriber (both players AND
  // every spectator) and re-render the board. See §I-2.
  presence: defineTable({
    gameId: v.id("games"),
    playerId: v.id("players"),
    role: vPresenceRole,
    lastSeen: v.number(),
    chatReadAt: v.optional(v.number()),
  })
    .index("by_gameId_and_playerId", ["gameId", "playerId"])
    .index("by_gameId_and_role", ["gameId", "role"])
    .index("by_lastSeen", ["lastSeen"]),

  // ----------------------------------------------------------- userPresence
  // Platform-wide presence tracking for online status
  userPresence: defineTable({
    playerId: v.id("players"),
    lastSeen: v.number(),
    updatedAt: v.number(),
  })
    .index("by_playerId", ["playerId"])
    .index("by_lastSeen", ["lastSeen"]),

  // ------------------------------------------------------------- commentary
  commentary: defineTable({
    gameId: v.id("games"),
    ply: v.number(), // moves.length AFTER the AI move this comments on
    text: v.string(),
    source: vCommentarySource,
    persona: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_gameId_and_ply", ["gameId", "ply"]),

  // ---------------------------------------------------------- ratingHistory
  ratingHistory: defineTable({
    playerId: v.id("players"),
    gameId: v.id("games"),
    pool: vRatingPool,
    before: v.number(),
    after: v.number(),
    delta: v.number(),
    createdAt: v.number(),
  })
    .index("by_playerId", ["playerId"]) // _creationTime is appended automatically -> sparkline order
    .index("by_gameId", ["gameId"]),

  // ---------------------------------------------------------------- wallets
  wallets: defineTable({
    userId: v.id("players"),
    availableBalance: v.number(),
    lockedBalance: v.number(),
    availableSantims: v.optional(v.number()), // Minor units (1 ETB = 100 santims)
    lockedSantims: v.optional(v.number()),
    status: v.optional(vWalletStatus), // "active" | "frozen" | "restricted" (defaults to active)
    freezeReason: v.optional(v.string()),
    totalDeposited: v.number(),
    totalWithdrawn: v.number(),
    totalWon: v.number(),
    totalLost: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_userId", ["userId"]),

  // --------------------------------------------------------------- deposits
  deposits: defineTable({
    userId: v.id("players"),
    walletId: v.id("wallets"),
    amount: v.number(),
    code: v.string(),
    screenshotId: v.optional(v.id("_storage")),
    senderInfo: v.optional(v.string()),
    status: vDepositStatus,
    rejectionReason: v.optional(v.string()),
    createdAt: v.number(),
    reviewedAt: v.optional(v.number()),
  })
    .index("by_userId", ["userId"])
    .index("by_status", ["status"])
    .index("by_code", ["code"]),

  // ------------------------------------------------------------ withdrawals
  withdrawals: defineTable({
    userId: v.id("players"),
    walletId: v.id("wallets"),
    amount: v.number(),
    payoutMethod: vPayoutMethod,
    payoutAccount: v.string(),
    status: vWithdrawalStatus,
    rejectionReason: v.optional(v.string()),
    createdAt: v.number(),
    completedAt: v.optional(v.number()),
  })
    .index("by_userId", ["userId"])
    .index("by_status", ["status"]),

  // ------------------------------------------------------------ commissions
  commissions: defineTable({
    gameId: v.id("games"),
    amount: v.number(),
    transferred: v.boolean(),
    createdAt: v.number(),
  }).index("by_transferred", ["transferred"]),

  // ------------------------------------------------------------- challenges
  challenges: defineTable({
    fromId: v.id("players"),
    toId: v.id("players"),
    parentGameId: v.optional(v.id("games")),
    previousWhiteId: v.optional(v.id("players")),
    previousBlackId: v.optional(v.id("players")),
    stake: v.optional(v.number()),
    timeControlKey: v.optional(v.string()),
    preferredColor: v.optional(v.union(v.literal("white"), v.literal("black"), v.literal("random"))),
    status: v.union(v.literal("pending"), v.literal("accepted"), v.literal("declined"), v.literal("cancelled"), v.literal("expired")),
    gameId: v.optional(v.id("games")),
    createdAt: v.number(),
    respondedAt: v.optional(v.number()),
  })
    .index("by_toId_and_status", ["toId", "status"])
    .index("by_fromId_and_status", ["fromId", "status"])
    .index("by_parentGameId", ["parentGameId"]),

  // ----------------------------------------------------------- notifications
  notifications: defineTable({
    userId: v.id("players"),
    type: v.union(
      v.literal("deposit_submitted"),
      v.literal("deposit_approved"),
      v.literal("deposit_rejected"),
      v.literal("withdrawal_submitted"),
      v.literal("withdrawal_completed"),
      v.literal("withdrawal_rejected"),
      v.literal("challenge_received"),
      v.literal("challenge_declined"),
      v.literal("challenge_accepted"),
      v.literal("friend_request"),
      v.literal("friend_accepted"),
      v.literal("chapa_payment_verified"),
      v.literal("chapa_payment_failed"),
      v.literal("system")
    ),
    title: v.string(),
    message: v.string(),
    link: v.optional(v.string()),
    read: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_userId_and_read", ["userId", "read"])
    .index("by_userId", ["userId"]),

  // --------------------------------------------------------- chapaPayments
  chapaPayments: defineTable({
    userId: v.id("players"),
    txRef: v.string(),
    amount: v.number(),
    currency: v.string(),
    provider: v.literal("chapa"),
    status: vChapaPaymentStatus,
    chapaRef: v.optional(v.string()),
    checkoutUrl: v.optional(v.string()),
    email: v.optional(v.string()),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    verifiedAt: v.optional(v.number()),
    metadata: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_txRef", ["txRef"])
    .index("by_userId", ["userId"])
    .index("by_status", ["status"]),

  // -------------------------------------------------------- financialLedger
  // Immutable journal entries recording every balance movement in integer santims.
  financialLedger: defineTable({
    userId: v.id("players"),
    walletId: v.id("wallets"),
    entryType: vLedgerEntryType,
    amountSantims: v.number(), // Always positive integer
    balanceAfterSantims: v.number(), // Resulting available balance
    lockedAfterSantims: v.number(), // Resulting locked balance
    referenceType: v.union(
      v.literal("deposit"),
      v.literal("withdrawal"),
      v.literal("match"),
      v.literal("admin"),
      v.literal("system")
    ),
    referenceId: v.string(),
    idempotencyKey: v.string(),
    description: v.string(),
    metadata: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_and_createdAt", ["userId", "createdAt"])
    .index("by_idempotencyKey", ["idempotencyKey"])
    .index("by_referenceType_and_referenceId", ["referenceType", "referenceId"])
    .index("by_createdAt", ["createdAt"]),

  // ------------------------------------------------------ financialDeposits
  // Provider-agnostic deposit requests with fee modeling.
  financialDeposits: defineTable({
    userId: v.id("players"),
    walletId: v.id("wallets"),
    provider: v.string(), // "chapa", etc.
    providerTxId: v.optional(v.string()),
    internalTxRef: v.string(),
    requestedCreditSantims: v.number(),
    providerFeeSantims: v.number(),
    grossAmountSantims: v.number(),
    chapaServiceFeeSantims: v.optional(v.number()),
    chapaVatSantims: v.optional(v.number()),
    effectiveRateBps: v.optional(v.number()),
    currency: v.string(), // "ETB"
    status: vFinancialDepositStatus,
    feeMode: vFeeMode,
    checkoutUrl: v.optional(v.string()),
    email: v.optional(v.string()),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    failureReason: v.optional(v.string()),
    providerResponse: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
    verifiedAt: v.optional(v.number()),
  })
    .index("by_internalTxRef", ["internalTxRef"])
    .index("by_providerTxId", ["providerTxId"])
    .index("by_userId_and_status", ["userId", "status"])
    .index("by_userId_and_createdAt", ["userId", "createdAt"])
    .index("by_status", ["status"]),

  // --------------------------------------------------- financialWithdrawals
  // Provider-agnostic withdrawal records with reservation accounting.
  financialWithdrawals: defineTable({
    userId: v.id("players"),
    walletId: v.id("wallets"),
    provider: v.string(),
    internalTransferRef: v.string(),
    providerTransferId: v.optional(v.string()),
    requestedAmountSantims: v.number(),
    providerFeeSantims: v.number(),
    totalReservedSantims: v.number(),
    chapaServiceFeeSantims: v.optional(v.number()),
    chapaVatSantims: v.optional(v.number()),
    effectiveRateBps: v.optional(v.number()),
    currency: v.string(), // "ETB"
    bankName: v.string(),
    bankCode: v.string(),
    accountNumberMasked: v.string(),
    accountHolderName: v.string(),
    status: vFinancialWithdrawalStatus,
    failureReason: v.optional(v.string()),
    providerResponse: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
    completedAt: v.optional(v.number()),
  })
    .index("by_internalTransferRef", ["internalTransferRef"])
    .index("by_providerTransferId", ["providerTransferId"])
    .index("by_userId_and_status", ["userId", "status"])
    .index("by_userId_and_createdAt", ["userId", "createdAt"])
    .index("by_status", ["status"]),

  // ----------------------------------------------------- financialAuditLogs
  // Immutable audit trail for admin balance adjustments, freeze actions, and config.
  financialAuditLogs: defineTable({
    adminId: v.id("players"),
    action: v.union(
      v.literal("freeze_wallet"),
      v.literal("unfreeze_wallet"),
      v.literal("manual_adjustment"),
      v.literal("config_update"),
      v.literal("reconciliation_override")
    ),
    targetUserId: v.optional(v.id("players")),
    amountSantims: v.optional(v.number()),
    reason: v.string(),
    metadata: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_adminId", ["adminId"])
    .index("by_targetUserId", ["targetUserId"])
    .index("by_createdAt", ["createdAt"]),

  // -------------------------------------------------------- financialConfig
  // Configurable rates and limits for fees and commissions.
  financialConfig: defineTable({
    key: v.string(), // "default"
    depositFeeRateBasisPoints: v.number(), // 250 = 2.5%
    withdrawalFeeRateBasisPoints: v.number(), // 250 = 2.5%
    commissionRateBasisPoints: v.number(), // 1000 = 10%
    minDepositSantims: v.number(), // 1000 = 10 ETB
    maxDepositSantims: v.number(), // 1000000 = 10,000 ETB
    minWithdrawalSantims: v.number(), // 5000 = 50 ETB
    maxWithdrawalSantims: v.number(), // 500000 = 5,000 ETB
    depositFeeMode: vFeeMode,
    withdrawalFeeMode: vFeeMode,
    updatedAt: v.number(),
    updatedBy: v.optional(v.id("players")),
  }).index("by_key", ["key"]),

  // ------------------------------------------------------------- rateLimits
  rateLimits: defineTable({
    key: v.string(),           // e.g. "deposit:user_abc123"
    windowStart: v.number(),   // timestamp of current window start
    count: v.number(),         // requests in current window
  }).index("by_key", ["key"]),

  // -------------------------------------------------------------- friendships
  friendships: defineTable({
    requesterId: v.id("players"),
    recipientId: v.id("players"),
    status: v.union(v.literal("pending"), v.literal("accepted"), v.literal("rejected")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_requesterId_and_status", ["requesterId", "status"])
    .index("by_recipientId_and_status", ["recipientId", "status"])
    .index("by_requesterId_and_recipientId", ["requesterId", "recipientId"]),

  // ------------------------------------------------------------------ blocks
  blocks: defineTable({
    blockerId: v.id("players"),
    blockedId: v.id("players"),
    createdAt: v.number(),
  })
    .index("by_blockerId", ["blockerId"])
    .index("by_blockedId", ["blockedId"])
    .index("by_blockerId_and_blockedId", ["blockerId", "blockedId"]),

  // ---------------------------------------------------------------- puzzles
  puzzles: defineTable({
    puzzleId: v.string(),
    fen: v.string(), // position to solve
    initialMove: v.optional(v.string()), // optional move made right before player's turn (e.g. "Qxf7+")
    moves: v.array(v.string()), // SAN solution sequence: [playerMove, opponentMove, playerMove...]
    rating: v.number(),
    themes: v.array(v.string()), // e.g. ["mateIn2", "fork", "pin", "sacrifice", "endgame"]
    title: v.string(),
    description: v.string(),
    solutionExplanation: v.string(),
    openingFamily: v.optional(v.string()),
    openingEco: v.optional(v.string()),
    playedCount: v.optional(v.number()),
    solvedCount: v.optional(v.number()),
  })
    .index("by_puzzleId", ["puzzleId"])
    .index("by_rating", ["rating"]),

  // --------------------------------------------------------- puzzleAttempts
  puzzleAttempts: defineTable({
    playerId: v.id("players"),
    puzzleId: v.string(),
    solved: v.boolean(),
    ratingBefore: v.number(),
    ratingAfter: v.number(),
    timeTakenMs: v.number(),
    createdAt: v.number(),
  })
    .index("by_playerId_and_createdAt", ["playerId", "createdAt"])
    .index("by_puzzleId", ["puzzleId"])
    .index("by_playerId_and_puzzleId", ["playerId", "puzzleId"]),

  // ------------------------------------------------------------ tournaments
  tournaments: defineTable({
    title: v.string(),
    description: v.string(),
    format: v.union(v.literal("arena"), v.literal("swiss")),
    status: v.union(v.literal("upcoming"), v.literal("active"), v.literal("completed")),
    timeControlKey: v.string(), // "3+0", "1+0", "5+3"
    baseTimeMs: v.number(),
    incrementMs: v.number(),
    durationMinutes: v.number(),
    startsAt: v.number(),
    endsAt: v.number(),
    entryFee: v.optional(v.number()), // ETB
    prizePool: v.optional(v.number()), // ETB
    creatorId: v.optional(v.id("players")),
    createdAt: v.number(),
  })
    .index("by_status_and_startsAt", ["status", "startsAt"])
    .index("by_startsAt", ["startsAt"]),

  // ------------------------------------------------- tournamentParticipants
  tournamentParticipants: defineTable({
    tournamentId: v.id("tournaments"),
    playerId: v.id("players"),
    username: v.string(),
    avatarUrl: v.string(),
    rating: v.number(),
    score: v.number(),
    gamesPlayed: v.number(),
    wins: v.number(),
    draws: v.number(),
    losses: v.number(),
    streak: v.number(),
    isPaused: v.boolean(),
    activeGameId: v.optional(v.id("games")),
    joinedAt: v.number(),
  })
    .index("by_tournamentId_and_score", ["tournamentId", "score"])
    .index("by_tournamentId_and_playerId", ["tournamentId", "playerId"])
    .index("by_playerId", ["playerId"]),

  // ------------------------------------------------------ tournamentMatches
  tournamentMatches: defineTable({
    tournamentId: v.id("tournaments"),
    gameId: v.id("games"),
    whiteId: v.id("players"),
    blackId: v.id("players"),
    round: v.optional(v.number()),
    status: v.union(v.literal("active"), v.literal("completed")),
    winnerId: v.optional(v.union(v.id("players"), v.null())),
    pointsWhite: v.optional(v.number()),
    pointsBlack: v.optional(v.number()),
    createdAt: v.number(),
    completedAt: v.optional(v.number()),
  })
    .index("by_tournamentId_and_status", ["tournamentId", "status"])
    .index("by_tournamentId_and_whiteId", ["tournamentId", "whiteId"])
    .index("by_tournamentId_and_blackId", ["tournamentId", "blackId"])
    .index("by_gameId", ["gameId"]),

  // -------------------------------------------------------- universities
  universities: defineTable({
    name: v.string(), // "Addis Ababa University"
    shortName: v.string(), // "AAU"
    city: v.string(), // "Addis Ababa"
    logoUrl: v.optional(v.string()),
    description: v.optional(v.string()),
    totalPlayers: v.number(),
    averageRating: v.number(),
    totalWins: v.number(),
    totalGames: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_shortName", ["shortName"])
    .index("by_averageRating", ["averageRating"])
    .index("by_totalPlayers", ["totalPlayers"])
    .index("by_totalWins", ["totalWins"]),

  // -------------------------------------------------- playerAchievements
  playerAchievements: defineTable({
    playerId: v.id("players"),
    achievementKey: v.string(),
    title: v.string(),
    description: v.string(),
    category: v.union(v.literal("combat"), v.literal("tactics"), v.literal("mastery"), v.literal("speed")),
    badgeIcon: v.string(),
    progress: v.number(), // 0 to 100
    isUnlocked: v.boolean(),
    unlockedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_playerId_and_achievementKey", ["playerId", "achievementKey"])
    .index("by_playerId_and_isUnlocked", ["playerId", "isUnlocked"])
    .index("by_playerId", ["playerId"]),

  // -------------------------------------------------- fairPlayTelemetry
  fairPlayTelemetry: defineTable({
    gameId: v.id("games"),
    playerId: v.id("players"),
    playerUsername: v.string(),
    tabBlurCount: v.number(),
    blursPerMove: v.number(),
    avgMoveTimeMs: v.number(),
    moveTimeVariance: v.number(),
    top1MatchRate: v.optional(v.number()),
    acpl: v.optional(v.number()), // Average Centipawn Loss
    suspicionScore: v.number(), // 0 to 100
    isFlagged: v.boolean(),
    flagReason: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_gameId", ["gameId"])
    .index("by_playerId", ["playerId"])
    .index("by_isFlagged", ["isFlagged"])
    .index("by_suspicionScore", ["suspicionScore"]),

  // -------------------------------------------------- fairPlayReports
  fairPlayReports: defineTable({
    gameId: v.id("games"),
    reporterId: v.id("players"),
    reporterUsername: v.string(),
    reportedPlayerId: v.id("players"),
    reportedUsername: v.string(),
    reason: v.union(
      v.literal("engine_assistance"),
      v.literal("suspicious_timing"),
      v.literal("stalling"),
      v.literal("other")
    ),
    notes: v.optional(v.string()),
    status: v.union(
      v.literal("pending"),
      v.literal("reviewed_clean"),
      v.literal("banned"),
      v.literal("warned")
    ),
    adminNotes: v.optional(v.string()),
    createdAt: v.number(),
    resolvedAt: v.optional(v.number()),
  })
    .index("by_status", ["status"])
    .index("by_reportedPlayerId", ["reportedPlayerId"])
    .index("by_gameId", ["gameId"])
    .index("by_gameId_and_reporterId", ["gameId", "reporterId"]),

  // -------------------------------------------------- feedback
  feedback: defineTable({
    userId: v.id("players"),
    clerkId: v.string(),
    userName: v.string(),
    userEmail: v.string(),
    userAvatarUrl: v.optional(v.string()),

    category: vFeedbackCategory,
    description: v.string(),

    gameId: v.optional(v.string()),
    matchId: v.optional(v.string()),
    tournamentId: v.optional(v.string()),
    opponentUsername: v.optional(v.string()),

    attachments: v.array(vFeedbackAttachment),

    status: vFeedbackStatus,
    adminNotes: v.optional(v.string()),

    emailStatus: vEmailStatus,
    emailError: v.optional(v.string()),
    emailSentAt: v.optional(v.number()),

    createdAt: v.number(),
    updatedAt: v.number(),
    resolvedAt: v.optional(v.number()),
    resolvedBy: v.optional(v.string()),
  })
    .index("by_userId", ["userId"])
    .index("by_status", ["status"])
    .index("by_category", ["category"])
    .index("by_createdAt", ["createdAt"])
    .index("by_status_and_createdAt", ["status", "createdAt"]),
});

