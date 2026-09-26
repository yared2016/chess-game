# Castle Chess — Security Model & Vulnerability Assessment

**Document Version:** 1.0  
**Audit Date:** 2026-09-26  
**Implementation Source:** `convex/lib/auth.ts`, `convex/games.ts`, `convex/financial/`, `src/app/api/finance/`, `convex/lib/rateLimit.ts`  
**Security Posture:** Hardened Core / Financial Isolation / Fair Play & Rate-Limiting Gaps

---

## 1. Authentication & Identity Management

### 1.1 Clerk OAuth & Session Lifecycle
Castle Chess authenticates players via Clerk, supporting Google, GitHub, and email OTP sign-in.
- **Canonical Subject Token:** Convex functions derive identity via `ctx.auth.getUserIdentity()`. The system strictly conforms to Convex guidelines by indexing and verifying the canonical `tokenIdentifier = "<issuer>|<subject>"`, preventing token collision or identity spoofing across identity providers.
- **Profile Synchronization:** Upon initial authentication, `players.getOrCreate` creates a row in the `players` table, initializing standard ratings (1200), zero win/loss records, and default 3D room presets.

### 1.2 Access Control Helpers
Authorization is enforced server-side using helper functions in [`convex/lib/auth.ts`](file:///c:/Users/USER/Downloads/Castle-3d-multiplayer-with-ai-vercel-eve-nextjs-clerk-main/Castle-3d-multiplayer-with-ai-vercel-eve-nextjs-clerk-main/convex/lib/auth.ts):
```typescript
/** Resolves the authenticated player or throws "Not authenticated". */
export async function requirePlayer(ctx: QueryCtx | MutationCtx): Promise<Doc<"players">> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Not authenticated");
  const player = await ctx.db
    .query("players")
    .withIndex("by_tokenIdentifier", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
    .unique();
  if (!player) throw new Error("Player profile not found");
  return player;
}

/** Restricts mutation execution strictly to platform administrators. */
export async function requireAdmin(ctx: QueryCtx | MutationCtx): Promise<Doc<"players">> {
  const player = await requirePlayer(ctx);
  const isAdmin = ADMIN_USERNAMES.includes(player.usernameLower);
  if (!isAdmin) throw new Error("Unauthorized: Admin privileges required");
  return player;
}
```

---

## 2. Server Authority & Anti-Tampering

### 2.1 Zero Client Trust Invariant (NFR-4)
- **FEN Tampering Defense:** The client never dictates the chessboard position. Even if a modified client sends a manipulated FEN or arbitrary move, the server rejects it.
- **Authoritative Replay:** The server reconstructs the exact board position by replaying `game.moves` from move 1 on an isolated V8 instance of chess.js.
- **Participation Verification:** In [`convex/games.ts:commitMove`](file:///c:/Users/USER/Downloads/Castle-3d-multiplayer-with-ai-vercel-eve-nextjs-clerk-main/Castle-3d-multiplayer-with-ai-vercel-eve-nextjs-clerk-main/convex/games.ts), the server verifies:
  1. Caller is authenticated (`requirePlayer`).
  2. Caller is a participant (`game.whiteId === player._id || game.blackId === player._id`).
  3. It is currently caller's turn (`game.turn === callerColor`).
  4. Move is legally possible in current position (`applyMove`).
  5. If move lands on back rank, promotion piece is provided (`promotion-required`).

### 2.2 Atomic Transaction Boundaries
Convex mutations run as ACID transactions. In a single atomic commit:
- Move is appended to `game.moves`.
- Board FEN, PGN, and turn are updated.
- If the move terminates the game (checkmate, stalemate, draw), rating adjustments and wallet escrow payouts are written in the **exact same transaction**. Ratings and financial balances can never be observed in a partial or desynchronized state.

---

## 3. Financial Subsystem Security

### 3.1 Integer Santim Representation (Minor Units)
- Floating-point arithmetic (`0.1 + 0.2 = 0.30000000000000004`) is strictly forbidden across financial logic.
- All amounts are represented as 64-bit integers in santims ($1 \text{ ETB} = 100 \text{ santims}$).
- Division operations utilize integer math (`Math.floor` or explicit bankers rounding) with remainder conservation.

### 3.2 Double-Entry Immutable Ledger
Every wallet modification requires an immutable record in `financialLedger`:
- Ledger records: `userId`, `walletId`, `entryType`, `amountSantims`, `balanceAfterSantims`, `lockedAfterSantims`, `idempotencyKey`.
- Any discrepancy between the wallet balance and the cumulative ledger entries is flagged immediately by the real-time reconciliation engine in [`convex/admin/finance.ts`](file:///c:/Users/USER/Downloads/Castle-3d-multiplayer-with-ai-vercel-eve-nextjs-clerk-main/Castle-3d-multiplayer-with-ai-vercel-eve-nextjs-clerk-main/convex/admin/finance.ts).

### 3.3 Chapa Webhook HMAC-SHA256 Timing-Safe Verification
Webhook payloads from Chapa are verified using timing-safe comparisons to prevent timing side-channel attacks:
```typescript
export function verifyChapaSignature(payload: string, signature: string, secret: string): boolean {
  const hash = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  const hashBuffer = Buffer.from(hash, "utf8");
  const signatureBuffer = Buffer.from(signature, "utf8");
  if (hashBuffer.length !== signatureBuffer.length) return false;
  return crypto.timingSafeEqual(hashBuffer, signatureBuffer);
}
```

### 3.4 Match Escrow & Double-Spend Prevention
- When entering matchmaking with a stake, the player's available balance is locked immediately via `match_lock`.
- If the player leaves the queue or matchmaking times out, the locked funds are refunded via `match_unlock`.
- Concurrent matchmaking requests cannot lock more funds than are currently available in the player's wallet.

---

## 4. Rate Limiting Architecture

A dedicated `rateLimits` table is defined in `convex/schema.ts` to enforce sliding window rate limiting:
```typescript
rateLimits: defineTable({
  key: v.string(),           // e.g. "deposit:user_2ab…" or "move:game_3cd…"
  windowStart: v.number(),   // Start timestamp of current window
  count: v.number(),         // Requests registered within the window
}).index("by_key", ["key"]);
```

### 4.1 Window Thresholds
- **Deposit Initialization:** Max 5 requests per 15 minutes per user.
- **Withdrawal Requests:** Max 3 requests per 24 hours per user.
- **Move Submissions:** Max 10 requests per second per game (prevents mutation flooding).
- **Pro AI Tutor Inquiries:** Capped at 40 questions per game via `tutorTurnsUsed`.

---

## 5. Security Threat Matrix & Gaps

| Threat / Vulnerability | Severity | Current Status | Remediation Required |
|---|---|---|---|
| **Stockfish / Bot Assistance (Fair Play)** | HIGH | **MISSING** | No client-side move timing analysis or tab-focus tracking exists. Human rated games are susceptible to external engine cheating. |
| **CSRF on Next.js API Routes** | MEDIUM | **MISSING** | Public `/api/finance/` endpoints rely solely on session cookies without anti-CSRF token verification on mutation endpoints. |
| **Mutation Rate Limiting Coverage** | MEDIUM | **PARTIAL** | `rateLimits` table and helper exist, but are not universally decorated across all Convex mutations (e.g., chat messages, challenge creation). |
| **Clerk Dev Billing in Production** | MEDIUM | **PARTIAL** | Pro subscription billing operates against Clerk test mode. Production domain cutover and live webhook secret rotation required. |
| **In-Game Chat Moderation** | LOW | **MISSING** | Ephemeral chat between players lacks automated profanity filtering, link sanitization, or real-time harassment reporting. |
| **Webhook Timestamp Replay Window** | LOW | **PARTIAL** | Chapa webhook validates HMAC signatures, but does not enforce a strict 5-minute replay expiry window on incoming headers. |

---

## 6. Actionable Security Hardening Roadmap

1. **Deploy Universal Mutation Rate Limiting (Phase 1):**
   - Wrap all public mutation handlers with `checkRateLimit(ctx, key, limit, windowMs)`.
2. **Implement Anti-Cheat Move Timing Variance (Phase 2):**
   - Record `moveDurationMs` for every ply. Flag games where human move time variance is under 50ms with 98%+ Stockfish top-choice correlation.
3. **Add Anti-CSRF Token Validation (Phase 2):**
   - Add `x-csrf-token` header validation to Next.js API routes (`/api/finance/*`).
4. **Automated User Moderation (Phase 3):**
   - Implement temporary mute and ban flags on `players` table with administrative override in `/yyhnan`.
