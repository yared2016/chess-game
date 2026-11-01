# ABAY CHESS — v4.2.7-PROD
## Master Implementation Task Tracker

**Status Definitions:**
- `NOT_STARTED`: Work has not begun.
- `IN_PROGRESS`: Actively being engineered on the current branch.
- `BLOCKED`: Dependency or unresolved Owner Decision prevents execution.
- `IMPLEMENTED`: Code written, self-reviewed, and committed.
- `TESTED`: Unit / integration / mutation tests executed and passing.
- `VERIFIED`: Confirmed against acceptance criteria with recorded evidence in `IMPLEMENTATION_TEST_EVIDENCE.md`.

---

## 1. PHASE-BY-PHASE TASK REGISTER

| Task ID | Phase | Component / Description | Assigned Priority | Target Files | Status | Test Reference | Blocked By |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **TSK-001** | Phase 0 | Create git branch `feat/v4.2.7-prod-implementation` | P0 | Git metadata | **COMPLETED** | Branch check | None |
| **TSK-002** | Phase 0 | Run baseline TypeScript typecheck & test suite | P0 | Whole codebase | **COMPLETED** | `pnpm typecheck` | None |
| **TSK-003** | Phase 0 | Initialize 6 Implementation Management Files | P0 | Docs root | **COMPLETED** | File presence | None |
| **TSK-101** | Phase 1 | Revoke & purge hardcoded `DEFAULT_VERIFY_ET_API_KEY` | P0 | `src/lib/payments/verify-et/client.ts` | **COMPLETED** | RB-42 | None |
| **TSK-102** | Phase 1 | Reconcile obsolete `https://fast-oyster-971...` URL | P0 | `src/app/api/finance/deposit/verify/route.ts` | **COMPLETED** | OP-01 | None |
| **TSK-103** | Phase 1 | Purge hardcoded email/ID sets from `convex/lib/auth.ts` | P0 | `convex/lib/auth.ts` | **COMPLETED** | RB-29 | None |
| **TSK-104** | Phase 1 | Implement `requireOwner(ctx)` checking Clerk Subject ID | P0 | `convex/lib/auth.ts` | **COMPLETED** | RB-29, 30 | None |
| **TSK-105** | Phase 1 | Implement `requireAdminPermission(ctx, permission)` | P0 | `convex/lib/auth.ts` | **COMPLETED** | RB-30 | None |
| **TSK-106** | Phase 1 | Scaffold `/fssmyfkl` route with scoped RBAC & masked PII | P1 | `src/app/(protected)/fssmyfkl/` | **COMPLETED** | RB-30 | None |
| **TSK-107** | Phase 1 | Enforce Owner-only access to `/yyhnan` route | P0 | `src/app/(protected)/yyhnan/` | **COMPLETED** | RB-29 | None |
| **TSK-201** | Phase 2 | Define 17 Canonical Accounts & Chart of Accounts schema | P0 | `convex/schema.ts`, `convex/financial/` | **COMPLETED** | RB-01, 36 | None |
| **TSK-202** | Phase 2 | Expand `convex/schema.ts` with all 14 database tables | P0 | `convex/schema.ts` | **COMPLETED** | Schema compile | None |
| **TSK-203** | Phase 2 | Build atomic `postJournalTransaction` double-entry engine | P0 | `convex/financial/ledger.ts` | **COMPLETED** | RB-01..04 | None |
| **TSK-204** | Phase 2 | Implement integer santim & idempotency validation | P0 | `convex/financial/ledger.ts` | **COMPLETED** | RB-02, 03 | None |
| **TSK-301** | Phase 3 | Implement versioned Provider Tariff query engine | P1 | `convex/financial/tariffs.ts` | **COMPLETED** | RB-46 | None |
| **TSK-302** | Phase 3 | Seed Telebirr P2P schedule with 100.00 ETB quarantined | P1 | `convex/financial/tariffs.ts` | **COMPLETED** | RB-46.2 | None |
| **TSK-303** | Phase 3 | Seed CBE schedule with Band 1 (0.575 ETB) quarantined | P1 | `convex/financial/tariffs.ts` | **COMPLETED** | RB-46.1 | None |
| **TSK-304** | Phase 3 | Enforce tariff overlap database invariant | P1 | `convex/financial/tariffs.ts` | **COMPLETED** | RB-70 | None |
| **TSK-305** | Phase 3 | Enforce CBE Birr channel `disabled` status | P1 | `convex/financial/channels.ts` | **COMPLETED** | RB-49 | None |
| **TSK-401** | Phase 4 | Implement 4-tier deposit lifecycle holding funds in 1030 | P0 | `convex/financial/deposits.ts` | **NOT_STARTED** | RB-13..15 | None |
| **TSK-402** | Phase 4 | Implement Tier 3 bank statement cleared cash mutation | P1 | `convex/financial/deposits.ts` | **NOT_STARTED** | RB-14 | None |
| **TSK-403** | Phase 4 | Implement Tier 2 & Tier 3 deposit reversals (full balance) | P1 | `convex/financial/deposits.ts` | **NOT_STARTED** | RB-16.1..4 | None |
| **TSK-404** | Phase 4 | Implement deposit chargeback with spent funds (Account 1050) | P0 | `convex/financial/deposits.ts` | **NOT_STARTED** | RB-69, 69.1 | None |
| **TSK-405** | Phase 4 | Implement Account 1050 repayment offset & Owner write-off to 5030 | P1 | `convex/financial/deposits.ts` | **NOT_STARTED** | RB-69.2 | None |
| **TSK-501** | Phase 5 | Implement Net Withdrawal Guarantee fee calculator | P0 | `convex/financial/withdrawals.ts` | **NOT_STARTED** | RB-45, 52 | None |
| **TSK-502** | Phase 5 | Implement withdrawal reservation mutation (2010 -> 2030 + 2040) | P0 | `convex/financial/withdrawals.ts` | **NOT_STARTED** | RB-11 | None |
| **TSK-503** | Phase 5 | Implement settlement execution with variance absorption (5010) | P0 | `convex/financial/withdrawals.ts` | **NOT_STARTED** | RB-12, 57, 58 | None |
| **TSK-504** | Phase 5 | Enforce independent CBS statement evidence before settlement | P1 | `convex/financial/withdrawals.ts` | **NOT_STARTED** | RB-71 | None |
| **TSK-505** | Phase 5 | Implement two-step returned transfer protocol (Cases E1, E2, E3) | P1 | `convex/financial/withdrawals.ts` | **NOT_STARTED** | RB-17, 72 | None |
| **TSK-601** | Phase 6 | Atomic match escrow join mutation (Debit 2010, Credit 2020) | P0 | `convex/financial/games.ts` | **NOT_STARTED** | RB-09, 10 | None |
| **TSK-602** | Phase 6 | Normal win settlement with 10% commission rake (Account 4010) | P0 | `convex/financial/games.ts` | **NOT_STARTED** | RB-05, OP-02 | None |
| **TSK-603** | Phase 6 | Organic draw settlement (100% full refund, 0% rake) | P1 | `convex/financial/games.ts` | **NOT_STARTED** | RB-06, RB-44 | None |
| **TSK-604** | Phase 6 | Mutual accepted draw policy (Keep blocked on 100% refund) | P1 | `convex/financial/games.ts` | **BLOCKED** | RB-07 | **OD-09** |
| **TSK-701** | Phase 7 | Implement 105% dynamic solvency ratio calculation | P0 | `convex/financial/solvency.ts` | **NOT_STARTED** | RB-21, 22 | None |
| **TSK-702** | Phase 7 | Implement non-negative Distributable Cash Cap formula | P0 | `convex/financial/solvency.ts` | **NOT_STARTED** | RB-21 | None |
| **TSK-703** | Phase 7 | Implement PendingCommitments unposted queue filter | P0 | `convex/financial/solvency.ts` | **NOT_STARTED** | RB-21 | None |
| **TSK-704** | Phase 7 | Authoritative 6-stage Owner Payout Lifecycle with CBS proof | P0 | `convex/financial/ownerPayouts.ts` | **NOT_STARTED** | RB-23, 24 | None |
| **TSK-801** | Phase 8 | Build Scoped FIFO Queue (`durableQueue`) & lease locks | P1 | `convex/financial/queue.ts` | **NOT_STARTED** | RB-25, 26 | None |
| **TSK-802** | Phase 8 | Pre-replay entity validation & DLQ after 5 retries | P1 | `convex/financial/queue.ts` | **NOT_STARTED** | RB-27, 28 | None |
| **TSK-901** | Phase 9 | Build Admin operations interface (`/fssmyfkl`) | P2 | `src/app/(protected)/fssmyfkl/` | **NOT_STARTED** | UI test | None |
| **TSK-902** | Phase 9 | Build Owner Command Center (`/yyhnan`) | P2 | `src/app/(protected)/yyhnan/` | **NOT_STARTED** | UI test | None |
| **TSK-1001**| Phase 10| Run full acceptance suite (RB-01..72, OP-01..08) | P0 | Test harness | **NOT_STARTED** | All RB/OP | None |
| **TSK-1101**| Phase 11| Production cutover preparation & rollback procedures | P0 | Scripts / Docs | **NOT_STARTED** | Cutover drill | Owner Authorization |
