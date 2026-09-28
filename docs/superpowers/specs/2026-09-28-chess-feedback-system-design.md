# Chess Platform Feedback System — Specification & Design Document

**Date:** 2026-09-28  
**Status:** Approved  
**Author:** Pair Programming Agent & Platform Engineer  

---

## 1. Overview & Objectives

The Chess Platform Feedback System is an end-to-end subsystem that allows chess players to submit chess-related feedback, report problems, propose feature requests, and optionally attach game/match context and multiple files (screenshots, PDFs, logs). The feedback is persisted in Convex, triggers an asynchronous branded confirmation email to the player, updates live in the Admin Command Center, and allows admins to track resolution lifecycle with private internal notes and secure attachment inspection.

### Key Tenets
1. **Chess-Native Identity:** Seamlessly adopts Castle's design system (dark slate theme, emerald accents, chess iconography, responsive typography).
2. **Server-Enforced Access Control:** Only the submitting player and authorized admins can access feedback details and attachments. Admin notes are strictly stripped from player-facing queries.
3. **Resilience & Decoupled Delivery:** Failure of the email delivery provider (Resend) logs failure and marks `emailStatus: "FAILED"` without rolling back or deleting the feedback record. Emails can be retried at any time by admins.
4. **Zero Impact on Financial & Gaming Systems:** Complete isolation from the ETB wallet, Chapa payments, matchmaking queue, and active chess game loops.

---

## 2. Architecture & Data Flow

```
+---------------------------------------------------------------------------------------+
|                                    PLAYER JOURNEY                                     |
|                                                                                       |
|  [Header / In-Game / Nav] -> /feedback                                                |
|            |                                                                          |
|            v                                                                          |
|  [Select Category: Chess Game, Matchmaking, Tournaments, Wallet, etc.]                |
|            |                                                                          |
|            v                                                                          |
|  [Optional Context: Game ID, Match ID, Opponent (Auto-filled if from /game/[id])]     |
|            |                                                                          |
|            v                                                                          |
|  [Optional Attachments: Multi-file drag & drop, client validation (<=10MB, max 5)]    |
|            |                                                                          |
|            v                                                                          |
|  [Generate Upload URL -> Direct Upload to Convex Storage -> Receive storageIds]       |
|            |                                                                          |
|            v                                                                          |
|  [Submit Mutation -> Convex: Verify Clerk Auth -> Store Record in 'feedback' Table]   |
|            |                                                                          |
|      +-----+---------------------------------------------------------+                |
|      |                                                               |                |
|      v                                                               v                |
|  [Success Screen: "♟ Thank You, Player!"]          [Convex Scheduler: runAfter(0)]    |
|  ["Back to Chess" CTA]                                               |                |
|                                                                      v                |
|                                                   [sendConfirmationEmailAction]       |
|                                                   (Resend API / Simulated Log)        |
|                                                                      |                |
|                                                    +-----------------+                |
|                                                    |                 |                |
|                                                    v                 v                |
|                                                 SUCCESS            FAILED             |
|                                            (emailStatus=SENT) (emailStatus=FAILED)    |
+---------------------------------------------------------------------------------------+

+---------------------------------------------------------------------------------------+
|                                  ADMIN DASHBOARD FLOW                                 |
|                                                                                       |
|  [Admin navigates to /admin or /yyhnan] -> "Player Feedback" Tab                      |
|            |                                                                          |
|            v                                                                          |
|  [Realtime Convex Query: adminListFeedback & adminGetStats]                           |
|            |                                                                          |
|            v                                                                          |
|  [Filter by Status (NEW, IN_REVIEW, RESOLVED, CLOSED) / Category / Search]            |
|            |                                                                          |
|            v                                                                          |
|  [Open Feedback Detail Modal / Drawer]                                                |
|      - View player profile, verified email, user ID                                   |
|      - View game ID / match ID context with quick links                               |
|      - Secure Attachment Viewer (image previews, PDF/doc signed access)               |
|      - Update Status (NEW -> IN_REVIEW -> RESOLVED -> CLOSED)                         |
|      - Add / Update Private Internal Notes                                            |
|      - Retry Failed Confirmation Email                                                |
+---------------------------------------------------------------------------------------+
```

---

## 3. Database Schema (`convex/schema.ts` & `convex/lib/validators.ts`)

### Validators
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

### Table: `feedback`
```typescript
feedback: defineTable({
  userId: v.id("players"),
  clerkId: v.string(),
  userName: v.string(),
  userEmail: v.string(),
  userAvatarUrl: v.optional(v.string()),

  category: vFeedbackCategory,
  description: v.string(),

  // Optional Chess Context
  gameId: v.optional(v.string()),
  matchId: v.optional(v.string()),
  tournamentId: v.optional(v.string()),
  opponentUsername: v.optional(v.string()),

  // Attachments
  attachments: v.array(vFeedbackAttachment),

  // Lifecycle & Admin
  status: vFeedbackStatus,
  adminNotes: v.optional(v.string()),

  // Transactional Email State
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
  .index("by_status_and_createdAt", ["status", "createdAt"]);
```

---

## 4. Backend Functions (`convex/feedback.ts`)

1. **`generateUploadUrl`** (`mutation`):
   - Authenticates user via `requirePlayer(ctx)`.
   - Returns `ctx.storage.generateUploadUrl()`.

2. **`submit`** (`mutation`):
   - Server-side auth check: `const player = await requirePlayer(ctx)`.
   - Derives `userId`, `clerkId`, `userName`, `userEmail`, `userAvatarUrl` directly from verified player document and identity.
   - Validates category in enum, description (trim, length >= 10, <= 4000), attachment count <= 5, file sizes <= 10MB.
   - Inserts record with `status: "NEW"`, `emailStatus: "NOT_SENT"`.
   - Schedules background email: `ctx.scheduler.runAfter(0, internal.feedback.sendConfirmationEmailAction, { feedbackId })`.
   - Inserts in-app player notification.

3. **`getMyFeedback`** (`query`):
   - Server-side auth: `const player = await requirePlayer(ctx)`.
   - Queries `feedback` index `by_userId` for caller only.
   - Strips `adminNotes` before returning to guarantee privacy.

4. **`getAttachmentUrl`** (`query`):
   - Arguments: `feedbackId: v.id("feedback")`, `storageId: v.id("_storage")`.
   - Verifies caller identity:
     - If admin: allowed.
     - If owner (`feedback.userId === player._id`): allowed.
     - Otherwise: throws `Error("unauthorized-attachment")`.
   - Verifies `storageId` belongs to `feedback.attachments`.
   - Returns signed URL `ctx.storage.getUrl(storageId)`.

5. **`adminList`** (`query`):
   - Enforces `await requireAdmin(ctx)`.
   - Supports search filter, category filter, status filter, and pagination/sorting.

6. **`adminGetStats`** (`query`):
   - Enforces `await requireAdmin(ctx)`.
   - Returns count of Total, New, In Review, Resolved, and Feature Requests.

7. **`adminUpdateStatus`** (`mutation`):
   - Enforces `await requireAdmin(ctx)`.
   - Updates status, sets `resolvedAt: Date.now()` and `resolvedBy: adminPlayer.username` when marked `RESOLVED` or `CLOSED`.

8. **`adminUpdateNotes`** (`mutation`):
   - Enforces `await requireAdmin(ctx)`.
   - Updates `adminNotes`.

9. **`sendConfirmationEmailAction`** (`internalAction`):
   - Reads feedback record via internal query.
   - Calls Resend API or logs simulation if `RESEND_API_KEY` is not present.
   - On success: patches `emailStatus: "SENT"`, `emailSentAt: Date.now()`.
   - On error: patches `emailStatus: "FAILED"`, `emailError: err.message`. Never deletes feedback.

10. **`adminRetryEmail`** (`mutation` / `action`):
    - Enforces `await requireAdmin(ctx)`.
    - Reschedules `sendConfirmationEmailAction`.

---

## 5. Security & Authorization

- **Authentication Layer:**
  - Route protection in `src/proxy.ts` (Next 16 middleware) guarding `/feedback`.
  - Clerk session verification server-side in all mutations and queries via `ctx.auth.getUserIdentity()`.
- **Admin Verification:**
  - Standardized on `convex/lib/auth.ts: requireAdmin(ctx)`, matching `admin.ts`.
- **File Upload Safeguards:**
  - Client-side and server-side MIME type whitelist: `image/png`, `image/jpeg`, `image/webp`, `application/pdf`.
  - Dangerous file extensions (.exe, .bat, .cmd, .sh, .msi, etc.) strictly rejected.
  - File size cap: 10 MB per file, max 5 files.
- **Attachment Privacy:**
  - Storage URLs are never publicly guessable; generated via authenticated query with permission check.

---

## 6. Frontend Specifications

### A. Player Feedback Page (`src/app/(protected)/feedback/page.tsx` & `@/components/feedback/feedback-view.tsx`)
- **Tabs:**
  - `Share Feedback`
  - `My Feedback`
- **Header:**
  - Title: `♟ Share Your Feedback`
  - Subtitle: `"Help us make your chess experience better."`
- **Form Fields:**
  - **Category Selector Grid:** 9 categories with respective Lucide icons and category-specific helper text.
  - **Message Box:** Placeholder `"Tell us about your chess experience, a problem you encountered, or an idea that could make the platform better..."`
  - **Optional Chess Context Collapsible:** Game ID, Match ID, Tournament ID, Opponent username. Includes quick button `"Attach Current Game"` when navigated with query params.
  - **Attachment Drag-and-Drop Area:**
    - Visual drop zone: `"Drop files here or click to upload"`.
    - Allowed notice: `"PNG, JPG, WEBP or PDF — up to 10 MB each"`.
    - Selected files list with thumbnail/icon, name, formatted size, upload progress, and individual remove button.
  - **Submit Button:** Single-click guarded, loading spinner, clear error callouts.
  - **Success Screen:** Chess-themed ("♟ Thank You, Player!", message summary, "Back to Chess" link).

### B. Admin Command Center Tab (`src/components/admin/admin-feedback-tab.tsx`)
- Integrated into `src/components/admin/admin-view.tsx` as `"feedback"` tab with badge for NEW count.
- **Top Metric Cards:**
  - Total Feedback
  - New (amber highlight)
  - In Review (blue highlight)
  - Resolved (green highlight)
  - Feature Requests (purple highlight)
- **Filters & Search:**
  - Live search input (player username, email, description, game ID).
  - Status dropdown filter.
  - Category dropdown filter.
- **List View:**
  - Player avatar, username, category icon & label, preview snippet, game badge, status badge, date, email delivery badge.
- **Detail Modal / Drawer:**
  - Full player identity & contact info.
  - Chess context pills (with direct link to `/game/[id]` if present).
  - Full description formatted.
  - Attachments grid with thumbnail preview for images, and secure open/download for documents.
  - Status transition buttons (`NEW` -> `IN_REVIEW` -> `RESOLVED` -> `CLOSED`).
  - Private Admin Notes editor with auto-save / save button.
  - Email status card with "Retry Email" trigger if failed.

---

## 7. Testing & Verification Plan

1. **Unit & Integration Tests (`convex/__tests__/feedback.test.ts`):**
   - Player submits feedback with category, text, and attachments -> record created in Convex with status `NEW`.
   - Non-authenticated caller fails submission.
   - Description < 10 characters fails validation.
   - Attachment limit (> 5 files or > 10MB) fails validation.
   - Email failure marks `emailStatus: "FAILED"` without deleting feedback.
   - `getMyFeedback` returns only caller's items and omits `adminNotes`.
   - `getAttachmentUrl` permits owner and admin, rejects unauthorized players.
   - `adminUpdateStatus` and `adminUpdateNotes` enforce `requireAdmin`.
2. **End-to-End & UI Verification:**
   - Full TypeScript build (`pnpm typecheck`) with zero errors.
   - Vitest test run (`pnpm test`) passes 100%.
   - Verify layout responsiveness (mobile 375px, tablet 768px, desktop 1200px).
