# ABAY CHESS — v4.2.7-PROD
## Implementation Risk Register

**Document Type:** Risk Register & Mitigation Strategy  
**Branch:** `feat/v4.2.7-prod-implementation`  
**Last Updated:** 2026-11-01  

---

## 1. Risk Matrix Overview

| Risk ID | Category | Description | Likelihood | Impact | Severity | Mitigation Strategy | Owner / Phase |
|---|---|---|---|---|---|---|---|
| **RSK-01** | Security | Leaked / hardcoded payment API keys or webhook secrets in source code | High (previously present) | Critical | **CRITICAL** | Purge `DEFAULT_VERIFY_ET_API_KEY` in `src/lib/payments/verify-et/client.ts`. Enforce strict runtime assertions for `VERIFY_ET_API_KEY` and `VERIFY_ET_WEBHOOK_SECRET`. | Phase 1 |
| **RSK-02** | Security | Admin privilege escalation via email spoofing or unverified Clerk attributes | High (previously present) | Critical | **CRITICAL** | Eliminate hardcoded email/ID arrays in `convex/lib/auth.ts`. Enforce server-side Clerk Subject ID validation matching `systemConfig.owner_identity`. | Phase 1 |
| **RSK-03** | Financial | Platform insolvency / float inflation from recognizing un-cleared deposits as liquid cash | Medium | Critical | **HIGH** | 4-Tier Deposit lifecycle: Tier 2 deposits credited to `1030 Provider Clearing`. Exclude 1030 from liquid cash solvency numerator until Tier 3 bank statement settlement. | Phase 2, 4, 7 |
| **RSK-04** | Financial | Solvency ratio breach (<105% coverage of user liabilities) during Owner payouts | Low | High | **HIGH** | Enforce Distributable Cap: $\min(\text{BookEquity}, \text{EligibleCashSurplus})$ where surplus requires 105% liability coverage and operating buffer. Require projected post-payout solvency $\ge 105\%$. | Phase 7 |
| **RSK-05** | Financial | Double-counting pending commitments in solvency denominator | Medium | Medium | **MEDIUM** | Filter `PendingCommitments` strictly to unposted `durableQueue` items where `postedTransactionId == null`. | Phase 7 |
| **RSK-06** | Financial | Fractional santim rounding error in CBE Band 1 tariff ($0.575 ETB) | High | Medium | **HIGH** | Strict quarantine: CBE Band 1 ($1–1,000 ETB) flagged `FRACTIONAL_SANTIM_QUARANTINED`. Automated execution blocked until exact CBS bank debit precision is verified. | Phase 3, 5 |
| **RSK-07** | Financial | Boundary ambiguity in Telebirr Band 1/2 ($100.00–$100.99 ETB) | High | Low | **MEDIUM** | Strict quarantine: amounts in $100.00–$100.99 ETB flagged `UNRESOLVED_BOUNDARY_QUARANTINED` pending official Ethio telecom clarification. | Phase 3, 5 |
| **RSK-08** | Financial | Negative player balance from chargeback on spent funds | Medium | High | **HIGH** | Cap Account 2010 deduction at available balance (never negative). Excess debit posted to `1050 Player Overdrafts Receivable`. Freeze account, auto-offset future deposits, allow Owner-only write-off to 5030. | Phase 4 |
| **RSK-09** | Financial | Provider fee variance / net withdrawal guarantee breach | Medium | Medium | **MEDIUM** | Zero platform markup. Player funded fee routed to `2040`. Actual fee variance ($f - F$) absorbed into `5010 Provider Fee Expense`. Net withdrawal amount guaranteed 100%. | Phase 5 |
| **RSK-10** | Legal / Ops | Premature rake on mutual draw without Owner decision | Medium | Medium | **MEDIUM** | Mutual draw commission policy unratified (OD-09). Keep execution BLOCKED and enforce fallback: 100% refund (0% rake) to both players. | Phase 6 |
| **RSK-11** | Operational | Queue deadlock or head-of-line blocking in financial queue | Medium | High | **HIGH** | `durableQueue` scoped by `scopeKey` (player ID or match ID). 30s lease timeout (`leaseExpiresAt`), exponential backoff, pre-replay entity state revalidation, DLQ after 5 attempts. | Phase 8 |
| **RSK-12** | Security | Unauthorized staff access to player PII or financial credentials | Medium | High | **HIGH** | Scoped RBAC with `vAdminPermission`. Staff admin portal (`/fssmyfkl`) masks PII (e.g. phone `+25191****123`, bank account `1000****456`). Secrets restricted to Owner (`/yyhnan`). | Phase 1, 9 |

---

## 2. Review and Escalation Cadence
- **Weekly Review:** Project lead reviews risk mitigation status during each phase transition.
- **Immediate Escalation:** Any solvency breach (<105%), double-posting bug, or ledger imbalance triggers immediate execution halt and rollback.
