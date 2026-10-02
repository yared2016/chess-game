# Castle Chess: Auth, Onboarding, Profile, Presence & Discovery Upgrade
## Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade Castle Chess with mandatory profile onboarding (`/complete-profile`), international phone validation, strict dual player types (student with searchable university vs public), university immutability, realtime presence & last-seen tracking, and an intelligent player discovery & matchmaking suggestion engine.

**Architecture:**
- **Auth & Gating:** Clerk remains authentication identity provider; Castle Chess enforces a multi-layer gate (edge proxy, server protected layout, client sync, and Convex mutation auth) ensuring accounts cannot bypass `/complete-profile`.
- **Database & Presence:** Extend `players` schema and add a dedicated `userPresence` table to prevent query subscription churn. Heartbeat runs at 30s interval with visibility awareness.
- **Discovery Engine:** Convex scoring algorithm balances rating proximity ($\pm 150$ Elo), activity/availability, university affinity, and social history with rotation jitter.

**Architecture Diagram:**
```mermaid
graph TD
    subgraph "Auth & Onboarding Gate"
        A[Clerk Auth / Sign In / Sign Up] --> B[src/proxy.ts]
        B --> C[Protected Layout & PlayerSync]
        C --> D{profileCompleted?}
        D -- No --> E[/complete-profile]
        D -- Yes --> F[/play Lobby]
        E --> G[Convex: players.completeProfile]
        G --> F
    end

    subgraph "Presence Subsystem"
        F --> H[usePlatformPresence Hook]
        H -- 30s beat & tab visible --> I[Convex: userPresence]
        I --> J[Online Status & Relative Last Seen]
    end

    subgraph "Discovery & Search"
        F --> K[Convex: discovery.getRecommendedPlayers]
        F --> L[Convex: discovery.getOnlinePlayers]
        K --> M["Players You May Want to Play" UI]
        L --> N["Online Now Rail" UI]
        F --> O[Dedicated /players Search Hub]
    end
```

**Tech Stack:** Next.js 16 (App Router), Convex 1.45, Clerk 7.9, React 19, Tailwind CSS 4, Lucide Icons, Sonner, Vitest.
**Spec:** `docs/superpowers/specs/2026-10-02-auth-profile-presence-discovery-design.md`

## Global Constraints
- Do NOT remove or replace Clerk.
- Do NOT use fragile CSS hacks to hide "Secured by Clerk" (document dashboard plan requirement).
- Phone number is mandatory for EVERY player (both University Students and Public Players).
- Strictly 2 player types: `university_student` and `public_player`. Never create or allow `staff`.
- University must be strictly IMMUTABLE from the user UI and user mutations once profile is completed.
- Never expose private phone numbers, student IDs, or email in public profile queries or UI.
- Presence heartbeats must never update the primary `players` document directly (use `userPresence`).
- Preserve all existing chess gameplay, matchmaking, ratings, tournaments, and wallet features.
- All tests must pass: `pnpm test` and `pnpm typecheck`.

---

### Task 1: Convex Schema & Immutability Rules
**Files:**
- Modify: `convex/schema.ts`
- Modify: `convex/lib/auth.ts`
- Modify: `convex/universities.ts`
- Create: `convex/__tests__/profile-immutability.test.ts`

**Interfaces:**
- Consumes: Convex `defineTable`, `v`, existing `players` and `universities` tables.
- Produces:
  - Extended `players` schema fields (`displayName`, `phoneNumber`, `playerType`, `studentId`, `verificationStatus`, `profileCompleted`, `profileCompletedAt`).
  - New `userPresence` table (`playerId`, `lastSeen`, `updatedAt`).
  - Auth helper: `requireCompletedPlayer(ctx)` in `convex/lib/auth.ts`.
  - Auto-seeding and immutability checks in `convex/universities.ts`.

- [ ] **Step 1: Write the failing test for immutability and requireCompletedPlayer**
Create `convex/__tests__/profile-immutability.test.ts` testing:
1. `requireCompletedPlayer` throws `"profile-incomplete"` when `profileCompleted` is false or unset.
2. `joinUniversity` throws `"university-immutable-after-profile-completion"` when a university student attempts to change campus after completing profile.

- [ ] **Step 2: Run test to verify it fails**
Run: `pnpm vitest run convex/__tests__/profile-immutability.test.ts`
Expected: FAIL (types / methods missing).

- [ ] **Step 3: Update `convex/schema.ts` and `convex/lib/auth.ts` and `convex/universities.ts`**
- In `convex/schema.ts`: Add `displayName`, `phoneNumber`, `playerType`, `studentId`, `verificationStatus`, `profileCompleted`, `profileCompletedAt` to `players` table and add `userPresence` table.
- In `convex/lib/auth.ts`: Export `requireCompletedPlayer(ctx)`.
- In `convex/universities.ts`: Enforce immutability in `joinUniversity` and `leaveUniversity` when `player.profileCompleted === true && player.playerType === "university_student"`.
- Ensure `listUniversities` auto-seeds if database is empty so real `Id<"universities">` are always returned.

- [ ] **Step 4: Run test to verify it passes**
Run: `pnpm vitest run convex/__tests__/profile-immutability.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit changes**
`git add convex/schema.ts convex/lib/auth.ts convex/universities.ts convex/__tests__/profile-immutability.test.ts`
`git commit -m "feat(convex): add profile fields, userPresence table, and university immutability rules"`

---

### Task 2: Backend Profile Completion & Username Availability
**Files:**
- Modify: `convex/players.ts`
- Modify: `convex/lib/returns.ts`
- Create: `convex/__tests__/complete-profile.test.ts`

**Interfaces:**
- Consumes: `requirePlayer` from `convex/lib/auth.ts`, `players` and `universities` tables.
- Produces:
  - Query `players.checkUsernameAvailability({ username: string }) -> { available: boolean; reason?: string }`
  - Mutation `players.completeProfile({ username, displayName, phoneNumber, playerType, universityId?, studentId? }) -> { success: boolean }`
  - Update `players.me` and `players.getByUsername` return validators in `convex/lib/returns.ts` to include public profile fields while keeping `phoneNumber` and `studentId` redacted.

- [ ] **Step 1: Write the failing test for completeProfile and checkUsernameAvailability**
Create `convex/__tests__/complete-profile.test.ts`:
1. Check username availability (valid, taken, invalid characters, length).
2. Complete profile as Public Player (success with valid phone, sets `profileCompleted: true`).
3. Complete profile as University Student (requires `universityId` and `studentId`).
4. Rejects invalid phone numbers.
5. Rejects duplicate completeProfile calls attempting to swap university.
6. Public projection `getByUsername` never returns `phoneNumber` or `studentId`.

- [ ] **Step 2: Run test to verify it fails**
Run: `pnpm vitest run convex/__tests__/complete-profile.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `completeProfile` and `checkUsernameAvailability` in `convex/players.ts`**
- Implement username validator (3-20 chars, lowercase alphanumeric, underscore, hyphen, no reserved words like "admin", "castle", "system").
- Implement phone number validator (E.164 compliant, length between 8 and 15 digits, handles Ethiopia `+251` prefixes).
- Complete profile mutation validates fields, checks username collision, saves fields, increments university totalPlayers count if student, and marks `profileCompleted: true`.
- Update `vMe` and `vPlayerProfile` in `convex/lib/returns.ts`.

- [ ] **Step 4: Run test to verify it passes**
Run: `pnpm vitest run convex/__tests__/complete-profile.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit changes**
`git add convex/players.ts convex/lib/returns.ts convex/__tests__/complete-profile.test.ts`
`git commit -m "feat(convex): implement completeProfile mutation and username availability query"`

---

### Task 3: Online/Offline Presence Backend & Heartbeat Hook
**Files:**
- Create: `convex/presence.ts`
- Create: `src/hooks/use-platform-presence.ts`
- Modify: `src/lib/format.ts`
- Create: `src/lib/__tests__/format-presence.test.ts`
- Create: `convex/__tests__/platform-presence.test.ts`
- Modify: `src/components/providers/player-sync.tsx`

**Interfaces:**
- Consumes: `userPresence` table, `requirePlayer`.
- Produces:
  - Mutation `presence.heartbeat() -> null`
  - Query `presence.getPresence({ playerId }) -> { isOnline: boolean; lastSeen: number }`
  - Query `presence.getBatchPresence({ playerIds: Id<"players">[] }) -> Record<string, { isOnline: boolean; lastSeen: number }>`
  - Helper `formatPresenceLastSeen(lastSeenMs, nowMs) -> string`
  - Hook `usePlatformPresence()` running 30s heartbeat when authenticated and visible.

- [ ] **Step 1: Write failing tests for formatPresenceLastSeen and presence mutations**
Create `src/lib/__tests__/format-presence.test.ts` testing:
- Under 60s $\rightarrow$ "Online"
- 2 minutes ago $\rightarrow$ "Last seen 2 min ago"
- 3 hours ago $\rightarrow$ "Last seen 3 hours ago"
- 26 hours ago $\rightarrow$ "Last seen yesterday"
- Multiple days ago $\rightarrow$ formatted date (e.g. "Last seen Oct 1").
Create `convex/__tests__/platform-presence.test.ts` testing heartbeat upsert and `getPresence` status.

- [ ] **Step 2: Run tests to verify they fail**
Run: `pnpm vitest run src/lib/__tests__/format-presence.test.ts convex/__tests__/platform-presence.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement presence backend, format helper, and hook**
- In `src/lib/format.ts`: Add `formatPresenceLastSeen`.
- In `convex/presence.ts`: Add `heartbeat`, `getPresence`, and `getBatchPresence`.
- In `src/hooks/use-platform-presence.ts`: Set 30s interval with `document.visibilityState` listener, calling `presence.heartbeat()`.
- In `src/components/providers/player-sync.tsx`: Mount `usePlatformPresence()`.

- [ ] **Step 4: Run tests to verify they pass**
Run: `pnpm vitest run src/lib/__tests__/format-presence.test.ts convex/__tests__/platform-presence.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit changes**
`git add convex/presence.ts src/hooks/use-platform-presence.ts src/lib/format.ts src/lib/__tests__/format-presence.test.ts convex/__tests__/platform-presence.test.ts src/components/providers/player-sync.tsx`
`git commit -m "feat(presence): add platform heartbeat, batch presence query, and relative time formatter"`

---

### Task 4: Player Discovery & Recommendation Algorithm Backend
**Files:**
- Create: `convex/discovery.ts`
- Create: `convex/__tests__/discovery.test.ts`

**Interfaces:**
- Consumes: `players`, `userPresence`, `friendships`, `blocks`, `games`.
- Produces:
  - Query `discovery.getRecommendedPlayers({ limit?: number })`
  - Query `discovery.getOnlinePlayers({ limit?: number })`
  - Query `discovery.searchPlayers({ query, minRating?, maxRating?, onlineOnly?, universityId?, playerType?, limit? })`

- [ ] **Step 1: Write failing test for discovery algorithm**
Create `convex/__tests__/discovery.test.ts` testing:
1. `getRecommendedPlayers` prioritizes similar ratings ($\pm 150$ Elo) over distant ratings.
2. `getRecommendedPlayers` prioritizes online/active players.
3. Excludes current user and blocked players in both directions.
4. `getOnlinePlayers` only returns users seen in last 60 seconds.
5. `searchPlayers` matches username and displayName, filters by rating and university, and never returns emails, phone numbers, or student IDs.

- [ ] **Step 2: Run test to verify it fails**
Run: `pnpm vitest run convex/__tests__/discovery.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `convex/discovery.ts`**
- Implement modular scoring:
  - $S_{\text{rating}} = \max(0, 1 - |\text{diff}| / 500) \times 0.35$
  - $S_{\text{presence}} = (\text{isOnline ? 1.0 : recent ? 0.5 : 0.05}) \times 0.30$
  - $S_{\text{community}} = (\text{sameUni ? 1.0 : student ? 0.7 : 0.3}) \times 0.15$
  - $S_{\text{social}} = (\text{isFriend ? 0.8 : 0.4}) \times 0.10$
  - $S_{\text{jitter}} = (\text{deterministic hash}) \times 0.10$
- Implement `getRecommendedPlayers`, `getOnlinePlayers`, and `searchPlayers`.

- [ ] **Step 4: Run test to verify it passes**
Run: `pnpm vitest run convex/__tests__/discovery.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit changes**
`git add convex/discovery.ts convex/__tests__/discovery.test.ts`
`git commit -m "feat(discovery): implement modular player recommendation and multi-filter search queries"`

---

### Task 5: Castle Chess Branded Auth Styling
**Files:**
- Modify: `src/app/sign-in/auth-card.tsx`
- Modify: `src/lib/clerk-appearance.ts`
- Modify: `src/app/sign-in/[[...sign-in]]/page.tsx`
- Modify: `src/app/sign-up/[[...sign-up]]/page.tsx`

**Interfaces:**
- Consumes: `@clerk/nextjs` `<SignIn />` and `<SignUp />`, `useClerkVariables`.
- Produces:
  - Premium Castle Chess authentication screen with knight logo `♞`, Fraunces typography, Study palette, and branded titles.
  - Correct fallback redirects (`/play`, handled by gate).

- [ ] **Step 1: Inspect and enhance `auth-card.tsx`**
- Add Castle Chess knight logo `♞` and brand title above the auth card.
- Add subtitle: "Join the community, build your rating, and compete in chess."
- Configure `appearance` with Study palette (`brass #c9a24a`, `walnut #1c1610`, `ivory #f1e7d3`).
- Add accessible headings, smooth layout transitions, and responsive centering.

- [ ] **Step 2: Run typecheck and existing auth tests**
Run: `pnpm vitest run src/components/nav/__tests__/auth-nav.test.tsx`
Expected: PASS.

- [ ] **Step 3: Commit changes**
`git add src/app/sign-in/auth-card.tsx src/lib/clerk-appearance.ts src/app/sign-in/[[...sign-in]]/page.tsx src/app/sign-up/[[...sign-up]]/page.tsx`
`git commit -m "style(auth): enhance Castle Chess branding and layout for sign-in and sign-up cards"`

---

### Task 6: Multi-Layer Edge & Layout Gating
**Files:**
- Modify: `src/proxy.ts`
- Modify: `src/app/(protected)/layout.tsx`
- Modify: `src/components/providers/player-sync.tsx`

**Interfaces:**
- Consumes: Clerk `auth()`, `players.me`.
- Produces:
  - Server redirect to `/complete-profile` if user is signed in but has not completed profile.
  - Client redirect to `/complete-profile` if user tries to navigate to any protected route while `me.profileCompleted !== true`.
  - Redirect from `/complete-profile` to `/play` once profile is complete.

- [ ] **Step 1: Update `src/proxy.ts`**
- Ensure `/complete-profile` requires authentication (`auth.protect()`), but does not conflict with protected prefixes.
- Add `/complete-profile` to `PROTECTED_PREFIXES` so unauthenticated visitors bounce to `/sign-in`.

- [ ] **Step 2: Update `src/app/(protected)/layout.tsx` and `player-sync.tsx`**
- In `PlayerSync`: check `me.profileCompleted`. If false and pathname is not `/complete-profile`, route to `/complete-profile`. If true and pathname is `/complete-profile`, route to `/play`.

- [ ] **Step 3: Verify with automated tests & manual check**
Run: `pnpm typecheck`
Expected: PASS with 0 errors.

- [ ] **Step 4: Commit changes**
`git add src/proxy.ts src/app/(protected)/layout.tsx src/components/providers/player-sync.tsx`
`git commit -m "feat(gate): enforce mandatory onboarding redirect to /complete-profile"`

---

### Task 7: International Phone Selector & Complete Profile UI
**Files:**
- Create: `src/components/auth/phone-input.tsx`
- Create: `src/components/auth/complete-profile-form.tsx`
- Create: `src/app/complete-profile/page.tsx`
- Create: `src/components/auth/__tests__/complete-profile-form.test.tsx`

**Interfaces:**
- Consumes: `api.players.completeProfile`, `api.players.checkUsernameAvailability`, `api.universities.listUniversities`.
- Produces:
  - Accessible International Phone Selector (`PhoneInput`).
  - Sectioned onboarding form (`CompleteProfileForm`).
  - Route `/complete-profile`.

- [ ] **Step 1: Write test for phone validation & complete profile form states**
Create `src/components/auth/__tests__/complete-profile-form.test.tsx` testing:
- Validates phone format (Ethiopia `+251 9...`).
- Renders 2 player type cards (Student vs Public); zero staff option.
- Disables submit when required fields are missing.
- Shows university combobox only when University Student is selected.

- [ ] **Step 2: Run test to verify it fails**
Run: `pnpm vitest run src/components/auth/__tests__/complete-profile-form.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement `PhoneInput`, `CompleteProfileForm`, and `/complete-profile/page.tsx`**
- Implement `PhoneInput` with country selector dropdown (Ethiopia `+251` default, US `+1`, UK `+44`, Kenya `+254`, etc.), format masking, and clear error message.
- Implement `CompleteProfileForm` with:
  - Section 1: Basic Info (Username with live check, Display Name, Phone).
  - Section 2: Player Type cards (University Student vs Public Player).
  - Section 3: University Combobox (searchable list of Ethiopian universities) + Student ID + Verification badge.
  - Submit button with spinner and validation feedback.
- Implement `src/app/complete-profile/page.tsx`.

- [ ] **Step 4: Run test to verify it passes**
Run: `pnpm vitest run src/components/auth/__tests__/complete-profile-form.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit changes**
`git add src/components/auth/phone-input.tsx src/components/auth/complete-profile-form.tsx src/app/complete-profile/page.tsx src/components/auth/__tests__/complete-profile-form.test.tsx`
`git commit -m "feat(onboarding): implement complete-profile flow with international phone validation"`

---

### Task 8: Lobby Player Discovery & Matchmaking Suggestions UI
**Files:**
- Create: `src/components/players/players-you-may-like.tsx`
- Create: `src/components/players/online-now-rail.tsx`
- Create: `src/components/players/find-opponent-modal.tsx`
- Modify: `src/app/(protected)/play/page.tsx`
- Create: `src/components/players/__tests__/players-you-may-like.test.tsx`

**Interfaces:**
- Consumes: `api.discovery.getRecommendedPlayers`, `api.discovery.getOnlinePlayers`, `api.challenges.createChallenge`.
- Produces:
  - "Players You May Want to Play" card grid in `/play`.
  - "Online Now" horizontal rail in `/play`.
  - "Find an Opponent" modal launcher in `/play`.

- [ ] **Step 1: Write test for discovery components**
Create `src/components/players/__tests__/players-you-may-like.test.tsx` testing:
- Renders player cards with avatar, username, rating, presence badge, and university badge.
- Clicking challenge triggers challenge flow.
- Empty states ("No players online right now", etc.).

- [ ] **Step 2: Run test to verify it fails**
Run: `pnpm vitest run src/components/players/__tests__/players-you-may-like.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement discovery components and integrate into `/play`**
- Build `PlayersYouMayLike` with responsive grid of player cards.
- Build `OnlineNowRail` showing live active users with status dots.
- Build `FindOpponentModal` with smart match suggestion based on rating and time controls.
- Integrate into `src/app/(protected)/play/page.tsx`.

- [ ] **Step 4: Run test to verify it passes**
Run: `pnpm vitest run src/components/players/__tests__/players-you-may-like.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit changes**
`git add src/components/players/players-you-may-like.tsx src/components/players/online-now-rail.tsx src/components/players/find-opponent-modal.tsx src/app/(protected)/play/page.tsx src/components/players/__tests__/players-you-may-like.test.tsx`
`git commit -m "feat(ui): add Players You May Want to Play and Online Now to play lobby"`

---

### Task 9: Dedicated Player Discovery & Search Hub
**Files:**
- Create: `src/components/players/player-search-hub.tsx`
- Create: `src/app/(protected)/players/page.tsx`
- Modify: `src/components/nav/auth-nav.tsx`
- Create: `src/components/players/__tests__/player-search-hub.test.tsx`

**Interfaces:**
- Consumes: `api.discovery.searchPlayers`, `api.universities.listUniversities`.
- Produces:
  - Route `/players` with debounced search, filters for rating range, online only, university, and player type.
  - Navigation link "Players" in site header.

- [ ] **Step 1: Write test for player search hub**
Create `src/components/players/__tests__/player-search-hub.test.tsx` testing search input, filter state changes, and empty result display.

- [ ] **Step 2: Run test to verify it fails**
Run: `pnpm vitest run src/components/players/__tests__/player-search-hub.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement `PlayerSearchHub`, `/players/page.tsx`, and nav link**
- Build `PlayerSearchHub` with debounced search input, rating range sliders/selects, university combobox filter, and online toggle.
- Add `/players` link into `src/components/nav/auth-nav.tsx`.
- Add `src/app/(protected)/players/page.tsx`.

- [ ] **Step 4: Run test to verify it passes**
Run: `pnpm vitest run src/components/players/__tests__/player-search-hub.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit changes**
`git add src/components/players/player-search-hub.tsx src/app/(protected)/players/page.tsx src/components/nav/auth-nav.tsx src/components/players/__tests__/player-search-hub.test.tsx`
`git commit -m "feat(players): implement dedicated /players search and discovery directory"`

---

### Task 10: Player Profile Page Upgrade & Privacy Enforcement
**Files:**
- Modify: `src/components/profile/profile-header.tsx`
- Modify: `src/app/(protected)/profile/[username]/page.tsx`
- Create: `src/components/profile/__tests__/profile-privacy.test.tsx`

**Interfaces:**
- Consumes: `api.players.getByUsername`, `api.presence.getPresence`.
- Produces:
  - Upgraded profile header showing display name, `@username`, player type, verified university badge, live presence indicator with relative last-seen.
  - Zero leakage of phone number, student ID, or email.
  - University locked from user modification.

- [ ] **Step 1: Write test for profile privacy and presence display**
Create `src/components/profile/__tests__/profile-privacy.test.tsx` testing:
- Renders display name, username, rating, tier, university badge, presence status.
- Verifies phone number, student ID, and email are never rendered.

- [ ] **Step 2: Run test to verify it fails**
Run: `pnpm vitest run src/components/profile/__tests__/profile-privacy.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Update `profile-header.tsx` and profile page**
- Connect `api.presence.getPresence` for the viewed user.
- Render live Online indicator or relative Last Seen time.
- Display `displayName` alongside `@username`.
- Show verified campus badge for University Students.
- Ensure university cannot be edited from settings or profile.

- [ ] **Step 4: Run test to verify it passes**
Run: `pnpm vitest run src/components/profile/__tests__/profile-privacy.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit changes**
`git add src/components/profile/profile-header.tsx src/app/(protected)/profile/[username]/page.tsx src/components/profile/__tests__/profile-privacy.test.tsx`
`git commit -m "feat(profile): display presence status and enforce PII privacy on public profile"`

---

### Task 11: Full Test Suite Verification & Typecheck
**Files:**
- Verify: all test files
- Verify: `pnpm typecheck`

- [ ] **Step 1: Run complete vitest test suite**
Run: `pnpm test`
Expected: All 62 original test files + all new test files pass (100% green).

- [ ] **Step 2: Run complete TypeScript typecheck**
Run: `pnpm typecheck`
Expected: 0 type errors across all files.

- [ ] **Step 3: Compile and format final report**
Compile comprehensive final report covering all 19 prompt sections.

- [ ] **Step 4: Final commit**
`git commit --allow-empty -m "chore: complete auth, onboarding, profile, discovery, and presence upgrade"`
