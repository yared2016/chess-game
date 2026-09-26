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

    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_clerkId", ["clerkId"])
    .index("by_tokenIdentifier", ["tokenIdentifier"])
    .index("by_usernameLower", ["usernameLower"])
    .index("by_email", ["email"])
    .index("by_rating", ["rating"])
    .index("by_ratingHuman", ["ratingHuman"])
    .index("by_ratingAi", ["ratingAi"]),

  // ------------------------------------------------------------------ queue
  queue: defineTable({
    playerId: v.id("players"),
    rating: v.number(), // ratingHuman snapshot at join time
    joinedAt: v.number(),
    stake: v.optional(v.number()),
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
    stake: v.optional(v.number()),
    status: v.union(v.literal("pending"), v.literal("accepted"), v.literal("declined"), v.literal("cancelled"), v.literal("expired")),
    gameId: v.optional(v.id("games")),
    createdAt: v.number(),
    respondedAt: v.optional(v.number()),
  })
    .index("by_toId_and_status", ["toId", "status"])
    .index("by_fromId_and_status", ["fromId", "status"]),

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
});
