// src/lib/errors.ts  [shared — integration]
/**
 * THE single Convex-error-code → user-copy map.
 *
 * Convex functions throw stable machine codes, never user copy (`throw new
 * Error("illegal-move")`). A rejected mutation reaches the browser wrapped in
 * transport noise, e.g.
 * `[CONVEX M(games:makeMove)] [Request ID: …] Server Error\nUncaught Error: illegal-move\n  at …`,
 * so codes are matched as **substrings** of the message, never compared for equality.
 *
 * Two layers used to keep their own copies of this table — `providers/convex-errors.ts`
 * for the lobby/settings toasts and `useGameController` for the move path — which drifted
 * (same code, two different sentences). They now both read this module:
 *
 * - `describeConvexError()` — the toast layer (lobby, matchmaking, settings, room picker).
 * - `describeGameError()`   — the in-game layer; identical except for the handful of codes
 *   in `GAME_OVERRIDES`, where the game board says something more specific.
 *
 * Every string that either layer showed before the merge is preserved verbatim, because
 * `src/lib/__tests__/errors.test.ts` asserts them — and that same test re-reads `convex/**`
 * and fails if a newly thrown code has no copy here.
 */

import { MAX_TUTOR_TURNS_PER_GAME } from "./constants";

/** Every machine code thrown by `convex/**` (excluding the test harness). */
export const CONVEX_ERROR_CODES = [
  "Not authenticated",
  "Player not provisioned",
  "already-in-game",
  "cannot-answer-own-offer",
  "corrupt-move-list",
  "draw-not-available",
  "game-not-active",
  "game-not-found",
  "hint-limit",
  "hints-unavailable",
  "illegal-move",
  "invalid-colour",
  "invalid-message-length",
  "invalid-ply",
  "invalid-room-image",
  "no-draw-offer",
  "not-a-participant",
  "not-ai-turn",
  "not-an-ai-game",
  "not-your-turn",
  "online-chat-only",
  "promotion-required",
  "stale-ai-move",
  "tutor-limit",
  "undo-not-allowed",
  "upload-not-found",
  "deposit-code-failed",
  "deposit-not-found",
  "deposit-not-pending",
  "insufficient-funds",
  "invalid-stake",
  "unauthorized-admin",
  "unauthorized-deposit",
  "wallet-not-found",
  "withdrawal-not-found",
  "withdrawal-not-pending",
  "cannot-challenge-self",
  "player-not-found",
  "challenge-not-found",
  "unauthorized-challenge",
  "challenge-not-pending",
  "challenge-expired",
  "unauthorized-notification",
  "timer-not-expired",
  "wallet-is-frozen",
  "chapa-payment-not-found",
  "unauthorized-payment",
  "unauthorized-webhook",
  "deposit-record-not-found",
  "deposit-amount-mismatch",
  "deposit-currency-mismatch",
  "cannot-friend-self",
  "player-blocked-you",
  "you-blocked-this-player",
  "already-friends",
  "request-already-sent",
  "friendship-not-found",
  "not-your-request",
  "request-not-pending",
  "not-your-friendship",
  "cannot-block-self",
  "rate-limit-exceeded",
  "game-still-active",
  "rematch-only-for-online-games",
  "opponent-already-offered-rematch",
  "tournament-not-found",
  "tournament-completed",
  "not-tournament-participant",
  "tournament-not-joined",
  "tournament-paused",
  "university-not-found",
  "account-banned-fair-play",
  "cannot-report-self",
  "player-banned-fair-play",
  "report-already-submitted",
  "feedback-description-too-short",
  "feedback-description-too-long",
  "too-many-attachments",
  "feedback-not-found",
  "unauthorized-attachment",
  "attachment-not-found",
  "opponent-not-found",
  "match-not-found",
  "profile-incomplete",
  "university-immutable-after-profile-completion",
  "username-reserved",
  "invalid-username",
  "username-taken",
  "invalid-display-name",
  "invalid-phone-number",
  "university-required",
  "student-id-required",
  "invalid-student-id",
  "public-player-cannot-have-university",
] as const;

export type ConvexErrorCode = (typeof CONVEX_ERROR_CODES)[number];

/** Which surface is asking. `"game"` = inside a game (board, controller, result dialog). */
export type ErrorLayer = "toast" | "game";

/** Shown when nothing matched and the caller gave no fallback. */
export const DEFAULT_ERROR_MESSAGE = "Something went wrong. Please try again.";

/** Default copy for every code. */
const COPY: Record<ConvexErrorCode, string> = {
  "Not authenticated": "You have been signed out. Sign in again to continue.",
  "Player not provisioned": "Your profile is still being set up. Give it a second and try again.",
  "already-in-game": "You already have a game in progress. Finish or resign it first.",
  "cannot-answer-own-offer": "You cannot answer your own draw offer.",
  "corrupt-move-list": "This game's moves could not be replayed. Reload the page.",
  "draw-not-available": "Draws can only be agreed against another player.",
  "game-not-active": "That game has already finished.",
  "game-not-found": "That game no longer exists.",
  "hint-limit": "You have used all three hints in this game.",
  "hints-unavailable": "Hints are only available at Beginner and Casual.",
  "illegal-move": "That move is not legal.",
  "invalid-colour": "Those colours are not valid hex values.",
  "invalid-message-length": "Write a message between 1 and 1,000 characters.",
  "invalid-ply": "That position is no longer part of this game.",
  "invalid-room-image": "That image is not usable — pick a PNG or JPEG under 5 MB.",
  "no-draw-offer": "There is no draw offer to answer.",
  "not-a-participant": "You are watching this game, not playing it.",
  "not-ai-turn": "It is not the AI's turn.",
  "not-an-ai-game": "This is not a game against the AI.",
  "not-your-turn": "It is not your turn.",
  "online-chat-only": "Player chat is available in online games.",
  "promotion-required": "Choose a promotion piece first.",
  "stale-ai-move": "The position moved on — nothing was applied.",
  // docs/PRO_TUTOR.md §3.5, with the cap read from the constant so the sentence and
  // the mutation can never disagree about the number.
  "tutor-limit": `The tutor has answered ${MAX_TUTOR_TURNS_PER_GAME} questions in this game. Start a new game to keep going.`,
  "undo-not-allowed": "Take-backs are disabled in online matches.",
  "upload-not-found": "The upload did not finish. Try picking the file again.",
  "deposit-code-failed": "Could not generate a unique deposit code. Please try again.",
  "deposit-not-found": "Deposit request could not be found.",
  "deposit-not-pending": "This deposit is no longer pending.",
  "insufficient-funds": "Insufficient balance in your wallet for this action.",
  "invalid-stake": "That match stake is not valid.",
  "unauthorized-admin": "You do not have admin permissions.",
  "unauthorized-deposit": "You can only upload screenshots to your own deposit.",
  "wallet-not-found": "Wallet not found. Please reload to initialize your wallet.",
  "withdrawal-not-found": "Withdrawal request could not be found.",
  "withdrawal-not-pending": "This withdrawal is no longer pending.",
  "cannot-challenge-self": "You cannot challenge yourself.",
  "player-not-found": "The requested player was not found.",
  "challenge-not-found": "This challenge was not found.",
  "unauthorized-challenge": "You are not authorized for this challenge.",
  "challenge-not-pending": "This challenge is no longer pending.",
  "challenge-expired": "This challenge has expired after 10 minutes and any staked balance has been refunded.",
  "unauthorized-notification": "You are not authorized to modify this notification.",
  "timer-not-expired": "The turn timer has not yet run out.",
  "wallet-is-frozen": "Your wallet is currently suspended by administration. Please contact support.",
  "chapa-payment-not-found": "The requested payment could not be found.",
  "unauthorized-payment": "You are not authorized to access this payment record.",
  "unauthorized-webhook": "Webhook signature verification failed.",
  "deposit-record-not-found": "Deposit record could not be found.",
  "deposit-amount-mismatch": "The verified deposit amount did not match the expected amount.",
  "deposit-currency-mismatch": "The deposit currency was not ETB.",
  "cannot-friend-self": "You cannot friend yourself.",
  "player-blocked-you": "This player has blocked you.",
  "you-blocked-this-player": "You have blocked this player.",
  "already-friends": "You are already friends.",
  "request-already-sent": "Friend request already sent.",
  "friendship-not-found": "Friendship not found.",
  "not-your-request": "This is not your friend request.",
  "request-not-pending": "Friend request is no longer pending.",
  "not-your-friendship": "This is not your friendship.",
  "cannot-block-self": "You cannot block yourself.",
  "rate-limit-exceeded": "Rate limit exceeded. Please try again later.",
  "game-still-active": "Cannot request a rematch while the current game is still in progress.",
  "rematch-only-for-online-games": "Rematches can only be offered for finished online games.",
  "opponent-already-offered-rematch": "Your opponent already offered a rematch. Check your screen to accept it!",
  "tournament-not-found": "Tournament could not be found or has ended.",
  "tournament-completed": "This tournament has already finished.",
  "not-tournament-participant": "You are not a registered participant in this tournament.",
  "tournament-not-joined": "You must join this tournament before searching for a match.",
  "tournament-paused": "Unpause your status to search for a tournament match.",
  "university-not-found": "The selected university could not be found.",
  "account-banned-fair-play": "Your account has been restricted from multiplayer play due to a Fair Play violation.",
  "cannot-report-self": "You cannot report yourself.",
  "player-banned-fair-play": "That player cannot be challenged due to an active Fair Play restriction.",
  "report-already-submitted": "You have already submitted a report for this match.",
  "feedback-description-too-short": "Feedback description must be at least 10 characters long.",
  "feedback-description-too-long": "Feedback description must not exceed 4,000 characters.",
  "too-many-attachments": "You may attach at most 5 files to your feedback.",
  "feedback-not-found": "Feedback report could not be found.",
  "unauthorized-attachment": "You are not authorized to access this feedback attachment.",
  "attachment-not-found": "The requested attachment was not found on this feedback.",
  "opponent-not-found": "The specified opponent player was not found.",
  "match-not-found": "The specified match or wager was not found.",
  "profile-incomplete": "Please complete your profile to continue.",
  "university-immutable-after-profile-completion": "University affiliation cannot be changed after profile completion.",
  "username-reserved": "This username is reserved. Please choose another.",
  "invalid-username": "Usernames must be 3-20 characters long and use lowercase letters, numbers, hyphens, or underscores.",
  "username-taken": "This username is already taken. Please choose another.",
  "invalid-display-name": "Display name must be between 2 and 30 characters.",
  "invalid-phone-number": "Please provide a valid phone number in E.164 format.",
  "university-required": "Please select your university.",
  "student-id-required": "Please enter your student ID.",
  "invalid-student-id": "Student ID must be between 2 and 30 characters.",
  "public-player-cannot-have-university": "Public players cannot select a university or enter a student ID.",
};

/**
 * In-game wording for the codes where the board can be more direct than a toast fired
 * from the lobby. Everything not listed here falls through to `COPY`.
 */
const GAME_OVERRIDES: Partial<Record<ConvexErrorCode, string>> = {
  "Not authenticated": "Please sign in again.",
  "Player not provisioned": "Your player profile is still being created.",
  "game-not-active": "This game has already finished.",
  "hint-limit": "No hints left in this game.",
  "not-a-participant": "You are not playing in this game.",
};

/**
 * Longest code first, so a code that contains another (none do today — the test keeps it
 * that way) could never be shadowed by its shorter neighbour.
 */
const MATCH_ORDER: readonly ConvexErrorCode[] = [...CONVEX_ERROR_CODES].sort(
  (a, b) => b.length - a.length,
);

/** Copy for a known code on a given surface. */
export function errorCopyFor(code: ConvexErrorCode, layer: ErrorLayer = "toast"): string {
  return (layer === "game" ? GAME_OVERRIDES[code] : undefined) ?? COPY[code];
}

/**
 * The machine code inside a rejected Convex call, or `null` when the message carries none.
 * Callers that need the code itself (retry policy, telemetry) use this; callers that need a
 * sentence use `describeConvexError` / `describeGameError`.
 */
export function convexErrorCode(error: unknown): ConvexErrorCode | null {
  const raw = error instanceof Error ? error.message : String(error);
  for (const code of MATCH_ORDER) {
    if (raw.includes(code)) return code;
  }
  return null;
}

/** Toast-layer copy: lobby, matchmaking, settings, room picker. */
export function describeConvexError(error: unknown, fallback = DEFAULT_ERROR_MESSAGE): string {
  const code = convexErrorCode(error);
  return code === null ? fallback : errorCopyFor(code, "toast");
}

/** In-game copy: the controller, the board and anything rendered beside them. */
export function describeGameError(error: unknown, fallback = DEFAULT_ERROR_MESSAGE): string {
  const code = convexErrorCode(error);
  return code === null ? fallback : errorCopyFor(code, "game");
}
