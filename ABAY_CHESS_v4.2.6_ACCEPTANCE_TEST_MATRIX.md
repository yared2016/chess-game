# ABAY CHESS — MASTER ACCEPTANCE TEST MATRIX (v4.2.6-PROD)

**Date:** November 1, 2026  
**Document:** Authoritative Acceptance Testing Specification  
**Basis:** Full Verification Suite for `v4.2.6-PROD` Architecture  
**Test Harness:** Vitest 5.0 (`pnpm vitest run`) + Convex Test Harness (`convex-test`)  
**Status:** Pending Explicit Owner Approval — **STRICT NO-IMPLEMENTATION PHASE**  

---

## 1. ACCEPTANCE TESTING METHODOLOGY & HARNESS

Every financial, authorization, and lifecycle rule specified in `v4.2.6-PROD` must be certified by automated integration and invariant tests before deployment.

### Testing Invariants Enforced:
1. **Mathematical Invariance:** $\sum \text{Debits} == \sum \text{Credits}$ across all journal lines.
2. **Safe Integer Arithmetic:** Every financial input and aggregation must be a positive safe integer ($1 \le x < \text{MAX\_SAFE\_INTEGER}$).
3. **Idempotency & Replay Invariance:** Submitting identical keys returns identical results; submitting conflicting keys fails closed.
4. **Zero-Trust Authorization:** Every mutation independently validates Clerk Subject ID and permissions.

---

## 2. RELEASE-BLOCKING TEST SUITE (RB-01 THROUGH RB-28)

These 28 test suites are **strictly release-blocking**. A single failure halts deployment.

---

### RB-01: Unbalanced Journal Transaction Rejection
- **Preconditions:** Chart of accounts seeded.
- **Input:** Mutation payload with Debit `1010` = 100,000 santims; Credit `2010` = 95,000 santims ($\Delta = 5,000$).
- **Expected Journal Postings:** Zero rows inserted.
- **Expected Business State:** Unchanged.
- **Expected Balance Changes:** All account balances unchanged.
- **Expected Authorization Result:** Authorized caller.
- **Failure Behavior:** Throws `ConvexError("unbalanced_journal_transaction")`. Transaction rolls back atomically.

---

### RB-02: Double Reversal Prevention
- **Preconditions:** Original transaction $T_1$ exists and has been reversed by reversal transaction $R_1$ (`reversalOfTransactionId: T_1._id`).
- **Input:** Request to reverse $T_1$ a second time via new reversal $R_2$.
- **Expected Journal Postings:** Zero rows inserted.
- **Expected Business State:** Unchanged.
- **Expected Balance Changes:** Zero.
- **Expected Authorization Result:** Authorized staff caller.
- **Failure Behavior:** Throws `ConvexError("transaction_already_reversed")`. Atomically aborts.

---

### RB-03: Reversal of a Reversal Prohibited
- **Preconditions:** Reversal transaction $R_1$ exists with `transactionType: "reversal"`.
- **Input:** Request to create transaction $R_2$ with `reversalOfTransactionId: R_1._id`.
- **Expected Journal Postings:** Zero rows inserted.
- **Expected Business State:** Unchanged.
- **Expected Balance Changes:** Zero.
- **Expected Authorization Result:** Authorized caller.
- **Failure Behavior:** Throws `ConvexError("cannot_reverse_a_reversal")`. Atomically aborts.

---

### RB-04: Conflicting Idempotency Key Reuse
- **Preconditions:** Transaction $T_1$ exists with `idempotencyKey: "dep_123"`, amount 50,000 santims.
- **Input:** New transaction submitted with `idempotencyKey: "dep_123"`, but amount 75,000 santims.
- **Expected Journal Postings:** Zero rows inserted.
- **Expected Business State:** Unchanged.
- **Expected Balance Changes:** Zero.
- **Expected Authorization Result:** Authorized caller.
- **Failure Behavior:** Throws `ConvexError("conflicting_idempotency_key_reuse")`.

---

### RB-05: Positive Safe Integer Validation
- **Preconditions:** Financial mutation endpoints active.
- **Input:** Test cases with amounts: `10.5` (fractional), `-500` (negative), `NaN`, `Infinity`, `Number.MAX_SAFE_INTEGER + 1`.
- **Expected Journal Postings:** Zero rows inserted.
- **Expected Business State:** Unchanged.
- **Expected Balance Changes:** Zero.
- **Expected Authorization Result:** Any caller.
- **Failure Behavior:** Throws `ConvexError("invalid_amount_must_be_positive_safe_integer_santims")`.

---

### RB-06: Zero-Line Journal Rejection
- **Preconditions:** Chart of accounts seeded.
- **Input:** Journal transaction submitted with empty lines array `lines: []`.
- **Expected Journal Postings:** Zero rows inserted.
- **Expected Business State:** Unchanged.
- **Expected Balance Changes:** Zero.
- **Expected Authorization Result:** Authorized caller.
- **Failure Behavior:** Throws `ConvexError("empty_journal_lines_prohibited")`.

---

### RB-07: Inactive or Nonexistent Account Rejection
- **Preconditions:** Account `"1030"` has `isActive === false`.
- **Input:** Journal transaction containing a posting line referencing account `"1030"`.
- **Expected Journal Postings:** Zero rows inserted.
- **Expected Business State:** Unchanged.
- **Expected Balance Changes:** Zero.
- **Expected Authorization Result:** Authorized caller.
- **Failure Behavior:** Throws `ConvexError("account_inactive_or_not_found")`.

---

### RB-08: Distributable Equity Formula (No Double-Deduction)
- **Preconditions:** `Balance(3010)` = 1,000,000 santims, Reserve = 100,000 santims. Available equity = 900,000 santims.
- **Input:** Owner reserves payout of 400,000 santims.
- **Expected Journal Postings:**
  - Debit `3010 Platform Commission Equity` = 400,000 santims.
  - Credit `2090 Owner Payouts Payable` = 400,000 santims.
- **Expected Business State:** `ownerPayouts` document created in status `"approved"`.
- **Expected Balance Changes:** `Balance(3010)` becomes 600,000; `Balance(2090)` becomes 400,000.
- **Expected Authorization Result:** Calculation of available equity post-reservation evaluates strictly to $600,000 - 100,000 = \mathbf{500,000 \text{ santims}}$. `Balance(2090)` is NOT subtracted a second time.
- **Failure Behavior:** If calculated available equity evaluates to 100,000 santims, the test fails.

---

### RB-09: Admin Payout Privilege Escalation Prevention
- **Preconditions:** Authenticated caller has role `"superadmin"` in `adminUsers`.
- **Input:** Caller invokes `requestOwnerPayout` or `authorizeOwnerPayout`.
- **Expected Journal Postings:** Zero rows inserted.
- **Expected Business State:** Unchanged.
- **Expected Balance Changes:** Zero.
- **Expected Authorization Result:** Access denied.
- **Failure Behavior:** Throws `ConvexError("unauthorized_not_owner")`.

---

### RB-10: Solvency Circuit Breaker Automatic Trip
- **Preconditions:** Cleared cash in bank = 500,000 santims. Total liabilities (`2010` + `2020` + `2030` + `2090`) = 600,000 santims.
- **Input:** Player attempts to invoke `lockMatchStake` for 5,000 santims.
- **Expected Journal Postings:** Zero rows inserted.
- **Expected Business State:** Match lock rejected.
- **Expected Balance Changes:** Zero.
- **Expected Authorization Result:** Authenticated player.
- **Failure Behavior:** Throws `ConvexError("circuit_breaker_active_insolvent")`.

---

### RB-11: Compromised Verify.et Fallback Key Eradication
- **Preconditions:** Environment variable `VERIFY_ET_API_KEY` is unset/undefined in Next.js runtime.
- **Input:** Caller invokes `getVerifyEtApiKey()`.
- **Expected Journal Postings:** N/A.
- **Expected Business State:** N/A.
- **Expected Balance Changes:** Zero.
- **Expected Authorization Result:** Fails closed.
- **Failure Behavior:** Throws `Error("system_misconfigured_missing_verify_et_api_key")`. Must NOT return any default string or hardcoded key.

---

### RB-12: Player Withdrawal KYC Name Matching
- **Preconditions:** Player KYC legal name is `"Abebe Bikila"`. Player destination account holder is `"Chala Tafa"`.
- **Input:** Player attempts `submitWithdrawalRequest`.
- **Expected Journal Postings:** Zero rows inserted.
- **Expected Business State:** Unchanged.
- **Expected Balance Changes:** Zero.
- **Expected Authorization Result:** Authenticated player.
- **Failure Behavior:** Throws `ConvexError("payout_destination_kyc_mismatch")`.

---

### RB-13: Tier 2 Deposit Is Not Cleared Cash
- **Preconditions:** Verify.et returns status `"completed"` for 1,000 ETB deposit. Bank statement has not yet cleared.
- **Input:** Mutation `autoCreditVerifyEt` executed.
- **Expected Journal Postings:**
  - Debit `1030 Provider Clearing / Deposit Receivable` = 100,000 santims.
  - Credit `2010 Player Available Deposits` = 100,000 santims.
- **Expected Business State:** Deposit marked `"verified_pending_clearing"`.
- **Expected Balance Changes:** `Balance(1030)` increases by 100,000. `Balance(1010 Cash - CBE)` remains 0!
- **Expected Authorization Result:** Verified server caller.
- **Failure Behavior:** If Account `1010` is debited at Tier 2, test fails immediately.

---

### RB-14: Tier 3 Deposit Clearing Moves Receivable to Cash
- **Preconditions:** Deposit was credited at Tier 2 (Receivable in `1030` = 100,000 santims). Official CBE bank statement confirms cleared funds.
- **Input:** Internal mutation `confirmDepositCleared` executed with bank credit statement reference.
- **Expected Journal Postings:**
  - Debit `1010 Cash - CBE Bank Account` = 100,000 santims.
  - Credit `1030 Provider Clearing / Deposit Receivable` = 100,000 santims.
- **Expected Business State:** Deposit status updated to `"cleared"`.
- **Expected Balance Changes:** `Balance(1030)` decreases to 0; `Balance(1010)` increases by 100,000 santims.
- **Expected Authorization Result:** Automated clearing worker or verified statement ingestion.
- **Failure Behavior:** Inability to clear receivable to cash without double-crediting player fails test.

---

### RB-15: Returned Withdrawal Uses Exact Reversal and Separate Wallet Restoration
- **Preconditions:** Withdrawal $W_1$ of 200,000 santims completed via `Debit 2030, Credit 1010`. External bank returns funds due to closed account.
- **Input:** Mutation `processReturnedWithdrawal` executed with bank return statement reference.
- **Expected Journal Postings (2 Atomic Transactions):**
  - Transaction 1 (Exact Reversal): Debit `1010 Cash - CBE` = 200,000 santims; Credit `2030 Player Pending Withdrawals` = 200,000 santims (`reversalOfTransactionId: W_1_settle_id`).
  - Transaction 2 (Business Wallet Restoration): Debit `2030 Player Pending Withdrawals` = 200,000 santims; Credit `2010 Player Available Deposits` = 200,000 santims.
- **Expected Business State:** Withdrawal marked `"returned"`. Player wallet available balance restored by 200,000 santims.
- **Expected Balance Changes:** `Balance(1010)` restored; `Balance(2030)` net zero change; `Balance(2010)` restored.
- **Expected Authorization Result:** Secondary verified bank statement proof.
- **Failure Behavior:** Directly crediting `2010` against `1010` in a single transaction without clearing `2030` fails test.

---

### RB-16: Returned Owner Payout Recorded as New Linked Compensating Event
- **Preconditions:** Owner payout $P_1$ of 500,000 santims completed via `Debit 2090, Credit 1010`. Bank returns funds.
- **Input:** Owner mutation `processReturnedOwnerPayout` executed with bank credit reference.
- **Expected Journal Postings:**
  - Step 1: Debit `1010 Cash - CBE` = 500,000; Credit `2090 Owner Payouts Payable` = 500,000 (`reversalOfTransactionId: P_1_settle_id`).
  - Step 2: Debit `2090 Owner Payouts Payable` = 500,000; Credit `3010 Platform Commission Equity` = 500,000.
- **Expected Business State:** Original payout $P_1$ remains `"completed"` in historical logs. New linked compensation record created.
- **Expected Balance Changes:** Cash and Retained Equity restored by 500,000 santims.
- **Expected Authorization Result:** Authenticated Owner only.
- **Failure Behavior:** Mutating the original completed payout document to `"failed"` fails test.

---

### RB-17: Owner Payout Limited by Eligible Cleared Cash Surplus
- **Preconditions:** Book Retained Equity (`3010`) = 1,000,000 santims. Cleared Cash in Bank (`1010`) = 800,000 santims. Player Liabilities (`2010` + `2020` + `2030`) = 700,000 santims. Operational Reserve = 50,000 santims.
- **Calculation:** Cleared cash surplus = $800,000 - 700,000 - 50,000 = \mathbf{50,000 \text{ santims}}$. Maximum distributable amount is $\min(1,000,000, 50,000) = \mathbf{50,000 \text{ santims}}$.
- **Input:** Owner attempts to reserve payout of 100,000 santims.
- **Expected Journal Postings:** Zero rows inserted.
- **Expected Business State:** Payout rejected.
- **Expected Balance Changes:** Zero.
- **Expected Authorization Result:** Authenticated Owner.
- **Failure Behavior:** Allowing a 100,000 santims payout when cleared cash surplus is only 50,000 santims fails test.

---

### RB-18: Payout Reservation Fails if Projected Solvency Below Threshold
- **Preconditions:** Cleared Cash = 1,000,000 santims. Total Liabilities = 950,000 santims. Current Solvency Ratio = 105.2%.
- **Input:** Owner attempts to reserve payout of 60,000 santims. Projected cash becomes 940,000 against 950,000 liabilities (projected solvency 98.9%).
- **Expected Journal Postings:** Zero rows inserted.
- **Expected Business State:** Payout rejected with `solvency_threshold_breach`.
- **Expected Balance Changes:** Zero.
- **Expected Authorization Result:** Authenticated Owner.
- **Failure Behavior:** Permitting payout reservation that causes projected solvency $< 100\%$ fails test.

---

### RB-19: Payout Destination Snapshot Cannot Change After Approval
- **Preconditions:** Owner payout $P_1$ approved with destination account `"1000723226426"`.
- **Input:** Owner updates global commission payout account in `ownerConfig` to `"093307470"`.
- **Expected Result:** Payout $P_1$ execution payload strictly retains original encrypted snapshot `"1000723226426"`.
- **Failure Behavior:** If $P_1$ dynamically reads the updated `ownerConfig` account, test fails.

---

### RB-20: Same Business Event with Different Idempotency Key Rejected
- **Preconditions:** Deposit $D_1$ with external reference `"CBE-FT99988"` already credited.
- **Input:** Submitting new deposit credit request with same external reference `"CBE-FT99988"` but new `idempotencyKey: "idem_fresh_key"`.
- **Expected Result:** Rejected with `ConvexError("deposit_reference_already_credited")`. Zero secondary credit.
- **Failure Behavior:** Crediting the same reference twice due to differing idempotency keys fails test.

---

### RB-21: Account 3999 Cannot Conceal Unexplained Opening Balance Variance
- **Preconditions:** Pre-cutover reconstruction calculates unexplained cash deficit of 200,000 santims.
- **Input:** Attempting to complete cutover and enable live withdrawals without documented Owner variance sign-off.
- **Expected Result:** Cutover verification script fails closed; live writes remain locked.
- **Failure Behavior:** Proceeding to live status with unbacked debit deficit in Account `3999` fails test.

---

### RB-22: Stale Reconciliation Data Blocks Unsafe Payout or Circuit Reset
- **Preconditions:** Latest reconciliation in `reconciliations` is 30 hours old (> 24h threshold).
- **Input:** Owner attempts to execute `requestOwnerPayout` or `resetCircuitBreaker`.
- **Expected Result:** Operation blocked with `ConvexError("stale_reconciliation_data_fresh_statement_required")`.
- **Failure Behavior:** Allowing financial distribution on stale statement data fails test.

---

### RB-23: Stale Queued Financial Event Rejected During Replay
- **Preconditions:** Maintenance write-freeze lifts. Queue worker picks up event $Q_1$ (challenge stake lock) created 4 hours ago. In the meantime, the challenging player spent their balance on another match.
- **Input:** Worker executes pre-replay revalidation.
- **Expected Result:** Insufficient funds detected; $Q_1$ quarantined to `"dead_letter"` with `stale_insufficient_funds`. Zero unbacked stake locked.
- **Failure Behavior:** Blindly executing the stale stake lock and creating a negative balance fails test.

---

### RB-24: Interrupted Owner Identity Rotation Has Safe Recovery Path
- **Preconditions:** Stage 1 rotation executed (`pendingOwnerClerkId: "user_new"`). Environment variable `OWNER_CLERK_ID` updated, but the new Owner Clerk account is suspended before confirmation.
- **Input:** Deployment administrator executes CLI emergency recovery script `npx convex run scripts/recoverOwner:execute '{ "forceOwnerClerkId": "user_fallback" }'`.
- **Expected Result:** System verifies deployment admin credentials, resets pending state, promotes `"user_fallback"`, and logs recovery in `financialAuditLogs`.
- **Failure Behavior:** Permanent lockout of the platform fails test.

---

### RB-25: Concurrent Queue Workers Respect Scoped Ordering Guarantee
- **Preconditions:** Two events for the same game $G_1$ are queued: Move Stake Lock ($E_1$) followed by Match Settlement ($E_2$).
- **Input:** Worker 1 and Worker 2 concurrently poll the queue.
- **Expected Result:** Worker 1 acquires lease on $E_1$. $E_2$ cannot be claimed until $E_1$ commits. $E_1$ is processed strictly before $E_2$.
- **Failure Behavior:** Out-of-order execution (settling pot before stake is locked) fails test.

---

### RB-26: Journal Integrity Verification Detects Unauthorized Modifications
- **Preconditions:** Mock mutation directly tampers with a journal row (simulating corrupted state).
- **Input:** Internal audit query `verifyLedgerIntegrity` executes.
- **Expected Result:** Integrity check computes trial balance and hash chain, detects mismatch, and raises immediate high-severity security alert.
- **Failure Behavior:** Failure to detect ledger mismatch fails test.

---

### RB-27: Receipt-Only Evidence Cannot Complete an External Payout
- **Preconditions:** Withdrawal is in status `"evidence_submitted"` with receipt image uploaded.
- **Input:** Admin attempts to execute `completeWithdrawal` without providing external bank statement credit confirmation.
- **Expected Result:** Mutation fails closed with `ConvexError("authoritative_statement_confirmation_required")`.
- **Failure Behavior:** Completing payout on image upload alone fails test.

---

### RB-28: Duplicate Revenue Closing Is Rejected
- **Preconditions:** Period ending $T_1$ was closed via `revenue_closing` transaction $J_1$.
- **Input:** Attempting to execute `closeAccountingPeriod` for same period $T_1$ again.
- **Expected Result:** Mutation returns idempotent acknowledgement without generating redundant zero-amount closing journal transactions.
- **Failure Behavior:** Generating duplicate closing lines fails test.

---

## 3. OPERATIONAL & CONCURRENCY TEST SUITE (OP-01 THROUGH OP-08)

| Test ID | Scenario | Preconditions | Input | Expected Outcome |
| :--- | :--- | :--- | :--- | :--- |
| **OP-01** | OCC Concurrent Idempotency Replay | Two identical deposit requests hit Convex simultaneously. | Same payload and `idempotencyKey`. | First commits; second hits OCC retry, reads index, and returns existing ID. Exactly one journal entry. |
| **OP-02** | Staged Owner Identity Rotation | Normal Owner rotation. | Current Owner proposes; env updated; New Owner confirms. | Clean handoff; audit log created; old owner loses authority. |
| **OP-03** | Queue Worker Crash Recovery | Worker 1 crashes while holding lease on queue item. | Worker lease expires after 60s. | Worker 2 reclaims expired lease; processes item cleanly. |
| **OP-04** | Revenue Closing Under Match Concurrency | Live matches conclude while `closeAccountingPeriod` runs. | Concurrently ending games. | Completed games post to current/next period; zero double-closed entries. |
| **OP-05** | PII Access Separation | Admin without `withdrawals.reveal_pii` reviews withdrawal. | Admin opens request. | Destination account displayed as `"******2642"`. Full account access denied. |
| **OP-06** | Account 3999 Variance Tracking | Baseline cutover with historical surplus. | Reconstructed assets exceed liabilities. | Account `3999` credited with surplus; trial balance balances $\sum D == \sum C$. |
| **OP-07** | Circuit Breaker Stale Statement Block | Bank statement is 25 hours old. | Fresh withdrawal request submitted. | Blocked until fresh bank statement reconciliation is ingested. |
| **OP-08** | Dead-Letter Queue Escalation | Queue item fails 5 consecutive retries. | Erroneous payload in queue. | Item marked `"dead_letter"`; alerts dispatched; queue unblocked. |

---
*End of Master Acceptance Test Matrix (v4.2.6-PROD)*
