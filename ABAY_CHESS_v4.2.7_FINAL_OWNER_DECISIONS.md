# ABAY CHESS — v4.2.7-PROD
## Master Owner Decisions Register & Governance Policy

**Document Version:** 4.2.7-PROD  
**Document Type:** Authoritative Register of Governance, Business & Financial Policy Decisions  
**Target Version:** v4.2.7-PROD  
**Status:** PENDING OWNER SIGN-OFF — **STRICT NO-IMPLEMENTATION PHASE**  
**Repository Basis:** `Castle-3d-multiplayer-with-ai-vercel-eve-nextjs-clerk-main` (Commit `06acb94`)  
**Production Domain:** `abaychess.com`  

---

## 1. EXECUTIVE SUMMARY & GOVERNANCE RULES

The Abay Chess architecture separates technical implementation from executive business policy. While technical and security standards are enforced automatically by Convex schema invariants, strategic business limits, fee absorption rules, emergency circuit breakers, and dispute resolutions require explicit Owner ratification.

### 1.1 Non-Negotiable Core Policies (Already Approved)
The following core policies are permanent and cannot be modified by decision options:
1. **Zero Deposit/Withdrawal Platform Markup:** Abay Chess earns **zero revenue** from payment deposits or player withdrawals. Platform revenue is derived strictly from game commission rake.
2. **Net Withdrawal Guarantee:** Players receive 100% of the requested withdrawal amount. Verified provider service fees are added to the total wallet deduction and disclosed before confirmation.
3. **Integer Santims Invariant:** All financial values use 64-bit integer santims ($1\text{ ETB} = 100\text{ santims}$). Zero floating-point arithmetic.
4. **Owner Sole Payout Authority:** Only the Owner (authenticated via Clerk Subject ID) can authorize platform profit distributions.
5. **Exact Accounting Structure:** The platform ledger is organized into **17 Canonical Accounts** (including active asset Account `1050 Player Overdrafts Receivable` and separate expense accounts `5020 Promotion & Bonus Expense` and `5030 Dispute & Chargeback Loss Expense`) and **14 Database Tables**.

---

## 2. COMPREHENSIVE DECISION REGISTER (OD-01 THROUGH OD-13)

### Decision OD-01: Minimum Owner Capital Reserve Threshold
- **Subject:** Capital floor in Account 3010 (Retained Platform Earnings) that cannot be distributed to the Owner.
- **Why Required:** Protects the platform against sudden operational liabilities, dispute buffers, and unexpected banking clawbacks.
- **Options:**
  - *Option A (Recommended):* **1,000.00 ETB (100,000 santims)** capital floor.
  - *Option B:* 5,000.00 ETB (500,000 santims) conservative floor.
  - *Option C:* Dynamic buffer equal to 10% of 30-day rolling transaction volume.
- **Financial Consequences:** Option A balances immediate liquidity with an adequate buffer for an early-stage deployment.
- **Status:** **PENDING OWNER SELECTION**

---

### Decision OD-02: Solvency Caution Threshold & 105% Coverage Enforcement
- **Subject:** Solvency ratio level that triggers Caution Mode and governs Distributable Cash calculations.
- **Why Required:** Determines when to throttle withdrawals and block owner distributions before an insolvency breach occurs.
- **Options:**
  - *Option A (Recommended):* **105% Coverage Ratio** ($\text{Eligible Cleared Cash} / \text{Total Obligations} \ge 1.05$).
    * Formula Enforcement: Distributable cash surplus deducts 105% of all liabilities:
      $$\text{EligibleCashSurplus} = \max\left(0, \ C_{\text{eligible}} - \left\lceil \frac{105 \times \mathcal{L}_{\text{total}}}{100} \right\rceil - \text{OperatingBuffer}\right)$$
      $$\mathbf{DistributableCap} = \max\Big(0, \ \min(\text{BookEquity}, \ \text{EligibleCashSurplus})\Big)$$
    * $\text{PendingCommitments}$ Definition: Sum of unposted commitments in `durableQueue` where `postedTransactionId == null`. Excludes transactions whose reservations have already posted to Accounts 2010–2090 to prevent double-counting.
  - *Option B:* 110% Coverage Ratio (Higher safety margin, but restricts operational cash).
  - *Option C:* 102% Coverage Ratio (Narrow margin).
- **Financial Consequences:** Option A provides an early warning buffer if provider clearing is delayed, ensuring Owner distributions can never reduce cash coverage below 105%.
- **Status:** **PENDING OWNER SELECTION**

---

### Decision OD-03: High-Value Withdrawal Review Threshold & Operational Processing SLA
- **Subject:** Withdrawal amount triggering mandatory manual review and operational SLA limits.
- **Why Required:** Prevents automated draining of platform bank accounts in the event of compromised player credentials or game exploit, while defining realistic staff processing timelines without publishing contradictory player commitments.
- **Threshold Options:**
  - *Option A (Recommended):* **2,000.00 ETB (200,000 santims)**.
  - *Option B:* 1,000.00 ETB (100,000 santims) (More manual staff workload).
  - *Option C:* 5,000.00 ETB (500,000 santims) (Higher exposure).
- **Operational SLA Options for Reviewed Withdrawals:**
  - *SLA Option 1 (Recommended):* **Up to 6 hours during daytime (08:00–20:00 EAT)** and **up to 12 hours overnight (20:00–08:00 EAT)**.
  - *SLA Option 2:* Fixed 24-hour SLA.
- **Player-Facing Expectation Alignment:**
  - Standard automated withdrawals ($\le \text{Threshold}$): Preserves the approved player-facing commitment: **`"Expected withdrawal processing time: 1-2 hours."`**
  - High-value withdrawals ($> \text{Threshold}$): UI explicitly displays: `"Manual verification required: estimated processing up to 6 hours (or 12 hours overnight)."`
- **Security Consequences:** Strikes an optimal balance between player convenience and fraud mitigation without creating contradictory expectations.
- **Status:** **PENDING OWNER SELECTION**

---

### Decision OD-04: CBE Birr Payment Channel Activation Status
- **Subject:** Operational status of CBE Birr for deposits and withdrawals.
- **Why Required:** Repository audit revealed that official CBE Birr programmatic transfer tariffs and automated verification interfaces are unverified.
- **Options:**
  - *Option A (Recommended):* **Strictly DISABLED** in production until provider API certification and tariff verification are completed.
  - *Option B:* Enabled for manual deposit matching only; disabled for withdrawals.
- **Risk Assessment:** Option A eliminates all risk of financial discrepancy or player fee disputes.
- **Status:** **PENDING OWNER SELECTION**

---

### Decision OD-05: Phase 1 Cutover Maintenance Window
- **Subject:** Scheduled downtime window for opening balance reconstruction and ledger freeze.
- **Why Required:** Phase 1 cutover requires reconciling historical player balances against external bank statements.
- **Options:**
  - *Option A (Recommended):* **Sunday 02:00 – 04:00 EAT (East Africa Time)**.
  - *Option B:* Monday 03:00 – 05:00 EAT.
- **Operational Impact:** Option A coincides with lowest concurrent gameplay traffic in Ethiopia.
- **Status:** **PENDING OWNER SELECTION**

---

### Decision OD-06: Durable Queue Retry Policy Before Dead-Lettering
- **Subject:** Number of automatic retries and backoff schedule for failed asynchronous financial tasks.
- **Why Required:** Prevents infinite retry loops on terminal errors while allowing recovery from transient network glitches.
- **Options:**
  - *Option A (Recommended):* **5 Retries with Exponential Backoff** (10s, 30s, 2m, 10m, 30m) before routing to DLQ.
  - *Option B:* 3 Retries (Faster escalation to staff).
- **Technical Consequences:** Option A prevents unnecessary administrative paging during minor provider outages.
- **Status:** **PENDING OWNER SELECTION**

---

### Decision OD-07: Account 3999 (Suspense) vs Account 1050 (Overdrafts) Governance & Quarantine Policy
- **Subject:** Treatment of unexplained statement discrepancies (Account 3999) versus identified customer overdrafts (Account 1050).
- **Why Required:** Unresolved statement discrepancies must never conceal unexplained cash shortfalls or inflate distributable profits. Known customer overdrafts must be tracked as accounting receivables and never conflated with mystery variances.
- **Account 1050 Governance Standards:**
  * *Nature of Balance:* An internal accounting asset recording an unpaid deficit from a reversed deposit; not automatically a legally perfected debt under civil law without documentary proof of identity and consent.
  * *Required Evidence:* Core Banking statement reference voucher, deposit link, ledger proof of spent funds ($A < D$), timestamped freeze audit log.
  * *Player Rights:* 14-day dispute window, support ticket review within 5 business days.
  * *Write-Off Authorization:* Owner-only authority after 90 days of default, debiting `5030 Dispute & Chargeback Loss Expense` and crediting `1050 Player Overdrafts Receivable`.
  * *Freeze Restriction:* `frozen_overdraft` cannot be manually removed by staff; requires full repayment or signed Owner write-off.
- **Options for Account 3999:**
  - *Option A (Recommended):* **Strict Dual-Convention Quarantine with Single Absolute-Value Cap Reduction**.
    * If Debit Balance (Asset Shortage): Treated as Contra-Equity, directly reducing distributable profit ETB-for-ETB.
    * If Credit Balance (Unexplained Excess): Treated as a Quarantined Suspense Liability, strictly excluded from equity/revenue.
    * Formula Impact: Authoritative Book Equity subtracts $|\text{Balance}(3999)|$ once: $\text{BookEquity} = \max(0, \text{Balance}(3010) - \text{Balance}(3020) - \text{CapitalReserve} - |\text{Balance}(3999)|)$. Eliminates double deduction.
    * Payout Cap Impact: $\mathbf{DistributableCap} = \max(0, \min(\text{BookEquity}, \text{EligibleCashSurplus}))$.
    * Quarantine Gate: If $|\text{Balance}(3999)| > 0$, automated Owner payouts are instantly frozen until formally resolved.
  - *Option B:* Automatically write off minor variances ($< 100\text{ ETB}$) directly to platform expense/revenue without payout freeze.
- **Audit Consequences:** Option A guarantees rigorous institutional accounting and prevents unauthorized capital extraction.
- **Status:** **PENDING OWNER SELECTION**

---

### Decision OD-08: Payment PII Unmasking Audit Policy & Dormant Accounts Review
- **Subject:** Staff permissions and audit trail for viewing unmasked player bank accounts and phone numbers, and legal review of dormant accounts.
- **Why Required:** Protects player financial privacy, complies with Ethiopian data protection standards, and ensures adherence to National Bank of Ethiopia customer deposit directives.
- **Options:**
  - *Option A (Recommended):* **Restricted to `view_payment_pii` permission** with mandatory append-only audit logging recording staff ID, player ID, timestamp, client IP, and explicit justification prompt.
  - *Option B:* Owner-only access (Admins cannot view full account numbers even during dispute investigation).
- **Dormant Account Liability Clarification:**
  * Player deposits in Account 2010 represent customer liabilities that **do not expire**.
  * Any proposed monthly dormant account maintenance fee (such as 10.00 ETB/month after 12 months) is **NOT approved, NOT implemented**, and remains strictly deferred pending separate Owner authorization and formal legal/regulatory compliance review under National Bank of Ethiopia customer deposit safeguarding directives.
- **Security Consequences:** Option A enables effective customer support while maintaining complete forensic accountability.
- **Status:** **PENDING OWNER SELECTION**

---

### Decision OD-09: Mutual Accepted Draw & Organic Draw Settlement Policy Ratification
- **Subject:** Platform commission and refund policy for mutual accepted draws and organically occurring draws.
- **Why Required:** Distinguishes collusive/early draw agreements from natural chess draws. The existing codebase (`convex/lib/games.ts:210`) implements 100% refund / 0% rake for all draws. A formalized policy is required before enabling mutual draw commission.
- **Mutual Accepted Draw Policy Options (BLOCKED Pending Selection):**
  - *Alternative 1 (Recommended):* **5% Deduction from Each Player's Original Stake (5% Total Pot Rake)**.
    * Each player loses 5% of their stake ($0.05S$). White refunded 95% ($0.95S = 47.5\%$ of pot), Black refunded 95% ($0.95S = 47.5\%$ of pot). Platform rake = 5% of total gross pot ($0.10S$).
    * Journal: Debit `2020 Escrow` ($2S$), Credit `2010 Player Deposits` (White: $0.95S$), Credit `2010 Player Deposits` (Black: $0.95S$), Credit `4010 Commission` ($0.10S$).
  - *Alternative 2:* **2.5% Deduction from Each Player's Original Stake (2.5% Total Pot Rake)**.
    * Each player loses 2.5% of their stake ($0.025S$). White refunded 97.5% ($0.975S = 48.75\%$ of pot), Black refunded 97.5% ($0.975S = 48.75\%$ of pot). Platform rake = 2.5% of total gross pot ($0.05S$).
    * Journal: Debit `2020 Escrow` ($2S$), Credit `2010 Player Deposits` (White: $0.975S$), Credit `2010 Player Deposits` (Black: $0.975S$), Credit `4010 Commission` ($0.05S$).
  - *Alternative 3:* **100% Stake Refund / 0% Platform Commission** (Preserve current codebase behavior for all draws).
- **Organic Draw (Stalemate, 50-move rule, repetition, insufficient material):**
  - Ratify **100% Full Refund / 0% Platform Commission** across all options.
- **Implementation Boundary:** Implementation of any mutual accepted draw commission is **STRICTLY BLOCKED** until the Owner explicitly ratifies Alternative 1 or Alternative 2. Until ratified, Alternative 3 remains the active default.
- **Status:** **PENDING OWNER SELECTION**

---

### Decision OD-10: Emergency Circuit-Breaker Stakes Limit
- **Subject:** Enforcing a temporary maximum match stake ceiling if the platform enters Caution Mode ($100\% \le \text{Solvency} < 105\%$).
- **Why Required:** Prevents rapid accumulation of high-value escrow liabilities during periods of delayed provider clearing.
- **Options:**
  - *Option A (Recommended):* **Enforce 50.00 ETB Maximum Match Stake** during Caution Mode until cleared cash recovers.
  - *Option B:* Enforce 100.00 ETB Maximum Match Stake.
  - *Option C:* Do not cap match stakes; throttle withdrawals only.
- **Risk Assessment:** Option A limits platform liability exposure during external gateway disruptions.
- **Status:** **PENDING OWNER SELECTION**

---

### Decision OD-11: Unverified Provider Tariffs & Boundary Gap Circuit Breakers
- **Subject:** Automated handling when a withdrawal falls into an unverified route or documented public tariff boundary gap:
  1. *Telebirr Boundary Gap ($100.00 - 100.99\text{ ETB}$ / $10,000 - 10,099\text{ santims}$):* Ethio Telecom public literature specifies `< 100` and `101–500`, leaving $[100.00, 100.99\text{ ETB}]$ unaddressed.
  2. *CBE Birr Disbursements:* Lack official programmatic B2C fee documentation.
  3. *Corporate B2C Automated API:* Institutional fee schedules differ from retail mobile banking.
- **Why Required:** Protects both the player and the platform from unexpected fee discrepancies, arbitrary rounding, or inaccurate disclosures.
- **Options:**
  - *Option A (Recommended):* **Strictly Block & Quarantine**.
    * Mark Telebirr $100.00 - 100.99\text{ ETB}$ as `UNRESOLVED_BOUNDARY_QUARANTINED`.
    * Mark CBE Birr as `UNVERIFIED` (permanently disabled).
    * Mark Corporate B2C as `UNVERIFIED_CORPORATE_B2C` (quarantined until corporate contract executed).
    * Display transparent message directing player to verified channels or manual support.
  - *Option B:* Allow withdrawal confirmation with estimated placeholder fees, platform absorbing discrepancies.
- **Financial Consequences:** Option A strictly enforces the zero-markup, zero-loss pass-through policy.
- **Status:** **PENDING OWNER SELECTION**

---

### Decision OD-12: CBE Fractional Santim Rounding vs Quarantine Policy
- **Subject:** Determining pass-through calculation and rounding treatment for CBE Band 1 ($1.00 - 1,000.00\text{ ETB}$): Base 0.50 ETB + 15% VAT = 0.575 ETB (57.5 santims).
- **Why Required:** In fiat banking, 1 santim is the indivisible base currency unit. Specifying a fractional debit (57.5 santims) or assuming rounding without empirical CBS voucher proof violates technical precision.
- **Options:**
  - *Option A (Recommended):* **Quarantine Band 1 as `FRACTIONAL_SANTIM_QUARANTINED`**. Keep inactive for automated quoting until an empirical CBE statement voucher confirms whether the Core Banking System debits 57 or 58 santims. Active verified payouts use Band 2 ($1,001 - 5,000\text{ ETB} = 1.15\text{ ETB}$ / 115 s.), Band 3 (2.30 ETB), Band 4 (3.45 ETB), and Band 5 (5.75 ETB).
  - *Option B:* Round up to 58 santims integer ceiling without empirical proof, absorbing any 0.5 santim debit variance into Account 5010.
- **Financial Consequences:** Option A ensures zero unverified financial assumptions are introduced into production accounting.
- **Status:** **PENDING OWNER SELECTION**

---

### Decision OD-13: High-Value Owner Payout Timelock & Multi-Factor Requirement
- **Subject:** Security requirements for large Owner profit distributions ($> 50,000.00$ ETB).
- **Why Required:** Safeguards platform treasury against session hijacking or compromised owner credentials.
- **Options:**
  - *Option A (Recommended):* **Mandatory 24-Hour Timelock + Dual-Factor Re-authentication** before funds can transition from `authorized` to `escrowed`.
  - *Option B:* Instant execution upon MFA confirmation.
- **Security Assessment:** Option A ensures out-of-band detection and cancellation if unauthorized distribution requests occur.
- **Status:** **PENDING OWNER SELECTION**

---

## 3. DECISION SUMMARY & SIGN-OFF TABLE

| Decision ID | Summary Question | Recommended Setting | Owner Decision | Signature & Date |
| :--- | :--- | :--- | :--- | :--- |
| **OD-01** | Minimum Owner Capital Reserve Floor | **1,000.00 ETB (100,000 s.)** | `[  ]` Option A / B / C | ____________________ |
| **OD-02** | Solvency Caution Level Trigger | **105% Coverage Ratio** | `[  ]` Option A / B / C | ____________________ |
| **OD-03** | High-Value Withdrawal Review Floor | **2,000.00 ETB (200,000 s.)** | `[  ]` Option A / B / C | ____________________ |
| **OD-04** | CBE Birr Deployment Status | **Strictly DISABLED** | `[  ]` Option A / B | ____________________ |
| **OD-05** | Phase 1 Maintenance Window | **Sunday 02:00 – 04:00 EAT** | `[  ]` Option A / B | ____________________ |
| **OD-06** | Queue Retry Limit Before DLQ | **5 Retries (Exponential)** | `[  ]` Option A / B | ____________________ |
| **OD-07** | Account 3999 Historical Discrepancy | **Quarantined in Equity** | `[  ]` Option A / B | ____________________ |
| **OD-08** | Payment PII Unmasking Audit Policy | **Elevated RBAC + Audit Log** | `[  ]` Option A / B | ____________________ |
| **OD-09** | Organic Draw Settlement Policy | **100% Full Refund / 0% Rake** | `[  ]` Option A / B | ____________________ |
| **OD-10** | Emergency Match Stake Ceiling | **50.00 ETB Max Stake** | `[  ]` Option A / B / C | ____________________ |
| **OD-11** | Unverified / Boundary Gap Tariffs | **Strict Automated Block & Quarantine** | `[  ]` Option A / B | ____________________ |
| **OD-12** | CBE Fractional Santim Treatment | **Quarantine Band 1 Until CBS Voucher** | `[  ]` Option A / B | ____________________ |
| **OD-13** | High-Value Payout Timelock | **24h Timelock + MFA** | `[  ]` Option A / B | ____________________ |

---
**END OF OWNER DECISIONS REGISTER — ABAY CHESS v4.2.7-PROD**  
*STATUS: PENDING OWNER APPROVAL — IMPLEMENTATION PROHIBITED*
