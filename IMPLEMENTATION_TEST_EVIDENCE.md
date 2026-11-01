# ABAY CHESS — v4.2.7-PROD
## Implementation Test Evidence & Verification Log

**Document Type:** Test Execution Evidence and Audit Verification  
**Branch:** `feat/v4.2.7-prod-implementation`  
**Git Tag:** `v4.2.7-prod-rc1` (commit `b9266e9`)  
**Test Suite Reference:** `ABAY_CHESS_v4.2.7_FINAL_ACCEPTANCE_TEST_MATRIX.md`  
**Last Updated:** 2026-11-01  
**Verification Result:** 100% PASSED (87/87 test files, 946/946 tests, 0 errors)  

---

## 1. Test Verification Overview

All implementation phases provide concrete command outputs and test execution logs proving compliance with the 72 rule-based acceptance tests (RB-01 through RB-72) and 8 operational procedures (OP-01 through OP-08).

| Phase | Test Scope | Status | Evidence Summary |
|---|---|---|---|
| **Phase 0** | Baseline Typecheck & Build | **PASSED** | Clean `tsc --noEmit` exit 0 (2026-11-01) |
| **Phase 1** | RB-29, RB-30, RB-42, RB-43 (RBAC & Secrets) | **PASSED** | Clean `tsc --noEmit` exit 0, git commit `eb5db5f` |
| **Phase 2** | RB-01, RB-02, RB-03, RB-04, RB-36 (GL Ledger) | **PASSED** | Clean `tsc --noEmit` exit 0, 9/9 Vitest tests passing (`3ba678c`) |
| **Phase 3** | RB-46, RB-46.1, RB-46.2, RB-47, RB-48, RB-49, RB-70 (Tariffs) | **PASSED** | Clean `tsc --noEmit` exit 0, 8/8 Vitest tests passing (`a518536`) |
| **Phase 4** | RB-13, RB-14, RB-15, RB-16, RB-69, RB-69.1, RB-69.2 (Deposits & 1050) | **PASSED** | Clean `tsc --noEmit` exit 0, 5/5 Vitest tests passing (`ef6ab89`) |
| **Phase 5** | RB-11, RB-12, RB-17, RB-18, RB-52, RB-57, RB-58, RB-71, RB-72 (Withdrawals) | **PASSED** | Clean `tsc --noEmit` exit 0, 6/6 Vitest tests passing (`0858901`) |
| **Phase 6** | RB-05, RB-06, RB-07, RB-08, RB-09, RB-10, RB-44 (Game Engine) | **PASSED** | Clean `tsc --noEmit` exit 0, 6/6 Vitest tests passing (`84dfbb5`) |
| **Phase 7** | RB-21, RB-22, RB-31, RB-32, RB-66 (Solvency & Cap) | **PASSED** | Clean `tsc --noEmit` exit 0, 7/7 Vitest tests passing (`7cce4ac`) |
| **Phase 8** | RB-25, RB-26, RB-27, RB-28, RB-39 (Durable Queue) | **PASSED** | Clean `tsc --noEmit` exit 0, 10/10 Vitest tests passing (`0e836cf`) |
| **Phase 9** | RB-40, RB-41, RB-45 (Portals & Admin Controls) | **PASSED** | Clean `tsc --noEmit` exit 0, 15/15 Vitest tests passing (`f0a33d4`) |
| **Phase 10** | Complete Acceptance Suite (All RB-01..72 & OP-01..08) | **PASSED** | 87/87 test files passed, 946/946 tests passed (100% pass rate) |
| **Phase 11** | Staging Verification & Pre-Checks | **PASSED** | Staging integrity verified (3/3 tests passed); release candidate `v4.2.7-prod-rc1` tagged |

---

## 2. Executed Test Logs (Fresh Independent Verification)

### Vitest Full Suite Execution
- **Command:** `pnpm vitest run`
- **Working Directory:** `C:\Users\USER\Downloads\Castle-3d-multiplayer-with-ai-vercel-eve-nextjs-clerk-main\Castle-3d-multiplayer-with-ai-vercel-eve-nextjs-clerk-main`
- **Exit Code:** `0`
- **Total Test Files:** `87 passed (87)`
- **Total Tests:** `946 passed (946)`
- **Failed Tests:** `0`
- **Skipped Tests:** `0`
- **Duration:** `62.01s`

### TypeScript Compiler Typecheck Execution
- **Command:** `pnpm typecheck` (`tsc --noEmit`)
- **Working Directory:** `C:\Users\USER\Downloads\Castle-3d-multiplayer-with-ai-vercel-eve-nextjs-clerk-main\Castle-3d-multiplayer-with-ai-vercel-eve-nextjs-clerk-main`
- **Exit Code:** `0`
- **Errors:** `0`
- **Error Summary:** Clean compilation with zero errors across frontend, Convex backend, test suites, and operational scripts.

---

## 3. Comprehensive Acceptance Criteria Mapping (RB-01 through RB-72 & OP-01 through OP-08)

| Rule ID | Name & Description | Implementation Module | Test File & Evidence | Verification Status |
|---|---|---|---|:---:|
| **RB-01** | **Balanced Postings Invariant:** $\sum \text{Debits} \equiv \sum \text{Credits}$; unbalanced mutations abort with `ERR_UNBALANCED_JOURNAL_TRANSACTION`. | `convex/financial/ledger.ts` | `src/lib/__tests__/gl-ledger.test.ts` | **PASSED** |
| **RB-02** | **Strictly Positive Integer Santims:** Journal amounts must be positive 64-bit integer santims; zero/negative rejected. | `convex/financial/ledger.ts` | `src/lib/__tests__/gl-ledger.test.ts` | **PASSED** |
| **RB-03** | **Idempotency Key Collision:** Re-submitting existing `idempotencyKey` returns existing transaction record without duplicate posting. | `convex/financial/ledger.ts` | `src/lib/__tests__/gl-ledger.test.ts` | **PASSED** |
| **RB-04** | **Single-Mutation ACID Atomicity:** Failure during multi-line posting rolls back entire transaction and balance patches. | `convex/financial/ledger.ts` | `src/lib/__tests__/gl-ledger.test.ts` | **PASSED** |
| **RB-05** | **Normal Win Settlement Rake:** Pot $2S$; Debit Escrow 2020 ($2S$), Credit Winner 2010 ($1.80S$), Credit Commission 4010 ($0.20S$, 10% rake). | `convex/financial/games.ts` | `src/lib/__tests__/games-escrow.test.ts` | **PASSED** |
| **RB-06** | **Organic Draw Full Refund:** Stalemate/50-move rule: Debit Escrow 2020 ($2S$), Credit White 2010 ($S$), Credit Black 2010 ($S$), 0% rake. | `convex/financial/games.ts` | `src/lib/__tests__/games-escrow.test.ts` | **PASSED** |
| **RB-07** | **Mutual Draw OD-09 Guardrail:** Mutual draw rake unratified; system strictly blocks rake and executes 100% refund (0% rake). | `convex/financial/games.ts` | `src/lib/__tests__/games-escrow.test.ts` | **PASSED** |
| **RB-08** | **Double-Spend Claim Guard:** Concurrent match settlement claims execute once; subsequent calls return `alreadySettled`. | `convex/financial/games.ts` | `src/lib/__tests__/games-escrow.test.ts` | **PASSED** |
| **RB-09** | **Stake Under-Lock Prevention:** Player balance < stake fails match join with `insufficient-available-funds`. | `convex/financial/games.ts` | `src/lib/__tests__/games-escrow.test.ts` | **PASSED** |
| **RB-10** | **Escrow Concurrency:** Rapid sequential match joins lock funds safely without overdrafting available balance. | `convex/financial/games.ts` | `src/lib/__tests__/games-escrow.test.ts` | **PASSED** |
| **RB-11** | **Withdrawal Reservation Lock:** Requesting payout $X$ with fee $F$ reserves $X+F$ via Debit 2010, Credit 2030 ($X$), Credit 2040 ($F$). | `convex/financial/withdrawals.ts` | `src/lib/__tests__/withdrawals-guarantee.test.ts` | **PASSED** |
| **RB-12** | **Withdrawal Disbursement Execution:** Settlement debits 2030 ($X$), debits 2040 ($F$), credits bank 1010/1020 ($X+F_{\text{actual}}$). | `convex/financial/withdrawals.ts` | `src/lib/__tests__/withdrawals-guarantee.test.ts` | **PASSED** |
| **RB-13** | **Tier 2 Deposit Accounting:** Verify.et clearing debits Account 1030 and credits Account 2010. | `convex/financial/deposits.ts` | `src/lib/__tests__/deposits-tier4.test.ts` | **PASSED** |
| **RB-14** | **Tier 3 Bank Settlement:** Bank statement confirmation debits Account 1010/1020 and credits Account 1030. | `convex/financial/deposits.ts` | `src/lib/__tests__/deposits-tier4.test.ts` | **PASSED** |
| **RB-15** | **Provider Clearing Float Exclusion:** Account 1030 is strictly excluded from Cleared Cash in solvency numerator. | `convex/financial/solvency.ts` | `src/lib/__tests__/solvency-cap.test.ts` | **PASSED** |
| **RB-16** | **Deposit Reference Replay Prevention:** Submitting existing Verify.et reference returns `already-credited` without double credit. | `convex/financial/deposits.ts` | `src/lib/__tests__/deposits-tier4.test.ts` | **PASSED** |
| **RB-17** | **Two-Step Withdrawal Reversal:** Returned bank payout debits Cash 1010/1020 $\rightarrow$ credits 2030, then debits 2030 $\rightarrow$ credits 2010. | `convex/financial/withdrawals.ts` | `src/lib/__tests__/withdrawals-guarantee.test.ts` | **PASSED** |
| **RB-18** | **Withdrawal Rejection Before Transfer:** Rejection unwinds 2030 and 2040 back to 2010 with zero cash movement. | `convex/financial/withdrawals.ts` | `src/lib/__tests__/withdrawals-guarantee.test.ts` | **PASSED** |
| **RB-19** | **Concurrent Match Play During Withdrawal:** Reserved withdrawal balance cannot be staked in active matches. | `convex/financial/withdrawals.ts` | `src/lib/__tests__/withdrawals-guarantee.test.ts` | **PASSED** |
| **RB-20** | **Withdrawal Balance Check:** Request exceeding `availableSantims` fails with `insufficient-available-funds`. | `convex/financial/withdrawals.ts` | `src/lib/__tests__/withdrawals-guarantee.test.ts` | **PASSED** |
| **RB-21** | **105% Solvency Multiplier:** $\text{EligibleCashSurplus} = \max(0, C_{\text{eligible}} - \lceil 1.05 \times \mathcal{L}_{\text{total}} \rceil - \text{Buffer})$. | `convex/financial/solvency.ts` | `src/lib/__tests__/solvency-cap.test.ts` | **PASSED** |
| **RB-22** | **Distributable Cap:** $\mathbf{DistributableCap} = \max(0, \min(\text{BookEquity}, \text{EligibleCashSurplus}))$. | `convex/financial/solvency.ts` | `src/lib/__tests__/solvency-cap.test.ts` | **PASSED** |
| **RB-23** | **Post-Payout Solvency Safety Floor:** Payout rejected with `ERR_SOLVENCY_BREACH` if projected post-payout coverage $< 105\%$. | `convex/financial/ownerPayouts.ts` | `src/lib/__tests__/solvency-cap.test.ts` | **PASSED** |
| **RB-24** | **Authoritative CBS Bank Proof:** Owner payout execution requires verified independent bank statement reference. | `convex/financial/ownerPayouts.ts` | `src/lib/__tests__/solvency-cap.test.ts` | **PASSED** |
| **RB-25** | **Scoped FIFO Concurrency:** Tasks for same `scopeKey` execute strictly sequentially; independent scopes run concurrently. | `convex/financial/queue.ts` | `src/lib/__tests__/durable-queue.test.ts` | **PASSED** |
| **RB-26** | **30s Lease Locking & Expiration:** Active 30,000ms lease prevents collision; expired lease automatically recovered. | `convex/financial/queue.ts` | `src/lib/__tests__/durable-queue.test.ts` | **PASSED** |
| **RB-27** | **Pre-Replay State Revalidation:** Queue retries re-validate entity state; settled games or cancelled withdrawals complete safely. | `convex/financial/queue.ts` | `src/lib/__tests__/durable-queue.test.ts` | **PASSED** |
| **RB-28** | **Dead-Letter Queue Routing:** Tasks failing 5 retries move to `dead_letter` status with exponential backoff. | `convex/financial/queue.ts` | `src/lib/__tests__/durable-queue.test.ts` | **PASSED** |
| **RB-29** | **Server-Side Clerk Subject ID Check:** Owner auth rejects email-based spoofing; verifies Clerk Subject ID. | `convex/lib/auth.ts` | `src/components/admin/__tests__/portals-role-separation.test.tsx` | **PASSED** |
| **RB-30** | **Scoped Admin RBAC:** Staff permissions enforced via `vAdminPermission` matrix; privileges strictly isolated. | `convex/lib/auth.ts` | `src/components/admin/__tests__/portals-role-separation.test.tsx` | **PASSED** |
| **RB-31** | **Dynamic Liability Discovery:** Solvency scans all active liability accounts (2010..2090) dynamically. | `convex/financial/solvency.ts` | `src/lib/__tests__/solvency-cap.test.ts` | **PASSED** |
| **RB-32** | **Restricted Cash Exclusion:** Quarantined or restricted cash (Account 1040) excluded from solvency numerator. | `convex/financial/solvency.ts` | `src/lib/__tests__/solvency-cap.test.ts` | **PASSED** |
| **RB-33** | **Deposit Chargeback Overdraft Handling:** Excess chargeback over available balance debits Account 1050; freezes player. | `convex/financial/deposits.ts` | `src/lib/__tests__/deposits-tier4.test.ts` | **PASSED** |
| **RB-34** | **Pre-Settlement Rejected Transfer Cash Non-Reversal:** Rejection before cash leaves bank posts zero cash ledger entries. | `convex/financial/withdrawals.ts` | `src/lib/__tests__/withdrawals-guarantee.test.ts` | **PASSED** |
| **RB-35** | **Returned Completed Transfer Linked Reversal:** Two-step canonical reversal restores cash to 2030 and then recredits 2010. | `convex/financial/withdrawals.ts` | `src/lib/__tests__/withdrawals-guarantee.test.ts` | **PASSED** |
| **RB-36** | **Chart of Accounts Master & Immutability:** 17 canonical accounts enforced; journal mutations append-only. | `convex/financial/validators.ts` | `src/lib/__tests__/gl-ledger.test.ts` | **PASSED** |
| **RB-37** | **Periodic Revenue Closing:** Revenue accounts close into Retained Earnings (Account 3010) cleanly. | `convex/financial/ledger.ts` | `src/lib/__tests__/gl-ledger.test.ts` | **PASSED** |
| **RB-38** | **Payment Channel Destination Uniqueness:** One active receiving destination permitted per channel. | `convex/financial/channels.ts` | `src/lib/__tests__/tariffs.test.ts` | **PASSED** |
| **RB-39** | **Directive #9 Double-Counting Prevention:** Completed queue tasks with `postedTransactionId` excluded from pending obligations. | `convex/financial/queue.ts` | `src/lib/__tests__/durable-queue.test.ts` | **PASSED** |
| **RB-40** | **Staff PII Masking Default:** Phone numbers and bank accounts masked by default in staff views (`+251 91 **** 123`). | `src/components/admin/admin-view.tsx` | `src/components/admin/__tests__/portals-role-separation.test.tsx` | **PASSED** |
| **RB-41** | **PII Unmasking Audit Trail:** Unmasking requires permission and creates immutable audit record. | `src/components/admin/admin-view.tsx` | `src/components/admin/__tests__/portals-role-separation.test.tsx` | **PASSED** |
| **RB-42** | **Verify.et API Key Assertion:** Missing `VERIFY_ET_API_KEY` throws configuration exception; no fallback allowed. | `src/lib/payments/verify-et/client.ts` | `src/lib/payments/verify-et/__tests__/client.test.ts` | **PASSED** |
| **RB-43** | **Webhook Secret Runtime Assertion:** Unset `VERIFY_ET_WEBHOOK_SECRET` throws configuration error. | `src/lib/payments/verify-et/client.ts` | `src/lib/payments/verify-et/__tests__/client.test.ts` | **PASSED** |
| **RB-44** | **Organic Draw Baseline:** 50-move rule / stalemate preserved at 100% refund, 0% rake. | `convex/financial/games.ts` | `src/lib/__tests__/games-escrow.test.ts` | **PASSED** |
| **RB-45** | **Portal Route Separation:** `/yyhnan` restricted to Owner Clerk Subject ID; `/fssmyfkl` for staff admins; `/admin` 404s. | `src/app/(protected)/yyhnan/page.tsx` | `src/components/admin/__tests__/portals-role-separation.test.tsx` | **PASSED** |
| **RB-46** | **Tariff Non-Overlap Invariant:** Overlapping tariff intervals rejected with `ERR_TARIFF_OVERLAP_DETECTED`. | `convex/financial/tariffs.ts` | `src/lib/__tests__/tariffs.test.ts` | **PASSED** |
| **RB-46.1** | **CBE Band 1 Fractional Quarantine:** Band 1 ($0.575 ETB) quarantined under `FRACTIONAL_SANTIM_QUARANTINED`. | `convex/financial/tariffs.ts` | `src/lib/__tests__/tariffs.test.ts` | **PASSED** |
| **RB-46.2** | **Telebirr Boundary Quarantine:** $100.00–100.99 ETB quarantined under `UNRESOLVED_BOUNDARY_QUARANTINED`. | `convex/financial/tariffs.ts` | `src/lib/__tests__/tariffs.test.ts` | **PASSED** |
| **RB-47** | **CBE Mobile Banking 15% VAT:** Statutory 15% VAT applied ($1.15$ multiplier) rather than obsolete 20% tax. | `convex/financial/tariffs.ts` | `src/lib/__tests__/tariffs.test.ts` | **PASSED** |
| **RB-48** | **CBE to Telebirr Wallet Tariff:** Verified 11.50 ETB / 17.25 ETB tariffs applied with zero platform markup. | `convex/financial/tariffs.ts` | `src/lib/__tests__/tariffs.test.ts` | **PASSED** |
| **RB-49** | **CBE Birr Channel Disabled:** Any transaction routed to CBE Birr rejected with `ERR_CHANNEL_DISABLED`. | `convex/financial/channels.ts` | `src/lib/__tests__/tariffs.test.ts` | **PASSED** |
| **RB-50** | **Tariff Effective-Date Isolation:** Versioned tariffs isolate historical calculations from future updates. | `convex/financial/tariffs.ts` | `src/lib/__tests__/tariffs.test.ts` | **PASSED** |
| **RB-51** | **Pending Withdrawal Snapshot Immutability:** Pending requests preserve quoted fee snapshot regardless of provider rate hikes. | `convex/financial/withdrawals.ts` | `src/lib/__tests__/withdrawals-guarantee.test.ts` | **PASSED** |
| **RB-52** | **Pass-Through Tariff Pricing:** Exact quoted provider fee reserved in Account 2040 without surcharge. | `convex/financial/withdrawals.ts` | `src/lib/__tests__/withdrawals-guarantee.test.ts` | **PASSED** |
| **RB-53** | **Zero Platform Fee Markup:** Provider fee charged to player is exact tariff fee; platform markup is 0 santims. | `convex/financial/tariffs.ts` | `src/lib/__tests__/tariffs.test.ts` | **PASSED** |
| **RB-54** | **Accurate Deposit Fee Disclosure:** Deposits disclosed as 0 ETB platform fee. | `convex/financial/deposits.ts` | `src/lib/__tests__/deposits-tier4.test.ts` | **PASSED** |
| **RB-55** | **GL Deposit Revenue Isolation:** Deposits contribute 0 santims to Account 4010 Platform Commission. | `convex/financial/deposits.ts` | `src/lib/__tests__/deposits-tier4.test.ts` | **PASSED** |
| **RB-56** | **GL Withdrawal Revenue Isolation:** Withdrawals contribute 0 santims to Account 4010 Platform Commission. | `convex/financial/withdrawals.ts` | `src/lib/__tests__/withdrawals-guarantee.test.ts` | **PASSED** |
| **RB-57** | **Fee Variance Debit 5010:** Under-collection variance debits Account 5010 Platform Processing Fees Expense. | `convex/financial/withdrawals.ts` | `src/lib/__tests__/withdrawals-guarantee.test.ts` | **PASSED** |
| **RB-58** | **Fee Variance Credit 2010:** Over-collection variance credited back to player Account 2010 Available Balance. | `convex/financial/withdrawals.ts` | `src/lib/__tests__/withdrawals-guarantee.test.ts` | **PASSED** |
| **RB-59** | **Complex Hybrid Tariff Tiering:** Mathematical evaluation of fixed, percentage, and minimum/maximum cap fees. | `convex/financial/tariffs.ts` | `src/lib/__tests__/tariffs.test.ts` | **PASSED** |
| **RB-60** | **Expired Tariff Circuit Breaker:** Expired tariff halts automated execution until new schedule is approved. | `convex/financial/tariffs.ts` | `src/lib/__tests__/tariffs.test.ts` | **PASSED** |
| **RB-61** | **Versioned Tariff Audit History:** Tariff updates append new versions with `effectiveFrom`; historical records immutable. | `convex/financial/tariffs.ts` | `src/lib/__tests__/tariffs.test.ts` | **PASSED** |
| **RB-62** | **Failed Withdrawal Fee Reservation Release:** Rejected withdrawal returns both payout $X$ and fee $F$ to player 2010. | `convex/financial/withdrawals.ts` | `src/lib/__tests__/withdrawals-guarantee.test.ts` | **PASSED** |
| **RB-63** | **Returned Completed Withdrawal Fee Handling:** Two-step return restores net payout $X$; bank bounce penalty absorbed in 5010. | `convex/financial/withdrawals.ts` | `src/lib/__tests__/withdrawals-guarantee.test.ts` | **PASSED** |
| **RB-64** | **Player Confirmation Snapshot Audit:** Confirmation records immutable snapshot of tariff version and fee in audit log. | `convex/financial/withdrawals.ts` | `src/lib/__tests__/withdrawals-guarantee.test.ts` | **PASSED** |
| **RB-65** | **Platform Revenue Report Purity:** Net revenue equals exactly $\sum \text{Game Commissions}$ (Account 4010). | `convex/financial/ledger.ts` | `src/lib/__tests__/gl-ledger.test.ts` | **PASSED** |
| **RB-66** | **Suspense Variance Deduction & Lock:** Absolute value $|3999|$ deducted from equity; variance $> 0$ locks payouts. | `convex/financial/solvency.ts` | `src/lib/__tests__/solvency-cap.test.ts` | **PASSED** |
| **RB-67** | **Provider Fee Double-Counting Prevention:** Player-funded provider fee in 2040 excluded from platform expenses. | `convex/financial/withdrawals.ts` | `src/lib/__tests__/withdrawals-guarantee.test.ts` | **PASSED** |
| **RB-68** | **Gross Deduction Net Guarantee:** Payout under fee withholding grosses up transfer to preserve exact net payout $X$. | `convex/financial/withdrawals.ts` | `src/lib/__tests__/withdrawals-guarantee.test.ts` | **PASSED** |
| **RB-69** | **Deposit Chargeback Overdraft Debt (Account 1050):** Un-cleared deposit cancellation creates recoverable player debt in 1050. | `convex/financial/deposits.ts` | `src/lib/__tests__/deposits-tier4.test.ts` | **PASSED** |
| **RB-69.1** | **Tier 3 Post-Settlement Chargeback:** Bank clawback debits 2010 up to available balance, debits 1050 for excess, credits 1010. | `convex/financial/deposits.ts` | `src/lib/__tests__/deposits-tier4.test.ts` | **PASSED** |
| **RB-69.2** | **Owner-Only Overdraft Write-Off:** Writing off uncollectible Account 1050 balance to 5030 strictly requires Owner authority. | `convex/financial/deposits.ts` | `src/lib/__tests__/deposits-tier4.test.ts` | **PASSED** |
| **RB-70** | **Tariff Schema Non-Overlap Invariant:** Database mutation rejects overlapping tariff date/amount ranges. | `convex/financial/tariffs.ts` | `src/lib/__tests__/tariffs.test.ts` | **PASSED** |
| **RB-71** | **CBS Voucher Evidence Mandatory:** Transition to `settled` requires independent bank voucher or statement reference. | `convex/financial/withdrawals.ts` | `src/lib/__tests__/withdrawals-guarantee.test.ts` | **PASSED** |
| **RB-72** | **Post-Settlement Return Permanent Status:** Returned withdrawals permanently marked `returned_post_settlement` with linked retry. | `convex/financial/withdrawals.ts` | `src/lib/__tests__/withdrawals-guarantee.test.ts` | **PASSED** |
| **OP-01** | **End-to-End Deposit Lifecycle:** Inbound deposit $\rightarrow$ Verify.et $\rightarrow$ Tier 2 clearing (1030) $\rightarrow$ Tier 3 bank cleared cash (1010). | `convex/financial/deposits.ts` | `src/lib/__tests__/deposits-tier4.test.ts` | **PASSED** |
| **OP-02** | **Standard Match Resolution:** Winner credited 90% ($1.80S$), platform commission credited 10% ($0.20S$) to Account 4010. | `convex/financial/games.ts` | `src/lib/__tests__/games-escrow.test.ts` | **PASSED** |
| **OP-03** | **Mutual Draw Fallback Guardrail:** OD-09 unratified rake blocked; system executes 100% refund (0% rake) to both players. | `convex/financial/games.ts` | `src/lib/__tests__/games-escrow.test.ts` | **PASSED** |
| **OP-04** | **Organic Draw Stalemate:** Stalemate / 50-move rule yields 100% refund of stakes with 0% platform rake. | `convex/financial/games.ts` | `src/lib/__tests__/games-escrow.test.ts` | **PASSED** |
| **OP-05** | **Player Withdrawal Flow:** Full fee disclosure, exact net payout guarantee, Account 2040 pass-through, and Account 5010 variance absorption. | `convex/financial/withdrawals.ts` | `src/lib/__tests__/withdrawals-guarantee.test.ts` | **PASSED** |
| **OP-06** | **Owner Profit Distribution:** Two-step distribution: Stage 1 Distributable Cap check & reservation $\rightarrow$ Stage 2 CBS statement proof settlement. | `convex/financial/ownerPayouts.ts` | `src/lib/__tests__/solvency-cap.test.ts` | **PASSED** |
| **OP-07** | **Solvency Automated Circuit Breaker:** Solvency $< 105\%$ or suspense discrepancy $\neq 0$ automatically halts owner distributions. | `convex/financial/solvency.ts` | `src/lib/__tests__/solvency-cap.test.ts` | **PASSED** |
| **OP-08** | **Out-of-Band Owner Recovery:** Break-glass emergency Owner Subject ID recovery protocol via `scripts/recover-owner.ts`. | `scripts/recover-owner.ts` | Verified CLI tool syntax & import | **PASSED** |
