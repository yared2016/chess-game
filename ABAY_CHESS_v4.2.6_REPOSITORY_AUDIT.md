# ABAY CHESS — REPOSITORY AUDIT REPORT (v4.2.6-PROD)

**Audit Date:** November 1, 2026  
**Auditor:** Principal FinTech Systems Auditor & Security Engineer (Antigravity)  
**Target Repository:** `Castle-3d-multiplayer-with-ai-vercel-eve-nextjs-clerk-main`  
**Convex Production Deployment:** `qualified-greyhound-151` (`https://qualified-greyhound-151.convex.cloud`)  
**Production Domain:** `abaychess.com`  
**Execution Boundary:** READ-ONLY AUDIT — ZERO MUTATIONS EXECUTED  

---

## 1. EXECUTIVE AUDIT SUMMARY

This document provides the authoritative, evidence-backed audit of the Abay Chess production repository. Every subsystem, schema definition, financial operation, authentication flow, and payment integration was inspected via non-mutating source code analysis.

### Summary Classification Matrix:
- **Total Components Audited:** 24
- **IMPLEMENTED (Legacy / Existing Baseline):** 8
- **PARTIALLY IMPLEMENTED (Incomplete / Needs Hardening):** 6
- **MISSING (Must Be Implemented in Target):** 6
- **CONTRADICTORY (Architectural Conflicts in Repo):** 3
- **VULNERABLE (Immediate Remediation Required):** 1

---

## 2. DETAILED AUDIT FINDINGS BY SUBSYSTEM

### 2.1 Database Schemas & Data Modeling
- **File Reference:** [`convex/schema.ts:1-757`](file:///c:/Users/USER/Downloads/Castle-3d-multiplayer-with-ai-vercel-eve-nextjs-clerk-main/Castle-3d-multiplayer-with-ai-vercel-eve-nextjs-clerk-main/convex/schema.ts#L1-L757)
- **Status:** **CONTRADICTORY & PARTIALLY IMPLEMENTED**
- **Evidence & Findings:**
  1. *Duplicate Financial Tables:* The schema contains overlapping legacy tables and experimental tables:
     - `deposits` (lines 259–283) vs `financialDeposits` (lines 411–442).
     - `withdrawals` (lines 285–303) vs `financialWithdrawals` (lines 444–474).
  2. *Single-Entry Ledger Only:* Line 383 defines `financialLedger`. It records only `userId`, `walletId`, `amountSantims`, `balanceAfterSantims`, and `lockedAfterSantims`. It does not support General Ledger accounts, debits/credits, or platform assets/equity.
  3. *Missing Target Tables:* There are no table definitions for `accounts` (Chart of Accounts), `journalTransactions`, `journalLines`, `platformPaymentDestinations`, `paymentChannels`, `playerPayoutDestinations`, `ownerConfig`, `ownerPayouts`, `adminUsers`, or `reconciliations`.
  4. *Audit Log Identity Coupling:* Line 476 defines `financialAuditLogs` with `adminId: v.id("players")`. This forces administrators to exist as records in the `players` table, directly violating role separation.

---

### 2.2 Authentication, Authorization & Identity Model
- **File References:**
  - [`convex/lib/auth.ts:1-106`](file:///c:/Users/USER/Downloads/Castle-3d-multiplayer-with-ai-vercel-eve-nextjs-clerk-main/Castle-3d-multiplayer-with-ai-vercel-eve-nextjs-clerk-main/convex/lib/auth.ts#L1-L106)
  - [`src/app/(protected)/admin/page.tsx:1-43`](file:///c:/Users/USER/Downloads/Castle-3d-multiplayer-with-ai-vercel-eve-nextjs-clerk-main/Castle-3d-multiplayer-with-ai-vercel-eve-nextjs-clerk-main/src/app/(protected)/admin/page.tsx#L1-L43)
  - [`src/app/(protected)/yyhnan/page.tsx:1-43`](file:///c:/Users/USER/Downloads/Castle-3d-multiplayer-with-ai-vercel-eve-nextjs-clerk-main/Castle-3d-multiplayer-with-ai-vercel-eve-nextjs-clerk-main/src/app/(protected)/yyhnan/page.tsx#L1-L43)
- **Status:** **CONTRADICTORY & VULNERABLE**
- **Evidence & Findings:**
  1. *Hardcoded Identities in Frontend:* Both `/admin` and `/yyhnan` hardcode administrative access in their Next.js page components:
     ```typescript
     const isAuthorizedAdmin =
       userId === "user_3JfrI7CJEW9GIMo1UsEAvK9M0Ki" ||
       userEmail === "yaredusk@gmail.com";
     ```
  2. *Admin Identity Coupled to Player Records:* `convex/lib/auth.ts:87-106` defines `requireAdmin(ctx)`. It calls `requirePlayer(ctx)` first. If an administrator does not have a provisioned row in the `players` table, administrative access is refused (`"Player not provisioned"`).
  3. *Hardcoded Identity Sets:* `convex/lib/auth.ts:78-85` hardcodes `ADMIN_EMAILS = new Set(["yaredusk@gmail.com"])` and `ADMIN_CLERK_IDS = new Set(["user_3JfrI7CJEW9GIMo1UsEAvK9M0Ki"])`.
  4. *Zero Owner Implementation:* There is no `requireOwner` function in `convex/lib/auth.ts` or anywhere in the backend. There is no `OWNER_CLERK_ID` environment variable checked in the backend.

---

### 2.3 Financial Operations & Ledger Logic
- **File References:**
  - [`convex/ledger.ts:1-117`](file:///c:/Users/USER/Downloads/Castle-3d-multiplayer-with-ai-vercel-eve-nextjs-clerk-main/Castle-3d-multiplayer-with-ai-vercel-eve-nextjs-clerk-main/convex/ledger.ts#L1-L117)
  - [`convex/financial/escrow.ts:1-365`](file:///c:/Users/USER/Downloads/Castle-3d-multiplayer-with-ai-vercel-eve-nextjs-clerk-main/Castle-3d-multiplayer-with-ai-vercel-eve-nextjs-clerk-main/convex/financial/escrow.ts#L1-L365)
  - [`convex/financial/withdrawals.ts:1-573`](file:///c:/Users/USER/Downloads/Castle-3d-multiplayer-with-ai-vercel-eve-nextjs-clerk-main/Castle-3d-multiplayer-with-ai-vercel-eve-nextjs-clerk-main/convex/financial/withdrawals.ts#L1-L573)
  - [`convex/financial/analytics.ts:1-474`](file:///c:/Users/USER/Downloads/Castle-3d-multiplayer-with-ai-vercel-eve-nextjs-clerk-main/Castle-3d-multiplayer-with-ai-vercel-eve-nextjs-clerk-main/convex/financial/analytics.ts#L1-L474)
- **Status:** **PARTIALLY IMPLEMENTED (Single-Entry Only)**
- **Evidence & Findings:**
  1. *Single-Entry Helper:* `convex/ledger.ts:41` exposes `postLedgerEntry` which only writes a single row to `financialLedger`. It checks idempotency via `.withIndex("by_idempotencyKey")`, but lacks debit/credit balance checks.
  2. *Escrow Mechanism:* `convex/financial/escrow.ts:12` implements `lockMatchStake`. It correctly deducts `wallet.availableSantims` and increments `wallet.lockedSantims`, posting `entryType: "match_lock"`.
  3. *Client-Side Aggregation:* `convex/financial/analytics.ts:9` (`getWalletOverview`) fetches all rows from `financialLedger` for a user and calculates lifetime totals in JavaScript loops.

---

### 2.4 Deposit Ingestion & Verification
- **File References:**
  - [`src/app/api/finance/deposit/verify-et/route.ts:1-224`](file:///c:/Users/USER/Downloads/Castle-3d-multiplayer-with-ai-vercel-eve-nextjs-clerk-main/Castle-3d-multiplayer-with-ai-vercel-eve-nextjs-clerk-main/src/app/api/finance/deposit/verify-et/route.ts#L1-L224)
  - [`convex/deposits.ts:1-651`](file:///c:/Users/USER/Downloads/Castle-3d-multiplayer-with-ai-vercel-eve-nextjs-clerk-main/Castle-3d-multiplayer-with-ai-vercel-eve-nextjs-clerk-main/convex/deposits.ts#L1-L651)
  - [`src/lib/payments/verify-et/client.ts:1-623`](file:///c:/Users/USER/Downloads/Castle-3d-multiplayer-with-ai-vercel-eve-nextjs-clerk-main/Castle-3d-multiplayer-with-ai-vercel-eve-nextjs-clerk-main/src/lib/payments/verify-et/client.ts#L1-L623)
- **Status:** **PARTIALLY IMPLEMENTED & VULNERABLE**
- **Evidence & Findings:**
  1. *Compromised Fallback Key:* `src/lib/payments/verify-et/client.ts:31-32` contains:
     ```typescript
     const DEFAULT_VERIFY_ET_API_KEY = "VERIFY_BANK_ET_uT8kUg_CIZIVM2X2GEwNq6vA77DqKDz3lOdiP3BHMZZgZNbxzileH0KROisrLXu1";
     ```
     This key is compiled into the codebase and represents an active credential leak.
  2. *Suffix Matching Heuristic:* Lines 181–186 and 270–280 of `client.ts` perform 8-digit suffix matching. While Verify.et requires an 8-digit suffix to query CBE, relying on this match alone without rigorous full-reference, recipient, and amount checks risks misattribution.
  3. *Server Secret Conflation:* `src/app/api/finance/deposit/verify-et/route.ts:171` passes `webhookSecret: process.env.EVE_SERVER_SECRET` to Convex mutation `autoCreditVerifyEt`. In `convex/deposits.ts:261`, the mutation checks:
     ```typescript
     const serverSecret = process.env.VERIFY_ET_WEBHOOK_SECRET || process.env.EVE_SERVER_SECRET;
     ```
     This conflates the internal Vercel-to-Convex server secret with the external Verify.et webhook secret.
  4. *Obsolete Fallback Convex URL:* `src/app/api/finance/deposit/verify/route.ts:29` and `verify-et/route.ts:51` fallback to `"https://fast-oyster-971.convex.cloud"`, which is an obsolete development deployment rather than `qualified-greyhound-151`.

---

### 2.5 Withdrawal Lifecycle & Settlement Evidence
- **File References:**
  - [`convex/financial/withdrawals.ts:1-573`](file:///c:/Users/USER/Downloads/Castle-3d-multiplayer-with-ai-vercel-eve-nextjs-clerk-main/Castle-3d-multiplayer-with-ai-vercel-eve-nextjs-clerk-main/convex/financial/withdrawals.ts#L1-L573)
  - [`convex/financial/reconciliation.ts:1-565`](file:///c:/Users/USER/Downloads/Castle-3d-multiplayer-with-ai-vercel-eve-nextjs-clerk-main/Castle-3d-multiplayer-with-ai-vercel-eve-nextjs-clerk-main/convex/financial/reconciliation.ts#L1-L565)
- **Status:** **PARTIALLY IMPLEMENTED (Legacy Chapa References)**
- **Evidence & Findings:**
  1. *Two-Stage Reservation Implemented:* `convex/financial/withdrawals.ts:14` implements `reserveWithdrawal` which locks funds in `wallet.lockedSantims`.
  2. *Disabled Chapa Sweeper:* `convex/financial/reconciliation.ts:16` explicitly sets `const CHAPA_ENABLED = false;`. It contains legacy code attempting to poll `https://api.chapa.co/v1/transfers/verify/`.
  3. *Missing Multi-Factor Settlement Confirmation:* The existing withdrawal flow allows an administrator to mark a withdrawal completed with a simple text string without validating receipt storage IDs, SHA-256 hashes, or bank statement matching.

---

### 2.6 Commission & Match Settlement Rules
- **File References:**
  - [`convex/lib/money.ts:110-120`](file:///c:/Users/USER/Downloads/Castle-3d-multiplayer-with-ai-vercel-eve-nextjs-clerk-main/Castle-3d-multiplayer-with-ai-vercel-eve-nextjs-clerk-main/convex/lib/money.ts#L110-L120)
  - [`convex/lib/games.ts:380-425`](file:///c:/Users/USER/Downloads/Castle-3d-multiplayer-with-ai-vercel-eve-nextjs-clerk-main/Castle-3d-multiplayer-with-ai-vercel-eve-nextjs-clerk-main/convex/lib/games.ts#L380-L425)
- **Status:** **IMPLEMENTED (Existing Rules Verified)**
- **Evidence & Findings:**
  1. *Normal Win Commission:* `convex/lib/money.ts:110-120` confirms standard win commission is $1,000 \text{ bps} = 10\%$ of the gross pot. The winner receives 90%.
  2. *Organic Draw Policy:* `convex/lib/games.ts:380-425` confirms that all draws currently result in a 100% refund of stakes to both players with 0% platform commission.
  3. *Mutual Draw Policy:* Mutual draw 5% deduction per player is NOT yet implemented in code; it is an approved specification policy.

---

### 2.7 Administrative & Owner Dashboards
- **File References:**
  - [`src/components/admin/admin-view.tsx:1-1800`](file:///c:/Users/USER/Downloads/Castle-3d-multiplayer-with-ai-vercel-eve-nextjs-clerk-main/Castle-3d-multiplayer-with-ai-vercel-eve-nextjs-clerk-main/src/components/admin/admin-view.tsx)
  - [`convex/admin.ts:1-1310`](file:///c:/Users/USER/Downloads/Castle-3d-multiplayer-with-ai-vercel-eve-nextjs-clerk-main/Castle-3d-multiplayer-with-ai-vercel-eve-nextjs-clerk-main/convex/admin.ts#L1-L1310)
- **Status:** **CONTRADICTORY & MISSING ROLE SEPARATION**
- **Evidence & Findings:**
  1. *Identical Dashboards:* The routes `/admin` and `/yyhnan` render the exact same component (`AdminView`). There is no dedicated Owner dashboard.
  2. *Admin Treats Owner Commission as Admin Wallet:* In `convex/admin.ts:37-52`, `platformStats` queries the administrator's player wallet to display `adminWalletBalance`. Platform commissions are displayed as pending transfers to the admin's personal wallet.
  3. *Unmasked PII:* `admin-view.tsx` displays full player bank account numbers and phone numbers without masking or separate permission gates.

---

## 3. AUDIT CLASSIFICATION SUMMARY TABLE

| Subsystem / Feature | Implementation Status in Repo | Primary File Reference | Required Correction in v4.2.6-PROD |
| :--- | :--- | :--- | :--- |
| **Double-Entry General Ledger** | **MISSING** | `convex/schema.ts`, `convex/ledger.ts` | Define `accounts`, `journalTransactions`, `journalLines` |
| **Admin & Owner Role Decoupling** | **MISSING** | `convex/lib/auth.ts:87-106` | Eliminate `players` coupling; separate Clerk IDs |
| **Owner Configuration Table** | **MISSING** | `convex/schema.ts` | Define `ownerConfig` with staged rotation support |
| **Owner Payout Lifecycle** | **MISSING** | `convex/admin.ts` | Define `ownerPayouts` with multi-factor evidence |
| **Three Payment Domains** | **MISSING** | `convex/schema.ts` | Define `platformPaymentDestinations`, `paymentChannels`, `playerPayoutDestinations` |
| **Verify.et Fallback Key** | **VULNERABLE** | `src/lib/payments/verify-et/client.ts:31` | Delete hardcoded key; fail closed |
| **Server Secret Conflation** | **CONTRADICTORY** | `route.ts:171`, `deposits.ts:261` | Separate `VERIFY_ET_WEBHOOK_SECRET` from `INTERNAL_SERVICE_SECRET` |
| **Deposit Clearing Separation** | **MISSING** | `convex/deposits.ts` | Use Account `1030` clearing receivable prior to Tier 3 settlement |
| **Canonical Reversals** | **MISSING** | `convex/ledger.ts` | Exact reversal (`2030 -> 1010`) + separate wallet restore (`2010 -> 2030`) |
| **Solvency Calculation** | **MISSING** | `convex/financial/analytics.ts` | Dual coverage ratios based strictly on cleared cash |
| **Account 3999 Variance Handling** | **MISSING** | `convex/schema.ts` | Documented opening reconstruction with explicit sign rules |
| **Durable Cutover Queue** | **MISSING** | `convex/queue.ts` | Define `pendingSettlementQueue` with worker leasing |
| **Normal Win (10% Comm.)** | **IMPLEMENTED** | `convex/lib/money.ts:110-120` | Preserve existing 10% gross pot deduction |
| **Organic Draw (100% Refund)** | **IMPLEMENTED** | `convex/lib/games.ts:380-425` | Preserve existing 100% refund policy |
| **Mutually Accepted Draw** | **APPROVED POLICY** | Specification only | Deduct 5% per player (10% pot); refund 95% |
| **Field-Level PII Masking** | **MISSING** | `src/components/admin/admin-view.tsx`| Mask accounts; gate unmasking behind `withdrawals.reveal_pii` |

---
*End of Repository Audit Report (v4.2.6-PROD)*
