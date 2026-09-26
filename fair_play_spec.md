# Fair Play Specification — Castle Chess

## Overview

Castle Chess requires a fair play framework to ensure competitive integrity,
especially for paid/staked games. This is NOT optional for a platform handling
real money.

---

## 1. Server-Authoritative Architecture

### Already Implemented ✅
- Server validates ALL moves via chess.js replay from start position
- Client-supplied FEN is NEVER trusted (NFR-4)
- Server determines game result, not the browser
- Server controls wallet settlement and escrow

### Needs Implementation 🔲
- Server-authoritative chess clock (Phase 1)
- Move timing analysis
- Engine correlation scoring

---

## 2. Anti-Cheat Signal Categories

### Category A: Move Timing Signals
| Signal | Description | Severity |
|--------|-------------|----------|
| Constant move time | All moves take same duration (±500ms) | Medium |
| Instant critical moves | Complex tactical positions solved in <1s | High |
| No thinking on forced moves | Fast on forced, slow on complex | Low |
| Unnaturally consistent | No time variation across game phases | Medium |

### Category B: Engine Correlation Signals
| Signal | Description | Severity |
|--------|-------------|----------|
| Top-1 engine move | Matches Stockfish #1 choice | Low (individually) |
| High centipawn accuracy | Average centipawn loss < 10 over many games | High (pattern) |
| Perfect play in critical positions | Engine moves in sharp tactical positions | Medium |
| Opening book deviation → perfect play | Unusual openings followed by perfect moves | Medium |

### Category C: Account/Behavioral Signals
| Signal | Description | Severity |
|--------|-------------|----------|
| New account, high performance | < 10 games, playing at 2200+ level | Medium |
| Multiple accounts same device | Shared browser fingerprint | High |
| Tab switching pattern | Alt-tab frequency during games | Low |
| Selective engagement | Only plays for stakes, refuses casual | Low |
| Rapid rating gain | Unusual rating trajectory | Medium |

---

## 3. Detection Framework Architecture

### Phase 1: Passive Data Collection (Implement First)
```
Game completed
  → Store per-move timestamps (already have lastMoveAt)
  → Store per-move server receive timestamps
  → Store move count, game duration, time control
  → Store average move time per phase (opening/middle/endgame)
```

### Phase 2: Offline Analysis Engine
```
Scheduled job (hourly/daily)
  → For flagged games, run Stockfish analysis
  → Compute centipawn loss per move
  → Compute engine correlation percentage
  → Compute move time variance
  → Score each game 0-100 suspicion level
  → Flag games scoring > threshold for review
```

### Phase 3: Real-Time Monitoring (Future)
```
During game
  → Track move timing patterns
  → Compare to player's historical patterns
  → Alert admin on significant deviation
  → NEVER auto-sanction from real-time signals alone
```

---

## 4. Review & Sanctions Process

### Automated Review Queue
1. Game flagged by analysis engine
2. Added to admin review queue with evidence
3. Human admin reviews:
   - Game replay with engine analysis
   - Move timing chart
   - Player history and patterns
   - Account metadata
4. Admin decision:
   - **Dismiss** — insufficient evidence
   - **Warn** — soft warning to player
   - **Restrict** — temporarily restrict from paid games
   - **Ban** — permanent account suspension

### Sanction Levels
| Level | Action | Criteria |
|-------|--------|----------|
| 0 | No action | Normal play |
| 1 | Silent flag | Single suspicious game |
| 2 | Warning | Multiple flagged games |
| 3 | Paid game restriction | Strong evidence pattern |
| 4 | Temporary ban | Confirmed cheating |
| 5 | Permanent ban | Repeated/egregious cheating |

### CRITICAL RULES
- **Never auto-ban** from a single signal
- **Never auto-ban** from statistical analysis alone
- **Always require** human review for sanctions ≥ Level 3
- **Always provide** appeal mechanism
- **Paid game stakes** from confirmed cheaters are refunded to opponents
- **Store all evidence** immutably for appeals

---

## 5. Game Integrity Rules

### Disconnect Handling
- Player disconnects: clock continues running
- Reconnection allowed: game state preserved
- Abandon timeout: configurable per time control
- No automatic forfeit without sufficient disconnect time

### Stalling Prevention
- Maximum time per move (for correspondence): configurable
- Repeated draw offer spam: auto-reject after 3 declined
- Clock is server-authoritative: cannot be manipulated client-side

### Duplicate Session Prevention
- One active game per player (findActiveGame check)
- One queue entry per player (by_playerId unique)
- Server rejects moves from wrong session

### First-Move Abort
- If neither player moves within the configured time, game is aborted
- Aborted games: no rating change, escrow refunded
- NOT counted as win/loss

---

## 6. Financial Fair Play

### Match Escrow Integrity
- Escrow locked BEFORE game starts
- Settlement happens atomically with game finalization
- `escrowSettled` flag prevents double settlement
- Idempotency keys on all ledger entries

### Anti-Manipulation Rules
- Cannot play yourself (queue prevents self-match)
- Cannot bet on games you're playing in (predictions separate)
- Withdrawal cooldown after large wins (future)
- Suspicious transaction detection (future)
- Rate limiting on financial operations

---

## 7. Implementation Priority

| Priority | Feature | Phase |
|----------|---------|-------|
| P0 | Server-authoritative clock | Phase 1 |
| P0 | Per-move timing storage | Phase 1 |
| P1 | Move timing analysis job | Phase 12 |
| P1 | Admin review queue UI | Phase 11 |
| P2 | Stockfish analysis pipeline | Phase 12 |
| P2 | Engine correlation scoring | Phase 12 |
| P3 | Real-time monitoring | Future |
| P3 | Behavioral analysis | Future |

---

## 8. Data Privacy

- Move timing data: stored per-game, retained indefinitely
- Account signals: stored securely, admin-only access
- Browser fingerprints: NOT stored (privacy concern)
- Analysis results: stored in admin-only audit tables
- Appeals: full evidence provided to player on request
- Student verification documents (university system): encrypted at rest, deleted after verification
