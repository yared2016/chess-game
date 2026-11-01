# ABAY CHESS — v4.2.7-PROD
## Implementation Decision Blockers & Owner Governance Register

**Document Type:** Decision Blockers & Policy Governance  
**Branch:** `feat/v4.2.7-prod-implementation`  
**Reference Document:** `ABAY_CHESS_v4.2.7_FINAL_OWNER_DECISIONS.md`  
**Last Updated:** 2026-11-01  

---

## 1. Active Owner Decision Blockers & Guardrails

| Decision ID | Subject | Policy Status | Implementation Impact & Hard Guardrail |
|---|---|---|---|
| **OD-01** | Provider Tariff Schedules | Verified for Telebirr P2P, CBE A2A, CBE-to-Telebirr | Implement dynamic engine. Quarantines enforced for unverified boundaries. |
| **OD-02** | Solvency Multiplier | **105% Coverage Multiplier Approved** | Code must strictly use $\lceil 1.05 \times \mathcal{L}_{\text{total}} \rceil$. Never allow payouts if projected coverage $< 105\%$. |
| **OD-03** | Operating Buffer | Approved ($5,000.00\text{ ETB} = 500,000\text{ santims}$) | Hardcoded baseline in `systemConfig.operating_buffer_santims`. |
| **OD-04** | CBE Birr Integration | **DISABLED** | Channel status strictly `disabled`. Reject any deposit/withdrawal routing to CBE Birr. |
| **OD-05** | CBE Band 1 ($0.575\text{ ETB}$) | **QUARANTINED** | Flagged `FRACTIONAL_SANTIM_QUARANTINED`. Automated payout blocked. Requires manual voucher entry. |
| **OD-06** | Telebirr $100.00–100.99\text{ ETB}$ Band | **QUARANTINED** | Flagged `UNRESOLVED_BOUNDARY_QUARANTINED`. Automated payout blocked for amounts within this interval. |
| **OD-07** | Account 1050 Write-Off Authority | **OWNER-ONLY** | Mutations writing off uncollectible overdrafts from 1050 to 5030 require `requireOwner(ctx)`. |
| **OD-08** | Dormant Account Maintenance Fee | **DEFERRED** | Do NOT implement automated deduction of 10 ETB/mo. Keep deferred pending regulatory review. |
| **OD-09** | Mutual Accepted Draw Rake | **UNRATIFIED / BLOCKED** | **CRITICAL GUARDRAIL:** Alternative 1 (5% pot rake) and Alternative 2 (2.5% pot rake) are both UNRATIFIED. The system MUST keep rake execution BLOCKED and fall back to existing behavior: **100% refund (0% rake) to both players** (`convex/lib/games.ts:210`). |
| **OD-10** | Single Withdrawal Limit | Approved ($50,000.00\text{ ETB} = 5,000,000\text{ santims}$) | Enforce schema validation cap on individual withdrawal requests. |
| **OD-11** | Daily Cumulative Review Threshold | Approved ($100,000.00\text{ ETB} = 10,000,000\text{ santims}$) | Automated freeze and manual escalation when 24h volume exceeds threshold. |
| **OD-12** | Primary Disbursement Channel | Approved (Telebirr P2P primary, CBE secondary) | System prioritizes Telebirr for automated API routing when enabled. |
| **OD-13** | Production Deployment Gate | **PENDING OWNER WRITTEN AUTHORIZATION** | Strictly no deployment to production Convex or Vercel until Phase 10 verification is complete and Owner signs off. |

---

## 2. Guardrail Enforcement in Code

1. **Mutual Draw Fallback (OD-09):**
   ```typescript
   // convex/financial/games.ts / convex/lib/games.ts
   // GUARDRAIL OD-09: Mutual draw rake unratified by Owner.
   // Strictly fall back to 100% refund (0% rake) to both players.
   if (game.endReason === "draw_mutual_agreement") {
     // Refund stake in full to both players
     await postRefundBothPlayers(ctx, gameId, stakeSantims);
   }
   ```

2. **CBE Birr Rejection (OD-04):**
   ```typescript
   if (channel === "cbe_birr") {
     throw new ConvexError({
       code: "ERR_CHANNEL_DISABLED",
       message: "CBE Birr channel is disabled pending official documentation (OD-04)."
     });
   }
   ```

3. **CBE Band 1 Quarantine (OD-05):**
   ```typescript
   if (route === "cbe_a2a" && amountSantims <= 100000n) {
     return {
       status: "FRACTIONAL_SANTIM_QUARANTINED",
       feeSantims: 58n, // or rounded
       requiresManualReview: true,
       reason: "Fractional santim (0.575 ETB) quarantined pending bank voucher verification (OD-05)."
     };
   }
   ```
