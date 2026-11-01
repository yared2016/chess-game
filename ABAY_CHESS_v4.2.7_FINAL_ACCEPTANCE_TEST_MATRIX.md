# ABAY CHESS — v4.2.7-PROD
## Final Production Acceptance Test Matrix (RB-01 to RB-70, RB-69.1, RB-69.2, OP-01 to OP-08)

**Document Version:** 4.2.7-PROD  
**Document Type:** Master Verification, Rollback, Security & Concurrency Test Protocol  
**Scope:** Complete Validation of 17 Canonical Accounts, 14 Database Tables, Invariants, Solvency, Tariffs, and 9-Phase Withdrawal Lifecycle  
**Status:** PENDING OWNER APPROVAL — **STRICT NO-IMPLEMENTATION PHASE**  
**Repository Basis:** `Castle-3d-multiplayer-with-ai-vercel-eve-nextjs-clerk-main` (Commit `06acb94b8111b6bcaed8291f781aa9b41bc102ac`)  
**Deployment Target:** `qualified-greyhound-151`  

---

## 1. TEST FRAMEWORK & METHODOLOGY

This matrix establishes the definitive acceptance criteria for Abay Chess v4.2.7-PROD. Every critical financial path, concurrency race condition, security boundary, tariff calculation, and lifecycle transition is verified by a dedicated test case.

### 1.1 Mandatory Test Structure
Every test case in this specification contains eight structured dimensions:
1. **Initial State:** System conditions, balances, and database records prior to execution.
2. **Input / Action:** Mutation arguments, user actions, or simulated events.
3. **Expected Business Behavior:** High-level platform outcome.
4. **Expected Financial Journal Entries:** Exact double-entry debits and credits in integer santims across the **17 Canonical Accounts**.
5. **Expected Player-Visible Behavior:** UI text, notices, and displayed wallet numbers.
6. **Expected Authorization Behavior:** Permission enforcement and role validation.
7. **Expected Audit Record:** Immutable log entry generated in `auditLogs`.
8. **Failure Behavior:** Exception type, transaction rollback, and cleanup behavior on violation.

---

## 2. ROLLBACK & FINANCIAL INVARIANT TESTS (RB-01 THROUGH RB-28)

- **RB-01 (Balanced Postings Invariant):** Any mutation attempting to insert journal postings where $\sum \text{Debits} \ne \sum \text{Credits}$ aborts with `transaction-unbalanced`. Zero records written.
- **RB-02 (Strictly Positive Integer Santims):** Postings with negative, zero, or fractional amounts fail schema validation (`invalid-amount-santims`).
- **RB-03 (Idempotency Key Collision):** Submitting a duplicate `idempotencyKey` returns the existing transaction header and skips posting re-execution.
- **RB-04 (Single-Mutation ACID Atomicity):** Simulated failure during multi-line posting causes complete rollback of all journal lines and balance patches.
- **RB-05 (Normal Win Settlement Rake):** Total pot 200.00 ETB (20,000 s.). Debit Escrow 20,000 s.; Credit Winner 18,000 s.; Credit Commission (4010) 2,000 s. (10% rake).
- **RB-06 (Organic Draw Full Refund):** Total pot 200.00 ETB. Stalemate ends match. Debit Escrow 20,000 s.; Credit White 10,000 s.; Credit Black 10,000 s. 0% commission.
- **RB-07 (Mutual Accepted Draw Deduction — BLOCKED Pending OD-09):** Total pot 200.00 ETB. Players agree draw. Under Alternative 1 (5% pot rake): Debit Escrow 20,000 s.; Credit White 9,500 s.; Credit Black 9,500 s.; Credit Commission (4010) 1,000 s. Under Alternative 2 (2.5% pot rake): Credit White 9,750 s.; Credit Black 9,750 s.; Credit Commission 500 s. Execution blocked until Owner ratifies OD-09; fallback is 100% refund (RB-06).
- **RB-08 (Double-Spend Rapid Result Claims):** Concurrent result claims on the same match execute only once; second claim fails due to `game.escrowSettled == true`.
- **RB-09 (Stake Escrow Under-Lock Prevention):** Player with 50 ETB attempting to join 100 ETB match fails with `insufficient-available-funds`.
- **RB-10 (Player Escrow Concurrency):** Rapid successive match joins lock funds sequentially; player balance cannot become negative.
- **RB-11 (Withdrawal Reservation Lock):** Requesting 1,000 ETB net with 4 ETB fee moves 100,400 santims from `availableSantims` to `2030` (100,000 s.) and `2040` (400 s.).
- **RB-12 (Withdrawal Disbursement Execution):** Successful bank transfer debits `2030 Withdrawal Payable` (100,000 s.), debits `2040 Provider Fees Payable` (400 s.), and credits `1020 Telebirr Account` (100,400 s.).
- **RB-13 (4-Tier Deposit: Tier 2 Provider Verification):** Verify.et success debits `1030 Provider Clearing` and credits `2010 Player Deposits`.
- **RB-14 (4-Tier Deposit: Tier 3 Bank Statement Settlement):** Bank feed confirmation debits `1010 CBE Bank Account` and credits `1030 Provider Clearing`.
- **RB-15 (Provider Clearing Exclusion from Solvency):** Account 1030 is excluded from the solvency numerator ($\text{Eligible Cleared Cash} / \text{Total Obligations}$).
- **RB-16 (Deposit Reference Replay Prevention):** Submitting an already credited Verify.et reference returns `already-credited` without double-crediting wallet.
- **RB-17 (Two-Step Withdrawal Reversal):** Failed transfer returned by bank executes Step 1 (Debit Cash 1010/1020, Credit Payable 2030) and Step 2 (Debit Payable 2030, Credit Player 2010).
- **RB-18 (Withdrawal Rejection Before Transfer):** Rejection before bank transfer releases `2030` and `2040` back to `2010` with zero cash movement.
- **RB-19 (Concurrent Match Play During Withdrawal):** Player with 1,000 ETB requesting 800 ETB withdrawal can only stake up to 200 ETB in active matches.
- **RB-20 (Withdrawal Exceeding Available Balance):** System rejects withdrawal requests exceeding `availableSantims` even if total equity is higher.
- **RB-21 (Distributable Cash Cap Enforcement & 105% Solvency):** Owner payout cannot exceed $\mathbf{DistributableCap} = \max(0, \min(\text{BookEquity}, \text{EligibleCashSurplus}))$, where $\text{EligibleCashSurplus} = \max(0, C_{\text{eligible}} - \lceil 105 \times \mathcal{L}_{\text{total}} / 100 \rceil - \text{OperatingBuffer})$. $\text{PendingCommitments}$ counts only unposted queue items (`postedTransactionId == null`), strictly preventing double-counting.
- **RB-22 (Post-Payout Solvency Safety Floor):** Owner payout authorization fails with `ERR_SOLVENCY_BREACH` if projected post-payout cleared cash coverage falls below 105%.
- **RB-23 (Authoritative Bank Confirmation Before Payout Completion):** Owner payout cannot move from `externally_confirmed` to `completed` without verified bank statement reference. Receipt image upload is supporting evidence only.
- **RB-24 (Multi-Admin Authorization Lockout):** Staff members with `admin` role cannot authorize or execute owner profit distributions.
- **RB-25 (Scoped FIFO Durable Queue Ordering):** Async settlement tasks for the same `scopeKey` execute strictly sequentially.
- **RB-26 (Lease Lock Expiration & Zombie Recovery):** If worker crashes, lease expires after 30 seconds (`leaseExpiresAt`) and another worker safely reclaims the task.
- **RB-27 (Pre-Replay State Revalidation):** Queue retry checks underlying entity state; if match is already settled, task completes without re-posting.
- **RB-28 (Dead-Letter Queue Routing):** Task failing 5 retries moves to `dead_letter` status and triggers an administrative incident alert.

---

## 3. HISTORICAL AUDIT & EDGE CASE TESTS (RB-29 THROUGH RB-44)

### RB-29: Email Matching Alone Cannot Bootstrap Owner
- **Initial State:** System has no registered Owner in `systemConfig`.
- **Input:** User with email `yaredusk@gmail.com` logs in with arbitrary Clerk Subject ID `user_unauthorized999` and calls `bootstrapOwner()`.
- **Expected Business Behavior:** Bootstrap mutation is rejected. Email matching alone is strictly insufficient.
- **Expected Authorization Behavior:** Fails with `owner-bootstrap-unauthorized`.
- **Expected Audit Record:** Security alert logged: `unauthorized_bootstrap_attempt`.
- **Failure Behavior:** No Owner assigned; system configuration untouched.

### RB-30: Concurrent Owner Bootstrap Race Condition
- **Initial State:** System configuration has no Owner record.
- **Input:** Two identical concurrent bootstrap requests arrive simultaneously from authorized deployment identity.
- **Expected Business Behavior:** Only the first mutation writes `owner_identity`; second transaction aborts with idempotency conflict.
- **Failure Behavior:** Database guarantees exactly one Owner record; no duplicate or split identity.

### RB-31: Dynamic Liability Discovery in Solvency Calculation
- **Initial State:** A new liability account (`2040 Provider Fees Payable`) exists in the chart of accounts.
- **Input:** Solvency calculation mutation is executed.
- **Expected Business Behavior:** Solvency engine dynamically scans all accounts where `category == "liability"` and `isActive == true` and sums them into the denominator.
- **Expected Financial Formula:**
  $$\text{Total Obligations} = \sum_{a \in \mathcal{L}} \text{CreditBalance}(a) + \text{PendingObligations}$$
- **Failure Behavior:** Hardcoded account list is prohibited; no liability account can be omitted from solvency obligations.

### RB-32: Restricted Cash Exclusion from Solvency Numerator
- **Initial State:** Platform holds 100,000 ETB in CBE, of which 20,000 ETB is collateralized or frozen by bank dispute.
- **Input:** System evaluates eligible cleared cash.
- **Expected Business Behavior:** Restricted funds are subtracted from the solvency numerator.
- **Expected Financial Formula:** Eligible Cash = $100,000 - 20,000 = 80,000$ ETB.

### RB-33: Deposit Chargeback After Funds Expended in Matches
- **Initial State:** Player A deposits 1,000 ETB (Tier 2 verified). Player A stakes 1,000 ETB and loses to Player B. Provider subsequently issues a chargeback.
- **Input:** Provider sends chargeback notice for deposit `dep_123`.
- **Expected Business Behavior:** Chargeback creates a negative balance / recovery liability on Player A's account. Player B's legitimate winnings are untouched. Player A's account is suspended until deficit is reimbursed.
- **Expected Journal Entries:**
  * Debit `3999 Historical Discrepancy / Chargeback Loss`: 100,000 s.
  * Credit `1030 Provider Clearing`: 100,000 s.
  * Subledger memo: Player A balance = $-1,000.00$ ETB.

### RB-34: Pre-Settlement Rejected Transfer Cash Non-Reversal
- **Initial State:** Withdrawal `wd_456` of 500 ETB net + 2 ETB fee is in `processing` status. External bank rejects transfer before cash leaves platform account.
- **Input:** Admin marks transfer as failed due to invalid recipient account number.
- **Expected Business Behavior:** Reserved funds return to player available balance. **Zero cash ledger postings are created**, because cash never left Account 1010/1020.
- **Expected Journal Entries:**
  * Debit `2030 Withdrawal Payable`: 50,000 s.
  * Debit `2040 Provider Fees Payable`: 200 s.
  * Credit `2010 Player Available Deposits`: 50,200 s.
- **Failure Behavior:** Posting a credit to Account 1010/1020 for unspent money is strictly prohibited.

### RB-35: Returned Completed Transfer Linked Reversal
- **Initial State:** Withdrawal `wd_789` was executed (cash disbursed from 1020). 48 hours later, recipient bank returns the funds as unroutable.
- **Input:** Statement feed shows returned disbursement of 1,000 ETB for `wd_789`.
- **Expected Business Behavior:** Two-step canonical reversal executed. Step 1 recognizes returned bank cash into payable; Step 2 restores player wallet.
- **Expected Journal Entries:**
  * Step 1: Debit `1020 Telebirr Cash`: 100,000 s.; Credit `2030 Withdrawal Payable`: 100,000 s.
  * Step 2: Debit `2030 Withdrawal Payable`: 100,000 s.; Credit `2010 Player Deposits`: 100,000 s.

### RB-36: Immutable Journal Record Update Rejection
- **Initial State:** Journal transaction `tx_100` exists in `journalTransactions`.
- **Input:** A rogue or buggy mutation calls `ctx.db.patch(tx_100._id, { totalAmountSantims: 9999 })`.
- **Expected Business Behavior:** Convex validator or schema interceptor rejects update. Journal entries are strictly append-only.
- **Failure Behavior:** Error `journal-transactions-immutable` thrown.

### RB-37: Periodic Revenue Closing into Retained Earnings
- **Initial State:** Account 4010 (Platform Commission) has a credit balance of 50,000 santims (500 ETB) at end of accounting period.
- **Input:** Owner executes period close mutation `closeRevenuePeriod(periodId)`.
- **Expected Business Behavior:** Balance of 4010 transfers to 3010 (Retained Platform Earnings). Account 4010 resets to zero.
- **Expected Journal Entries:**
  * Debit `4010 Platform Commission Revenue`: 50,000 s.
  * Credit `3010 Retained Platform Earnings`: 50,000 s.

### RB-38: Duplicate Active Payment Destination Prevention
- **Initial State:** CBE Account `1000723226426` is active for channel `cbe_account`.
- **Input:** Admin attempts to activate a second receiving destination for `cbe_account`.
- **Expected Business Behavior:** System rejects creation with `conflicting-active-destination`. Exactly one active receiving destination is permitted per channel.

### RB-39: Expired Queue Lease Worker Commit Prevention
- **Initial State:** Worker A claims task `tsk_1` with lease expiring at $T_1$. Worker A hangs for 45 seconds; lease expires. Worker B claims `tsk_1` at $T_2$.
- **Input:** Worker A wakes up and attempts to commit result.
- **Expected Business Behavior:** Worker A's commit is fenced off and rejected with `lease-expired`. Worker B's result commits safely.
- **Failure Behavior:** Zero duplicate settlements.

### RB-40: Dual-Write Interruption Desynchronization Prevention
- **Initial State:** Cutover Phase 2 (Dual-Writing active).
- **Input:** Transaction succeeds on legacy table but network timeout interrupts general ledger write.
- **Expected Business Behavior:** Transaction is wrapped in a single Convex ACID boundary; failure of either side rolls back the entire operation.
- **Failure Behavior:** Legacy and General Ledger cannot drift out of sync.

### RB-41: Owner Destination Change Snapshot Isolation
- **Initial State:** Owner has payout `payout_001` in `escrowed` status with bank destination `CBE-1000...`.
- **Input:** Owner updates personal bank account in settings to `Telebirr-0933...`.
- **Expected Business Behavior:** Existing payout `payout_001` preserves its immutable destination snapshot (`CBE-1000...`). Only future payouts use the new destination.

### RB-42: Encryption Key Rotation Historical Decryption
- **Initial State:** 100 player bank accounts encrypted with Key Version 1 (`INTERNAL_SERVICE_SECRET_V1`).
- **Input:** Key rotated to Version 2. New records encrypted with V2.
- **Expected Business Behavior:** Decryption helper dynamically inspects `keyVersion` tag and uses V1 key for legacy records and V2 key for new records.
- **Failure Behavior:** Historical records remain decryptable by authorized staff.

### RB-43: Stale Reconciliation Blocks Owner Payout
- **Initial State:** Daily bank reconciliation has not been completed for $> 48$ hours.
- **Input:** Owner attempts to authorize profit payout.
- **Expected Business Behavior:** Authorization rejected with `reconciliation-data-stale`. Owner payouts require active, verified daily reconciliation.

### RB-44: Organic Draw Existing Code Baseline Preservation
- **Initial State:** Match ends in organic draw (50-move rule).
- **Input:** `finalizeGame` called with `end.winner === "draw"`.
- **Expected Business Behavior:** Both players receive 100% refund of their original stakes; platform commission is 0 ETB. Existing code behavior preserved.

---

## 4. WITHDRAWAL & SERVICE FEE ACCEPTANCE TESTS (RB-45 THROUGH RB-68)

### RB-45: Net Withdrawal Guarantee (1,000 ETB Request)
- **Initial State:** Player A has 2,000.00 ETB available balance. Selected route is Telebirr P2P (`telebirr_p2p`).
- **Input:** Player enters withdrawal amount: **1,000.00 ETB** (100,000 santims).
- **Expected Business Behavior:**
  * Player requested amount: 1,000.00 ETB.
  * Verified provider fee (Telebirr P2P tier $501 - 1,500$ ETB): **4.00 ETB** (400 santims).
  * Total wallet deduction: **1,004.00 ETB** (100,400 santims).
  * Net amount player receives in Telebirr: **1,000.00 ETB** (100,000 santims).
  * Abay Chess platform revenue: **0.00 ETB**.
- **Expected Player-Visible Breakdown:** Display shows 1,000.00 ETB net received, 4.00 ETB provider fee, 1,004.00 ETB deducted.
- **Expected Financial Postings (on execution):**
  * Debit `2030 Withdrawal Payable`: 100,000 s. (Player Net)
  * Debit `2040 Provider Fees Payable`: 400 s. (Provider Fee)
  * Credit `1020 Telebirr Account`: 100,400 s. (Disbursement + Provider Fee)
- **Failure Behavior:** Deducting fee from the 1,000 ETB payout is strictly prohibited.

### RB-46: Route-Specific Tariff Calculation (Telebirr P2P vs CBE Account Active Tier)
- **Initial State:** Player initiates withdrawal request.
- **Input:**
  * Case A: 500.00 ETB via Telebirr P2P (`telebirr_p2p`, Band 2: $101 - 500$ ETB).
  * Case B: 1,500.00 ETB via CBE Account-to-Account (`cbe_to_cbe`, Band 2: $1,001 - 5,000$ ETB).
- **Expected Business Behavior:**
  * Case A (Telebirr): Provider fee is **2.00 ETB** (200 s.). Total deduction = **502.00 ETB** (50,200 s.). Player receives exactly 500.00 ETB.
  * Case B (CBE Account): Provider fee is 1.00 ETB base + 15% VAT = **1.15 ETB** (115 s.). Total deduction = **1,501.15 ETB** (150,115 s.). Player receives exactly 1,500.00 ETB.
- **Failure Behavior:** Applying a flat universal fee or incorrect VAT multiplier across different providers is prohibited.

### RB-46.1: CBE Fractional Santim Quarantine Circuit Breaker
- **Initial State:** Player attempts 500.00 ETB withdrawal via CBE Account-to-Account (`cbe_to_cbe`, Band 1: $1.00 - 1,000.00$ ETB).
- **Input:** Tariff engine evaluates Band 1 (0.50 ETB base + 15% VAT = 0.575 ETB / 57.5 santims).
- **Expected Business Behavior:** Since 0.575 ETB cannot be rounded to 58 santims without physical CBS statement voucher proof, Band 1 is marked `FRACTIONAL_SANTIM_QUARANTINED`. Automated quotation is blocked with `ERR_TARIFF_FRACTIONAL_QUARANTINED`, and the request is held for manual compliance processing.
- **Failure Behavior:** Silently rounding 57.5 santims up to 58 santims or down to 57 santims without empirical proof is strictly prohibited.

### RB-46.2: Telebirr Documented Boundary Gap Quarantine Circuit Breaker
- **Initial State:** Player attempts 100.00 ETB withdrawal via Telebirr P2P (`telebirr_p2p`).
- **Input:** Tariff engine evaluates amount $A = 10,000\text{ santims}$ ($100.00\text{ ETB}$).
- **Expected Business Behavior:** Official Ethio Telecom documentation states `< 100` and `101–500`. The range $[100.00, 100.99\text{ ETB}]$ ($10,000 - 10,099\text{ santims}$) is quarantined as `UNRESOLVED_BOUNDARY_QUARANTINED`. System returns `ERR_TARIFF_BOUNDARY_QUARANTINED` and halts automated quoting until official provider clarification is received.

### RB-47: CBE Mobile Banking Statutory Tax Calculation (15% VAT Reconciliation)
- **Initial State:** Player requests 2,000.00 ETB withdrawal to CBE Account.
- **Input:** Tariff engine evaluates CBE Account-to-Account tier ($1,001 - 5,000$ ETB).
- **Expected Business Behavior:**
  * Base service commission: 1.00 ETB (100 santims).
  * 15% VAT (VAT Proclamation No. 1341/2024): 0.15 ETB (15 santims).
  * Statutory multiplier applied: $1.15$ (Universal 20% multiplier revoked).
  * Total Provider Fee: **1.15 ETB** (115 santims).
  * Total Wallet Deduction: **2,001.15 ETB** (200,115 santims).
  * Player Receives: Exactly **2,000.00 ETB** (200,000 santims).

### RB-48: CBE Mobile Banking to External Wallet (CBE $\rightarrow$ Telebirr)
- **Initial State:** Player requests 5,000.00 ETB withdrawal via CBE transfer to Telebirr wallet (`cbe_to_telebirr`).
- **Input:** Tariff engine evaluates CBE-to-Wallet tier ($1 - 10,000$ ETB).
- **Expected Business Behavior:**
  * Base fee: 10.00 ETB (1,000 santims).
  * 15% VAT: 1.50 ETB (150 santims).
  * Total Provider Fee: **11.50 ETB** (1,150 santims) (instead of obsolete 12.00 ETB).
  * Total Wallet Deduction: **5,011.50 ETB** (501,150 santims). Player receives exactly 5,000.00 ETB.

### RB-49: CBE Birr Unverified Route Circuit Breaker
- **Initial State:** Player attempts to select CBE Birr for withdrawal destination.
- **Input:** Player submits withdrawal form with destination channel `cbe_birr`.
- **Expected Business Behavior:** System rejects request with `payment-channel-disabled`. UI displays message: *"CBE Birr withdrawals are temporarily unavailable. Please choose CBE Bank Account or Telebirr."*
- **Failure Behavior:** Executing withdrawal on unverified tariff is strictly prohibited.

### RB-50: Tariff Versioning Effective-Date Isolation
- **Initial State:** Telebirr tariff Version 1 is active (effective until Nov 15). Version 2 (new tariff) is created with `effectiveFrom = Nov 16`.
- **Input:**
  * Case A: Withdrawal submitted on Nov 10.
  * Case B: Withdrawal submitted on Nov 17.
- **Expected Business Behavior:**
  * Case A calculates fee using Version 1.
  * Case B calculates fee using Version 2.
- **Failure Behavior:** Tariff changes cannot retroactively affect earlier calculations.

### RB-51: Confirmed Pending Withdrawal Tariff Snapshot Immutability
- **Initial State:** Player confirms 1,000 ETB withdrawal under Tariff V1 (fee: 4.00 ETB). Withdrawal enters `processing`.
- **Input:** Provider announces immediate fee hike to 10.00 ETB; Admin updates `providerTariffs` to V2.
- **Expected Business Behavior:** Player's pending withdrawal executes under snapshot terms: total deduction remains 1,004.00 ETB. Platform absorbs difference if bank debits higher fee, posting offset to `5010 Provider Processing Fees`.
- **Failure Behavior:** Pending withdrawal cannot silently deduct additional funds from player wallet.

### RB-52: Pre-Confirmation Mandatory Fee Disclosure
- **Initial State:** Player enters 500 ETB on `/wallet` withdrawal modal.
- **Input:** Player has not yet clicked "Confirm Withdrawal".
- **Expected Player-Visible Behavior:** Screen clearly displays:
  ```
  WITHDRAWAL AMOUNT: 500.00 ETB
  Selected Provider: Telebirr
  Provider Service Fee: 2.00 ETB
  TOTAL WALLET DEDUCTION: 502.00 ETB
  YOU WILL RECEIVE: 500.00 ETB
  ABAY CHESS WITHDRAWAL REVENUE: 0.00 ETB
  ```
  Accompanied by the mandatory service-fee disclosure notice.

### RB-53: Zero Platform Fee Markup Enforcement
- **Initial State:** Provider tariff charges 4.00 ETB for transfer.
- **Input:** Verification audit reviews database record.
- **Expected Business Behavior:** Fee charged to player is exactly 4.00 ETB. Markups, spreads, or rounding increments are strictly zero.

### RB-54: Accurate Deposit Fee Disclosure (Zero Platform Deposit Fee)
- **Initial State:** Player initiates 500 ETB deposit via CBE.
- **Input:** Player views deposit instructions.
- **Expected Business Behavior:** Screen states: *"Abay Chess charges 0 ETB deposit fee. You will receive 500.00 ETB in your wallet. Any transfer fees charged by your bank are paid directly to your bank."*

### RB-55: General Ledger Deposit Revenue Isolation
- **Initial State:** 10,000 ETB in deposits processed through Verify.et.
- **Input:** Financial auditor inspects Account 4010 (Platform Commission).
- **Expected Business Behavior:** Deposits contribute **0 santims** to Account 4010. Balance of 4010 reflects only game commissions.

### RB-56: General Ledger Withdrawal Revenue Isolation
- **Initial State:** 20,000 ETB in withdrawals processed.
- **Input:** Financial auditor inspects revenue accounts.
- **Expected Business Behavior:** Withdrawals contribute **0 santims** to Account 4010. Withdrawal fees are passed through to 2040 and cleared against bank disbursements.

### RB-57: Provider Fees Never Classified as Platform Revenue
- **Initial State:** Player pays 4.00 ETB provider fee on withdrawal.
- **Input:** General ledger journal transaction is posted.
- **Expected Journal Entries:**
  * Debit `2010 Player Deposits`: 100,400 s.
  * Credit `2030 Withdrawal Payable`: 100,000 s.
  * Credit `2040 Provider Fees Payable`: 400 s.
- **Failure Behavior:** Crediting 400 santims to Account 4010 is strictly prohibited.

### RB-58: Provider Fee Pass-Through Accounting Balance Invariant
- **Initial State:** Withdrawal `wd_101` executed.
- **Input:** Bank executes transfer and deducts 4.00 ETB fee.
- **Expected Journal Entries:**
  * Debit `2030 Withdrawal Payable`: 100,000 s.
  * Debit `2040 Provider Fees Payable`: 400 s.
  * Credit `1020 Telebirr Account`: 100,400 s.
- **Verification:** Total Debits (100,400 s.) $\equiv$ Total Credits (100,400 s.). Account 2040 clears to zero.

### RB-59: Complex Tariff Tiering (Fixed + Percentage + Cap)
- **Initial State:** A provider introduces a hybrid tariff: 1% fee with minimum 2 ETB and maximum 25 ETB.
- **Input:**
  * Case A: Withdrawal of 100 ETB (1% = 1 ETB) $\rightarrow$ Fee clamped to minimum **2.00 ETB**.
  * Case B: Withdrawal of 1,000 ETB (1% = 10 ETB) $\rightarrow$ Fee is **10.00 ETB**.
  * Case C: Withdrawal of 5,000 ETB (1% = 50 ETB) $\rightarrow$ Fee clamped to maximum **25.00 ETB**.
- **Expected Business Behavior:** Tariff engine evaluates mathematical boundary constraints correctly.

### RB-60: Expired Tariff Circuit Breaker
- **Initial State:** Provider tariff has `effectiveUntil = 2026-11-01T00:00:00Z`. Current time is `2026-11-01T12:00:00Z`. No new tariff has been approved.
- **Input:** Player requests withdrawal.
- **Expected Business Behavior:** Withdrawal confirmation blocked with `tariff-expired`. Alert dispatched to Admin/Owner.

### RB-61: Versioned Tariff Audit History Protection
- **Initial State:** Tariff record `trf_telebirr_p2p_v1` exists in `providerTariffs`.
- **Input:** Admin updates tariff for Telebirr.
- **Expected Business Behavior:** System inserts new record `trf_telebirr_p2p_v2` with updated timestamp and sets `effectiveUntil` on V1. V1 record is never overwritten or deleted.

### RB-62: Failed Withdrawal Fee Reservation Release
- **Initial State:** Withdrawal requested: 1,000 ETB payout + 4.00 ETB fee (total reserved: 1,004.00 ETB).
- **Input:** Withdrawal is rejected by compliance admin before transfer.
- **Expected Business Behavior:** Entire 1,004.00 ETB (payout + fee) returns to player's `availableSantims`.
- **Expected Journal Entries:**
  * Debit `2030 Withdrawal Payable`: 100,000 s.
  * Debit `2040 Provider Fees Payable`: 400 s.
  * Credit `2010 Player Available Deposits`: 100,400 s.

### RB-63: Returned Completed Withdrawal Fee Settlement (Two-Step Reversal)
- **Initial State:** Withdrawal executed (1,000 ETB net + 4 ETB provider fee disbursed from bank). Transfer later bounces back to platform bank account. Bank does not refund the 4 ETB service fee.
- **Input:** Admin reconciles returned transfer of 1,000 ETB.
- **Expected Business Behavior:** Player's 1,000 ETB net deposit is restored via canonical two-step reversal. The 4 ETB non-refundable banking fee was already settled; any additional bank bounce penalty is absorbed into `5010 Provider Processing Fees`.
- **Expected Journal Entries:**
  * Step 1 (Cash Inward Recovery): Debit `1020 Telebirr Cash` 100,000 s., Credit `2030 Withdrawal Payable` 100,000 s.
  * Step 2 (Wallet Liability Re-credit): Debit `2030 Withdrawal Payable` 100,000 s., Credit `2010 Player Available Deposits` 100,000 s.
  * If unrefunded return penalty assessed: Debit `5010 Provider Processing Fees (Expense)` $R$, Credit `1020 Telebirr Cash` $R$.

### RB-64: Player Confirmation Snapshot Audit Trail
- **Initial State:** Player clicks "Confirm Withdrawal".
- **Input:** Mutation `confirmWithdrawal` executes.
- **Expected Audit Record:** Record created in `auditLogs` capturing `userId`, `amountSantims`, `feeSantims`, `tariffId`, `tariffVersion`, `routeId`, and `timestamp`.

### RB-65: Platform Revenue Report Purity
- **Initial State:** Accounting period generated.
- **Input:** Owner pulls monthly financial profit report.
- **Expected Business Behavior:** Net revenue equals exactly $\sum \text{Game Commissions}$. Deposit fees = 0 ETB, withdrawal revenue = 0 ETB.

### RB-66: Owner Payout Eligibility Excludes Provider Clearing and Restricted Cash
- **Initial State:**
  * Cash in CBE (1010): 50,000 ETB.
  * Provider Clearing (1030): 20,000 ETB (unsettled deposits).
  * Player Liabilities (2010): 40,000 ETB.
  * Retained Earnings (3010): 30,000 ETB.
- **Input:** Owner requests maximum distributable payout.
- **Expected Business Behavior:**
  * Book Equity = 30,000 ETB.
  * Eligible Cleared Cash Surplus = $50,000 - 40,000 = 10,000$ ETB (Clearing 1030 excluded!).
  * Distributable Cash Cap = **10,000.00 ETB**.
- **Failure Behavior:** Allowing Owner to withdraw 30,000 ETB based on book equity while cash is only 10,000 ETB is strictly blocked.

### RB-67: Provider Fee Double-Counting Prevention
- **Initial State:** Player pays 4.00 ETB provider fee.
- **Input:** Platform expenses evaluated.
- **Expected Business Behavior:** The 4.00 ETB fee is **not** included in platform operating expenses (5010), because it was funded directly by the player.

### RB-68: Gross Deduction Net Guarantee Under Provider Fee Withholding
- **Initial State:** An external provider deducts its 15.00 ETB fee from the gross outbound payment (withholding model).
- **Input:** Player requests 1,000.00 ETB withdrawal.
- **Expected Business Behavior:** System initiates a gross transfer of **1,015.00 ETB**, ensuring that after the provider deducts 15.00 ETB, the player receives exactly **1,000.00 ETB**. Total wallet deduction = 1,015.00 ETB.

### RB-69: Deposit Chargeback with Spent Funds (Recoverable Player Debt & Account Freeze)
- **Initial State:** Player deposits 1,000 ETB (100,000 s.) verified at Tier 2. Player wagers and loses 600 ETB; available balance $A = 40,000\text{ s.}$ Provider cancels the un-cleared deposit of $D = 100,000\text{ s.}$ before bank settlement.
- **Input:** System executes `deposit_reversal_tier2_overdraft` for $D = 100,000\text{ s.}$
- **Expected Journal Entries:**
  * Debit `2010 Player Available Deposits`: 40,000 santims (clears available balance to exactly 0; Zero Negative Balance Invariant preserved).
  * Debit `1050 Player Overdrafts Receivable`: 60,000 santims ($D - A$, tracked as recoverable player debt against player ID).
  * Credit `1030 Provider Clearing / In-Transit`: 100,000 santims ($D$).
- **Distinction from Account 3999:** Account 3999 is strictly untouched because the debtor and reason are fully identified.
- **Expected System State:** Player account status transitioned to `frozen_overdraft`. All gameplay, deposits, and withdrawals blocked until the deficit in Account 1050 is repaid.

### RB-69.1: Post-Settlement Tier 3 Chargeback with Spent Funds
- **Initial State:** Deposit of 1,000 ETB (100,000 s.) settled into CBE Account `1010`. Player spent 600 ETB; available balance $A = 40,000\text{ s.}$ CBE executes external clawback of 1,000 ETB from Account `1010`.
- **Input:** Admin executes `deposit_chargeback_tier3_overdraft` for $D = 100,000\text{ s.}$
- **Expected Journal Entries:**
  * Debit `2010 Player Available Deposits`: 40,000 santims (clears player wallet to 0).
  * Debit `1050 Player Overdrafts Receivable`: 60,000 santims ($D - A$).
  * Credit `1010 CBE Bank Account`: 100,000 santims (cash debited by bank).
- **Expected System State:** Player account status transitioned to `frozen_overdraft`. Platform records an active receivable in Account 1050.

### RB-69.2: Uncollectible Overdraft Write-Off (Owner Authorization Only)
- **Initial State:** Account 1050 has balance of 60,000 santims for player in `frozen_overdraft` for >90 days. Recovery efforts exhausted.
- **Input 1:** Staff admin attempts to write off deficit.
- **Expected Authorization Behavior:** System rejects with `ERR_UNAUTHORIZED_WRITE_OFF` (Staff cannot write off balances; requires Owner).
- **Input 2:** Owner executes `writeOffOverdraft(ctx, { playerId, amountSantims: 60000, reason: "90_DAY_DEFAULT" })`.
- **Expected Financial Journal Entries:**
  * Debit `5030 Dispute & Chargeback Loss Expense`: 60,000 santims
  * Credit `1050 Player Overdrafts Receivable`: 60,000 santims
- **Expected System State:** Account 1050 subledger balance reaches 0. Player account status transitions to `banned_bad_debt`. Cannot be unfrozen without full restitution.

### RB-70: Tariff Schema Overlap Invariant Enforcement
- **Initial State:** Active tariff exists for route `telebirr_p2p` with band $10,100 \le A \le 50,000$ santims ($101.00 - 500.00$ ETB).
- **Input:** Admin attempts to activate a new tariff record for `telebirr_p2p` covering $40,000 \le A \le 80,000$ santims with overlapping validity dates.
- **Expected Business Behavior:** Database query guard / mutation validator rejects insertion with `ERR_TARIFF_OVERLAP_DETECTED`. No overlapping active tariffs can exist for the same route and amount band.

### RB-71: External Statement Evidence Required for Settlement
- **Initial State:** Withdrawal request is in `processing` state following bank batch dispatch.
- **Input:** Admin or system attempts to transition status to `settled` without supplying `providerTransactionReference`, `externalSettlementReference`, `evidenceType`, or `evidenceReference`.
- **Expected Business Behavior:** Mutation fails with `ERR_MISSING_SETTLEMENT_EVIDENCE`. Payout cannot be marked settled on gateway ACK alone; independent external clearing evidence (bank statement line or API CBS confirmation) is mandatory.

### RB-72: Post-Settlement Return Linkage and Permanent Status
- **Initial State:** Withdrawal `wd_201` is in `settled` state. Bank notifies platform that beneficiary account was invalid and returned the principal.
- **Input:** Reconciler posts two-step return journal and marks request returned.
- **Expected System State:**
  * Request `wd_201` status permanently transitions to `returned_post_settlement` with recorded `returnReference` and `returnReason`. It is never mutated back to `pending` or `processing`.
  * If the player requests a retry to a corrected destination, a new withdrawal record `wd_202` is created with `linkedOriginalRequestId = "wd_201"`.

---

## 5. OPERATIONAL ACCEPTANCE SCENARIOS (OP-01 THROUGH OP-08)

- **OP-01 (End-to-End Deposit Lifecycle):** Player submits CBE deposit $\rightarrow$ Verify.et verifies $\rightarrow$ Tier 2 posted to Account 1030 $\rightarrow$ Bank feed statement matches $\rightarrow$ Tier 3 posted to Account 1010 $\rightarrow$ Balance available for play.
- **OP-02 (Standard Match Resolution with 10% Rake):** Match completes $\rightarrow$ Winner credited 90% $\rightarrow$ Platform commission credited 10% $\rightarrow$ Game record updated with ratings and ledger link.
- **OP-03 (Mutual Draw Settlement — BLOCKED Pending OD-09):** Players agree draw $\rightarrow$ If Alternative 1 ratified: 95% of stakes refunded to each (5% total pot rake posted to Account 4010). If Alternative 2 ratified: 97.5% of stakes refunded to each (2.5% total pot rake). Rake execution blocked until OD-09 selection; active behavior is 100% refund (OP-04).
- **OP-04 (Organic Draw Stalemate):** Match ends in stalemate $\rightarrow$ 100% full refund to both players $\rightarrow$ 0 ETB platform fee.
- **OP-05 (Player Withdrawal Flow with Fee Disclosure):** Player requests 1,000 ETB via Telebirr $\rightarrow$ Calculator discloses 4 ETB fee and 1,004 ETB deduction $\rightarrow$ Player confirms $\rightarrow$ Funds reserved $\rightarrow$ Admin reviews $\rightarrow$ Bank transfers $\rightarrow$ Player receives exactly 1,000 ETB.
- **OP-06 (Owner Profit Distribution):** Owner initiates payout $\rightarrow$ System verifies Distributable Cash Cap and $\ge 105\%$ solvency $\rightarrow$ Funds escrowed into 2090 $\rightarrow$ Bank dispatches $\rightarrow$ Bank statement matches $\rightarrow$ Status completed.
- **OP-07 (Solvency Breach Automated Circuit Breaker):** Solvency drops below 100% $\rightarrow$ System triggers critical halt $\rightarrow$ All withdrawals locked $\rightarrow$ Stakes capped $\rightarrow$ Emergency incident alert dispatched.
- **OP-08 (CLI Out-of-Band Owner Recovery):** Owner account locked $\rightarrow$ Administrator runs `scripts/recover-owner.ts` with Convex deploy key $\rightarrow$ Owner Subject ID updated $\rightarrow$ Immutable audit log posted.

---
**END OF ACCEPTANCE TEST MATRIX — ABAY CHESS v4.2.7-PROD**  
*STATUS: PENDING OWNER APPROVAL — IMPLEMENTATION PROHIBITED*
