# Master Implementation & Governance Plan: Abay Chess v4.2.7-PROD

> **Status:** ACTIVE EXECUTION  
> **Target Release:** `v4.2.7-PROD`  
> **Production Domain:** `https://abaychess.com`  
> **Owner Portal:** `/yyhnan`  
> **Repository:** `Castle-3d-multiplayer-with-ai-vercel-eve-nextjs-clerk-main`  

---

## 1. Executive Mission & Goals

Execute end-to-end delivery of the approved **Abay Chess v4.2.7-PROD** governance, financial, UI cleanup, legal policies management system, and production deployment:
1. **Policy Reconciliation (OD-01 through OD-13):**
   - **OD-01 (Option C):** Minimum Owner Capital Reserve = 10% of total transaction volume over previous rolling 30 days (with 1,000.00 ETB / 100,000 santims baseline floor).
   - **OD-02 (Option A):** 105% dynamic solvency coverage ratio ($\text{Eligible Cash} / \text{Total Obligations} \ge 1.05$).
   - **OD-03 (Option A + SLA 1):** Withdrawals $> 2,000\text{ ETB}$ (200,000 santims) trigger mandatory manual review (`review_pending`), with SLA of $\le 6\text{h}$ daytime (08:00–20:00 EAT) and $\le 12\text{h}$ overnight (20:00–08:00 EAT).
   - **OD-04 (Option A):** CBE Birr strictly disabled in production.
   - **OD-05 (Option A):** Sunday 02:00–04:00 EAT cutover maintenance window.
   - **OD-06 (Option A):** Durable queue 5 retries at 10s, 30s, 2m, 10m, 30m before DLQ.
   - **OD-07 (Option A):** Account 3999 contra-equity quarantine with single absolute-value cap deduction; Account 1050 separate customer overdraft receivable with 14-day dispute window, staff freeze immutable, 90-day Owner-only write-off to Account 5030.
   - **Withdrawal Policy A (Minimum Withdrawal):** 100.00 ETB (10,000 santims) minimum ordinary withdrawal, server-side enforced in integer santims, fee breakdown displayed, idempotency, controlled account-closure/final-balance exception when legitimate balance $< 100\text{ ETB}$.
   - **Withdrawal Policy B (First Successful Withdrawal Eligibility):** Requires $\ge 3$ verified, legitimate, completed chess matches (unique, non-abandoned, non-aborted). Progress indicator displayed (`X/3 completed matches`). Eligibility fulfilled upon successful first withdrawal completion. No deposit confiscation.
2. **Visible Credits Removal & Legal Asset Notice Preservation:**
   - Remove visible Credits section and creator/AI attribution from Settings page (`settings-form.tsx`).
   - Remove visible Pieces, Rooms, Engine, and Credits items from Homepage footer (`landing-footer.tsx`).
   - Remove visible attribution from game screen (`game-sidebar.tsx`).
   - Preserve open-source legal obligations (Poly Pizza / Jarlan Perez CC BY 3.0, Stockfish 11 GPLv3, Poly Haven CC0) in dedicated `/legal/licenses` route.
   - Maintain all gameplay, 3D assets, matchmaking, rooms, Stockfish engine, and wallet functionality intact.
3. **Legal & Policies Management System:**
   - Public legal routes: `/legal` (hub), `/legal/terms`, `/legal/privacy`, `/legal/payments`, `/legal/licenses`.
   - Registration acceptance: Mandatory Terms & Privacy acceptance checkbox on profile completion/signup, with server-side audit recording (user ID, version, timestamp, IP/UA).
   - Owner dashboard management (`/yyhnan`): Owner-only access (Clerk Subject ID), create/edit/publish/archive/version policy documents, preview, immutable audit history.
4. **Verification & Deployment:**
   - Vitest suite passing 100% with new test cases.
   - Typecheck (`tsc --noEmit`) passing with 0 errors.
   - Production build (`pnpm build`) passing cleanly.
   - Production release deployed and verified live on `https://abaychess.com`.

---

## 2. Phase-by-Phase Execution Plan

### Phase 1: Baseline Audit & Inspection
- [x] Read and inspect existing repository state, branch `feat/v4.2.7-prod-implementation`, head `fb0850a`.
- [x] Verify Vitest suite passes (87 test files, 946 tests passed).
- [x] Verify TypeScript typecheck passes (0 errors).
- [x] Update `task_plan.md`, `findings.md`, and `progress.md`.

### Phase 2: Policy Reconciliation
- [x] Implement OD-01 Option C in `convex/financial/solvency.ts`: Dynamic 10% rolling 30-day transaction volume reserve with 100,000 santims floor.
- [x] Enforce Withdrawal Policy A: 100.00 ETB (10,000 santims) minimum withdrawal across `convex/financial/withdrawals.ts`, `convex/financial/channels.ts`, `convex/lib/constants.ts`, and frontend modals. Support account-closure full balance withdrawal exception.
- [x] Enforce Withdrawal Policy B: First-time withdrawal 3 completed chess matches verification in `convex/financial/withdrawals.ts` and `convex/financial/eligibility.ts`.
- [x] Add withdrawal eligibility query and progress UI (`1/3 completed matches`) to `withdraw-modal.tsx` and `withdraw-flow.tsx`.

### Phase 3: Visible Credits Removal & Open-Source Notice Relocation
- [x] Remove visible Credits section from `src/components/settings/settings-form.tsx`.
- [x] Remove visible Pieces, Rooms, Engine, and Credits items from `src/components/landing/landing-footer.tsx`. Add links to `/legal`, `/legal/terms`, `/legal/privacy`, `/legal/payments`, `/legal/licenses`.
- [x] Remove inline credits text from `src/components/game/game-sidebar.tsx`.
- [x] Remove creator/AI attribution from `src/components/profile/profile-header.tsx` and `recent-games-table.tsx`.
- [x] Verify 3D piece models, rooms, animations, and Stockfish engine run without regression.

### Phase 4: Legal & Policies Management System
- [x] Add `policies` and `policyAcceptances` tables to `convex/schema.ts`.
- [x] Add policy acceptance fields to `players` table in `convex/schema.ts`.
- [x] Implement `convex/policies.ts` with public queries (`getPublishedPolicy`, `listPublishedPolicies`), owner mutations (`savePolicy`, `publishPolicy`), and acceptance mutation (`recordPolicyAcceptance`).
- [x] Create public legal routes:
  - `src/app/legal/page.tsx` (Legal Hub)
  - `src/app/legal/terms/page.tsx` (Terms of Service)
  - `src/app/legal/privacy/page.tsx` (Privacy Policy)
  - `src/app/legal/payments/page.tsx` (Payment & Withdrawal Policy)
  - `src/app/legal/licenses/page.tsx` (Open Source Licenses & Attributions)
- [x] Add mandatory Terms & Privacy acceptance checkbox to `src/components/auth/complete-profile-form.tsx` and integrate with `convex/players.ts`.
- [x] Build Owner Legal Policy Management Card (`src/components/admin/legal-policies-card.tsx`) and mount into `/yyhnan` (`AdminView`).

### Phase 5: Verification & Testing
- [x] Add unit and integration tests for:
  - Dynamic capital reserve (OD-01 Option C).
  - 100 ETB minimum withdrawal & account closure exception (Policy A).
  - 3 completed matches first withdrawal eligibility (Policy B).
  - Policy publication, retrieval, and acceptance recording.
- [x] Run full Vitest suite (`pnpm vitest run`) and confirm 100% pass rate (88 test files, 953 tests passed).
- [x] Run full typecheck (`pnpm typecheck`) and confirm 0 errors.
- [x] Run production build (`pnpm build`) and confirm build artifact generation (34/34 pages static/dynamic generation passed).

### Phase 6: Vercel Production Deployment & Handover
- [x] Commit all audited, verified changes cleanly with descriptive message.
- [x] Deploy to production and verify live domain `https://abaychess.com` and public routes (`/`, `/play`, `/wallet`, `/legal`, `/legal/licenses`, `/yyhnan`).
- [x] Generate comprehensive final owner handover report.
    
    DepositRoute --> Auth
    DepositRoute --> ProviderInterface
    ProviderInterface --> ChapaAdapter
    ChapaAdapter --> ChapaClient
    ChapaClient --> ChapaCheckout
    
    User --> ChapaCheckout
    ChapaCheckout --> User
    User --> VerifyRoute
    ChapaAPI -.-> WebhookRoute
    
    VerifyRoute --> ProviderInterface
    WebhookRoute --> ProviderInterface
    TransferRoute --> ProviderInterface
    
    DepositRoute --> WalletDomain
    VerifyRoute --> WalletDomain
    WebhookRoute --> WalletDomain
    TransferRoute --> WalletDomain
    
    WalletDomain --> Ledger
    EscrowEngine --> Ledger
    Ledger --> Tables
```

**Tech Stack:**
- Next.js 16 (App Router), React 19, TypeScript
- Clerk Authentication
- Convex 1.44 (Real-time Database, ACID Transactions)
- Tailwind CSS v4, Lucide React, Sonner Toast
- Chapa Payment & Transfer API (Test Mode first)

---

## Global Constraints & Principles

1. **Decoupled Architecture:** Chapa is strictly an external adapter. The Convex ledger is the only source of truth.
2. **Integer Minor Units:** All monetary values stored and calculated in integer santims (`1 ETB = 100 santims`). Display formatting happens at presentation boundary.
3. **Zero Frontend Financial Trust:** The browser never decides balance, fee, commission, status, or transaction references.
4. **Immutable Ledger:** Every balance movement creates an immutable ledger entry. Compensating transactions are used for reversals; old rows are never modified.
5. **Strict Invariants:**
   - `availableBalance >= 0`
   - `lockedBalance >= 0`
   - `totalBalance = availableBalance + lockedBalance`
   - Ledger entries balance out across domain accounts.
6. **No Generic Balance Mutations:** Operations are restricted to explicit domain verbs (`creditDeposit`, `reserveMatchEntry`, `releaseMatchEntry`, `settleMatch`, `reserveWithdrawal`, `completeWithdrawal`, `reverseWithdrawal`).
7. **Idempotent Operations:** All webhook deliveries and verification calls must be idempotent via unique transaction indexes.
8. **Test Mode First:** Test keys (`CHASECK_TEST-`) and sandbox flows only. Live money activation prohibited during development.

---

## Master Implementation Phases & Tasks

### Task 1: Complete Project Inspection & Architectural Mapping (Phase 1)
- [x] **Step 1:** Review all 10 target dimensions across the codebase.
- [x] **Step 2:** Formulate `findings.md` with explicit details on current database, auth, game engine, admin, and route patterns.
- [x] **Step 3:** Commit inspection findings to project memory.

### Task 2: Financial Ledger & Domain Model Design (Phase 2)
- [x] **Step 1:** Design immutable ledger entries (`DEPOSIT_CREDIT`, `DEPOSIT_FEE`, `MATCH_LOCK`, `MATCH_UNLOCK`, `MATCH_PAYOUT`, `MATCH_LOSS`, `PLATFORM_COMMISSION`, `WITHDRAWAL_RESERVE`, `WITHDRAWAL_COMPLETE`, `WITHDRAWAL_REVERSAL`, `ADMIN_ADJUSTMENT`).
- [x] **Step 2:** Design state machines for deposits, withdrawals, and match escrow.
- [x] **Step 3:** Define `PaymentProvider` abstraction interface and money representation contract (1 ETB = 100 santims).

### Task 3: Financial Database Schema (Phase 3)
**Files:**
- Modify: `convex/schema.ts`
- Modify: `convex/lib/validators.ts`

- [ ] **Step 1:** Add financial validators in `convex/lib/validators.ts`:
  - `vLedgerEntryType`: union of all 11 financial movement types.
  - `vFinancialDepositStatus`: union of `created`, `pending_provider`, `verifying`, `verified`, `credited`, `failed`, `expired`.
  - `vFinancialWithdrawalStatus`: union of `requested`, `reserved`, `provider_submitted`, `provider_pending`, `completed`, `failed`, `reversed`, `cancelled`.
  - `vWalletStatus`: union of `active`, `frozen`, `restricted`.
  - `vFeeMode`: union of `additive`, `deduct_from_gross`.
- [ ] **Step 2:** Add `financialLedger` table to `convex/schema.ts`:
  - Fields: `userId`, `walletId`, `entryType`, `amountSantims`, `balanceAfterSantims`, `lockedAfterSantims`, `referenceType` (deposit, game, withdrawal, admin), `referenceId`, `idempotencyKey`, `description`, `metadata`, `createdAt`.
  - Indexes: `by_userId`, `by_idempotencyKey`, `by_referenceType_and_referenceId`, `by_createdAt`.
- [ ] **Step 3:** Add `financialDeposits` table to `convex/schema.ts`:
  - Fields: `userId`, `walletId`, `provider`, `providerTxId`, `internalTxRef`, `requestedCreditSantims`, `providerFeeSantims`, `grossAmountSantims`, `currency`, `status`, `feeMode`, `checkoutUrl`, `createdAt`, `updatedAt`, `verifiedAt`, `failureReason`.
  - Indexes: `by_internalTxRef`, `by_providerTxId`, `by_userId_and_status`.
- [ ] **Step 4:** Add `financialWithdrawals` table to `convex/schema.ts`:
  - Fields: `userId`, `walletId`, `provider`, `internalTransferRef`, `providerTransferId`, `requestedAmountSantims`, `providerFeeSantims`, `totalReservedSantims`, `currency`, `bankName`, `bankCode`, `accountNumberMasked`, `accountHolderName`, `status`, `failureReason`, `createdAt`, `updatedAt`, `completedAt`.
  - Indexes: `by_internalTransferRef`, `by_providerTransferId`, `by_userId_and_status`.
- [ ] **Step 5:** Add `financialAuditLogs` table to `convex/schema.ts`:
  - Fields: `adminId`, `action`, `targetUserId`, `amountSantims`, `reason`, `ipAddress`, `createdAt`.
  - Indexes: `by_adminId`, `by_targetUserId`, `by_createdAt`.
- [ ] **Step 6:** Run `npx convex dev` / `npx convex codegen` to sync database schema.

### Task 4: Money & Fee Utilities (Phase 4)
**Files:**
- Create: `src/lib/payments/money.ts`
- Create: `convex/lib/money.ts`

- [ ] **Step 1:** Create `src/lib/payments/money.ts` with minor unit math:
  - `toSantims(etb: number): number` (rounds safely).
  - `toEtb(santims: number): number`.
  - `formatEtb(santims: number): string`.
  - `calculateFee(amountSantims: number, feeRateBasisPoints: number, mode: "additive" | "deduct_from_gross")`.
- [ ] **Step 2:** Duplicate server-side twin in `convex/lib/money.ts` (Convex functions run in isolate and cannot import from `src/`).
- [ ] **Step 3:** Write unit tests for fee calculation, boundary rounding, and negative protection.

### Task 5: Payment Provider Abstraction Layer (Phase 5)
**Files:**
- Create: `src/lib/payments/types.ts`
- Create: `src/lib/payments/provider.ts`

- [ ] **Step 1:** Create `src/lib/payments/types.ts` declaring:
  - `PaymentProvider` interface.
  - `PaymentInitRequest`, `PaymentInitResponse`.
  - `PaymentVerifyResult`.
  - `TransferInitRequest`, `TransferInitResponse`, `TransferVerifyResult`.
  - `BankInfo` definition.
- [ ] **Step 2:** Create `src/lib/payments/provider.ts` registry:
  - `getPaymentProvider(providerId = "chapa"): PaymentProvider`.

### Task 6: Chapa Client & Test Adapter (Phase 6)
**Files:**
- Create: `src/lib/payments/chapa/client.ts`
- Create: `src/lib/payments/chapa/adapter.ts`

- [ ] **Step 1:** Create `ChapaClient` in `src/lib/payments/chapa/client.ts`:
  - Methods: `initializePayment`, `verifyPayment`, `initializeTransfer`, `verifyTransfer`, `getBanks`.
  - Enforce `Authorization: Bearer ${CHAPA_SECRET_KEY}`.
  - Normalized error handling without leaking secrets.
- [ ] **Step 2:** Implement `ChapaAdapter` in `src/lib/payments/chapa/adapter.ts` satisfying `PaymentProvider`.
- [ ] **Step 3:** Implement HMAC SHA256 webhook signature verification (`x-chapa-signature`).

### Task 7: Deposit Initialization Endpoint (Phase 7)
**Files:**
- Create: `src/app/api/finance/deposit/initialize/route.ts`
- Create: `convex/financial/deposits.ts`

- [ ] **Step 1:** Implement `createPendingDeposit` mutation in `convex/financial/deposits.ts` (records `financialDeposits` in `pending_provider` state).
- [ ] **Step 2:** Implement `POST /api/finance/deposit/initialize`:
  - Authenticate Clerk user via `await auth()`.
  - Retrieve server-side fee configuration (e.g. 2.5% additive).
  - Calculate `providerFee` and `grossAmount`.
  - Generate collision-resistant `internalTxRef = DEP_${clerkUserId}_${timestamp}_${random}`.
  - Call `provider.initializePayment(...)`.
  - Persist pending deposit in Convex.
  - Return `{ checkoutUrl, internalTxRef, grossAmount, fee, creditAmount }`.

### Task 8: Server-Side Payment Verification (Phase 8)
**Files:**
- Create: `src/app/api/finance/deposit/verify/route.ts`
- Modify: `convex/financial/deposits.ts`

- [ ] **Step 1:** Implement `POST /api/finance/deposit/verify`:
  - Receive `internalTxRef`.
  - Fetch pending record from Convex.
  - Call `provider.verifyPayment(internalTxRef)`.
  - Validate amount, currency (ETB), status (`success`), and user identity.
  - If valid, execute atomic domain crediting mutation in Convex.
  - Return normalized status to frontend.

### Task 9 & 10: Webhook Handler & Idempotency (Phases 9 & 10)
**Files:**
- Create: `src/app/api/finance/webhook/chapa/route.ts`
- Modify: `convex/financial/deposits.ts`

- [ ] **Step 1:** Implement `POST /api/finance/webhook/chapa`:
  - Validate `x-chapa-signature` header using HMAC SHA256 of raw body with `CHAPA_WEBHOOK_SECRET`.
  - Parse event payload and extract `tx_ref`.
  - Query Chapa verification API directly (never trust webhook payload alone).
  - Call idempotent `creditVerifiedDeposit` in Convex.
  - Return `200 OK`.

### Task 11: Domain Wallet Crediting & Ledger Posting (Phase 11)
**Files:**
- Create: `convex/ledger.ts`
- Modify: `convex/wallets.ts`

- [ ] **Step 1:** Implement `postLedgerEntry` internal helper in `convex/ledger.ts`.
- [ ] **Step 2:** Implement `creditDeposit` domain mutation:
  - Assert deposit status is `verified` and not already `credited`.
  - Check wallet status is not `frozen`.
  - Update `wallet.availableBalance += requestedCreditSantims`.
  - Insert `DEPOSIT_CREDIT` ledger entry with idempotency key.
  - Insert `DEPOSIT_FEE` ledger entry for audit.
  - Mark deposit document `credited`.
  - Trigger in-app notification.

### Task 12 & 13: Wallet & Deposit UI with Transparent Fees (Phases 12 & 13)
**Files:**
- Modify: `src/app/(protected)/wallet/page.tsx`
- Modify: `src/components/wallet/wallet-view.tsx`
- Create: `src/components/wallet/deposit-modal.tsx`
- Create: `src/components/wallet/ledger-history.tsx`

- [ ] **Step 1:** Build `DepositModal` with live fee breakdown:
  - Input: Requested credit (e.g. 100 ETB).
  - Display:
    - Wallet credit: `100.00 ETB`
    - Chapa transaction fee (2.5%): `2.50 ETB`
    - Total payment required: `102.50 ETB`
  - Action: Proceed to Chapa hosted checkout.
- [ ] **Step 2:** Build `LedgerHistory` component showing immutable transactions with type icons, santim formatting, and status pills.

### Task 14, 15 & 16: Match Escrow, Settlement & Commission (Phases 14, 15 & 16)
**Files:**
- Modify: `convex/queue.ts`
- Modify: `convex/challenges.ts`
- Modify: `convex/lib/games.ts`
- Create: `convex/financial/escrow.ts`

- [ ] **Step 1:** Refactor `queue.join` & `challenges.createChallenge` to call `reserveMatchEntry` which records a `MATCH_LOCK` ledger entry.
- [ ] **Step 2:** Refactor `finalizeGame` in `convex/lib/games.ts` to call `settleMatch`:
  - Calculate gross pot in santims (`stake * 2`).
  - Calculate platform commission using configured rate (e.g. 10%).
  - Record `PLATFORM_COMMISSION` ledger entry.
  - Record `MATCH_PAYOUT` ledger entry for winner.
  - Record `MATCH_LOSS` ledger entry for loser.
  - Mark game `escrowSettled = true`.

### Task 17, 18, 19, 20 & 21: Withdrawal Pipeline (Phases 17 - 21)
**Files:**
- Create: `convex/financial/withdrawals.ts`
- Create: `src/app/api/finance/withdrawal/request/route.ts`
- Create: `src/components/wallet/withdraw-modal.tsx`

- [ ] **Step 1:** Implement `reserveWithdrawal` mutation in `convex/financial/withdrawals.ts`:
  - Validates `availableBalance >= requestedAmount + fee`.
  - Moves total required from `availableBalance` to `lockedBalance`.
  - Posts `WITHDRAWAL_RESERVE` ledger entry.
- [ ] **Step 2:** Integrate Chapa Transfer API in `src/app/api/finance/withdrawal/request/route.ts`.
- [ ] **Step 3:** Implement transfer verification and webhook reconciliation.
- [ ] **Step 4:** Implement `completeWithdrawal` (clears locked) and `reverseWithdrawal` (restores locked back to available on failure).

### Task 22, 23 & 24: Admin Financial Center & Audit System (Phases 22 - 24)
**Files:**
- Modify: `src/app/(protected)/yyhnan/page.tsx`
- Modify: `src/components/admin/admin-view.tsx`
- Create: `src/components/admin/admin-finance-tab.tsx`
- Create: `convex/admin/finance.ts`

- [ ] **Step 1:** Add Financial Overview tab to `/yyhnan` admin console:
  - Aggregate deposits, withdrawals, platform commission, provider fees, wallet liabilities.
  - Wallet freeze / unfreeze action with audit reason.
  - Financial ledger explorer with filtering.
- [ ] **Step 2:** Implement reconciliation tool comparing Convex records against Chapa API transactions.
- [ ] **Step 3:** Log every administrative intervention to `financialAuditLogs`.

### Task 25, 26, 27 & 28: Verification, Stress Testing & Production Readiness
- [ ] **Step 1:** Verify complete flow in Chapa Test Mode.
- [ ] **Step 2:** Test double-entry prevention and negative balance denial.
- [ ] **Step 3:** Run TypeScript check (`npx tsc --noEmit`) and Convex codegen.
- [ ] **Step 4:** Document production deployment checklist in `progress.md`.
