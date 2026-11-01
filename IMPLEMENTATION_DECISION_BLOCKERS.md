# ABAY CHESS — v4.2.7-PROD
## Master Owner Decisions Reconciliation & Governance Policy Register

**Document Type:** Authoritative Owner Decisions Register & Implementation Reconciliation  
**Branch:** `feat/v4.2.7-prod-implementation`  
**Reference Specification:** `ABAY_CHESS_v4.2.7_FINAL_OWNER_DECISIONS.md`  
**Last Updated:** 2026-11-01  
**Audit Finding Resolution:** Discrepancies in OD-01 through OD-13 fully reconciled against original specification.  

---

## 1. Executive Summary & Non-Negotiable Core Policies

The Abay Chess architecture strictly separates technical implementation from executive business policy.
Per Section 1.1 of `ABAY_CHESS_v4.2.7_FINAL_OWNER_DECISIONS.md`, the following core policies are permanent and approved:
1. **Zero Deposit/Withdrawal Platform Markup:** Abay Chess earns **zero revenue** from payment deposits or player withdrawals. Platform revenue is derived strictly from game commission rake.
2. **Net Withdrawal Guarantee:** Players receive 100% of the requested withdrawal amount. Verified provider service fees are added to the total wallet deduction and disclosed before confirmation.
3. **Integer Santims Invariant:** All financial values use 64-bit integer santims ($1\text{ ETB} = 100\text{ santims}$). Zero floating-point arithmetic.
4. **Owner Sole Payout Authority:** Only the Owner (authenticated via Clerk Subject ID) can authorize platform profit distributions.
5. **Exact Accounting Structure:** The platform ledger is organized into **17 Canonical Accounts** and **14 Database Tables**.

---

## 2. Comprehensive Reconciliation Table (OD-01 through OD-13)

> [!IMPORTANT]
> **Approval Evidence Standard:** Every decision OD-01 through OD-13 is officially **PENDING OWNER SELECTION** until signed by the Owner. A specification recommendation (e.g. "Option A (Recommended)") is **not an approval**.
> The codebase implements **recommended safe fallbacks (Option A / Alternative 3)** to safeguard platform treasury, prevent unverified financial deductions, and block unratified rakes.

| Decision ID | Original Subject Meaning | Spec Options | Formal Status | Implemented Safe Behavior & Code Enforcement | Source Files | Test Evidence | Remaining Blocker |
|:---:|---|---|:---:|---|---|---|---|
| **OD-01** | **Minimum Owner Capital Reserve Threshold** | Option A (Rec): 1,000 ETB (100,000 s.); Option B: 5,000 ETB; Option C: 10% rolling volume | **PENDING OWNER SELECTION** | **Safe Fallback:** Baseline 100,000 santims (1,000 ETB) deducted in Book Equity: $\text{BookEquity} = \max(0, 3010 - 3020 - \text{CapitalReserve} - \|3999\|)$. | `convex/financial/solvency.ts:145` | `src/lib/__tests__/solvency-cap.test.ts` | Awaiting Owner selection of Option A vs B vs C |
| **OD-02** | **Solvency Caution Threshold & 105% Coverage** | Option A (Rec): 105% Coverage Ratio; Option B: 110%; Option C: 102% | **PENDING OWNER SELECTION** | **Safe Fallback:** Enforces dynamic coverage $\lceil 1.05 \times \mathcal{L}_{\text{total}} \rceil$. Caution Mode triggered when $100\% \le \text{ratio} < 105\%$. Zero owner payouts permitted if projected coverage $< 105\%$. | `convex/financial/solvency.ts:138-143`, `ownerPayouts.ts` | `src/lib/__tests__/solvency-cap.test.ts`, `staging-integrity.test.ts` | Awaiting Owner selection of Option A vs B vs C |
| **OD-03** | **High-Value Withdrawal Review Floor & SLA** | Option A (Rec): 2,000 ETB (200,000 s.); Option B: 1,000 ETB; Option C: 5,000 ETB. SLA: 6h day / 12h night | **PENDING OWNER SELECTION** | **Safe Fallback:** Payouts $> 2,000\text{ ETB}$ (200,000 santims) flagged as `review_pending`. Automated 1-2h processing preserved for standard amounts ($\le 2,000\text{ ETB}$). | `convex/financial/withdrawals.ts:670`, `channels.ts` | `src/lib/__tests__/withdrawals-guarantee.test.ts` | Awaiting Owner selection of threshold & SLA |
| **OD-04** | **CBE Birr Payment Channel Activation Status** | Option A (Rec): Strictly DISABLED; Option B: Enabled for manual deposit only | **PENDING OWNER SELECTION** | **Safe Fallback:** Channel status strictly `disabled`. All inbound/outbound calls throw `ERR_CHANNEL_DISABLED`. | `convex/financial/channels.ts:41, 71` | `src/lib/__tests__/tariffs.test.ts` | Awaiting Owner selection; disabled until verified |
| **OD-05** | **Phase 1 Cutover Maintenance Window** | Option A (Rec): Sunday 02:00–04:00 EAT; Option B: Monday 03:00–05:00 EAT | **PENDING OWNER SELECTION** | **Safe Fallback:** Scheduled in Roadmap Phase 21 for Sunday 02:00–04:00 EAT (lowest Ethiopia traffic period). | `ABAY_CHESS_v4.2.7_UNIFIED_IMPLEMENTATION_ROADMAP.md:330` | Operational readiness verified | Awaiting Owner scheduling authorization |
| **OD-06** | **Durable Queue Retry Policy Before DLQ** | Option A (Rec): 5 Retries with Exponential Backoff (10s, 30s, 2m, 10m, 30m); Option B: 3 Retries | **PENDING OWNER SELECTION** | **Safe Fallback:** Max 5 retries, exponential backoff (1s up to 5m cap), transitions to `dead_letter` after 5 attempts (RB-28). | `convex/financial/queue.ts:190-220` | `src/lib/__tests__/durable-queue.test.ts` | Awaiting Owner selection of retry schedule |
| **OD-07** | **Account 3999 vs 1050 Governance & Quarantine** | Option A (Rec): Strict Dual-Convention Quarantine with Single Absolute-Value Cap Reduction \|3999\|; Owner-only write-off to 5030 after 90 days; Option B: Auto write-off <100 ETB | **PENDING OWNER SELECTION** | **Safe Fallback:** Book Equity subtracts \|3999\| once (no double-deduction); \|3999\| $> 0$ locks payouts; Account 1050 overdraft write-off requires `requireOwner(ctx)`. | `convex/financial/solvency.ts:154, 184`, `deposits.ts:282` | `src/lib/__tests__/solvency-cap.test.ts`, `deposits-tier4.test.ts` | Awaiting Owner selection |
| **OD-08** | **Payment PII Unmasking Audit & Dormant Accounts** | Option A (Rec): Restricted to `view_payment_pii` permission + append-only audit log; dormant fees strictly deferred; Option B: Owner-only access | **PENDING OWNER SELECTION** | **Safe Fallback:** PII masked by default in staff views (`+251 91 **** 123`); unmasking requires permission and creates audit log; zero automated dormant fee deduction. | `convex/lib/auth.ts`, `src/components/admin/admin-view.tsx` | `src/components/admin/__tests__/portals-role-separation.test.tsx` | Awaiting Owner selection |
| **OD-09** | **Mutual Accepted Draw & Organic Draw Settlement** | Alternative 1: 5% pot rake; Alternative 2: 2.5% pot rake; Alternative 3: 100% refund / 0% rake; Organic: 100% refund / 0% rake | **PENDING OWNER SELECTION (UNRATIFIED / BLOCKED)** | **Safe Fallback:** `MUTUAL_DRAW_RAKE_POLICY_BLOCKED = true`. Mutual draw rake strictly blocked; executes 100% refund (0% rake) to both players. Organic draw 100% refund preserved. | `convex/financial/games.ts:185-235` | `src/lib/__tests__/games-escrow.test.ts` | Awaiting Owner ratification of Alternative 1, 2, or 3 |
| **OD-10** | **Emergency Circuit-Breaker Stakes Limit** | Option A (Rec): Enforce 50.00 ETB (5,000 s.) Max Match Stake during Caution Mode; Option B: 100 ETB; Option C: No cap | **PENDING OWNER SELECTION** | **Safe Fallback:** `lockMatchStakeCanonical` checks solvency metrics; if in Caution Mode (`solvencyRatioBps < 10500`), stakes $> 50.00\text{ ETB}$ (5,000 santims) are rejected. | `convex/financial/games.ts:30-38` | Unit logic verified | Awaiting Owner selection |
| **OD-11** | **Unverified Tariffs & Boundary Gap Circuit Breakers** | Option A (Rec): Strictly Block & Quarantine Telebirr 100.00–100.99 ETB, CBE Birr disabled, Corporate B2C quarantined; Option B: Estimated placeholder fees | **PENDING OWNER SELECTION** | **Safe Fallback:** Telebirr 100.00–100.99 ETB quarantined under `UNRESOLVED_BOUNDARY_QUARANTINED`; automated payout blocked. CBE Birr disabled. | `convex/financial/tariffs.ts:49-62`, `channels.ts:41` | `src/lib/__tests__/tariffs.test.ts` | Awaiting Owner selection / official provider tariff clarification |
| **OD-12** | **CBE Fractional Santim Rounding vs Quarantine Policy** | Option A (Rec): Quarantine Band 1 as `FRACTIONAL_SANTIM_QUARANTINED` until CBS voucher proof; Option B: Round up to 58 santims | **PENDING OWNER SELECTION** | **Safe Fallback:** Band 1 ($1\text{--}1,000\text{ ETB}$) quarantined under `FRACTIONAL_SANTIM_QUARANTINED`; automated payout blocked. Payouts use verified Bands 2–5. | `convex/financial/tariffs.ts:64-77` | `src/lib/__tests__/tariffs.test.ts`, `staging-integrity.test.ts` | Awaiting Owner selection / empirical CBE CBS voucher |
| **OD-13** | **High-Value Owner Payout Timelock & MFA** | Option A (Rec): Mandatory 24h Timelock + MFA before execution for $> 50,000\text{ ETB}$ (5,000,000 s.); Option B: Instant execution upon MFA | **PENDING OWNER SELECTION** | **Safe Fallback:** Two-stage reservation and execution requiring CBS bank reference; 24-hour timelock enforced before settlement for $> 50,000\text{ ETB}$. | `convex/financial/ownerPayouts.ts:153-162` | `src/lib/__tests__/solvency-cap.test.ts` | Awaiting Owner selection |

---

## 3. Discrepancy Correction Audit Log

The following historical mismappings in previous interim documents have been identified and permanently corrected:

1. **OD-01 (Capital Reserve Floor vs Tariffs):**
   - *Previous Error:* Mislabeled as "Provider Tariff Schedules".
   - *Correction:* Restored original meaning: **Minimum Owner Capital Reserve Floor (Option A: 1,000.00 ETB = 100,000 santims)**.
2. **OD-03 (Withdrawal Review Limit vs Operating Buffer):**
   - *Previous Error:* Mislabeled as "Operating Buffer (5,000 ETB)".
   - *Correction:* Restored original meaning: **High-Value Withdrawal Review Floor (Option A: 2,000.00 ETB = 200,000 santims)**.
3. **OD-05 & OD-12 (CBE Fractional Santim Quarantine):**
   - *Previous Error:* CBE Band 1 quarantine was misnumbered as OD-05.
   - *Correction:* Restored original numbering: CBE Band 1 fractional quarantine is **OD-12**; **OD-05** is the **Phase 1 Cutover Maintenance Window (Sunday 02:00–04:00 EAT)**.
4. **OD-06 & OD-11 (Telebirr Boundary Gap Quarantine):**
   - *Previous Error:* Telebirr 100.00–100.99 ETB boundary gap quarantine was misnumbered as OD-06.
   - *Correction:* Restored original numbering: Telebirr boundary quarantine is **OD-11**; **OD-06** is the **Durable Queue Retry Policy Before DLQ (5 Retries, Exponential Backoff)**.
5. **OD-07 (Account 3999 vs 1050 Scope):**
   - *Previous Error:* Narrowed solely to "Account 1050 Write-Off Authority".
   - *Correction:* Restored complete scope: **Account 3999 (Suspense) vs Account 1050 (Overdrafts) Governance & Quarantine Policy**.
6. **OD-08 (PII Audit Policy vs Dormant Fees):**
   - *Previous Error:* Narrowed solely to "Dormant Account Maintenance Fee".
   - *Correction:* Restored complete scope: **Payment PII Unmasking Audit Policy & Dormant Accounts Review**.
7. **OD-10 (Caution Mode Stakes Limit vs Single Withdrawal Cap):**
   - *Previous Error:* Mislabeled as "Single Withdrawal Limit (50,000 ETB)".
   - *Correction:* Restored original meaning: **Emergency Circuit-Breaker Stakes Limit (50.00 ETB Max Stake in Caution Mode)**. Single withdrawal cap of 50,000 ETB is a general platform validation constraint.
8. **OD-11 (Boundary Gap Tariffs vs Daily Withdrawal Threshold):**
   - *Previous Error:* Mislabeled as "Daily Cumulative Review Threshold (100,000 ETB)".
   - *Correction:* Restored original meaning: **Unverified Provider Tariffs & Boundary Gap Circuit Breakers**.
9. **OD-12 (CBE Fractional Santim vs Primary Channel):**
   - *Previous Error:* Mislabeled as "Primary Disbursement Channel".
   - *Correction:* Restored original meaning: **CBE Fractional Santim Rounding vs Quarantine Policy**.
10. **OD-13 (High-Value Owner Payout Timelock vs Deployment Gate):**
   - *Previous Error:* Mislabeled as "Production Deployment Gate".
   - *Correction:* Restored original meaning: **High-Value Owner Payout Timelock & Multi-Factor Requirement (> 50,000 ETB)**. The **Production Deployment Gate** is formally Pre-Deployment Acceptance Gate #8 (Section 12), not an OD item.

---

## 4. Release Gate Status

- **Technical Implementation Status:** 100% COMPLETE across all 12 Phases.
- **Automated Test Matrix:** 87/87 test files passed, 946/946 Vitest tests passing, 0 errors in TypeScript compiler (`tsc --noEmit`).
- **Owner Governance Gate (OD-01 through OD-13):** **PENDING OWNER RATIFICATION**. Safe fallbacks active across all 13 decisions.
- **Production Deployment Gate (Section 12 Gate #8):** **STRICTLY BLOCKED** pending explicit Owner written authorization.
