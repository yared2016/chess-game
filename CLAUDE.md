@AGENTS.md

# Castle 3D Chess & Financial System — Developer Guidelines

<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->

## Financial & Wallet System Rules

1. **Internal Ledger is Authoritative:**
   - The Convex internal financial ledger (`financialLedger`) is the sole source of truth for all balances, match escrow, platform commissions, and withdrawals.
   - External gateways (Chapa, etc.) are **adapters only**, never the ledger.

2. **Money Representation:**
   - All financial logic and database records use **integer minor units** (santims: 1 ETB = 100 santims).
   - Never use JavaScript floating-point calculations for financial operations.
   - Use centralized utility functions in `src/lib/payments/money.ts` and `convex/lib/money.ts`.

3. **No Direct Balance Mutations:**
   - `updateWalletBalance` or raw arbitrary balance edits are strictly prohibited.
   - All financial state changes must pass through domain operations (`creditDeposit`, `reserveMatchEntry`, `releaseMatchEntry`, `settleMatch`, `reserveWithdrawal`, `completeWithdrawal`, `reverseWithdrawal`).
   - Every balance modification must record an immutable ledger entry.

4. **Invariants Enforced:**
   - `availableBalance >= 0`
   - `lockedBalance >= 0`
   - `totalBalance = availableBalance + lockedBalance`

5. **Provider Decoupling:**
   - All payment provider interactions must implement the `PaymentProvider` interface in `src/lib/payments/types.ts`.
   - Never couple wallet domain logic directly to Chapa-specific fields or quirks.

6. **Fee Transparency:**
   - Distinguish strictly between **payment provider fees** (e.g. Chapa transaction fees) and **platform commission** (retained by Castle Chess).
   - Display full breakdowns to the user prior to deposit or withdrawal confirmation.

7. **Test Mode First:**
   - Never enable live money during development or testing.
   - Always use test mode credentials (`CHASECK_TEST-`).

8. **Admin Operations:**
   - The administrative dashboard is located at `/yyhnan` (protected by server-side Clerk admin verification).
   - The route `/admin` is intentionally kept deprecated/404.

## Key Development Commands

```bash
# Start Next.js development server
npm run dev

# Start Convex local development sync
npx convex dev

# Regenerate Convex TypeScript bindings
npx convex codegen

# Run TypeScript type check
npx tsc --noEmit
```
