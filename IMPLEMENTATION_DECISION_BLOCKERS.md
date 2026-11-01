# ABAY CHESS — v4.2.7-PROD
## Implementation Decision Blockers & Owner Governance Register

**Document Type:** Decision Blockers & Policy Governance  
**Branch:** `feat/v4.2.7-prod-implementation`  
**Reference Document:** `ABAY_CHESS_v4.2.7_FINAL_OWNER_DECISIONS.md`  
**Last Updated:** 2026-11-01  
**Verification Status:** FINAL INDEPENDENT AUDIT COMPLETED  

---

## 1. Active Owner Decision Blockers & Classification Matrix

Every one of the 13 Owner Decisions is tracked below with its formal policy status, implementation impact, hard guardrail, and independent verification classification.

| Decision ID | Subject | Policy Status | Implementation Impact & Hard Guardrail | Independent Verification Status |
|---|---|---|---|:---:|
| **OD-01** | Provider Tariff Schedules | Verified for Telebirr P2P, CBE A2A, CBE-to-Telebirr | Dynamic engine in `convex/financial/tariffs.ts`. Quarantines enforced for unverified boundaries. | **APPROVED & IMPLEMENTED** |
| **OD-02** | Solvency Multiplier | **105% Coverage Multiplier Approved** | Code strictly enforces $\lceil 1.05 \times \mathcal{L}_{\text{total}} \rceil$ in `convex/financial/solvency.ts`. Never allows payouts if projected coverage $< 105\%$. | **APPROVED & IMPLEMENTED** |
| **OD-03** | Operating Buffer | Approved ($5,000.00\text{ ETB} = 500,000\text{ santims}$) | Hardcoded baseline in `DEFAULT_OPERATING_BUFFER_SANTIMS` in `convex/financial/solvency.ts`. | **APPROVED & IMPLEMENTED** |
| **OD-04** | CBE Birr Integration | **DISABLED** | Channel status strictly `disabled` in `convex/financial/channels.ts`. All inbound/outbound routes throw `ERR_CHANNEL_DISABLED`. | **APPROVED POLICY (DISABLED) & IMPLEMENTED WITH HARD REJECTION** |
| **OD-05** | CBE Band 1 ($0.575\text{ ETB}$) | **QUARANTINED** | Flagged `FRACTIONAL_SANTIM_QUARANTINED` in `convex/financial/tariffs.ts`. Automated payout blocked (`isAutomatedPayoutAllowed = false`). | **UNRESOLVED / IMPLEMENTED WITH SAFE FALLBACK (QUARANTINED)** |
| **OD-06** | Telebirr $100.00–100.99\text{ ETB}$ Band | **QUARANTINED** | Flagged `UNRESOLVED_BOUNDARY_QUARANTINED` in `convex/financial/tariffs.ts`. Automated payout blocked for amounts within this interval. | **UNRESOLVED / IMPLEMENTED WITH SAFE FALLBACK (QUARANTINED)** |
| **OD-07** | Account 1050 Write-Off Authority | **OWNER-ONLY** | Mutations writing off uncollectible overdrafts from 1050 to 5030 require `requireOwner(ctx)` in `convex/financial/deposits.ts`. | **APPROVED & IMPLEMENTED** |
| **OD-08** | Dormant Account Maintenance Fee | **DEFERRED** | Do NOT implement automated deduction of 10 ETB/mo. Keep deferred pending regulatory review. | **DEFERRED (NO-OP BY DESIGN)** |
| **OD-09** | Mutual Accepted Draw Rake | **UNRATIFIED / BLOCKED** | **CRITICAL GUARDRAIL:** Mutual draw rake (5% or 2.5%) is UNRATIFIED. System keeps rake execution BLOCKED and safely falls back to **100% refund (0% rake) to both players** in `convex/financial/games.ts`. | **UNRATIFIED / IMPLEMENTED WITH SAFE FALLBACK (100% REFUND)** |
| **OD-10** | Single Withdrawal Limit | Approved ($50,000.00\text{ ETB} = 5,000,000\text{ santims}$) | Enforced via `MAX_SINGLE_WITHDRAWAL_SANTIMS` schema check in `convex/financial/withdrawals.ts`. | **APPROVED & IMPLEMENTED** |
| **OD-11** | Daily Cumulative Review Threshold | Approved ($100,000.00\text{ ETB} = 10,000,000\text{ santims}$) | Automated freeze and manual escalation flag `review_pending` when 24h volume exceeds threshold in `convex/financial/withdrawals.ts`. | **APPROVED & IMPLEMENTED** |
| **OD-12** | Primary Disbursement Channel | Approved (Telebirr P2P primary, CBE secondary) | System prioritizes Telebirr for automated API routing when enabled in `convex/financial/channels.ts`. | **APPROVED & IMPLEMENTED** |
| **OD-13** | Production Deployment Gate | **PENDING OWNER WRITTEN AUTHORIZATION** | Strictly no deployment to production Convex (`qualified-greyhound-151`) or Vercel until explicit Owner sign-off is received. | **BLOCKED PENDING OWNER WRITTEN SIGN-OFF** |

---

## 2. Guardrail Enforcement in Code

1. **Mutual Draw Fallback (OD-09):**
   ```typescript
   // convex/financial/games.ts
   // GUARDRAIL OD-09: Mutual draw rake unratified by Owner.
   // Strictly fall back to 100% refund (0% rake) to both players.
   if (MUTUAL_DRAW_RAKE_POLICY_BLOCKED) {
     return await settleMatchOrganicDrawCanonical(ctx, {
       gameId: args.gameId,
       whitePlayerId: game.whitePlayerId,
       blackPlayerId: game.blackPlayerId,
       stakeSantims: game.stakeSantims,
     });
   }
   ```

2. **CBE Birr Rejection (OD-04):**
   ```typescript
   // convex/financial/channels.ts
   if (channel === "cbe_birr" || config.status === "disabled") {
     throw new Error(`ERR_CHANNEL_DISABLED: Payment channel "${channel}" is currently disabled (OD-04).`);
   }
   ```

3. **CBE Band 1 Quarantine (OD-05):**
   ```typescript
   // convex/financial/tariffs.ts
   if (route === "cbe_a2a" && amountSantims >= BigInt(100) && amountSantims <= BigInt(100000)) {
     return {
       status: "quarantined",
       feeSantims: BigInt(58),
       tariffId: "cbe_a2a_band1_quarantine",
       version: 1,
       route: "cbe_a2a",
       isAutomatedPayoutAllowed: false,
       quarantineReason: "FRACTIONAL_SANTIM_QUARANTINED",
       effectiveBps: 0,
       effectiveFixedSantims: BigInt(58),
     };
   }
   ```

4. **Telebirr Boundary Quarantine (OD-06):**
   ```typescript
   // convex/financial/tariffs.ts
   if (route === "telebirr_p2p" && amountSantims >= BigInt(10000) && amountSantims <= BigInt(10099)) {
     return {
       status: "quarantined",
       feeSantims: BigInt(500),
       tariffId: "telebirr_p2p_boundary_quarantine",
       version: 1,
       route: "telebirr_p2p",
       isAutomatedPayoutAllowed: false,
       quarantineReason: "UNRESOLVED_BOUNDARY_QUARANTINED",
       effectiveBps: 0,
       effectiveFixedSantims: BigInt(500),
     };
   }
   ```

5. **105% Solvency & Distributable Cap (OD-02, OD-03):**
   ```typescript
   // convex/financial/solvency.ts
   const requiredCoverageMultiplier = (totalObligations * BigInt(105) + BigInt(99)) / BigInt(100);
   const eligibleCashSurplus = eligibleCash > requiredWithBuffer ? eligibleCash - requiredWithBuffer : BigInt(0);
   const distributableCap = bookEquity < eligibleCashSurplus ? bookEquity : eligibleCashSurplus;
   ```
