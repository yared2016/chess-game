# SDD ledger — plan: docs/superpowers/plans/2026-10-02-auth-profile-presence-discovery.md

## Pre-flight Plan Review
| Task Pair / Component | Consumed vs Produced | Scan Finding | Ruling / Action |
|---|---|---|---|
| Task 1 -> Task 2 | Schema fields (`displayName`, `phoneNumber`, `playerType`, etc.) -> `players.completeProfile` | Clean agreement | Proceed |
| Task 1 -> Task 3 | `userPresence` table -> `presence.ts` | Clean agreement | Proceed |
| Task 1 -> Task 4 | `players` & `userPresence` tables -> `discovery.ts` | Clean agreement | Proceed |
| Task 2 -> Task 7 | `completeProfile` API -> `CompleteProfileForm` UI | Clean agreement | Proceed |
| Task 3 -> Task 8 & 10 | `presence.getPresence` & format helper -> Discovery & Profile UI | Clean agreement | Proceed |
| Task 4 -> Task 8 & 9 | `discovery` queries -> Discovery UI & Search Hub | Clean agreement | Proceed |
| Task 6 -> Task 7 | Protected layout gate -> `/complete-profile` onboarding route | Clean agreement | Proceed |

## Execution Progress
- Task 1: fix round 1/5 (spec: query auto-seeding fix + register error codes in src/lib/errors.ts)
- Task 1: complete (commits e614e92..b015e08, review clean)
- Task 2: fix round 1/5 (quality: preserve custom username across ensurePlayer sessions, preserve verified status and profileCompletedAt)
- Task 2: complete (commits b015e08..c0acff8, review clean)
- Task 3: complete (commits c0acff8..54c30e8, review clean)
- Task 4: fix round 1/5 (code review: optimize presence queries, hash jitter, clamp limits, test fair-play ban)
- Task 4: complete (commits 54c30e8..8ff6982, review clean)
- Task 5: complete (commit 2ca32d6, visual branding, copy, styling)
- Task 6: complete (commit 1804a3d, edge proxy, layout gate, reverse redirect)
- Task 7: complete (commit ceaa5da, PhoneInput, CompleteProfileForm, /complete-profile route)
- Task 8: complete (commit ebb70e3, OnlineNowRail, PlayersYouMayLike, FindOpponentModal, /play integration)
- Task 9: complete (commit 63955bd, PlayerSearchHub, /players route, nav link)
- Task 10: complete (commit 4488b15, ProfileHeaderView presence, badges, direct challenge modal, PII privacy enforcement)
- Task 11: complete (72 test files, 827 tests passing, tsc --noEmit 0 errors)
