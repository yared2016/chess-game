# Production Master: Chess Platform Wallet & Payment Architecture Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a secure, production-grade internal ETB wallet and ledger subsystem for the 3D chess platform, using Chapa as an external payment provider adapter while keeping the financial domain completely decoupled.

**Architecture:** The internal Convex financial ledger serves as the authoritative source of truth for user balances, locked match escrow, platform commissions, provider fees, and withdrawals. A clean `PaymentProvider` adapter layer sits between the platform and Chapa (or future providers like ArifPay/SantimPay). All financial amounts use integer minor units (1 ETB = 100 santims) to eliminate floating-point rounding hazards.

**Architecture Diagram:**

```mermaid
graph TD
    User([User / Browser])
    
    subgraph "Frontend Layer (Next.js 16)"
        WalletUI[Wallet & Studio UI /wallet]
        DepositModal[Deposit Confirmation Modal]
        WithdrawModal[Withdrawal Modal]
        AdminDashboard[Admin Finance Center /yyhnan]
    end

    subgraph "Server API & Provider Abstraction"
        DepositRoute[/api/finance/deposit/initialize]
        VerifyRoute[/api/finance/deposit/verify]
        TransferRoute[/api/finance/withdrawal/transfer]
        WebhookRoute[/api/finance/webhook/chapa]
        ProviderInterface[PaymentProvider Interface]
        ChapaAdapter[Chapa Provider Adapter]
        ChapaClient[Chapa HTTP API Client]
    end

    subgraph "External Payment Gateway"
        ChapaCheckout[Chapa Hosted Checkout]
        ChapaAPI[Chapa REST API]
        ChapaTransferAPI[Chapa Transfer API]
    end

    subgraph "Convex Authoritative Financial Core"
        Auth[Clerk Auth Guard requirePlayer/Admin]
        WalletDomain[Wallet Domain Ops]
        Ledger[Immutable Financial Ledger]
        EscrowEngine[Match Escrow & Settlement Engine]
        Tables[(Convex DB: wallets, ledger, deposits, withdrawals, auditLogs)]
    end

    User --> WalletUI
    WalletUI --> DepositModal
    WalletUI --> WithdrawModal
    DepositModal --> DepositRoute
    WithdrawModal --> TransferRoute
    
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
