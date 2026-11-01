# ABAY CHESS — OWNER DECISION REGISTER (v4.2.6-PROD)

**Date:** November 1, 2026  
**Document:** Authoritative Decision Register & Pending Policy Catalogue  
**Status:** Pending Explicit Owner Review and Approval — **STRICT NO-IMPLEMENTATION PHASE**  

---

## 1. PURPOSE AND GOVERNANCE PRINCIPLES

In accordance with strict FinTech architectural standards, the engineering team cannot invent, assume, or default financial or operational policies that impact platform liabilities, user assets, or legal compliance.

This register catalogues every business, financial, operational, and security policy:
1. **Approved Policies:** Established rules embedded in the specification.
2. **Pending Policies:** Open policy questions that strictly require the Owner's formal review, direction, and sign-off before implementation.

---

## 2. POLICY STATUS SUMMARY MATRIX

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        ABAY CHESS MASTER POLICY STATUS MATRIX                          │
├──────────────────────────┬─────────────────────────────────────┬───────────────────────┤
│ POLICY DOMAIN            │ SPECIFIED RULE / STATUS             │ GOVERNANCE STATUS     │
├──────────────────────────┼─────────────────────────────────────┼───────────────────────┤
│ Normal Win Commission    │ 10% gross pot deducted from winner  │ APPROVED (Preserved)  │
│ Organic Draw Settlement  │ 100% refund of stakes (0% comm.)    │ APPROVED (Preserved)  │
│ Mutually Accepted Draw   │ 5% deducted per player (10% pot)    │ APPROVED NEW POLICY   │
│ Decoupled Admin/Owner    │ Independent Clerk auth models       │ APPROVED NEW POLICY   │
│ Two-Stage Withdrawal     │ Requested -> Reserved -> Settled    │ APPROVED NEW POLICY   │
│ Distributable Cash Cap   │ Min(Book Equity, Cash Surplus)      │ APPROVED NEW POLICY   │
│ Deposit Clearing (1030)  │ Tier 2 Clearing vs Tier 3 Cash      │ APPROVED NEW POLICY   │
├──────────────────────────┼─────────────────────────────────────┼───────────────────────┤
│ CBE Bank Account         │ Mandatory deposit destination       │ APPROVED (Mandatory)  │
│ Telebirr                 │ Mandatory deposit destination       │ APPROVED (Mandatory)  │
│ CBE Birr Enablement      │ Automated deposit verification      │ CONDITIONAL (Disabled)│
├──────────────────────────┼─────────────────────────────────────┼───────────────────────┤
│ Asymmetric Match Endings │ Disconnections, timeouts, forfeits  │ PENDING OWNER REVIEW  │
│ Account 3999 Deficit     │ Capital injection vs write-off      │ PENDING OWNER REVIEW  │
│ Operational Reserve      │ Mandatory capital buffer santims    │ PENDING OWNER REVIEW  │
│ Tier 2 Deposit Staking   │ Permitting gameplay before clearing │ PENDING OWNER REVIEW  │
│ High-Stake Tiered Rates  │ Reduced commission for >10,000 ETB  │ PENDING OWNER REVIEW  │
│ Dual Payout Approval     │ Threshold for secondary sign-off    │ PENDING OWNER REVIEW  │
│ Secret Renaming Schedule │ EVE_SERVER_SECRET migration timing  │ PENDING OWNER REVIEW  │
└──────────────────────────┴─────────────────────────────────────┴───────────────────────┘
```

---

## 3. DETAILED PENDING OWNER DECISIONS

### DECISION 01: Settlement Policies for Asymmetric Match Endings
- **Current Audited Behavior:** In `convex/lib/games.ts:380-425`, all games concluding via normal draw flags return 100% of stakes. However, timeout and disconnection handling routes through standard win mutations (`concludeGame`), awarding 90% of the pot to the survivor and taking 10% platform commission.
- **The Issue:** Players frequently dispute whether a disconnection was intentional abandonment (warranting a loss) or an infrastructure/server network failure (warranting a full refund).
- **Options for Owner Direction:**
  - **Option 1A (Preserve Existing):** Any player whose clock runs out or who disconnects during an active game forfeits the match. The winner receives 90% of the gross pot; the platform takes 10% commission.
  - **Option 1B (Differentiated Server Abort):** If a disconnection is accompanied by platform-side WebSocket failure or server ping loss affecting both players, the match is marked `"server_aborted"` and 100% of stakes are refunded with 0% platform commission.
- **Owner Direction Required:** Approve Option 1A or 1B.

---

### DECISION 02: Historical Baseline Variance Treatment in Account 3999
- **The Issue:** Abay Chess historically operated on a single-entry ledger without double-entry general ledger balance sheets. During the pre-cutover reconstruction, the baseline balance sheet will be computed:
  $$\text{Balance}(3999) = \text{ClearedCash} - (\text{PlayerLiabilities} + \text{OwnerPayables} + \text{RetainedCommissions})$$
- **Scenario Analysis:**
  - If $\text{Balance}(3999)$ has a **Credit balance**: External cash exceeds recognized obligations (unallocated surplus). This is held in equity.
  - If $\text{Balance}(3999)$ has a **Debit balance**: External cash is less than player liabilities (historical cash deficit).
- **Strict Rule:** A debit variance cannot be treated as cash backing. Player liabilities must be backed 1:1 by real cash.
- **Options for Owner Direction:**
  - **Option 2A (Capital Contribution):** The Owner commits to depositing personal cash into the platform CBE account to bring $\text{Balance}(3999) \ge 0$ before unrestricted withdrawals are enabled.
  - **Option 2B (Restricted Phased Recovery):** The Owner authorizes a documented equity deficit write-off against future platform commission earnings, with an enhanced solvency buffer.
- **Owner Direction Required:** Approve baseline variance resolution protocol.

---

### DECISION 03: CBE Birr Activation and Readiness Criteria
- **Current Status:** CBE Birr (`0933074790`) remains **STRICTLY DISABLED** in `platformPaymentDestinations` and `paymentChannels`.
- **The Issue:** Enabling automated deposits for CBE Birr without proven reference lookup in Verify.et leads to stuck player funds and manual disputes.
- **Readiness Criteria Proposed:**
  1. Successful automated reference query via Verify.et API in live production testing with at least 5 distinct test transactions.
  2. Verified recipient account and name match (`0933074790` / `Yared Fikadu Bekele`).
  3. Formal Owner sign-off recorded in this register.
- **Owner Direction Required:** Confirm readiness criteria before CBE Birr is toggled to `"active"`.

---

### DECISION 04: Minimum Operational Reserve Buffer
- **The Issue:** The distributable equity formula mandates subtracting a required operational reserve:
  $$\text{AvailableDistributableEquity} = \text{Balance}(3010) - \text{RequiredOperationalReserve}$$
- **The Decision:** The Owner must establish the exact baseline santim buffer that cannot be withdrawn as profit, ensuring working capital for transaction fees, reversal buffers, and operating expenses.
- **Proposed Options:**
  - **Option 4A:** 50,000 santims (500 ETB).
  - **Option 4B:** 100,000 santims (1,000 ETB) [Recommended].
  - **Option 4C:** 500,000 santims (5,000 ETB).
- **Owner Direction Required:** Select operational reserve amount.

---

### DECISION 05: Player Staking Policy on In-Transit (Tier 2) Deposits
- **The Issue:** When Verify.et confirms a deposit, funds are credited to `wallet.availableSantims` (backed by `Account 1030 Provider Clearing / Deposit Receivable`). However, external cash does not physically clear in the CBE bank account until Tier 3.
- **The Risk:** If a player uses Tier 2 funds to play a match, loses to an opponent, and the opponent immediately withdraws, the platform has paid out cleared cash against an un-cleared receivable. If the deposit ultimately fails to clear, the platform incurs a loss.
- **Proposed Options:**
  - **Option 5A (Immediate Gameplay Allowed):** Players may stake Tier 2 funds immediately (standard gaming UX). The platform absorbs network clearing lag float within an Owner-defined maximum exposure ceiling (e.g. 10,000 ETB). Withdrawals are gated by Tier 3 settlement.
  - **Option 5B (Strict Clearing Gating):** Players can only stake funds that have reached Tier 3 cleared status. (Safer for the platform, but introduces a 5–30 minute deposit delay for players).
- **Owner Direction Required:** Approve Option 5A or 5B.

---

### DECISION 06: High-Stake Tiered Commission Schedule
- **The Issue:** Normal completed games incur a flat 10% gross pot commission. For high-stake games (> 10,000 ETB pot), a 10% commission (1,000+ ETB) may discourage high-volume VIP players.
- **Proposed Options:**
  - **Option 6A (Flat 10% Always):** Maintain 10% across all stakes [Preserved Baseline].
  - **Option 6B (Tiered High-Stake Rates):**
    * Stakes up to 5,000 ETB: 10% commission.
    * Stakes 5,001 to 20,000 ETB: 7.5% commission.
    * Stakes above 20,000 ETB: 5% commission.
- **Owner Direction Required:** Maintain flat 10% or adopt tiered rates.

---

### DECISION 07: Dual Authorization Requirement for Large Withdrawals
- **The Issue:** To prevent administrator fraud or compromised staff credentials, large withdrawals should require dual sign-off.
- **Proposed Threshold:** Any player withdrawal exceeding **10,000 ETB (1,000,000 santims)** requires:
  1. Initial processing and evidence submission by an Admin.
  2. Secondary independent confirmation by a Superadmin or the Owner.
- **Owner Direction Required:** Confirm dual authorization threshold.

---

### DECISION 08: Server Secret Renaming Schedule
- **The Issue:** The existing codebase uses `EVE_SERVER_SECRET` to authenticate Vercel-to-Convex internal mutations. We propose standardizing this to `INTERNAL_SERVICE_SECRET`.
- **Proposed Migration:** Support both secret names during a 30-day grace period, then deprecate `EVE_SERVER_SECRET`.
- **Owner Direction Required:** Approve secret migration schedule.

---
*End of Owner Decision Register (v4.2.6-PROD)*
