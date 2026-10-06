# Castle Chess Admin Dashboard — Architectural Design Specification

**Document Version:** 1.0.0  
**Date:** 2026-10-06  
**Status:** Approved Architecture (Ready for Implementation Planning)  
**Author:** Pair Programming Agent & Platform Architect  

---

## 1. Executive Summary & Core Requirements

The Castle Chess Admin Dashboard is an **all-in-one, responsive, production-grade administrative command center** running on the exact design language, component tokens, typography, and theme styling of the **Player Wallet (`wallet-view.tsx`)**.

### Critical Constraints
1. **Single-Page Dashboard Architecture**: Strictly **NO sidebar** and **NO separate admin routes**. The entire management surface lives on one cohesive page with responsive card stacking, sticky header, and slide-out detail drawers / confirmation modals.
2. **General Public Platform**: **Zero university, campus, student, or institutional concepts**. All player profiles, ratings, and filters represent general public chess players.
3. **Financial Source of Truth**: The immutable santim ledger (`financialLedger`) is the authoritative source for all financial balances and transactions. Provider records (Chapa payments, bank payouts) enrich ledger events without duplicating transactions.
4. **No Direct Balance Editing**: Administrators **never** directly set or modify wallet balances. Any legitimate manual adjustment creates an audited ledger entry (`admin_adjustment`), tracking before/after balances in santims.
5. **Automatic Chapa Deposits**: Standard verified Chapa payments credit wallets automatically via webhooks/verification. Admin manual approvals apply strictly to manual transfer submissions (`deposits` table) or reconciliation exceptions.
6. **Targeted Player Wallet Controls**: Restrictions for deposits, staking, withdrawals, or full wallet freezes are **per-player**, enforced in server-side mutations, and require non-empty audit reasons.
7. **Server-Side Security**: All admin operations require `requireAdmin(ctx)`. Client-side states are untrusted.
8. **ETB Currency Standard**: All financial values are formatted in **ETB** with `Geist Mono` tabular figures (`tabular-nums`).

---

## 2. Visual Architecture & Design Tokens (Player Wallet Alignment)

The dashboard reuses existing theme variables and tokens from `DESIGN.md` and `wallet-view.tsx`:

* **Surfaces**:
  * Dark Theme: Background `espresso` (`#151916` / `bg-background`), Cards `walnut` (`#1e2420` / `bg-card`), Modals `cellar` (`#101410`).
  * Light Theme: Background `light-ivory-ground` (`#f5f4ef`), Cards `light-paper` (`#fffefa` / `bg-card`), Borders `light-seam` (`#d0d5ca`).
* **Accents**:
  * Brand / Primary: `brass` / `baize` (`#3f9b73` emerald tint, active indicators, primary buttons).
  * Success / Inflow: `text-emerald-600 dark:text-emerald-400`, `bg-emerald-500/10`, `border-emerald-500/20`.
  * Danger / Outflow: `text-rose-600 dark:text-rose-400`, `bg-rose-500/10`, `border-rose-500/20`.
  * Warning / In-Flight: `text-amber-600 dark:text-amber-400`, `bg-amber-500/10`, `border-amber-500/20`.
* **Typography**:
  * Titles & Headers: `Geist` font family, tight tracking.
  * Financial Values: `Geist Mono` (`font-mono font-bold tracking-tight tabular-nums`).
* **Borders & Radii**:
  * Metric & Content Cards: `rounded-3xl` (`1.5rem` / `24px`), `border border-border/80`.
  * Badges & Status Pills: `rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider`.
  * Inputs & Action Buttons: `rounded-2xl` or `rounded-xl`.
* **Mobile Responsiveness**:
  * Zero horizontal page overflow at `320px+`.
  * Desktop multi-column grid transforms into vertical touch-friendly cards on mobile.
  * Touch targets &ge; `44px`. Drawers expand to full-screen sheets on mobile.

---

## 3. Single-Page Layout & Content Hierarchy

```text
┌────────────────────────────────────────────────────────────────────────┐
│ Castle Chess Admin Header: Title • Live Status • Refresh • Date Preset │
├────────────────────────────────────────────────────────────────────────┤
│ Top KPI Row (8 responsive cards: Players, Online, Games, Balance, etc.)│
├────────────────────────────────────┬───────────────────────────────────┤
│ Overview (Live 7-Day Chart)        │ Pending Actions Queue (Counts)    │
│                                    ├───────────────────────────────────┤
│                                    │ Quick Actions (Drawer Triggers)   │
├────────────────────────────────────┼───────────────────────────────────┤
│ Financial Overview & Liquidity     │ Recent Activity Stream (Live)     │
│ (Platform, Liabilities, Escrow...) ├───────────────────────────────────┤
│                                    │ System Health (Convex, Chapa...)  │
├────────────────────────────────────┴───────────────────────────────────┤
│ Transaction History Table / Mobile Cards (Filters, Search, CSV Export) │
├────────────────────────────────────┬───────────────────────────────────┤
│ User Feedback Triage (Tabs: New,   │ Player Wallet Security Controls   │
│ In Review, Resolved, Detail Modal) │ (Select Player, Toggles, Reason)  │
├────────────────────────────────────┴───────────────────────────────────┤
│ Footer: Version • Security Status • Real Last Updated Timestamp        │
└────────────────────────────────────────────────────────────────────────┘
```

### 3.1 Top KPI Row (8 Cards)
1. **Total Players**: Authoritative count of registered players.
2. **Online Now**: Real-time presence count (`Date.now() - lastSeen < 60,000`).
3. **Active Games**: In-progress online multiplayer and rated games.
4. **Platform Funds**: Total float available in platform bank/Chapa accounts.
5. **Locked Escrow**: Funds locked specifically in active game pots.
6. **Revenue Today**: Net commissions and platform fee cut earned today.
7. **Deposits Today**: Total ETB volume deposited today.
8. **Withdrawals Today**: Total ETB volume completed today.

### 3.2 Financial Overview Card
Differentiates platform liquidity:
* **Platform Balance**: Gross funds in platform accounts.
* **User Liabilities**: Total player available balances in wallets.
* **Active Match Escrow**: Stakes reserved in active games.
* **Pending Withdrawal Reserve**: Funds locked in flight for pending cash-outs.
* **Platform Revenue**: Accumulated 10% match commissions and earned fees.
* **Provider Fees**: Fees charged by payment gateway (Chapa).

### 3.3 Pending Actions Queue
Instant count badges linking to inspection drawers:
* Pending Withdrawals (`pendingWithdrawals.length`)
* Pending Deposits (`pendingDeposits.length`)
* Failed Payments (unverified / failed deposits)
* Fair Play Reports (`fairPlayReports` with status `pending`)
* User Feedback (`feedback` with status `NEW`)
* System Alerts (reconciliation mismatches or webhook failures)

### 3.4 Quick Actions
One-click triggers for on-page modals:
* `Inspect Player`: Opens player search and drawer.
* `Process Deposit`: Opens manual deposits review modal.
* `Process Withdrawal`: Opens pending withdrawals queue.
* `Create Tournament`: Launches tournament creation modal.
* `Broadcast Notification`: Launches system announcement modal.
* `System Health`: Opens comprehensive diagnostic panel.

### 3.5 Transaction History
* **Filters**: `All`, `Deposits`, `Withdrawals`, `Stakes`, `Winnings`, `Commissions`, `Refunds`.
* **Search**: Real-time debounce query matching player username, internal reference, or Chapa transaction ID.
* **Data Fields**: Date & Time, Player (avatar + username), Type, Amount (ETB), Fee (ETB), Net Impact (ETB), Reference, Chapa Ref, Status badge (`Completed`, `Processing`, `Failed`, `Reversed`), and View Action (`Eye` icon).
* **CSV Export**: Client-side CSV generation matching current filter/date range.

### 3.6 User Feedback Widget
* Tabs: `New`, `In Review`, `Resolved`.
* Cards showing player avatar, username, message snippet, category pill (`Payment`, `Fair Play`, `Bug Report`, `Feature Request`, `Account`), timestamp.
* Clicking opens `FeedbackDetailModal` with full description, attachments, match context, and admin response composer.

### 3.7 Wallet Security & Freeze Controls
Targeted per-player controls:
* Input: Player search by username or ID.
* Status Indicators:
  * Deposits: `Enabled` / `Restricted`
  * Staking: `Enabled` / `Restricted`
  * Withdrawals: `Enabled` / `Restricted`
  * Entire Wallet: `Active` / `Frozen`
* Mandatory input: `Audit Reason`.
* Confirmation modal before executing mutation.

---

## 4. Interactive Detail Drawers & Modals

### 4.1 Player Detail Drawer (`PlayerDetailDrawer`)
* **Profile & Account**: Avatar, username, display name, verification status, email (if authorized), Clerk ID, registration timestamp, last seen, online pill, account status (`Active` / `Banned` / `Frozen`).
* **Wallet & Ledger**: Available balance (ETB), locked balance (ETB), total deposited, total withdrawn, net gaming profit/loss, and recent player transactions.
* **Fair Play**: Cheat detection score (0–100), centipawn loss (ACPL), window blur telemetry, reports against player, previous sanctions.
* **Admin Audit History**: Immutable chronological list of administrative actions targeting this player.

### 4.2 Transaction Detail Drawer (`TransactionDetailDrawer`)
* Structured receipt view: Status badge, Amount (ETB), Gross amount, Gateway fee, Net impact, Internal reference, Provider/Chapa reference with copy button, Player info, Payment method, and Audit log trail.

### 4.3 Confirmation Dialog (`AdminConfirmDialog`)
* High-friction confirmation for sensitive actions:
  * Freezing or unfreezing a wallet
  * Setting player restrictions
  * Banning or warning a player
  * Reversing or completing a withdrawal
  * Overriding a reconciliation mismatch
* Requires selecting confirmation checkbox and supplying a non-empty reason.

---

## 5. Authoritative Backend Schema & Functions

### 5.1 Convex Query & Mutation Map

1. **`convex/admin.ts`**:
   * `isAdmin`: Verifies caller identity against `ADMIN_EMAILS` or `ADMIN_CLERK_IDS`.
   * `getPlatformKpis`: Computes live 8-KPI metrics and pending action counts using indexed queries.
   * `getUnifiedTransactions`: Authoritative ledger reader combining `financialLedger` with `financialDeposits`, `financialWithdrawals`, and `commissions`.
   * `getRecentActivity`: Chronological event feed (deposits, payouts, matches, registrations).
   * `getSystemHealth`: Verifies database, auth, presence, cron status, and Chapa gateway responsiveness.
2. **`convex/admin/finance.ts`**:
   * `setPlayerWalletRestrictions`: Per-player restriction mutation (`depositsRestricted`, `stakingRestricted`, `withdrawalsRestricted`, `walletFrozen`) logging to `financialAuditLogs`.
   * `financialOverview`: Aggregate balances (liability, locked escrow, revenue, provider fees).
   * `adminReconcileWithdrawal`: Reconcile or reverse stuck withdrawals with immutable ledger entries.
   * `manualLedgerAdjustment`: Secure administrative correction (requires target player, santim amount, debit/credit, and mandatory reason; creates `financialLedger` entry).
3. **`convex/feedback.ts`**:
   * `adminList`, `adminGetStats`, `adminUpdateStatus`, `adminUpdateNotes`, `getAttachmentUrl`.
4. **`convex/fairPlay.ts`**:
   * `listFlaggedGames`, `listReports`, `getFairPlayStats`, `takeFairPlayAction`.

### 5.2 Immutable Audit Log Schema
Stored in `financialAuditLogs`:
```ts
{
  adminId: Id<"players">,
  action: string, // "wallet_restrictions_update", "manual_adjustment", "ban_player", etc.
  targetUserId: Id<"players">,
  reason: string,
  metadata?: string, // JSON stringified { previousState, newState }
  createdAt: number,
}
```

---

## 6. Verification & Quality Gates

1. **Static Analysis**: `pnpm run typecheck` and ESLint checks must pass with 0 errors.
2. **Cross-Browser & Responsive Verification**:
   * Responsive layout tested at 320px, 375px, 768px, 1024px, 1440px+.
   * Verified zero horizontal page scrolling on mobile viewports.
3. **Theme Integrity**: Both Dark Mode (`#151916` ground) and Light Mode (`#f5f4ef` ground) visually verified.
4. **Security Testing**: Verification that unauthorized users are redirected and all mutations reject non-admin callers.
5. **No Regressions**: Existing player Wallet, Chapa deposit callback, game play, and matchmaking remain completely untouched and functional.
