# ABAY CHESS — v4.2.7-PROD
## Master Implementation Execution Plan (Phases 0–11)

**Document Type:** Master Implementation Execution Plan  
**Target Architecture:** 17 Canonical GL Accounts, 14 Database Tables, Net Withdrawal Guarantee, Zero Platform Markup, 105% Solvency Multiplier, Scoped FIFO Queue, Zero-Trust RBAC  
**Status:** ACTIVE IMPLEMENTATION PHASE  
**Repository Working Branch:** `feat/v4.2.7-prod-implementation`  
**Baseline Git Commit:** `b648a73c03b7c81464b307516c6beb0b36058166` (preserving root audit baseline `06acb94b8111b6bcaed8291f781aa9b41bc102ac`)  
**Production Convex Deployment:** `qualified-greyhound-151`  

---

## 1. PHASING AND STAGE ROADMAP

### PHASE 0: Baseline Verification & Environment Hardening
- **Objective:** Establish clean git branch, verify TypeScript build, test framework, and document repository reality against authoritative specs.
- **Tasks:**
  - [x] Create dedicated feature branch `feat/v4.2.7-prod-implementation`.
  - [ ] Verify baseline TypeScript typecheck and Vitest suite execution.
  - [ ] Initialize the 6 mandatory implementation tracking documents.
  - [ ] Map dependencies, approval gates, and non-negotiable financial constraints.
- **Acceptance Criteria:** `tsc --noEmit` and existing test suite run without unhandled runtime breaks.
- **Rollback:** Switch back to `main`.

### PHASE 1: Core Architecture, Zero-Trust RBAC & Secrets Sanitization
- **Objective:** Eliminate hardcoded credentials, enforce server-side Clerk Subject ID authorization, isolate `/yyhnan` exclusively to Owner, and introduce `/fssmyfkl` for staff admin.
- **Tasks:**
  - [ ] Revoke and purge hardcoded `DEFAULT_VERIFY_ET_API_KEY` from `src/lib/payments/verify-et/client.ts`. Enforce server environment variable assertions (`VERIFY_ET_API_KEY`, `VERIFY_ET_WEBHOOK_SECRET`).
  - [ ] Reconcile obsolete URL `https://fast-oyster-971...` in `src/app/api/finance/deposit/verify/route.ts` to `CONVEX_CLOUD_URL`.
  - [ ] Refactor `convex/lib/auth.ts`: remove hardcoded email and user ID sets; implement `requireOwner(ctx)` checking Clerk Subject ID against `systemConfig.owner_identity`; implement `requireAdminPermission(ctx, perm: vAdminPermission)`.
  - [ ] Implement server-side authorization guards for `/yyhnan` (Owner only).
  - [ ] Scaffold dedicated `/fssmyfkl` route for staff admins with masked PII views.
- **Acceptance Criteria:** Tests **RB-29, RB-30, RB-42, RB-43** pass. Email matching alone cannot grant Owner privileges.

### PHASE 2: General Ledger Schema (17 Accounts, 14 Tables) & Posting Engine
- **Objective:** Deploy production-grade append-only double-entry general ledger to Convex backend.
- **Tasks:**
  - [ ] Implement complete Chart of Accounts validator with 17 canonical accounts (1010, 1020, 1030, 1040, 1050, 2010, 2020, 2030, 2040, 2090, 3010, 3020, 3999, 4010, 5010, 5020, 5030).
  - [ ] Expand `convex/schema.ts` with all 14 tables: `accounts`, `journalTransactions`, `journalPostings`, `dailyReconciliations`, `auditLogs`, `playerBalances`, `depositRequests`, `withdrawalRequests`, `ownerPayoutRequests`, `paymentChannels`, `platformPaymentDestinations`, `durableQueue`, `providerTariffs`, `systemConfig`.
  - [ ] Build atomic ledger mutation `convex/financial/ledger.ts:postJournalTransaction` enforcing $\sum \text{Debits} \equiv \sum \text{Credits}$ in 64-bit integer santims, idempotency key uniqueness, and append-only immutability.
- **Acceptance Criteria:** Tests **RB-01, RB-02, RB-03, RB-04, RB-36** pass. Unbalanced transactions abort immediately.

### PHASE 3: Dynamic Tariff Engine & Boundary Quarantine
- **Objective:** Implement versioned, effective-dated provider fee calculator supporting verified Telebirr and CBE schedules.
- **Tasks:**
  - [ ] Create `convex/financial/tariffs.ts` querying active non-overlapping tariffs.
  - [ ] Enforce schema overlap invariant (`ERR_TARIFF_OVERLAP_DETECTED`).
  - [ ] Seed official schedules:
    - Telebirr P2P (Bands 1..5; 100.00–100.99 ETB quarantined under `UNRESOLVED_BOUNDARY_QUARANTINED`).
    - CBE Account-to-Account (Bands 1..5; Band 1 quarantined under `FRACTIONAL_SANTIM_QUARANTINED`).
    - CBE to Telebirr Wallet (Bands 1..2).
  - [ ] Keep CBE Birr channel strictly `disabled` (**OD-04**).
- **Acceptance Criteria:** Tests **RB-46, RB-46.1, RB-46.2, RB-47, RB-48, RB-49, RB-70** pass.

### PHASE 4: 4-Tier Deposit Lifecycle & Account 1050 Overdraft Handling
- **Objective:** Eliminate solvency float inflation by holding verified deposits in Provider Clearing (1030) until bank statement settlement, and manage chargebacks with Account 1050.
- **Tasks:**
  - [ ] Refactor deposit verification mutation to post Tier 2: Debit `1030 Provider Clearing`, Credit `2010 Player Deposits`.
  - [ ] Implement Tier 3 bank statement settlement mutation: Debit `1010/1020 Cleared Cash`, Credit `1030 Provider Clearing`.
  - [ ] Implement Tier 2 and Tier 3 reversal & chargeback workflows:
    - If player has full balance ($A \ge D$): Debit `2010`, Credit `1030` or `1010`.
    - If player has spent funds ($A < D$): Debit `2010` ($A$, balance stops at 0), Debit `1050 Player Overdrafts Receivable` ($D - A$), Credit `1030` or `1010` ($D$), set status `frozen_overdraft`.
  - [ ] Implement Account 1050 repayment offset and Owner-only write-off mutation to `5030 Dispute & Chargeback Loss Expense`.
- **Acceptance Criteria:** Tests **RB-13, RB-14, RB-15, RB-16, RB-69, RB-69.1, RB-69.2** pass. Account 1030 excluded from solvency numerator.

### PHASE 5: 9-Phase Net Withdrawal Guarantee & Pass-Through Accounting
- **Objective:** Enforce Net Withdrawal Guarantee where player receives 100% of requested amount, quoted provider fees pass through Account 2040, variances absorb into 5010, and independent CBS evidence is mandatory.
- **Tasks:**
  - [ ] Implement withdrawal request mutation snapshotting immutable `tariffSnapshot`.
  - [ ] Implement reservation mutation: Debit `2010` ($X + F$), Credit `2030` ($X$), Credit `2040` ($F$).
  - [ ] Implement settlement execution mutation: Debit `2030` ($X$), Debit `2040` ($F$), Debit `5010` ($v = f - F$ if under-collected), Credit `1010/1020` ($X + f$), Credit `2010` ($s = F - f$ if over-collected).
  - [ ] Enforce independent settlement evidence fields (`externalSettlementReference`, `cbe_cbs_voucher`, etc.) before transitioning to `settled`.
  - [ ] Implement two-step returned transfer protocol (Case E1, Case E2, Case E3).
- **Acceptance Criteria:** Tests **RB-11, RB-12, RB-17, RB-18, RB-52, RB-57, RB-58, RB-71, RB-72** pass.

### PHASE 6: Match Escrow, Commission Rake & Draw Governance
- **Objective:** Atomic match escrow locking, normal win 10% rake, and draw settlement.
- **Tasks:**
  - [ ] Escrow join mutation: Debit `2010 Player Deposits` ($S$), Credit `2020 Active Match Escrow` ($S$).
  - [ ] Match win settlement: Debit `2020` ($2S$), Credit `2010 Winner` ($1.80S$), Credit `4010 Commission` ($0.20S$).
  - [ ] Organic draw settlement: Debit `2020` ($2S$), Credit `2010 White` ($S$), Credit `2010 Black` ($S$) with 0% rake.
  - [ ] Mutual accepted draw: Document Alternative 1 (5% pot rake) vs Alternative 2 (2.5% pot rake). Keep execution **BLOCKED** on 100% refund fallback until OD-09 is ratified by Owner.
- **Acceptance Criteria:** Tests **RB-05, RB-06, RB-07, RB-08, RB-09, RB-10, RB-44** pass.

### PHASE 7: Dynamic Solvency Monitoring & Distributable Cash Cap
- **Objective:** Compute dynamic platform solvency ratio and restrict Owner distributions to Distributable Cap enforcing 105% cash coverage.
- **Tasks:**
  - [ ] Implement `convex/financial/solvency.ts:calculateSolvencyMetrics`.
  - [ ] Compute $\text{EligibleCashSurplus} = \max(0, C_{\text{eligible}} - \lceil 105 \times \mathcal{L}_{\text{total}} / 100 \rceil - \text{OperatingBuffer})$.
  - [ ] Compute $\mathbf{DistributableCap} = \max(0, \min(\text{BookEquity}, \text{EligibleCashSurplus}))$.
  - [ ] Filter `PendingCommitments` to only unposted queue items (`postedTransactionId == null`).
  - [ ] Enforce pre-authorization check: projected post-payout solvency $\ge 105\%$ (**OD-02**).
- **Acceptance Criteria:** Tests **RB-21, RB-22, RB-31, RB-32, RB-66** pass.

### PHASE 8: Scoped FIFO Queue & Asynchronous Settlement
- **Objective:** Build background resilient processing engine.
- **Tasks:**
  - [ ] Implement `convex/financial/queue.ts` with `scopeKey` sequential locking, 30-second lease expiration (`leaseExpiresAt`), pre-replay entity revalidation, and 5-retry exponential backoff before DLQ.
- **Acceptance Criteria:** Tests **RB-25, RB-26, RB-27, RB-28, RB-39** pass.

### PHASE 9: Separate Staff Admin (`/fssmyfkl`) & Owner Command Center (`/yyhnan`)
- **Objective:** Build dedicated role-separated web interfaces.
- **Tasks:**
  - [ ] Build `/fssmyfkl` for staff: deposit reconciliation, withdrawal review queue, unmasking audit logs, match monitoring.
  - [ ] Build `/yyhnan` for Owner: general ledger inspector, chart of accounts, 105% solvency telemetry, 6-stage payout execution with mandatory CBS statement references.
- **Acceptance Criteria:** Non-owners strictly blocked from `/yyhnan`; non-admins strictly blocked from `/fssmyfkl`.

### PHASE 10: Full Acceptance Suite & Independent Arithmetic Verification
- **Objective:** Execute test suite validating all 72 release-blocking tests and financial scenarios A–F.
- **Acceptance Criteria:** 100% test pass rate recorded in `IMPLEMENTATION_TEST_EVIDENCE.md`.

### PHASE 11: Production Staging & Controlled Cutover Readiness
- **Objective:** Prepare zero-downtime deployment package, backup procedures, and operational checklists without deploying without explicit authorization.
