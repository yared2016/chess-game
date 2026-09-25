// convex/lib/validators.ts
import { v } from "convex/values";

export const vColour = v.union(v.literal("w"), v.literal("b"));
export const vWinner = v.union(v.literal("w"), v.literal("b"), v.literal("draw"));
export const vBoardView = v.union(v.literal("2d"), v.literal("3d"));
export const vQualityTier = v.union(
  v.literal("auto"),
  v.literal("low"),
  v.literal("medium"),
  v.literal("high"),
);
export const vDifficulty = v.union(
  v.literal("beginner"),
  v.literal("casual"),
  v.literal("intermediate"),
  v.literal("advanced"),
  v.literal("grandmaster"),
);
export const vGameMode = v.union(v.literal("online"), v.literal("ai"), v.literal("local"));
export const vGameStatus = v.union(
  v.literal("waiting"), // created, awaiting a second player (friend-invite stretch)
  v.literal("active"),
  v.literal("checkmate"),
  v.literal("stalemate"),
  v.literal("draw"),
  v.literal("resigned"),
  v.literal("abandoned"),
);
export const vEndReason = v.union(
  v.literal("checkmate"),
  v.literal("stalemate"),
  v.literal("threefold"),
  v.literal("fifty-move"),
  v.literal("insufficient"),
  v.literal("agreement"),
  v.literal("resignation"),
  v.literal("abandonment"),
);
export const vRoomPreset = v.union(
  v.literal("study"),
  v.literal("space"),
  v.literal("park"),
  v.literal("arcade"),
  v.literal("minimal"),
  v.literal("custom"),
);
export const vRoomColors = v.object({
  background: v.string(),
  lightSquare: v.string(),
  darkSquare: v.string(),
});
export const vPromotionPiece = v.union(
  v.literal("q"),
  v.literal("r"),
  v.literal("b"),
  v.literal("n"),
);
export const vLastMove = v.object({
  from: v.string(),
  to: v.string(),
  san: v.string(),
  colour: vColour,
  captured: v.optional(v.string()),
  /** Only set when the captured piece did NOT stand on `to` — i.e. en passant. */
  capturedSquare: v.optional(v.string()),
  promotion: v.optional(v.string()),
});
export const vCommentarySource = v.union(
  v.literal("eve"),
  v.literal("fallback"),
  v.literal("hint"),
);
export const vRatingPool = v.union(v.literal("human"), v.literal("ai"));
export const vPresenceRole = v.union(v.literal("w"), v.literal("b"), v.literal("spectator"));

export const vDepositStatus = v.union(v.literal("pending"), v.literal("approved"), v.literal("rejected"));
export const vWithdrawalStatus = v.union(v.literal("pending"), v.literal("completed"), v.literal("rejected"));
export const vPayoutMethod = v.union(v.literal("telebirr"), v.literal("cbe"));

export const vChapaPaymentStatus = v.union(
  v.literal("pending"),
  v.literal("success"),
  v.literal("failed"),
  v.literal("cancelled"),
  v.literal("expired"),
);

export const vLedgerEntryType = v.union(
  v.literal("deposit_credit"),
  v.literal("deposit_fee"),
  v.literal("match_lock"),
  v.literal("match_unlock"),
  v.literal("match_payout"),
  v.literal("match_loss"),
  v.literal("platform_commission"),
  v.literal("withdrawal_reserve"),
  v.literal("withdrawal_fee"),
  v.literal("withdrawal_complete"),
  v.literal("withdrawal_reversal"),
  v.literal("admin_adjustment"),
);

export const vFinancialDepositStatus = v.union(
  v.literal("created"),
  v.literal("pending_provider"),
  v.literal("verifying"),
  v.literal("verified"),
  v.literal("credited"),
  v.literal("failed"),
  v.literal("expired"),
);

export const vFinancialWithdrawalStatus = v.union(
  v.literal("requested"),
  v.literal("reserved"),
  v.literal("provider_submitted"),
  v.literal("provider_pending"),
  v.literal("completed"),
  v.literal("failed"),
  v.literal("reversed"),
  v.literal("cancelled"),
);

export const vWalletStatus = v.union(
  v.literal("active"),
  v.literal("frozen"),
  v.literal("restricted"),
);

export const vFeeMode = v.union(
  v.literal("additive"),
  v.literal("deduct_from_gross"),
);

