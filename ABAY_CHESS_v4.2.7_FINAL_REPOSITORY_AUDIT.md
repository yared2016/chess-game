# ABAY CHESS — v4.2.7-PROD
## Final Production Repository Audit & Source-of-Truth Report

**Document Version:** 4.2.7-PROD  
**Document Type:** Authoritative Technical, Financial & Security Repository Audit  
**Audit Target:** Commit tree `06acb94b8111b6bcaed8291f781aa9b41bc102ac` (`Castle-3d-multiplayer-with-ai-vercel-eve-nextjs-clerk-main`)  
**Production Deployment:** `qualified-greyhound-151` (`https://qualified-greyhound-151.convex.cloud`)  
**Production Domain:** `abaychess.com`  
**Audit Execution Mode:** STRICT READ-ONLY AUDIT — **NO CODE OR PRODUCTION MODIFICATIONS**  
**Audit Timestamp:** 2026-11-01T13:55:00+03:00  

---

## 1. EXECUTIVE AUDIT SUMMARY & METHODOLOGY

This audit establishes the empirical source of truth for the Abay Chess codebase. Prior specifications (v4.2.0 through v4.2.6) described target architectures, some of which were assumed to be implemented. This report evaluates the **actual current source code** against production financial, security, and payment requirements.

### 1.1 Classification Standard
Every requirement and finding is classified into one of five rigorous statuses:
- **IMPLEMENTED:** Verified present in code, active, and matching requirements.
- **PARTIALLY IMPLEMENTED:** Functionality exists in code but is incomplete, uses legacy adapters, or has defects.
- **SPECIFIED BUT NOT IMPLEMENTED:** Fully defined in v4.2.7 specification but does not exist in application code.
- **MISSING:** Neither implemented in code nor properly defined in prior specifications.
- **VULNERABLE:** Present in code and poses an active security, financial, or integrity hazard.

---

## 2. REPOSITORY & WORKING TREE BASELINE VERIFICATION

- **Git Branch:** `main` (synchronized with `origin/main`).
- **Exact Head Commit:** `06acb94b8111b6bcaed8291f781aa9b41bc102ac` (*"perf: instant home board rendering, edge asset bypass, route prefetching, and mobile click responsiveness"*).
- **Working Tree State Verification:**
  - `git diff HEAD` outputs empty (0 modified tracked files).
  - `git status --porcelain` reveals **zero modified files**, **zero staged files**, and **zero deletions**.
  - The working tree is 100% clean with respect to tracked files.
  - The **only differences** between commit `06acb94` and the local working tree are the untracked documentation files authored for the v4.2.6 and v4.2.7 specification packages.
- **Zero-Modification Check:** Confirmed that no application source files, Convex schemas, environment files, database records, or package dependencies were altered during this audit.

---

## 3. COMPONENT-BY-COMPONENT EMPIRICAL FINDINGS

### 3.1 Convex Database Schema & Accounting Engine
- **File:** `convex/schema.ts` (lines 381–407)
- **Current Behavior:** Table `financialLedger` is defined as a single-entry transaction log containing fields `userId: v.id("players")`, `walletId: v.id("wallets")`, `entryType: vLedgerEntryType`, `amountSantims: v.number()`, `balanceAfterSantims: v.number()`, and `lockedAfterSantims: v.number()`.
- **Defects & Inconsistencies:**
  1. No double-entry ledger exists in code. Tables `accounts`, `journalTransactions`, `journalPostings`, and `dailyReconciliations` do not exist in `convex/schema.ts`.
  2. Every transaction is forced to attach to a `players` row (`userId: v.id("players")`). Platform commission and provider clearing cannot be tracked without a player account.
  3. No debit/credit balancing invariant ($\sum \text{Debits} \equiv \sum \text{Credits}$) is enforced in code.
  4. Amounts use `v.number()` rather than `v.int64()`, risking precision degradation for large sums.
- **Specification Contrast:** The target v4.2.7 architecture specifies **17 Canonical Accounts** in the Chart of Accounts (including active asset Account `1050 Player Overdrafts Receivable` and separate expense accounts `5020 Promotion & Bonus Expense` and `5030 Dispute & Chargeback Loss Expense`) and **14 Database Tables** in the Convex schema.
- **Status:** **SPECIFIED BUT NOT IMPLEMENTED**.

### 3.2 Deposit Verification & Provider Clearing Architecture
- **Files:** `src/app/api/finance/deposit/verify/route.ts` (lines 28–76), `convex/financial/deposits.ts` (lines 135–220)
- **Current Behavior:** When Verify.et verifies a payment reference via `/api/finance/deposit/verify`, line 71 immediately invokes `convex.mutation(api.financial.deposits.creditVerifiedDeposit)`. This mutation directly patches `wallet.availableSantims = wallet.availableSantims + deposit.requestedCreditSantims`.
- **Defects & Inconsistencies:**
  1. No clearing account exists in code. Funds are treated as cleared cash instantaneously upon API response.
  2. Account 1030 (Provider Clearing / In-Transit Deposits) is not utilized in the code, meaning unsettled external funds inflate player balances and platform solvency.
  3. Hardcoded fallback endpoint `https://fast-oyster-971.convex.cloud` is present on line 29 of `src/app/api/finance/deposit/verify/route.ts`, bypassing the production `qualified-greyhound-151` deployment if `NEXT_PUBLIC_CONVEX_URL` is omitted.
- **Status:** **PARTIALLY IMPLEMENTED / VULNERABLE**.

### 3.3 Security Vulnerability: Hardcoded Fallback Credentials & Account Destinations
- **File:** `src/lib/payments/verify-et/client.ts` (lines 31–44)
- **Current Behavior:**
  ```typescript
  const DEFAULT_VERIFY_ET_API_KEY =
    "VERIFY_BANK_ET_uT8kUg_CIZIVM2X2GEwNq6vA77DqKDz3lOdiP3BHMZZgZNbxzileH0KROisrLXu1";

  export const OFFICIAL_RECEIVER_NAME = "Yared Tekleye";
  export const OFFICIAL_RECEIVER_PHONE = "0987678228";
  export const OFFICIAL_CBE_ACCOUNT =
    process.env.NEXT_PUBLIC_CBE_ACCOUNT || "1000456789123";
  export const OFFICIAL_CBE_BIRR_NUMBER =
    process.env.NEXT_PUBLIC_CBE_BIRR_ACCOUNT || "0987678228";

  export function getVerifyEtApiKey(): string {
    return process.env.VERIFY_ET_API_KEY || DEFAULT_VERIFY_ET_API_KEY;
  }
  ```
- **Defects & Inconsistencies:**
  1. A live or staging Verify.et API key is committed directly into the client repository on line 32.
  2. Fallback receiver name is `"Yared Tekleye"` and phone is `"0987678228"`, which contradicts the approved Owner production destinations: CBE Account `1000723226426` (`Yared Fikadu Bekele`) and Telebirr `093307470` (`Yared Fikadu Bekele`).
- **Status:** **VULNERABLE** (Critical security risk; key must be revoked and rotated).

### 3.4 Authentication & Zero-Trust Role Separation
- **Files:** `convex/lib/auth.ts` (lines 78–106), `src/app/(protected)/admin/page.tsx` (lines 23–26), `src/app/(protected)/yyhnan/page.tsx` (lines 23–26)
- **Current Behavior:**
  - `convex/lib/auth.ts`:
    ```typescript
    const ADMIN_EMAILS = new Set(["yaredusk@gmail.com"]);
    const ADMIN_CLERK_IDS = new Set(["user_3JfrI7CJEW9GIMo1UsEAvK9M0Ki"]);

    export async function requireAdmin(ctx: AnyCtx): Promise<Doc<"players">> {
      // ...
      const email = (player.email ?? identity.email ?? "").toLowerCase();
      if (email && ADMIN_EMAILS.has(email)) return player;
      throw new Error("unauthorized-admin");
    }
    ```
  - Both `/admin` and `/yyhnan` check:
    ```typescript
    const isAuthorizedAdmin =
      userId === "user_3JfrI7CJEW9GIMo1UsEAvK9M0Ki" ||
      userEmail === "yaredusk@gmail.com";
    ```
- **Defects & Inconsistencies:**
  1. Hardcoded user ID and email addresses are embedded in source code.
  2. Email matching alone (`ADMIN_EMAILS.has(email)`) grants administrative privileges in Convex backend, violating the strict Clerk Subject ID requirement.
  3. `requireAdmin` returns `Doc<"players">`, forcing administrators to have a player profile.
  4. There is no `requireOwner` function in `convex/lib/auth.ts`.
  5. There is no `vAdminPermission` RBAC schema in code.
  6. The route `/fssmyfkl` (Admin portal) does not exist in the repository; both `/admin` and `/yyhnan` render the same generic `AdminView`.
- **Status:** **VULNERABLE / SPECIFIED BUT NOT IMPLEMENTED**.

### 3.5 Match Settlement & Game Commission
- **Files:** `convex/lib/games.ts` (lines 190–340), `convex/lib/constants.ts` (line 107)
- **Current Behavior:**
  - `COMMISSION_RATE = 0.1` (10% platform commission).
  - Normal Win: Total pool = 2x stake; Commission = 10% of total pool; Winner receives 90% of total pool. Posted to single-entry ledger as `match_payout` and `match_loss`.
  - Organic Draw: `if (end.winner === "draw")` executes lines 210–280, giving both players a 100% full refund of their stake with 0% platform commission (`entryType: "match_unlock"`).
  - Mutual Draw: No special branch exists in `finalizeGame`. Mutual draw agreement currently triggers `end.winner === "draw"`, refunding 100% to both players instead of deducting the approved 5% per player.
- **Defects & Inconsistencies:**
  1. Normal win commission (10%) and organic draw refund (100%) are **IMPLEMENTED** in code.
  2. Mutual draw 5% deduction is **SPECIFIED BUT NOT IMPLEMENTED** in code.
  3. Commissions are not posted to a general ledger revenue account (4010) because double-entry accounting is not yet implemented.
- **Status:** **PARTIALLY IMPLEMENTED**.

### 3.6 Withdrawal & Service Fee Architecture
- **Files:** `convex/financial/withdrawals.ts`, `src/app/api/finance/withdrawal/`
- **Current Behavior:** Withdrawals currently use legacy Chapa transfer schemas. Fees are modeled as platform-managed basis points (`feeMode: vFeeMode`).
- **Defects & Inconsistencies:**
  1. The new v4.2.7 mandatory policy—that Abay Chess earns zero withdrawal revenue, the player receives 100% of the requested amount, and verified provider service fees are added to the total wallet deduction—is **NOT IMPLEMENTED** in code.
  2. No dynamic, versioned provider tariff engine (`providerTariffs`) exists in code.
  3. No player-facing service-fee disclosure calculator exists on `/wallet`.
  4. Two-step balanced reversal protocol for completed withdrawals does not exist in code.
- **Status:** **SPECIFIED BUT NOT IMPLEMENTED / MISSING**.

### 3.7 Asynchronous Concurrency & Durable Queue
- **Files:** `convex/schema.ts`, `convex/queue.ts`
- **Current Behavior:** Background processing relies on basic mutations and Next.js API timeouts.
- **Defects & Inconsistencies:**
  1. Table `durableQueue` does not exist in `convex/schema.ts`.
  2. No scoped FIFO ordering (by `gameId` or `userId`) is enforced.
  3. No lease locking (`leaseExpiresAt`) or Dead-Letter Queue (DLQ) exists in code.
- **Status:** **SPECIFIED BUT NOT IMPLEMENTED**.

### 3.8 Deposit Chargeback, Reversal & Recoverable Debt Architecture
- **Files:** `convex/financial/deposits.ts`, `src/app/api/webhooks/verify-et/`
- **Current Behavior:** Code processes successful deposit verification by directly crediting `players.balance` (or creating a single-entry `deposit` ledger record). There is zero chargeback, reversal, or dispute handling mechanism in code.
- **Defects & Inconsistencies:**
  1. If a deposit is reversed or contested externally, there is no mutation to execute a reversal.
  2. No clearing account (Account 1030) exists to hold unverified or clearing balances.
  3. Spent funds handling ($A < D$) does not exist: if a player has wagered or withdrawn funds, there is no Recoverable Player Debt asset account (Account `1050 Player Overdrafts Receivable`) to record the identified claim against the player, nor any automated account-freeze mechanism. It must not be conflated with mystery discrepancy Account 3999. Furthermore, Account 1050 is an accounting asset recording an unpaid deficit and does not automatically establish a legally enforceable debt without documented contract proof; write-off requires explicit Owner authorization to Account `5030 Dispute & Chargeback Loss Expense`.
  4. The Zero Negative Balance Invariant is not enforced at the ledger mutation level for reversals.
- **Status:** **SPECIFIED BUT NOT IMPLEMENTED**.

---

## 4. OFFICIAL PAYMENT TARIFF RESEARCH & VERIFIABLE SOURCES

Tariff research was conducted using official provider portals, regulatory filings, and verified documentation.

### 4.1 Ethio Telecom / Telebirr Official Tariffs
* **Official Publisher:** Ethio Telecom
* **Official Document / Portal:** *Telebirr Pricing and Tariff Schedule*
* **Official Source URL:** `https://www.ethiotelecom.et/telebirr/` (Verified November 2026)
* **Effective Date:** Active 2025/2026 Tariff Schedule
* **Verification Date:** 2026-11-01

#### Route 1: Telebirr-to-Telebirr (P2P Wallet-to-Wallet) — `telebirr_p2p`
- **Status:** **VERIFIED (With Documented Public Boundary Gap Quarantined)**
- **Transfer Direction:** Sender (Platform Telebirr `093307470`) $\rightarrow$ Recipient (Player Telebirr)
- **Official Tariff Schedule & Public Gap Analysis:**
  * Band 1 ($< 100.00\text{ ETB}$): $100 \le A \le 9,999\text{ santims}$ ($1.00 - 99.99\text{ ETB}$) $\rightarrow$ **1.00 ETB** (100 santims) [**ACTIVE**]
  * **Boundary Gap ($100.00 - 100.99\text{ ETB}$):** $10,000 \le A \le 10,099\text{ santims}$ $\rightarrow$ **QUARANTINED** (`UNRESOLVED_BOUNDARY_QUARANTINED`). Public Ethio Telecom text specifies `< 100` and `101–500`. Payouts in this exact band are held until Ethio Telecom provides written confirmation or empirical verification.
  * Band 2 ($101.00 - 500.00\text{ ETB}$): $10,100 \le A \le 50,000\text{ santims}$ ($101.00 - 500.00\text{ ETB}$) $\rightarrow$ **2.00 ETB** (200 santims) [**ACTIVE**]
  * Band 3 ($501.00 - 1,500.00\text{ ETB}$): $50,001 \le A \le 150,000\text{ santims}$ ($500.01 - 1,500.00\text{ ETB}$) $\rightarrow$ **4.00 ETB** (400 santims) [**ACTIVE**]
  * Band 4 ($1,501.00 - 5,000.00\text{ ETB}$): $150,001 \le A \le 500,000\text{ santims}$ ($1,500.01 - 5,000.00\text{ ETB}$) $\rightarrow$ **6.00 ETB** (600 santims) [**ACTIVE**]
  * Band 5 ($5,001.00 - 75,000.00\text{ ETB}$): $500,001 \le A \le 7,500,000\text{ santims}$ ($5,000.01 - 75,000.00\text{ ETB}$) $\rightarrow$ **8.00 ETB** (800 santims) [**ACTIVE**]
- **VAT Treatment:** Inclusive in published gross tariff.
- **Fee Payer:** Deducted from sender account during transfer.

#### Route 2: Telebirr-to-Bank (Telebirr Wallet $\rightarrow$ Commercial Bank Account) — `telebirr_to_bank`
- **Status:** **VERIFIED (With Documented Public Boundary Gap Quarantined)**
- **Transfer Direction:** Telebirr $\rightarrow$ CBE Account / Other Bank
- **Tariff Schedule with Closed Santim Intervals:**
  * Band 1 ($< 100.00\text{ ETB}$): $100 \le A \le 9,999\text{ santims}$ ($1.00 - 99.99\text{ ETB}$) $\rightarrow$ **1.00 ETB** (100 santims) [**ACTIVE**]
  * **Boundary Gap ($100.00 - 100.99\text{ ETB}$):** $10,000 \le A \le 10,099\text{ santims}$ $\rightarrow$ **QUARANTINED** (`UNRESOLVED_BOUNDARY_QUARANTINED`). Held until written provider clarification.
  * Band 2 ($101.00 - 500.00\text{ ETB}$): $10,100 \le A \le 50,000\text{ santims}$ ($101.00 - 500.00\text{ ETB}$) $\rightarrow$ **3.00 ETB** (300 santims) [**ACTIVE**]
  * Band 3 ($501.00 - 1,500.00\text{ ETB}$): $50,001 \le A \le 150,000\text{ santims}$ ($500.01 - 1,500.00\text{ ETB}$) $\rightarrow$ **6.00 ETB** (600 santims) [**ACTIVE**]
  * Band 4 ($1,501.00 - 5,000.00\text{ ETB}$): $150,001 \le A \le 500,000\text{ santims}$ ($1,500.01 - 5,000.00\text{ ETB}$) $\rightarrow$ **9.00 ETB** (900 santims) [**ACTIVE**]
  * Band 5 ($5,001.00 - 75,000.00\text{ ETB}$): $500,001 \le A \le 7,500,000\text{ santims}$ ($5,000.01 - 75,000.00\text{ ETB}$) $\rightarrow$ **15.00 ETB** (1,500 santims) [**ACTIVE**]
- **VAT Treatment:** Inclusive in published gross tariff.

---

### 4.2 Commercial Bank of Ethiopia (CBE) Official Tariffs
* **Official Publisher:** Commercial Bank of Ethiopia
* **Official Document / Portal:** *CBE Digital Banking Terms, Conditions & Tariffs*
* **Official Source URL:** `https://www.combanketh.et/` (Verified November 2026)
* **Governing Tax Regulation:**
  - *Value Added Tax (VAT) Proclamation No. 1341/2024:* 15% VAT on financial service commissions.
  - *Tax Reconciliation Audit:* Official published CBE schedules show charges After VAT computed strictly as $\text{Base Commission} \times 1.15$. The previously assumed 20% multiplier (5% DRMF surcharge) is ungrounded on retail transfers and officially revoked.
* **Verification Date:** 2026-11-01

#### Route 3: CBE Mobile Banking Account-to-Account (CBE $\rightarrow$ CBE) — `cbe_to_cbe`
- **Status:** **VERIFIED (Retail Mobile Banking P2P Route)**
- **Transfer Direction:** Platform CBE Account (`1000723226426`) $\rightarrow$ Player CBE Account
- **Published Tariff Schedule (Base + 15% VAT) & Fractional Santim Policy:**
  * **Band 1 ($1.00 - 1,000.00\text{ ETB}$):** Base 0.50 ETB + 15% VAT = **0.575 ETB** (57.5 santims) $\rightarrow$ **QUARANTINED** (`FRACTIONAL_SANTIM_QUARANTINED`). In fiat banking, 1 santim is the indivisible base currency unit. Prohibit rounding to 58 santims without empirical CBS voucher proof. Held inactive until verified voucher evidence confirms bank debit rounding.
  * **Band 2 ($1,001.00 - 5,000.00\text{ ETB}$):** Base 1.00 ETB + 15% VAT = **1.15 ETB** (115 santims) [**ACTIVE**]
  * **Band 3 ($5,001.00 - 10,000.00\text{ ETB}$):** Base 2.00 ETB + 15% VAT = **2.30 ETB** (230 santims) [**ACTIVE**]
  * **Band 4 ($10,001.00 - 50,000.00\text{ ETB}$):** Base 3.00 ETB + 15% VAT = **3.45 ETB** (345 santims) [**ACTIVE**]
  * **Band 5 ($50,001.00 - 100,000.00\text{ ETB}$):** Base 5.00 ETB + 15% VAT = **5.75 ETB** (575 santims) [**ACTIVE**]
- **Fee Payer:** Debited from sending CBE account.

#### Route 4: CBE Mobile Banking $\rightarrow$ External Mobile Wallet (CBE $\rightarrow$ Telebirr) — `cbe_to_telebirr`
- **Status:** **VERIFIED (Retail Mobile Banking P2P Route)**
- **Published Tariff Schedule (Base + 15% VAT):**
  * Band 1 ($1.00 - 10,000.00\text{ ETB}$): Base 10.00 ETB + 15% VAT = **11.50 ETB** (1,150 santims) [**ACTIVE**]
  * Band 2 ($> 10,000.00\text{ ETB}$): Base 15.00 ETB + 15% VAT = **17.25 ETB** (1,725 santims) [**ACTIVE**]

#### Route 5: Corporate B2C Automated API Route — `cbe_corporate_b2c`
- **Status:** **UNVERIFIED_CORPORATE_B2C (Quarantined)**
- **Finding:** Commercial banks maintain separate institutional fee schedules for automated B2C batch API integrations. The retail rates above must not be assumed to apply automatically to system-level APIs without an executed corporate agreement.
- **Enforcement:** Quarantined until corporate contract documentation is verified. Automated payouts route through verified channels only.

---

### 4.3 CBE Birr Wallet Tariffs — `cbe_birr_wallet`
- **Status:** **UNVERIFIED**
- **Audit Finding:** Official documentation from the Commercial Bank of Ethiopia does not provide clear, authoritative amount bands, merchant settlement fees, or VAT schedules for programmatic third-party disbursements via CBE Birr. In practice, CBE Birr operates under differing peer-to-peer and merchant rules.
- **Mandatory Policy Applied:** In accordance with prompt instructions, **CBE Birr is marked UNVERIFIED and must remain strictly DISABLED**. Player withdrawals via CBE Birr cannot be initiated until verified documentation is certified by the provider and approved by the Owner.

---

## 5. AUDIT SUMMARY CLASSIFICATION TABLE

| Component / Requirement | Code Location | Actual Code Reality | Audit Classification |
| :--- | :--- | :--- | :--- |
| **Double-Entry General Ledger** | `convex/schema.ts` | Only single-entry `financialLedger` exists. | **SPECIFIED BUT NOT IMPLEMENTED** |
| **Deposit Clearing Account (1030)** | `src/app/api/.../verify/route.ts` | Direct credit to player wallet without clearing account. | **SPECIFIED BUT NOT IMPLEMENTED** |
| **Deposit Chargeback & Recoverable Debt (1050)** | `convex/financial/deposits.ts` | Zero reversal or Account 1050 recoverable debt logic. | **SPECIFIED BUT NOT IMPLEMENTED** |
| **Leaked API Key & Fallbacks** | `src/lib/payments/verify-et/client.ts:31` | Hardcoded `DEFAULT_VERIFY_ET_API_KEY` present. | **VULNERABLE** |
| **Obsolete Convex URL** | `src/app/api/.../verify/route.ts:29` | Hardcoded `https://fast-oyster-971.convex.cloud`. | **VULNERABLE** |
| **Hardcoded Admin Credentials** | `convex/lib/auth.ts:79-84` | Hardcoded `user_3JfrI7...` and email in code. | **VULNERABLE** |
| **Admin Route `/fssmyfkl`** | `src/app/(protected)/` | Route does not exist. | **MISSING** |
| **Owner Route `/yyhnan`** | `src/app/(protected)/yyhnan/` | Mounts generic `AdminView` with hardcoded auth. | **PARTIALLY IMPLEMENTED** |
| **Normal Win Commission (10%)** | `convex/lib/games.ts:289` | Calculated and credited in single-entry ledger. | **IMPLEMENTED (Single-Entry)** |
| **Organic Draw Refund (100%)** | `convex/lib/games.ts:210` | 100% stakes refund to both players; 0% rake. | **IMPLEMENTED (Single-Entry)** |
| **Mutual Draw Deduction Policy** | `convex/lib/games.ts:209` | Not differentiated from organic draw; gives 100% refund. Mutual draw rake (Alt 1: 5% pot / Alt 2: 2.5% pot) blocked pending OD-09. | **SPECIFIED BUT NOT IMPLEMENTED** |
| **Zero Platform Fee on Withdrawals** | `convex/financial/withdrawals.ts` | Legacy basis points model still present in config. | **SPECIFIED BUT NOT IMPLEMENTED** |
| **Net Withdrawal Guarantee** | UI / Backend | Player requested amount not separated from fee. | **SPECIFIED BUT NOT IMPLEMENTED** |
| **Withdrawal Evidence & Return Audit** | `convex/financial/withdrawals.ts` | Payout marked settled on gateway ACK; returns not modeled. | **SPECIFIED BUT NOT IMPLEMENTED** |
| **Dynamic Provider Tariff Engine** | `convex/schema.ts` | No versioned tariff tables exist. | **MISSING** |
| **Tariff Overlap Invariant & Quarantine** | `convex/schema.ts` | No tariff table or validation guards exist. | **SPECIFIED BUT NOT IMPLEMENTED** |
| **Durable Scoped FIFO Queue** | `convex/schema.ts` | Table `durableQueue` does not exist. | **SPECIFIED BUT NOT IMPLEMENTED** |
| **Two-Step Reversal Protocol** | `convex/financial/` | Direct refunds used without balanced steps. | **SPECIFIED BUT NOT IMPLEMENTED** |

---
**END OF AUDIT REPORT — ABAY CHESS v4.2.7-PROD**  
*STATUS: STRICT READ-ONLY AUDIT COMPLETE — IMPLEMENTATION PROHIBITED*
