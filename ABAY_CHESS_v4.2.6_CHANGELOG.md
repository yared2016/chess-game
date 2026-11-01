# ABAY CHESS — SPECIFICATION CHANGELOG: v4.2.5-PROD TO v4.2.6-PROD

**Date:** November 1, 2026  
**Document:** Architectural and Financial Changelog  
**Basis:** Transition from `v4.2.5-PROD` to `v4.2.6-PROD`  
**Status:** Pending Explicit Owner Approval — **STRICT NO-IMPLEMENTATION PHASE**  

---

## 1. COMPREHENSIVE REVISION COMPARISON MATRIX

| Change ID | Subsystem | Previous Problem in v4.2.5-PROD | Exact Correction in v4.2.6-PROD | Technical & Financial Reason | Approval Dependency |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **CHG-01** | **Deposit Accounting** | Tier 2 wallet credit posted `Debit 1010 Cash, Credit 2010 Player Deposits` before bank clearing, incorrectly recognizing uncleared funds as cash float. | Replaced with two-stage posting: At Tier 2, post `Debit 1030 Provider Clearing / Deposit Receivable, Credit 2010`. At Tier 3 (cleared statement), post `Debit 1010/1020 Cleared Cash, Credit 1030`. | Prevents recognizing uncleared receivables as physical cash. Eliminates false cash float and unbacked solvency inflation. | Core Accounting Invariant (Approved) |
| **CHG-02** | **Reversal Accounting** | In v4.2.5, reversing a completed withdrawal directly credited `2010 Player Deposits` against `1010 Cash`, mixing an exact journal reversal with a business wallet restoration. | Disentangled into two distinct steps: (1) Exact journal reversal: `Debit 1010 Cash, Credit 2030 Withdrawal Payable`. (2) Business wallet restoration: `Debit 2030, Credit 2010 Player Available Deposits`. | Maintains exact inverse symmetry of GL postings. Prevents corrupting subledger payable balances. | Core Accounting Invariant (Approved) |
| **CHG-03** | **Distributable Cash vs Equity** | Distributable commission was calculated solely from ledger equity (`Balance(3010) - Reserve`), ignoring actual cleared cash liquidity. | Mandated that maximum Owner payouts are capped by the **lower of**: (1) Book Distributable Equity, and (2) Eligible Cleared Cash Surplus after all obligations and required reserves. Pre-payout projected solvency check enforced. | Prevents distributing accounting profit when actual cash is locked in player liabilities or uncleared receivables. | Core FinTech Safety (Approved) |
| **CHG-04** | **Owner Payout Lifecycle** | The lifecycle moved directly from `evidence_submitted` to `completed` without mandatory external statement confirmation. | Introduced mandatory `externally_confirmed` stage between `evidence_submitted` and `completed`. Returned completed payouts are recorded as new linked compensating events, never rewritten as failed. | Receipt uploads prove file integrity, not bank execution. Authoritative confirmation requires statement credit verification. | Core FinTech Safety (Approved) |
| **CHG-05** | **Opening Balance Reconstruction** | Opening balance equation only considered cash, player balances, and commissions, omitting clearing balances, accrued fees, and payables. | Comprehensive balance sheet reconstruction covering all assets (cash, receivables), all liabilities (available, escrow, pending, payables, fees), equity, and residual variance in `3999` with explicit sign rules. | Guarantees that opening general ledger trial balance balances without concealing missing liabilities or assets. | Core Accounting Invariant (Approved) |
| **CHG-06** | **Journal Data Validation** | Relied on basic Convex schema types (`v.number()`) without validating safe aggregate sums, nonempty lines, or conditional reversal fields. | 12-point atomic validation pipeline: safe integer checks, $< \text{MAX\_SAFE\_INTEGER}$ aggregates, active accounts, debit-credit equality, nonempty lines, and reversal linkage rules. | Prevents corrupted, fractional, or unbalanced transactions from entering the immutable ledger. | Core Ledger Integrity (Approved) |
| **CHG-07** | **Immutability Classification** | Immutability was occasionally described with language implying cryptographic engine guarantees. | Clarified that immutability in Convex is **application-enforced append-only encapsulation** (zero public write handlers, internal-only insertion, no update/delete handlers, reversal-only corrections). | Eliminates false architectural claims. Accurately represents Convex platform capabilities. | Architectural Clarification (Approved) |
| **CHG-08** | **Uniqueness & Concurrency (OCC)** | Claimed uniqueness based on Convex indexes alone, which are non-unique lookup structures. | Formally documented the **Atomic Lookup-and-Insert Pattern** paired with Convex **Optimistic Concurrency Control (OCC)** serializable retries and payload equivalence verification. | Prevents race condition collisions and duplicate financial postings across distributed nodes. | Concurrency Architecture (Approved) |
| **CHG-09** | **Owner Destination Snapshot** | Payout records referenced the current Owner configuration, meaning future configuration updates could alter historical payout records. | Mandated that `ownerPayouts` contains an immutable encrypted destination snapshot (`destinationAccountEncrypted`) captured at authorization time. | Guarantees immutable audit records. Prevents configuration drift from altering historical settlement destinations. | PII & Security Governance (Approved) |
| **CHG-10** | **Payment Channel Consistency** | Enablement flags overlapped between `platformPaymentDestinations` and `paymentChannels`, creating potential state divergence. | Established a unified channel eligibility model: a channel is available to players only if BOTH channel and destination records pass all health, verification, and Owner-approval checks. | Eliminates conflicting configuration states between network definitions and platform receiving accounts. | Operational Governance (Approved) |
| **CHG-11** | **Solvency & Circuit Breaker** | Circuit breaker definition did not explicitly account for restricted cash (collateral, minimum bank balances) or stale statement data. | Restricted cash is deducted from eligible cash float. Fresh statement ($< 24\text{h}$) is mandatory. Automatic trip on insolvency; reset requires fresh statements and completed reconciliation. | Prevents treating legally encumbered or stale bank balances as available to back player liabilities. | Core Solvency Invariant (Approved) |
| **CHG-12** | **Generalized Liability Reporting** | Solvency equations hardcoded only accounts `2010`, `2020`, `2030`, and `2090`. | Defined a generalized liability classification query selecting all accounts where `category === "liability"` and `isActive === true`. | Prevents future approved liability accounts from silently disappearing from solvency calculations. | Architectural Hardening (Approved) |
| **CHG-13** | **Durable Queue & Scoped FIFO** | Claimed global FIFO ordering based merely on indexed creation timestamps. | Defined an explicit **Scoped FIFO Model** (FIFO within game/player scope) utilizing worker lease locking (`leaseExpiresAt`), exponential backoff, and a Dead-Letter Queue (DLQ). | Eliminates unproven global FIFO claims. Provides robust crash-recovery and poison-message isolation. | Queue Architecture (Approved) |
| **CHG-14** | **Write-Freeze Queue Replay** | Assumed queued events could be replayed without re-verifying state changes that occurred during the maintenance window. | Mandated pre-replay state revalidation: before an event is replayed, the worker re-verifies business state, idempotency, current account balances, and settlement validity. | Prevents executing stale, conflicting, or already-settled financial instructions post-cutover. | Cutover Governance (Approved) |
| **CHG-15** | **Staged Owner Identity Rotation** | Rotation risk: changing environment variables before database update (or vice versa) could lock out the Owner. | Staged rotation ceremony: Current Owner proposes `pendingOwnerClerkId` $\rightarrow$ environment variable updated $\rightarrow$ New Owner confirms with Clerk auth. CLI recovery available. | Eliminates lockout risks during identity transitions. Guarantees continuous cryptographic authorization. | Identity Governance (Approved) |
| **CHG-16** | **Secret Separation & Fallback Removal** | Legacy code conflated `VERIFY_ET_WEBHOOK_SECRET` with `EVE_SERVER_SECRET`, and contained a compromised hardcoded fallback key. | Completely eliminated `DEFAULT_VERIFY_ET_API_KEY`. Separated outbound API key (Vercel), inbound webhook secret (Vercel), and internal service secret (`EVE_SERVER_SECRET` / `INTERNAL_SERVICE_SECRET`). | Closes critical credential leak. Establishes clean security boundaries across runtimes. | Critical Security Fix (Approved) |
| **CHG-17** | **External Settlement Evidence** | Receipt hashes and transaction references were treated as sufficient proof of completed settlement. | Clarified that hashes prove file integrity, not bank settlement. Authoritative settlement requires bank API confirmation or statement credit match. | Prevents fraudulent or unverified payouts from completing on receipt slips alone. | FinTech Verification (Approved) |
| **CHG-18** | **Accounting Period Closing** | Closing rules did not address late-arriving transactions or define reopening policies. | Established strict period cutoffs: late-arriving transactions post to the current open period. Reopening closed periods is strictly prohibited; corrections use compensating entries. | Preserves financial auditability. Prevents retroactive tampering with historical financial periods. | General Ledger Governance (Approved) |
| **CHG-19** | **Disaster Recovery & RPO/RTO** | Relied on generic backup claims without defining recovery objectives or forward recovery preference. | Defined RPO (1 hour) and RTO (4 hours). Mandated forward recovery via compensating journal entries over snapshot rollbacks (which erase intervening match gameplay). | Minimizes data loss and player disruption during disaster recovery scenarios. | Operational Resilience (Approved) |

---

## 2. DETAILED SUBSYSTEM IMPACT ANALYSIS

### 2.1 Deposit Accounting & Float Recognition
- **Previous Flaw:** In `v4.2.5`, when Verify.et verified a deposit, the system immediately posted:
  - `Debit 1010 Cash - CBE Bank Account`
  - `Credit 2010 Player Available Deposits`
  This meant that if CBE's banking network experienced settlement lag, the platform recognized money as cleared cash before it actually arrived in the platform's bank account.
- **Correction in `v4.2.6`:**
  - Account `1030` is formally designated as `Provider Clearing / Deposit Receivable`.
  - When Verify.et verifies the transaction (Tier 2):
    - `Debit 1030 Provider Clearing / Deposit Receivable`
    - `Credit 2010 Player Available Deposits`
  - When the bank statement or automated banking webhook confirms cleared funds in the CBE account (Tier 3):
    - `Debit 1010 Cash - CBE Bank Account`
    - `Credit 1030 Provider Clearing / Deposit Receivable`
  - In solvency calculations, `1030` is an asset, but it is **not cleared cash**. Thus, uncleared deposits cannot artificially inflate the platform's cash coverage ratio.

### 2.2 Reversal Symmetry and Subledger Restorations
- **Previous Flaw:** When an external withdrawal failed or bounced, `v4.2.5` posted:
  - `Debit 1010 Cash - CBE Bank Account`
  - `Credit 2010 Player Available Deposits`
  This was an accounting error: the original completed withdrawal was `Debit 2030, Credit 1010`. Reversing it directly into `2010` bypassed the payable account (`2030`), leaving an imbalance in the subledger.
- **Correction in `v4.2.6`:**
  - The reversal must mirror the original transaction exactly:
    - `Debit 1010 Cash - CBE Bank Account`
    - `Credit 2030 Player Pending Withdrawals`
  - Then, a separate business transaction restores the funds to the player's available wallet:
    - `Debit 2030 Player Pending Withdrawals`
    - `Credit 2010 Player Available Deposits`
  - Both transactions are linked, atomic, and auditable.

### 2.3 Solvency Capping on Owner Distributions
- **Previous Flaw:** `v4.2.5` calculated distributable equity as `Balance(3010) - Reserve`. However, even if book equity is positive, the platform might have cash locked in player liabilities or uncleared receivables.
- **Correction in `v4.2.6`:**
  - The Owner can only withdraw cash that is **both** earned book equity **and** unencumbered cleared cash.
  - Formula:
    $$\text{MaxDistributableAmount} = \min(\text{BookDistributableEquity}, \text{EligibleClearedCashSurplus})$$
  - Where $\text{EligibleClearedCashSurplus} = \text{ClearedCash} - \text{TotalPlatformObligations} - \text{RequiredOperationalReserve}$.
  - Any payout that would reduce the platform's projected solvency ratio below $100\%$ is rejected at the reservation stage.

---
*End of Specification Changelog (v4.2.6-PROD)*
