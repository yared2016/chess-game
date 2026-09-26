/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as admin from "../admin.js";
import type * as admin_finance from "../admin/finance.js";
import type * as challenges from "../challenges.js";
import type * as chapaPayments from "../chapaPayments.js";
import type * as commentary from "../commentary.js";
import type * as crons from "../crons.js";
import type * as deposits from "../deposits.js";
import type * as financial_analytics from "../financial/analytics.js";
import type * as financial_deposits from "../financial/deposits.js";
import type * as financial_escrow from "../financial/escrow.js";
import type * as financial_reconciliation from "../financial/reconciliation.js";
import type * as financial_withdrawals from "../financial/withdrawals.js";
import type * as friends from "../friends.js";
import type * as games from "../games.js";
import type * as leaderboard from "../leaderboard.js";
import type * as ledger from "../ledger.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_chess from "../lib/chess.js";
import type * as lib_clockEngine from "../lib/clockEngine.js";
import type * as lib_constants from "../lib/constants.js";
import type * as lib_elo from "../lib/elo.js";
import type * as lib_games from "../lib/games.js";
import type * as lib_money from "../lib/money.js";
import type * as lib_rateLimit from "../lib/rateLimit.js";
import type * as lib_returns from "../lib/returns.js";
import type * as lib_timeControl from "../lib/timeControl.js";
import type * as lib_validators from "../lib/validators.js";
import type * as notifications from "../notifications.js";
import type * as playerChat from "../playerChat.js";
import type * as players from "../players.js";
import type * as queue from "../queue.js";
import type * as rateLimit from "../rateLimit.js";
import type * as ratingHistory from "../ratingHistory.js";
import type * as seedPlayers from "../seedPlayers.js";
import type * as seedProfile from "../seedProfile.js";
import type * as stats from "../stats.js";
import type * as storage from "../storage.js";
import type * as wallets from "../wallets.js";
import type * as withdrawals from "../withdrawals.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  admin: typeof admin;
  "admin/finance": typeof admin_finance;
  challenges: typeof challenges;
  chapaPayments: typeof chapaPayments;
  commentary: typeof commentary;
  crons: typeof crons;
  deposits: typeof deposits;
  "financial/analytics": typeof financial_analytics;
  "financial/deposits": typeof financial_deposits;
  "financial/escrow": typeof financial_escrow;
  "financial/reconciliation": typeof financial_reconciliation;
  "financial/withdrawals": typeof financial_withdrawals;
  friends: typeof friends;
  games: typeof games;
  leaderboard: typeof leaderboard;
  ledger: typeof ledger;
  "lib/auth": typeof lib_auth;
  "lib/chess": typeof lib_chess;
  "lib/clockEngine": typeof lib_clockEngine;
  "lib/constants": typeof lib_constants;
  "lib/elo": typeof lib_elo;
  "lib/games": typeof lib_games;
  "lib/money": typeof lib_money;
  "lib/rateLimit": typeof lib_rateLimit;
  "lib/returns": typeof lib_returns;
  "lib/timeControl": typeof lib_timeControl;
  "lib/validators": typeof lib_validators;
  notifications: typeof notifications;
  playerChat: typeof playerChat;
  players: typeof players;
  queue: typeof queue;
  rateLimit: typeof rateLimit;
  ratingHistory: typeof ratingHistory;
  seedPlayers: typeof seedPlayers;
  seedProfile: typeof seedProfile;
  stats: typeof stats;
  storage: typeof storage;
  wallets: typeof wallets;
  withdrawals: typeof withdrawals;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  agent: import("@convex-dev/agent/_generated/component.js").ComponentApi<"agent">;
};
