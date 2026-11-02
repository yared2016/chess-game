// convex/policies.ts
// Authoritative Legal Documents & Policies Management Subsystem (Abay Chess v4.2.7-PROD Phase 4)

import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { requireOwner, requireAdmin, requirePlayer, optionalPlayer } from "./lib/auth";
import { Id } from "./_generated/dataModel";

export const DEFAULT_TERMS_CONTENT = `# Abay Chess — Terms of Service

**Effective Date:** November 1, 2026  
**Version:** 4.2.7-PROD  
**Applicability:** All registered players and visitors on \`https://abaychess.com\`

Welcome to **Abay Chess**, Ethiopia's premier real-time online 3D chess platform with verified Ethiopian Birr (ETB) player balances and secure match settlements. By accessing, registering, or using Abay Chess, you agree to be legally bound by these Terms of Service.

---

### 1. Account Registration & Eligibility
1.1. You must be at least 18 years of age (or the age of legal majority in your jurisdiction) to participate in real-money staked chess matches.  
1.2. Each player is permitted only **one account**. Multi-accounting, account sharing, or operating accounts on behalf of third parties is strictly prohibited.  
1.3. You are responsible for safeguarding your login credentials (authenticated securely via Clerk). Any action conducted under your account is deemed your own.

---

### 2. Fair Play & Anti-Cheating Policy
2.1. Abay Chess enforces a strict zero-tolerance policy against computer assistance and artificial intelligence use during human vs. human matches.  
2.2. You may NOT use chess engines (e.g., Stockfish, Leela, Komodo), opening books, endgame tablebases, external browser extensions, or guidance from other individuals during active rated or staked matches.  
2.3. The platform employs automated move analysis, timing heuristics, and forensic telemetry to detect engine correlation. Confirmed cheating results in permanent account suspension, rating invalidation, and forfeiture of ill-gotten contest winnings.

---

### 3. Match Stakes, Escrow & Settlements
3.1. When two players agree to enter a staked match, both players' stakes are atomically locked in platform escrow (Account 2020) upon match start.  
3.2. Upon verified game conclusion:
- **Decisive Win:** Winner receives the gross pot minus platform commission. Platform rake is strictly 10%.
- **Organic Draw (Stalemate, 50-move rule, threefold repetition, insufficient material):** 100% full stake refund to both players; 0% platform rake.
- **Mutual Draw Agreement:** Subject to the platform mutual draw policy.
3.3. Disconnections and abandons are governed by official chess time control rules. If a player leaves the match and fails to reconnect within the abandonment window, the game is declared a loss by abandonment.

---

### 4. Player Balances, Deposits & Net Withdrawal Guarantee
4.1. Player deposits represent liabilities owed to players (Account 2010). Funds remain the legal property of the player.  
4.2. **Zero Platform Markup:** Abay Chess charges **0% internal fee** on deposits and withdrawals. All revenue is derived exclusively from match commission rake.  
4.3. **Net Withdrawal Guarantee:** When you request a payout of $X$ ETB, you receive exactly $X$ ETB in your bank or mobile wallet. External network provider transfer fees are quoted and deducted from your available balance prior to confirmation.  
4.4. **Withdrawal Requirements:**
- **Minimum Withdrawal:** 100.00 ETB (10,000 santims) for standard withdrawals. If your legitimate balance is below 100.00 ETB, you may execute an account-closure withdrawal for your full remaining balance.
- **First-Time Withdrawal Eligibility:** Players must complete at least three (3) legitimate, non-abandoned chess matches prior to initiating their first withdrawal. Deposited funds are never confiscated.

---

### 5. Prohibited Conduct & Account Suspension
5.1. You may not engage in match-fixing, sandbagging (deliberate rating deflation), rating inflation, or payment abuse.  
5.2. Chargebacks or fraudulent payment reversals will result in immediate wallet freezing, registration of an overdraft receivable (Account 1050), and potential civil enforcement.

---

### 6. Dispute Resolution & Governing Law
6.1. These Terms are governed by and construed in accordance with the laws of the Federal Democratic Republic of Ethiopia.  
6.2. For payment or match disputes, contact support through the platform command center. Support tickets are reviewed within five (5) business days.
`;

export const DEFAULT_PRIVACY_CONTENT = `# Abay Chess — Privacy Policy

**Effective Date:** November 1, 2026  
**Version:** 4.2.7-PROD  
**Production Domain:** \`https://abaychess.com\`

At **Abay Chess**, we respect your personal privacy and are committed to safeguarding your personal identification and financial information in compliance with Ethiopian data protection laws and the National Bank of Ethiopia customer safeguarding principles.

---

### 1. Information We Collect
1.1. **Account Identification:** We authenticate players securely via Clerk. We receive your unique Clerk user identifier, verified email address, profile avatar, and username.  
1.2. **Profile & Player Identity:** Display name, bio, and optional full legal name for payment KYC verification.  
1.3. **Payment Details:** Ethiopian mobile phone number (Telebirr) and Commercial Bank of Ethiopia (CBE) account number and holder name. Full bank details are masked in administrative interfaces and restricted by elevated permissions.  
1.4. **Gameplay & Device Telemetry:** Move timestamps, move notation (SAN/PGN), browser User-Agent, IP address (for security, session verification, and anti-collusion fraud prevention).

---

### 2. How We Use Your Information
2.1. To provide real-time 3D chess multiplayer matchmaking and rating calculation.  
2.2. To process deposits and execute withdrawals via official Ethiopian payment channels (Telebirr and CBE).  
2.3. To enforce Fair Play rules, detect engine cheating, and prevent multi-accounting.  
2.4. To maintain immutable accounting and financial ledger records.

---

### 3. Payment Data Protection & PII Safeguarding
3.1. We do NOT store credit card numbers or banking passwords.  
3.2. Player bank account numbers and phone numbers are encrypted at rest and masked in staff support dashboards.  
3.3. Unmasking of payment details requires the elevated \`view_payment_pii\` permission and generates an immutable, forensic audit record recording staff identity, player identity, timestamp, and justification.

---

### 4. Data Sharing & Third Parties
4.1. We do not sell, rent, or monetize your personal data.  
4.2. We share payment instruction details solely with regulated financial entities (Ethio Telecom / Telebirr, Commercial Bank of Ethiopia, and certified gateway aggregators) strictly to execute user-requested payouts and deposits.  
4.3. We may disclose information if required by court order, National Bank of Ethiopia directive, or law enforcement investigation involving financial fraud.

---

### 5. Your Rights & Data Retention
5.1. You have the right to inspect your profile information and update your payout preferences at any time.  
5.2. Financial ledger entries and match records are permanently retained in immutable records to satisfy regulatory audit and financial solvency requirements.
`;

export const DEFAULT_PAYMENTS_CONTENT = `# Abay Chess — Payment & Payout Policy

**Effective Date:** November 1, 2026  
**Version:** 4.2.7-PROD  
**Currency Standard:** Ethiopian Birr (ETB) | 1 ETB = 100 santims  
**Production Standard:** Zero Platform Markup & 100% Net Withdrawal Guarantee

---

### 1. Platform Fee Structure
1.1. **Zero Deposit Markup:** Abay Chess charges **0.00 ETB** on all incoming deposits.  
1.2. **Zero Withdrawal Markup:** Abay Chess charges **0.00 ETB** internal markup on withdrawals.  
1.3. **Game Commission:** Platform operating revenue is derived strictly from a 10% rake on decisive winning match pots. Organic draws incur 0% commission.

---

### 2. Official Payment Channels & Tariffs
Abay Chess currently supports verified Ethiopian payment corridors:

#### 2.1. Telebirr (Ethio Telecom)
- **Deposit Route:** Peer-to-Merchant / B2C payment. Minimum deposit: 10.00 ETB.
- **Withdrawal Route:** Telebirr P2P transfer fee schedule:
  - 10.00 – 99.99 ETB: Quarantined / manual verification
  - 101.00 – 500.00 ETB: 1.00 ETB (100 santims)
  - 501.00 – 1,000.00 ETB: 2.00 ETB (200 santims)
  - 1,001.00 – 2,000.00 ETB: 4.00 ETB (400 santims)
  - 2,001.00 – 5,000.00 ETB: 6.00 ETB (600 santims)
  - 5,001.00 – 10,000.00 ETB: 8.00 ETB (800 santims)
  - 10,001.00 – 25,000.00 ETB: 10.00 ETB (1,000 santims)

#### 2.2. Commercial Bank of Ethiopia (CBE Account-to-Account)
- **Deposit Route:** Direct CBE mobile/internet banking transfer with CBS transaction reference.
- **Withdrawal Route:** CBE Account-to-Account disbursement verified via Core Banking System (CBS) voucher:
  - 1,001.00 – 5,000.00 ETB: 1.15 ETB (115 santims)
  - 5,001.00 – 10,000.00 ETB: 2.30 ETB (230 santims)
  - 10,001.00 – 50,000.00 ETB: 3.45 ETB (345 santims)
  - 50,001.00 – 100,000.00 ETB: 5.75 ETB (575 santims)

#### 2.3. CBE Birr
- Per Owner Decision OD-04, CBE Birr is **strictly disabled** in production until official programmatic API certification is verified.

---

### 3. Net Withdrawal Guarantee
3.1. When a player requests a net payout of $X$ ETB, the player receives exactly $X$ ETB in their destination account.  
3.2. Quoted provider fees ($F$) are reserved from the player's available wallet balance at request time ($X + F$).  
3.3. In the event of bank fee variances:
- **Under-Collection:** If the bank charges $f > F$, Abay Chess absorbs the deficit into Account 5010. The player's net payout $X$ is never reduced.
- **Over-Collection:** If the bank charges $f < F$, the excess fee $(F - f)$ is automatically refunded to the player's wallet balance (Account 2010).

---

### 4. Minimum Withdrawal & First-Time Eligibility
4.1. **Minimum Withdrawal:** Standard ordinary withdrawals have a minimum limit of **100.00 ETB (10,000 santims)**.  
4.2. **Account Closure Exception:** If a player's total legitimate balance is under 100.00 ETB, they may execute an account closure withdrawal for their full remaining balance.  
4.3. **First-Time Withdrawal Rule:** To safeguard the platform against fraud and collusive cashouts, first-time withdrawals require the player to have completed at least **three (3) legitimate chess matches**. Once verified, all subsequent withdrawals are unrestricted.
`;

export const DEFAULT_LICENSES_CONTENT = `# Abay Chess — Open Source Licenses & Legal Attributions

**Version:** 4.2.7-PROD  
**Permanent Legal Compliance Register**

Abay Chess is built with open-source software and creative assets licensed under recognized open-source and Creative Commons licenses. This document fulfills all legal attribution and licensing requirements.

---

### 1. 3D Chess Piece Models
- **Creator / Author:** Jarlan Perez  
- **Distribution Platform:** Poly Pizza (\`https://poly.pizza\`)  
- **License:** Creative Commons Attribution 3.0 Unported (**CC BY 3.0**)  
- **License Terms:** \`https://creativecommons.org/licenses/by/3.0/\`  
- **Modifications:** Optimized geometry, PBR material maps, and glTF binary bundling for WebGL runtime rendering.

---

### 2. Chess Engine (Stockfish)
- **Software:** Stockfish Chess Engine (\`https://stockfishchess.org\`)  
- **License:** GNU General Public License version 3 (**GPL v3**)  
- **License Terms:** Full license text is available at \`/stockfish/sf11/LICENSE-GPL-3.0.txt\` and \`/stockfish/sf18/LICENSE-GPL-3.0.txt\`.  
- **Source Code Availability:** Stockfish runs client-side in Web Workers within your browser. Complete source code is available at \`https://github.com/official-stockfish/Stockfish\`.

---

### 3. Room Environments & HDR Lighting
- **Assets:** High Dynamic Range Images (HDRI) from Poly Haven (\`https://polyhaven.com\`)  
- **License:** Creative Commons CC0 1.0 Universal (**CC0**) Public Domain Dedication  
- **Attribution (Voluntary Courtesy):**
  - *Classic Study:* \`combination_room\` by Sergej Majboroda
  - *Space Nebula:* \`qwantani_night_puresky\` by Greg Zaal & Jarod Guest
  - *Park Meadow:* \`meadow_2\` by Sergej Majboroda
  - *Neon Arcade / Studio:* \`white_studio_06\` by Grzegorz Wronkowski

---

### 4. Client Framework & Libraries
- **Next.js & React:** MIT License © Vercel, Inc. and Meta Platforms, Inc.
- **Three.js & React Three Fiber:** MIT License © Mr.doob and pmndrs.
- **Tailwind CSS & Lucide Icons:** MIT License © Tailwind Labs & Lucide Contributors.
`;

const DEFAULT_DOCS: Record<string, { title: string; content: string; version: string }> = {
  terms: {
    title: "Terms of Service",
    content: DEFAULT_TERMS_CONTENT,
    version: "4.2.7-PROD",
  },
  privacy: {
    title: "Privacy Policy",
    content: DEFAULT_PRIVACY_CONTENT,
    version: "4.2.7-PROD",
  },
  payments: {
    title: "Payment & Payout Policy",
    content: DEFAULT_PAYMENTS_CONTENT,
    version: "4.2.7-PROD",
  },
  licenses: {
    title: "Open Source Licenses & Attributions",
    content: DEFAULT_LICENSES_CONTENT,
    version: "4.2.7-PROD",
  },
};

/**
 * Public query to fetch an active published legal document by slug.
 * Falls back to authoritative default content if not yet customized in the database.
 */
export const getPublishedPolicy = query({
  args: {
    slug: v.string(),
  },
  handler: async (ctx, args) => {
    const policy = await ctx.db
      .query("policies")
      .withIndex("by_slug_and_status", (q) =>
        q.eq("slug", args.slug).eq("status", "published")
      )
      .first();

    if (policy) {
      return {
        slug: policy.slug,
        title: policy.title,
        content: policy.content,
        version: policy.version,
        publishedAt: policy.publishedAt ?? policy.updatedAt,
        updatedAt: policy.updatedAt,
      };
    }

    // Default fallback
    const fallback = DEFAULT_DOCS[args.slug];
    if (fallback) {
      return {
        slug: args.slug,
        title: fallback.title,
        content: fallback.content,
        version: fallback.version,
        publishedAt: Date.now(),
        updatedAt: Date.now(),
      };
    }

    return null;
  },
});

/**
 * Public query to list all active published legal documents for the Legal Portal hub.
 */
export const listPublishedPolicies = query({
  args: {},
  handler: async (ctx) => {
    const published = await ctx.db
      .query("policies")
      .withIndex("by_status", (q) => q.eq("status", "published"))
      .collect();

    const result = Object.entries(DEFAULT_DOCS).map(([slug, def]) => {
      const match = published.find((p) => p.slug === slug);
      if (match) {
        return {
          slug: match.slug,
          title: match.title,
          version: match.version,
          publishedAt: match.publishedAt ?? match.updatedAt,
        };
      }
      return {
        slug,
        title: def.title,
        version: def.version,
        publishedAt: Date.now(),
      };
    });

    return result;
  },
});

/**
 * Admin query to list all policies with drafts and versions for the Owner Command Center.
 */
export const listPoliciesForAdmin = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const all = await ctx.db.query("policies").collect();

    // Map each standard slug with its DB doc or default fallback
    return Object.entries(DEFAULT_DOCS).map(([slug, def]) => {
      const dbDoc = all.find((p) => p.slug === slug);
      return {
        _id: dbDoc?._id,
        slug,
        title: dbDoc?.title ?? def.title,
        content: dbDoc?.content ?? def.content,
        version: dbDoc?.version ?? def.version,
        status: dbDoc?.status ?? ("published" as const),
        publishedAt: dbDoc?.publishedAt ?? Date.now(),
        updatedAt: dbDoc?.updatedAt ?? Date.now(),
        updatedBy: dbDoc?.updatedBy ?? "system_seed",
      };
    });
  },
});

/**
 * Owner-only mutation to create, edit, or version a policy document.
 */
export const savePolicy = mutation({
  args: {
    slug: v.string(),
    title: v.string(),
    content: v.string(),
    version: v.string(),
    status: v.union(v.literal("draft"), v.literal("published"), v.literal("archived")),
  },
  handler: async (ctx, args) => {
    const owner = await requireOwner(ctx);
    const now = Date.now();

    const existing = await ctx.db
      .query("policies")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        title: args.title,
        content: args.content,
        version: args.version,
        status: args.status,
        publishedAt: args.status === "published" ? now : existing.publishedAt,
        updatedAt: now,
        updatedBy: owner.identity.subject,
      });
      return { success: true, policyId: existing._id, action: "updated" };
    } else {
      const policyId = await ctx.db.insert("policies", {
        slug: args.slug,
        title: args.title,
        content: args.content,
        version: args.version,
        status: args.status,
        publishedAt: args.status === "published" ? now : undefined,
        updatedAt: now,
        updatedBy: owner.identity.subject,
      });
      return { success: true, policyId, action: "created" };
    }
  },
});

/**
 * Player mutation to record acceptance of Terms and Privacy policies upon registration or profile completion.
 */
export const recordPolicyAcceptance = mutation({
  args: {
    termsVersion: v.string(),
    privacyVersion: v.string(),
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const player = await requirePlayer(ctx);
    const now = Date.now();

    // 1. Record immutable acceptance audit record
    await ctx.db.insert("policyAcceptances", {
      playerId: player._id,
      clerkId: player.clerkId,
      termsVersion: args.termsVersion,
      privacyVersion: args.privacyVersion,
      acceptedAt: now,
      ipAddress: args.ipAddress,
      userAgent: args.userAgent,
    });

    // 2. Patch player document
    await ctx.db.patch(player._id, {
      acceptedTermsVersion: args.termsVersion,
      acceptedPrivacyVersion: args.privacyVersion,
      acceptedPoliciesAt: now,
    });

    return { success: true, acceptedAt: now };
  },
});

/**
 * Query to check if the currently authenticated player has accepted the current policies.
 */
export const checkUserPolicyAcceptance = query({
  args: {},
  handler: async (ctx) => {
    const player = await optionalPlayer(ctx);
    if (!player) {
      return { hasAccepted: false, isGuest: true };
    }

    const hasAccepted =
      Boolean(player.acceptedTermsVersion) && Boolean(player.acceptedPrivacyVersion);

    return {
      hasAccepted,
      isGuest: false,
      acceptedTermsVersion: player.acceptedTermsVersion,
      acceptedPrivacyVersion: player.acceptedPrivacyVersion,
      acceptedPoliciesAt: player.acceptedPoliciesAt,
    };
  },
});
