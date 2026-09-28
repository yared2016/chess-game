# Chess Platform Feedback System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a complete, production-ready feedback subsystem for the Castle 3D Chess platform, enabling players to submit chess-related feedback with context and attachments, receive confirmation emails, track their feedback history, and empower admins to manage, review, and resolve feedback in real time with private internal notes and secure attachment viewing.

**Architecture:** A native Convex architecture with a dedicated `feedback` table, client-side direct uploads to Convex storage via one-time signed URLs, server-gated attachment access control via `getFeedbackAttachmentUrl`, transactional confirmation emails queued asynchronously via Convex internal actions (with resilient error tracking and retry), a player-facing `/feedback` page with "Share Feedback" and "My Feedback" tabs, and an integrated "Player Feedback" tab in the Admin Command Center (`admin-view.tsx`).

**Architecture Diagram:**

```mermaid
graph TD
    subgraph "Player Interface"
        A[Header / In-Game / Nav] --> B[/feedback Route]
        B --> C[Category & Form Input]
        B --> D[Optional Game Context]
        B --> E[Secure File Uploader]
        E -->|Upload URL| F[Convex Storage]
    end

    subgraph "Convex Backend"
        C & D & E --> G[submitFeedback Mutation]
        G --> H[(feedback Table)]
        G -->|runAfter 0| I[sendConfirmationEmailAction]
        I -->|Resend API| J[Player Email Inbox]
        H --> K[getMyFeedback Query]
        H --> L[getFeedbackAttachmentUrl Query]
    end

    subgraph "Admin Command Center"
        H --> M[adminListFeedback Query]
        H --> N[adminGetStats Query]
        M & N --> O[Admin Feedback Tab]
        O --> P[Feedback Detail Modal]
        P -->|Update Status| Q[adminUpdateStatus Mutation]
        P -->|Save Notes| R[adminUpdateNotes Mutation]
        P -->|Retry Email| S[adminRetryEmail Mutation]
    end
```

**Tech Stack:** Next.js 16 (App Router), Convex 1.45.0, Clerk 7.9.1, Tailwind CSS v4, Lucide React, Sonner, Resend API / internalAction.  
**Spec:** `docs/superpowers/specs/2026-09-28-chess-feedback-system-design.md`

## Global Constraints
- **Zero Financial Disruption:** Never modify or interfere with `wallets`, `deposits`, `withdrawals`, `chapaPayments`, or `ledger`.
- **Identity Derivation:** Server-side `requirePlayer(ctx)` & `ctx.auth.getUserIdentity()`. Never trust client-sent `userId` or `userEmail`.
- **File Limits:** Max 5 attachments, max 10MB per file, allowed MIME types: PNG, JPEG, WEBP, PDF.
- **Admin Privacy:** `adminNotes` must never be sent to player queries.
- **Email Resilience:** If email fails, feedback MUST NOT be rolled back or deleted. Store `emailStatus = "FAILED"` and allow retry.

---

### Task 1: Convex Schema and Validators for Feedback

**Files:**
- Modify: `convex/lib/validators.ts`
- Modify: `convex/schema.ts`
- Test: `convex/__tests__/feedback-schema.test.ts`

**Interfaces:**
- Consumes: Convex schema primitives
- Produces: `vFeedbackCategory`, `vFeedbackStatus`, `vEmailStatus`, `vFeedbackAttachment`, `feedback` table definition

- [ ] **Step 1: Write test for feedback schema validators**

Create `convex/__tests__/feedback-schema.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import {
  vFeedbackCategory,
  vFeedbackStatus,
  vEmailStatus,
} from "../lib/validators";

describe("Feedback Schema Validators", () => {
  it("defines all required feedback categories", () => {
    const validCategories = [
      "chess_game",
      "matchmaking",
      "tournaments",
      "wallet_payments",
      "account_profile",
      "website_app",
      "feature_request",
      "report_problem",
      "general_feedback",
    ];
    expect(validCategories.length).toBe(9);
  });

  it("defines all required feedback statuses", () => {
    const validStatuses = ["NEW", "IN_REVIEW", "RESOLVED", "CLOSED"];
    expect(validStatuses.length).toBe(4);
  });

  it("defines all required email statuses", () => {
    const validEmailStatuses = ["NOT_SENT", "SENT", "FAILED"];
    expect(validEmailStatuses.length).toBe(3);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `pnpm test convex/__tests__/feedback-schema.test.ts`
Expected: FAIL due to missing validator exports in `convex/lib/validators.ts`.

- [ ] **Step 3: Add validators to `convex/lib/validators.ts` and table to `convex/schema.ts`**

In `convex/lib/validators.ts`:
```typescript
export const vFeedbackCategory = v.union(
  v.literal("chess_game"),
  v.literal("matchmaking"),
  v.literal("tournaments"),
  v.literal("wallet_payments"),
  v.literal("account_profile"),
  v.literal("website_app"),
  v.literal("feature_request"),
  v.literal("report_problem"),
  v.literal("general_feedback")
);

export const vFeedbackStatus = v.union(
  v.literal("NEW"),
  v.literal("IN_REVIEW"),
  v.literal("RESOLVED"),
  v.literal("CLOSED")
);

export const vEmailStatus = v.union(
  v.literal("NOT_SENT"),
  v.literal("SENT"),
  v.literal("FAILED")
);

export const vFeedbackAttachment = v.object({
  storageId: v.id("_storage"),
  fileName: v.string(),
  fileType: v.string(),
  fileSize: v.number(),
  uploadedAt: v.number(),
});
```

In `convex/schema.ts`:
Import validators and add `feedback` table:
```typescript
  feedback: defineTable({
    userId: v.id("players"),
    clerkId: v.string(),
    userName: v.string(),
    userEmail: v.string(),
    userAvatarUrl: v.optional(v.string()),

    category: vFeedbackCategory,
    description: v.string(),

    gameId: v.optional(v.string()),
    matchId: v.optional(v.string()),
    tournamentId: v.optional(v.string()),
    opponentUsername: v.optional(v.string()),

    attachments: v.array(vFeedbackAttachment),

    status: vFeedbackStatus,
    adminNotes: v.optional(v.string()),

    emailStatus: vEmailStatus,
    emailError: v.optional(v.string()),
    emailSentAt: v.optional(v.number()),

    createdAt: v.number(),
    updatedAt: v.number(),
    resolvedAt: v.optional(v.number()),
    resolvedBy: v.optional(v.string()),
  })
    .index("by_userId", ["userId"])
    .index("by_status", ["status"])
    .index("by_category", ["category"])
    .index("by_createdAt", ["createdAt"])
    .index("by_status_and_createdAt", ["status", "createdAt"]),
```

- [ ] **Step 4: Run test to verify it passes**
Run: `pnpm test convex/__tests__/feedback-schema.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add convex/lib/validators.ts convex/schema.ts convex/__tests__/feedback-schema.test.ts
git commit -m "feat(convex): add feedback schema and validators"
```

---

### Task 2: Convex Feedback Backend Functions & Email Action

**Files:**
- Create: `convex/feedback.ts`
- Create: `convex/__tests__/feedback.test.ts`

**Interfaces:**
- Consumes: `requirePlayer`, `requireAdmin`, `feedback` table
- Produces: `generateUploadUrl`, `submit`, `getMyFeedback`, `getAttachmentUrl`, `adminList`, `adminGetStats`, `adminUpdateStatus`, `adminUpdateNotes`, `adminRetryEmail`, `sendConfirmationEmailAction`

- [ ] **Step 1: Write unit tests in `convex/__tests__/feedback.test.ts`**

Create test suite testing:
1. `submit` validation (rejects unauthenticated, rejects empty description, accepts valid submission, schedules email).
2. `getMyFeedback` returns player's feedback and hides `adminNotes`.
3. `getAttachmentUrl` allows owner and admin, rejects unauthorized other player.
4. `adminList` and `adminGetStats` reject non-admins.
5. `adminUpdateStatus` and `adminUpdateNotes` update records properly.

- [ ] **Step 2: Run test to verify it fails**
Run: `pnpm test convex/__tests__/feedback.test.ts`
Expected: FAIL (`convex/feedback.ts` does not exist yet)

- [ ] **Step 3: Implement `convex/feedback.ts`**

Implement:
- `generateUploadUrl`: mutation calling `ctx.storage.generateUploadUrl()` after `requirePlayer(ctx)`.
- `submit`: mutation validating input, inserting into `feedback`, triggering `sendConfirmationEmailAction` via `ctx.scheduler.runAfter(0, ...)`, inserting an in-app notification.
- `getMyFeedback`: query filtering by `userId === player._id`, omitting `adminNotes`.
- `getAttachmentUrl`: query checking caller permissions (admin or owner) and returning `ctx.storage.getUrl(storageId)`.
- `adminList`: query for admins with search filter, category filter, status filter, and pagination.
- `adminGetStats`: query for admins calculating total, new, in-review, resolved, and feature requests.
- `adminUpdateStatus`: mutation for admins updating status and resolution info.
- `adminUpdateNotes`: mutation for admins saving internal notes.
- `sendConfirmationEmailAction`: internal action invoking Resend API with chess platform template, catching failures and updating `emailStatus = "FAILED"`.
- `adminRetryEmail`: mutation for admins to reschedule the email action.

- [ ] **Step 4: Run test to verify it passes**
Run: `pnpm test convex/__tests__/feedback.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add convex/feedback.ts convex/__tests__/feedback.test.ts
git commit -m "feat(convex): implement feedback backend functions, auth and email actions"
```

---

### Task 3: Next.js Route Protection and Navigation Shortcuts

**Files:**
- Modify: `src/proxy.ts`
- Modify: `src/components/nav/nav-links.tsx`
- Modify: `src/components/nav/auth-nav.tsx`

**Interfaces:**
- Consumes: Next 16 middleware (`clerkMiddleware`), header component
- Produces: Protected `/feedback` route, "Feedback" menu links for players

- [ ] **Step 1: Add `/feedback` to `PROTECTED_PREFIXES` in `src/proxy.ts`**
Ensure unauthenticated users are redirected to `/sign-in` when visiting `/feedback`.

- [ ] **Step 2: Add "Feedback" link in `auth-nav.tsx` user menu and mobile account menu**
In `auth-nav.tsx`:
Add a link with `MessageSquarePlus` or `LifeBuoy` icon to `/feedback` in both the desktop UserButton menu items and mobile account menu.

- [ ] **Step 3: Verify with existing nav test**
Run: `pnpm test src/components/nav/__tests__/auth-nav.test.tsx`
Expected: PASS

- [ ] **Step 4: Commit**
```bash
git add src/proxy.ts src/components/nav/auth-nav.tsx
git commit -m "feat(nav): add feedback route protection and navigation links"
```

---

### Task 4: Player Feedback Submission and History View

**Files:**
- Create: `src/components/feedback/file-uploader.tsx`
- Create: `src/components/feedback/feedback-form.tsx`
- Create: `src/components/feedback/my-feedback-list.tsx`
- Create: `src/components/feedback/feedback-view.tsx`
- Create: `src/app/(protected)/feedback/page.tsx`
- Test: `src/components/feedback/__tests__/feedback-form.test.tsx`

**Interfaces:**
- Consumes: `api.feedback.generateUploadUrl`, `api.feedback.submit`, `api.feedback.getMyFeedback`
- Produces: Polished interactive player feedback page with Category Selector, Context Auto-Fill, Multi-File Uploader, Success Screen, and History Tab.

- [ ] **Step 1: Create `src/components/feedback/file-uploader.tsx`**
- Multi-file drop zone ("Drop files here or click to upload", "PNG, JPG, WEBP or PDF — up to 10 MB each").
- Validation for file size (<= 10MB) and MIME types (`image/png`, `image/jpeg`, `image/webp`, `application/pdf`).
- Disallow `.exe`, `.bat`, `.cmd`, `.sh`, `.msi`, `.js`, etc.
- Selected file row showing thumbnail preview (for images) or document icon, file name, formatted size, and individual delete button.
- Progress indicator during Convex storage upload.

- [ ] **Step 2: Create `src/components/feedback/feedback-form.tsx`**
- Header: `♟ Share Your Feedback` & Subtitle `"Help us make your chess experience better."`
- "How can we help?" -> 9 Category selector buttons with chess & app icons.
- Dynamic category helper text (e.g. Chess Game -> "You can tell us about the chess board, moves, clock, game result...").
- "What would you like to tell us?" -> Textarea with counter and placeholder.
- Optional Chess Context accordion (Game ID, Match ID, Tournament ID, Opponent). Auto-reads `?gameId=...&opponent=...` from URL and shows "Attached Game: #..." badge.
- Anti-duplicate submission protection (disabled submit button, loading spinner).
- Success Screen: `♟ Thank You, Player!` with confirmation details and "Back to Chess" link.

- [ ] **Step 3: Create `src/components/feedback/my-feedback-list.tsx`**
- Lists caller's past feedback via `useQuery(api.feedback.getMyFeedback)`.
- Status badges: `NEW`, `IN_REVIEW`, `RESOLVED`, `CLOSED`.
- Date formatting, category icon, message preview, and expandable view with attachments.
- Guarantees zero exposure of `adminNotes`.

- [ ] **Step 4: Create `feedback-view.tsx` and `page.tsx`**
- Tab switcher: `Share Feedback` vs `My Feedback`.
- Page title & responsive layout (mobile-first, desktop max-w-4xl).

- [ ] **Step 5: Run tests and typecheck**
Run: `pnpm typecheck`
Expected: PASS

- [ ] **Step 6: Commit**
```bash
git add src/components/feedback/ src/app/\(protected\)/feedback/
git commit -m "feat(feedback): implement player feedback page, form, and history"
```

---

### Task 5: Admin Command Center "Player Feedback" Section

**Files:**
- Create: `src/components/admin/admin-feedback-tab.tsx`
- Create: `src/components/admin/feedback-detail-modal.tsx`
- Modify: `src/components/admin/admin-view.tsx`

**Interfaces:**
- Consumes: `api.feedback.adminList`, `api.feedback.adminGetStats`, `api.feedback.adminUpdateStatus`, `api.feedback.adminUpdateNotes`, `api.feedback.adminRetryEmail`, `api.feedback.getAttachmentUrl`
- Produces: Integrated "Player Feedback" tab in Admin Command Center with realtime metrics, filters, list scan, and full inspection drawer/modal.

- [ ] **Step 1: Create `src/components/admin/feedback-detail-modal.tsx`**
- Displays complete player identity: Avatar, Name, Username, Verified Email, Clerk ID.
- Displays chess context: Game ID (with link to `/game/[id]`), Match ID, Tournament ID, Opponent.
- Displays full description and timestamp.
- Secure Attachment Viewer: Fetches signed URL via `getAttachmentUrl`, renders image preview for images, and Open/Download button for PDFs.
- Status Updater buttons: `NEW`, `IN_REVIEW`, `RESOLVED`, `CLOSED`.
- Internal Admin Notes textarea with "Save Notes" button.
- Email delivery status with "Retry Confirmation Email" button if `emailStatus === 'FAILED'`.

- [ ] **Step 2: Create `src/components/admin/admin-feedback-tab.tsx`**
- Summary Cards at the top:
  - Total Feedback
  - New (with alert badge)
  - In Review
  - Resolved
  - Feature Requests
- Search input (player, email, description, game ID).
- Category and Status dropdown filters.
- Realtime table/card list view: Player avatar, player username, category icon & label, message snippet, context tag, status pill, submission date, email status indicator.
- Click to open `FeedbackDetailModal`.

- [ ] **Step 3: Modify `src/components/admin/admin-view.tsx`**
- Add `"feedback"` to `type AdminTab`.
- Add tab button: `Player Feedback` with unread NEW count pill.
- Render `<AdminFeedbackTab />` when `activeTab === "feedback"`.

- [ ] **Step 4: Run typecheck and test**
Run: `pnpm typecheck`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add src/components/admin/admin-feedback-tab.tsx src/components/admin/feedback-detail-modal.tsx src/components/admin/admin-view.tsx
git commit -m "feat(admin): add player feedback tab and inspection modal to admin command center"
```

---

### Task 6: In-Game Feedback Shortcut

**Files:**
- Modify: `src/components/game/game-options-menu.tsx` (or game action bar)

**Interfaces:**
- Consumes: Current `gameId`, opponent info
- Produces: "Report / Share Feedback" button linking to `/feedback?gameId=${gameId}&opponent=${opponent}`

- [ ] **Step 1: Add feedback link/button to game options menu**
- When clicked, opens `/feedback?gameId=${gameId}&opponent=${encodeURIComponent(opponentName)}` in a new tab or navigation, auto-populating chess context.

- [ ] **Step 2: Run test and typecheck**
Run: `pnpm typecheck`
Expected: PASS

- [ ] **Step 3: Commit**
```bash
git add src/components/game/
git commit -m "feat(game): add quick feedback shortcut with game context"
```

---

### Task 7: Full System Verification & Regression Testing

**Files:**
- Entire repository

- [ ] **Step 1: Run complete vitest test suite**
Run: `pnpm test`
Expected: All tests pass (704+ tests).

- [ ] **Step 2: Run complete TypeScript typecheck**
Run: `pnpm typecheck`
Expected: 0 errors.

- [ ] **Step 3: Run linter**
Run: `pnpm lint`
Expected: 0 errors.

- [ ] **Step 4: Commit any final polishing**
```bash
git commit -m "chore: verify end-to-end feedback system and full test suite"
```
