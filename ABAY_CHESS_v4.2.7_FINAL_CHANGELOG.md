# ABAY CHESS — v4.2.7-PROD
## Master Architectural & Financial Specification Delta Log

**Document Version:** 4.2.7-PROD  
**Document Type:** Specification Delta, Historical Reconciliation & Change Log  
**Base Specification:** v4.2.6-PROD  
**Target Specification:** v4.2.7-PROD  
**Status:** PENDING OWNER APPROVAL — **STRICT NO-IMPLEMENTATION PHASE**  
**Repository Basis:** `Castle-3d-multiplayer-with-ai-vercel-eve-nextjs-clerk-main` (Commit `06acb94b8111b6bcaed8291f781aa9b41bc102ac`)  
**Deployment Target:** `qualified-greyhound-151` (`https://qualified-greyhound-151.convex.cloud`)  

---

## 1. EXECUTIVE SUMMARY OF CHANGES & TECHNICAL CORRECTIONS

Specification **v4.2.7-PROD** represents the final, comprehensive production blueprint for Abay Chess. It resolves all prior accounting, concurrency, secret management, and lifecycle discrepancies, incorporating the newly mandated **Withdrawal Service Fee Separation Policy**, grounding all payment routes in official Ethiopian banking tariffs, and establishing an empirical source-of-truth baseline against commit `06acb94`.

### Key Corrections in Final Technical Audit Pass:
1. **Chart of Accounts vs Database Tables Distinction:** Corrected prior textual ambiguities to state with precision:
   - Exactly **17 Canonical General Ledger Accounts** in the Chart of Accounts (including active asset Account `1050 Player Overdrafts Receivable`, `5020 Promotion & Bonus Expense`, and `5030 Dispute & Chargeback Loss Expense`).
   - Exactly **14 Database Tables** in the Convex double-entry schema.
2. **Financial Arithmetic & Tariff Alignment Corrections Across Scenarios:**
   - Corrected Scenario A tariff alignment: Payout $1,001.00\text{ ETB} = 100,100\text{ santims}$ (within verified Band 2: $1,001 - 5,000\text{ ETB}$), fee 115 s. ($1.15\text{ ETB}$), total wallet deduction = **100,215 santims**, net received = $100,100\text{ santims}$.
   - Reaffirmed Fractional Santim Quarantine: Payout of $1,000.00\text{ ETB}$ ($0.575\text{ ETB}$ / $57.5\text{ santims}$) is strictly quarantined as **`FRACTIONAL_SANTIM_QUARANTINED`** and inactive until CBS voucher proof confirms debit rounding, without assuming speculative rounding.
   - Corrected Scenario B arithmetic: Payout 100,100 s., fee charged 150 s., bank debit = **100,250 santims**, variance 35 s. debited to 5010, ensuring Debits ($100,100 + 115 + 35 = 100,250$) $\equiv$ Credits ($100,250$).
   - Completely rewritten Scenario D: Pre-settlement cancellation and rejection reversal releasing principal from 2030 and fee from 2040 back to 2010, balancing exactly ($100,215\text{ s.}$).
   - Scenario E: Two-step post-settlement returned transfer journal with formal Case E1 (player fault), Case E2 (banking error, platform fee absorption), and Case E3 (full provider refund).
   - Scenario F Numerical Demonstration: Multi-player batch (2 players, 3 withdrawals, concurrent idempotency, duplicate rejection, debits $\equiv$ credits $750,680\text{ santims}$).
3. **CBE Tariff Example & Fractional Santim Policy:**
   - Disambiguated CBE tiers: 1–1,000 ETB is 0.575 ETB, while 1,001–5,000 ETB is 1.15 ETB.
   - Established Safe Representation Policy: Because 0.575 ETB (57.5 santims) contains a fractional santim, rounding to 58 santims without bank statement evidence is prohibited. Tier 1–1,000 ETB is quarantined as **`FRACTIONAL_SANTIM_QUARANTINED`** and inactive until physical statement voucher evidence proves CBS settlement precision.
   - Kept retail mobile banking separate from corporate B2C automated API routes (`UNVERIFIED_CORPORATE_B2C`).
4. **Telebirr Boundary Gap Quarantine:**
   - Identified that Ethio telecom public documentation specifies `< 100` and `101 - 500`, leaving an official boundary gap for $[100.00, 100.99\text{ ETB}]$ ($10,000 - 10,099\text{ santims}$).
   - Classified amount 100.00 ETB as **`UNRESOLVED_BOUNDARY_QUARANTINED`** pending written provider confirmation.
5. **Independent Settlement Evidence & Return Handling:**
   - Established that gateway ACK does not prove settlement. Added explicit fields: `providerTransactionReference`, `externalSettlementReference`, `evidenceType`, `evidenceReference`, `evidenceTimestamp`, `verificationActor`, `actualPrincipalTransferredSantims`, `actualProviderFeeChargedSantims`, `returnedAmountSantims`, `returnReference`, `returnReason`, `returnDate`, `returnSupportingEvidenceStorageId`.
   - Returned withdrawals retain original history permanently (`returned_post_settlement`). Retries spawn a new linked request (`linkedOriginalRequestId`).
6. **Comprehensive Provider Fee Accounting & Zero Double-Counting:**
   - Defined distinct accounting rules for player-funded quoted fees (2040), platform-funded promotional subsidies (5020), under-collection variance (5010), over-collection refund (2010), refunded provider fees, and unrefunded return fees.
   - Proved zero double-counting between 2040 and 5010, and verified zero platform revenue on provider fees.
7. **Complete Tariff Schema & Overlap Invariant:**
   - Expanded `providerTariffs` with `feePayer`, `taxInclusion`, `calculationBasis`, `roundingPrecisionPolicy`, `minAmountSantims`, `maxAmountSantims`, `sourceEvidence`, `verificationDate`, and `approvalAuditTrail`.
   - Enforced database invariant preventing two active tariff versions matching the same route and amount concurrently.
8. **Separation of Deposit Reversals by Settlement Stage & Account 1050 Governance:**
   - Defined distinct journal workflows for Tier 2 reversals before bank settlement and Tier 3 chargebacks after bank settlement.
   - Explicitly distinguished Recoverable Player Debt (Account `1050 Player Overdrafts Receivable`) from Unexplained Financial Discrepancies (Account `3999 System Discrepancy Suspense`).
   - Account 1050 Governance: Clarified accounting asset vs legal claim; specified required evidence, 14-day dispute window, automated repayment offset, Owner-only write-off authority to Account `5030 Dispute & Chargeback Loss Expense`, and restrictions on removing `frozen_overdraft`.
9. **Ledger Enforcement: Schema vs Mutation-Level Guarantees:**
   - Explicitly documented that Convex indexes do not enforce uniqueness at write time; detailed mutation-level query guards, balance assertions, ACID transaction atomicity, and append-only immutability.
10. **Authoritative 105% Solvency & Distributable Cap Formulation:**
    - Defined authoritative Book Equity subtracting $|\text{Balance}(3999)|$ once, completely eliminating double deduction.
    - Defined authoritative Eligible Cash Surplus strictly enforcing 105% liability coverage: $\max(0, C_{\text{eligible}} - \lceil 105 \times \mathcal{L}_{\text{total}} / 100 \rceil - \text{OperatingBuffer})$.
    - Enforced non-negative cap guarantee: $\mathbf{DistributableCap} = \max(0, \min(\text{BookEquity}, \text{EligibleCashSurplus}))$.
    - Defined unposted queue states in `durableQueue` that add to `PendingCommitments`; excluded tasks with already posted liabilities to eliminate double-counting.
11. **Mutual Accepted Draw Policy Reconciliation:**
    - Documented both Alternative 1 (5% of stake = 5% pot rake) and Alternative 2 (2.5% of stake = 2.5% pot rake). Blocked rake implementation until OD-09 ratification; preserved 100% refund codebase default.
12. **Withdrawal SLA & Dormant Accounts Reconciliation:**
    - Reconciled approved player-facing 1–2 hour expectation with manual review 6h daytime / 12h night operational limit under OD-03/OD-06.
    - Clarified that player deposits do not expire, and deferred any proposed dormant account maintenance fee pending Owner and regulatory review.

---

## 2. DETAILED DELTA ANALYSIS (v4.2.6-PROD $\rightarrow$ v4.2.7-PROD)

### 2.1 Withdrawal Service Fee Separation & Net Payout Guarantee
- **Prior Treatment (v4.2.6):** Withdrawals were modeled with platform-level min/max limits and generic basis-point configurations, leaving ambiguous whether provider fees were deducted from the player's payout or absorbed by the platform.
- **v4.2.7-PROD Revision:**
  1. **Zero Platform Revenue Rule:** Abay Chess earns **zero revenue** from deposits or withdrawals. Platform revenue is strictly and exclusively generated from game commission rake.
  2. **Net Withdrawal Guarantee:** When a player requests an amount $X$, the player is guaranteed to receive exactly $X$ in their external bank account or mobile wallet.
  3. **Fee Separation:** The applicable payment provider service fee $F$ is calculated dynamically and added to the player's total wallet deduction ($X + F$). The fee is never subtracted from the player's requested payout.
  4. **Dynamic Player-Facing Calculator:** The wallet interface must display the exact breakdown ($X$, $F$, $X+F$, Net Received, and Platform Revenue = 0 ETB) and require explicit player confirmation before funds are locked.
  5. **Pass-Through Accounting:** Provider fees are accounted for as pass-through liabilities (`2040 Provider Fees Payable`), neither recognized as platform revenue nor recorded as platform operating expenses.

### 2.2 Versioned, Effective-Dated Provider Tariff System
- **Prior Treatment (v4.2.6):** Fees were partially represented in `paymentChannels` without route granularity, versioning, or effective dates.
- **v4.2.7-PROD Revision:**
  1. Added table `providerTariffs` to the Convex schema (Table 13 of 14).
  2. Supports discrete payment routes (e.g., Telebirr P2P, Telebirr-to-Bank, CBE Account-to-Account, CBE-to-Wallet).
  3. Supports amount-bracketed fixed fees, percentage rates, minimum/maximum charges, and explicit tax additions (15% VAT + 5% Disaster Risk Response Fund for CBE).
  4. Enforces versioning, `effectiveFrom`, `effectiveUntil`, verification metadata, and audit logs. Tariffs are never mutated in place.
  5. **Pending Withdrawal Tariff Snapshot:** When a player confirms a withdrawal, an immutable snapshot of the agreed tariff and fee is stored on the `withdrawalRequests` record. Subsequent tariff updates cannot alter confirmed pending withdrawals.

### 2.3 Complete Nine-Phase Withdrawal Accounting Lifecycle
- **v4.2.7-PROD Addition:** Explicitly specified the complete lifecycle and balanced journal entries across nine states:
  1. *Requested:* Preview generated; zero ledger movement.
  2. *Confirmed / Reserved:* Debit `2010 Player Deposits` ($X+F$), Credit `2030 Withdrawal Payable` ($X$), Credit `2040 Provider Fees Payable` ($F$).
  3. *Under Review / Approved:* Administrative review for payouts $>2,000$ ETB; zero ledger movement.
  4. *Cancelled by Player:* Debit `2030` ($X$), Debit `2040` ($F$), Credit `2010` ($X+F$). Full restoration.
  5. *Rejected by Admin:* Debit `2030` ($X$), Debit `2040` ($F$), Credit `2010` ($X+F$). Full restoration.
  6. *Timeout / Investigating:* Dispatched but gateway timed out. Zero cash movement until confirmed.
  7. *Failed Transfer:* Provider confirms failure without bank debit. Debit `2030` ($X$), Debit `2040` ($F$), Credit `2010` ($X+F$). Full restoration.
  8. *Executed / Settled:* Debit `2030` ($X$), Debit `2040` ($F$), Credit `1010/1020 Bank Cash` ($X+F$). Payables clear to zero.
  9. *Returned Transfer After Settlement (2-Step):* Step 1: Debit `1010/1020 Cash` ($X$), Credit `2030 Payable` ($X$). Step 2: Debit `2030 Payable` ($X$), Credit `2010 Deposits` ($X$). Non-refundable bank fee evaluated per policy.

### 2.4 Dynamic Solvency & Distributable Cash Formulas
- **Prior Treatment (v4.2.6):** Hardcoded a fixed liability account list (`2010 + 2020 + 2030 + 2090`), omitting Account 2040 and future liability expansions.
- **v4.2.7-PROD Revision:**
  - Formula dynamically sums all active accounts where `category == "liability"`:
    $$\text{Total Obligations} = \sum_{a \in \mathcal{L}} \text{CreditBalance}(a) + \text{PendingObligations}$$
  - Eligible cash strictly subtracts restricted cash, collateral, and pending disbursements in transit.
  - Distributable Cash Cap accounts for debit balance in Account 3999 (historical cash deficits) as an immediate reduction from book equity.

---

## 3. HISTORICAL ISSUE REGISTER (v4.2.0 – v4.2.7 TRACEABILITY)

The following master register tracks every issue identified across all review cycles and documents its definitive resolution in v4.2.7-PROD:

| Issue ID | Original Description | Identified | Severity | Repository Evidence | v4.2.6 Status | v4.2.7 Resolution | Test ID | Final Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **ISS-01** | Single-entry ledger without debit/credit balancing | v4.2.0 | Critical | `convex/schema.ts:383` | Specified GL | Full 14-table GL schema with 17 canonical accounts and strict validators | RB-01..04 | **RESOLVED** |
| **ISS-02** | Deposit clearing absence inflating solvency float | v4.2.2 | Critical | `deposit/verify/route.ts:71` | Added 1030 | 4-tier deposit lifecycle using 1030 Provider Clearing | RB-13..16 | **RESOLVED** |
| **ISS-03** | Lack of canonical two-step reversal symmetry | v4.2.3 | High | `convex/financial/` | Defined 2-step | Formal 2-step reversals for withdrawals and owner payouts | RB-17, 34, 35 | **RESOLVED** |
| **ISS-04** | Distributable profit calculated without cash surplus | v4.2.4 | Critical | `convex/admin/finance.ts` | Defined Cap | Distributable Cap enforces 105% coverage: $\max(0, \min(\text{BookEquity}, \text{EligibleCashSurplus}))$ | RB-21..24 | **RESOLVED** |
| **ISS-05** | Owner payout completed on receipt upload without bank | v4.2.5 | High | `yyhnan/page.tsx` | Added stage | Mandatory `externally_confirmed` stage before completion | RB-23 | **RESOLVED** |
| **ISS-06** | Financial queue lacks scoped FIFO and lease locking | v4.2.5 | High | `convex/queue.ts` | Added queue | Scoped FIFO (`scopeKey`), 30s lease lock, DLQ, pre-replay checks | RB-25..28, 39 | **RESOLVED** |
| **ISS-07** | Payment channels disconnected from destination table | v4.2.5 | Medium | `convex/schema.ts` | Unified rule | Channel active iff channel + destination + gateway healthy | RB-38 | **RESOLVED** |
| **ISS-08** | Leaked fallback API key committed to source | v4.2.5 | Critical | `client.ts:31-32` | Flagged | Immediate key revocation instruction; runtime env assertion | RB-42 | **RESOLVED** |
| **ISS-09** | Hardcoded obsolete Convex cloud URL | v4.2.5 | High | `deposit/verify/route.ts:29` | Reconciled | Hardcoded URL removed; strict env variable reader enforced | OP-01 | **RESOLVED** |
| **ISS-10** | Hardcoded email/ID in admin and owner UI | v4.2.5 | High | `admin/page.tsx:24` | Removed | Server-side Clerk Subject ID check; separate `/fssmyfkl` route | RB-29, 30 | **RESOLVED** |
| **ISS-11** | Withdrawal amount conflated with provider fee | v4.2.7 | Critical | `withdrawals.ts` | Unaddressed | Player receives 100% requested; fee added to wallet deduction | RB-45, 52 | **RESOLVED** |
| **ISS-12** | Absence of versioned provider tariff engine | v4.2.7 | High | Codebase | Unaddressed | Table `providerTariffs` with amount brackets and tax modeling | RB-46..51 | **RESOLVED** |
| **ISS-13** | Unverified CBE Birr routing risk | v4.2.7 | High | `client.ts:40` | Conditional | CBE Birr marked UNVERIFIED and programmatically DISABLED | RB-49, 60 | **RESOLVED** |
| **ISS-14** | Retroactive tariff modification on pending withdrawals | v4.2.7 | High | Codebase | Unaddressed | Immutable `tariffSnapshot` on withdrawal confirmation | RB-50, 51 | **RESOLVED** |
| **ISS-15** | Deposit fee disclosure and zero platform revenue | v4.2.7 | Medium | UI / Schema | Unaddressed | Transparent disclosure; platform deposit revenue = 0 ETB | RB-53..56 | **RESOLVED** |
| **ISS-16** | Organic draw policy status ambiguity | v4.2.6 | Medium | `lib/games.ts:210` | 100% refund | Verified existing code implements 100% refund; raised OD-09 | RB-44 | **RESOLVED** |
| **ISS-17** | Withdrawal arithmetic errors & Scenario A/D/F revisions | v4.2.7 | High | Spec Sec 5.5 | Typographical | Scenario A aligned to 1,001 ETB, Scenario D rewritten, Scenario F proved | RB-57, 58 | **RESOLVED** |
| **ISS-18** | CBE Band 1 fractional santim debiting ambiguity (0.575 ETB) | v4.2.7 | High | Spec Sec 7.1 | Unaddressed | Quarantined as `FRACTIONAL_SANTIM_QUARANTINED` pending CBS voucher | RB-46.1 | **RESOLVED** |
| **ISS-19** | Telebirr official boundary gap at 100.00 ETB | v4.2.7 | Medium | Spec Sec 7.1 | Unaddressed | Quarantined as `UNRESOLVED_BOUNDARY_QUARANTINED` pending provider text | RB-46.2 | **RESOLVED** |
| **ISS-20** | Deposit chargeback spent funds ($A < D$) unhandled | v4.2.7 | High | Spec Sec 4.4 | Unaddressed | Deficit charged to 1050 (Recoverable Debt, NOT 3999), balance stops at 0 | RB-69 | **RESOLVED** |
| **ISS-21** | Premature settlement on gateway ACK without bank evidence | v4.2.7 | High | Spec Sec 5.6 | Unaddressed | Required external clearing evidence; permanent return audit trail | RB-71, 72 | **RESOLVED** |
| **ISS-22** | Overlapping active provider tariffs | v4.2.7 | Medium | Spec Sec 6.13 | Unaddressed | Schema overlap invariant enforced (`ERR_TARIFF_OVERLAP_DETECTED`) | RB-70 | **RESOLVED** |
| **ISS-23** | Deposit reversal stage separation unmodeled | v4.2.7 | High | Spec Sec 4.4 | Unaddressed | Distinct journals for Tier 2 before bank settlement and Tier 3 chargebacks | RB-16.1..4 | **RESOLVED** |
| **ISS-24** | Account 3999 double deduction in solvency cap formula | v4.2.7 | High | Spec Sec 8.4 | Mathematical | Book Equity defined with single absolute deduction; non-negative cap | RB-21, 22 | **RESOLVED** |
| **ISS-25** | Account 5020 conflation (Promotion vs Dispute Loss) | v4.2.7 | High | Spec Sec 4.1 | Clarified | Separated 5020 Promotion Expense and 5030 Dispute Loss Expense (17 Accounts) | RB-01, 69.2 | **RESOLVED** |
| **ISS-26** | Solvency Distributable Cap omitted 105% multiplier | v4.2.7 | High | Spec Sec 8.4 | Corrected | Explicitly restored $\lceil 105 \times \mathcal{L} / 100 \rceil$; defined PendingCommitments | RB-21, 22 | **RESOLVED** |
| **ISS-27** | Mutual draw commission percentage conflict | v4.2.7 | Medium | Spec Sec 3.3 | Unaligned | Documented Alt 1 (5% pot rake) vs Alt 2 (2.5% pot rake); blocked pending OD-09 | RB-07 | **RESOLVED** |
| **ISS-28** | Provider fee double-counting risk across Accounts 2040 & 5010 | v4.2.7 | High | Spec Sec 5.4 | Specified | Formalized 6 provider-fee cases; Account 5010 debited only for unquoted variance | RB-57, 58 | **RESOLVED** |
| **ISS-29** | Withdrawal SLA mismatch & dormant account fee risk | v4.2.7 | Medium | Spec Sec 3.5 | Unreconciled | Preserved player 1-2h SLA; manual review 6h/12h SLA; dormant fee deferred | RB-52, OP-05 | **RESOLVED** |

---
**END OF CHANGELOG — ABAY CHESS v4.2.7-PROD**  
*STATUS: PENDING OWNER APPROVAL — IMPLEMENTATION PROHIBITED*
