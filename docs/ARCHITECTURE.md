# Technical architecture, data, and engine contract

> Applies to Stockfish **19 Lite single-threaded** on device only. No Wareed/VPS chess compute. Specification: [SPECIFICATION.md](SPECIFICATION.md).

## Component graph

```text
Phone / desktop browser
  ├─ Next.js App Router + React + chessboard components
  │    ├─ chess.js authoritative local rule/state machine
  │    ├─ game controller: mode/rated state, Undo, clocks, branch pointer
  │    ├─ Web Worker EngineController (Stockfish 19 Lite UCI)
  │    ├─ evaluation scheduler (lower priority than move requests)
  │    ├─ Sherine character event/state renderer
  │    └─ IndexedDB local saves + engine/asset Cache Storage
  ├─ Clerk authentication
  └─ Convex authenticated queries/mutations (separate Chess deployment)
       ├─ games + immutable move tree + branch/session metadata
       ├─ engine analysis snapshots + derived stats
       ├─ ratings and eligible result ledger
       ├─ lessons, attempts, practice queue
       ├─ chess profiles, card themes, avatar seed
       └─ Sherine personality/upgrade state + audit log

Secure HTTP MCP endpoint (on app deployment)
  ├─ OAuth discovery, scopes, owner-level auth, audit and rate limits
  ├─ game/progress/lesson read tools
  ├─ branch/lesson/practice/upgrade write tools
  └─ Convex validation/service functions (never modifies ratings directly)
```

## Recommended code topology

```text
app/                         # Next.js routes / game / learn / history / profile / mcp
components/chess/            # Board, squares, clocks, eval bar, move list
components/fatma/            # Sprite and speech bubbles
components/shell/            # iOS sheet, progress, navigation
lib/chess/rules/             # chess.js adapters and position validation
lib/chess/engine/            # UCI worker lifecycle, parser and scheduler
lib/chess/game/              # Reducer/game mode/rating eligibility
lib/chess/history/           # Branch tree/replay/PGN conversion
lib/chess/lessons/           # Lesson schema, validators, graders
lib/chess/personality/       # Event->dialogue packs, cooldown, unlocks
lib/mcp/                    # Tool catalog and auth resource
convex/                      # Chess-only schema/functions/indexes
public/engine/               # Vendored exact GPL Stockfish lite files + notices
public/sounds/               # sound pack or Web Audio fallback
public/fatma/                # rights-cleared art and metadata
tests/                       # unit + integration + Playwright + benchmarks
```

This is a suggested layout, not a requirement for an absent codebase.

## EngineController design

```ts
type ThinkPreset = "fast" | "standard" | "deep";
type SearchKind = "move" | "eval" | "review";
type EngineState = "idle" | "loading" | "ready" | "thinking" | "stopped" | "error";
type EngineRequest = {
  id: string; sequence: number; kind: SearchKind; fen: string;
  moves?: string[]; movetimeMs?: number; depth?: number;
  multiPv?: number; strengthPreset?: string; abortId: string;
};
type EngineResult = {
  requestId: string; engineVersion: string; bestmove?: string;
  depth?: number; scoreWhiteCp?: number; mateWhiteIn?: number;
  pvUci?: string[]; elapsedMs: number;
};
```

- Pinned version and checksum for `stockfish-19-lite-single.{js,wasm}`.
- Worker starts after board shell paint; no main-thread WASM.
- Handshake UCI -> `uciok` -> `isready` -> `readyok`, then position/search.
- Search requests serialized; move generation preempts eval/review via `stop`; cancellation/versioned sequence discards late `bestmove`.
- Validate `bestmove` against current legal moves; if mismatched request id/FEN, discard and recover.
- Keep one active worker on mobile; terminate on prolonged background/low-memory and restore from saved FEN.
- Tune `movetime` for responsiveness without misrepresenting chosen strength. In Full Power never set a weakening `Skill Level`/UCI_Elo.
- MultiPV if enabled should be limited and deferred. Use a bounded hash, throttle eval redraw and prevent analysis loops.
- Cache UCI analysis by `sha256(engine version + FEN + UCI options + movetime/depth + candidate PV)`, with depth/quality metadata. An evaluation from weak settings must not be used for full-strength move selection. Snapshot invalidates on engine upgrade or policy revision. Repeated same FEN under a different move clock may be a different decision.
- Favor Cache Storage for hashed/versioned engine assets; IndexedDB for unsynced games, not localStorage large PGNs. Gracefully handle Safari eviction/storage denial.
- Engine code must remain GPL compliant with exact build source provenance, notices, and LICENSE exposure.

## Core storage model (Convex)

Every table includes `ownerClerkSubject` or a trustworthy derived `userId`, ownership indexed, `createdAt`/`updatedAt` where relevant, and validated mutation boundaries. Do not trust client-supplied userId.

| Table | Minimum fields and indexes |
| --- | --- |
| `chessProfiles` | userId, alias, avatarSeed, cardTheme, boardPalette, publicVisibility; byUser |
| `games` | userId, originFen, mode, modeVersion, engineBuild, enginePreset, color, startedAt, endedAt, result, ratedEligibility, activeBranchId, gameRevision; byUserDate/byStatus |
| `gameNodes` | userId, gameId, nodeId, parentNodeId, ply, uci, san, resultingFen, createdAt, clockAfter, originSource; byGameParent/byGamePly |
| `gameBranches` | userId, gameId, parentNodeId, headNodeId, label, forkedFromBranchId, kind, version; byGame |
| `gameSessions` | userId, parentGameId?, parentNodeId?, originFen, currentHeadId, mode, ratingEligibility, gameRevision; byParent/byUser |
| `engineAnalyses` | ownerId, nodeId?, normalizedPositionKey, engineBuild, settingsHash, score, PV, depth, computeMs, updatedAt; byPositionKey |
| `ratingLedgers` | userId, modePool, gameId, before, after, expected, opponentProfileVersion, algorithmVersion, confidence, timestamp; byUserPool |
| `ratingProfiles` | userId, modePool, mu, phi/uncertainty, gamesCount, provisional, algorithmVersion; byUserPool |
| `opponents` | versioned presetId, levelLabel, engineConfig / beginner policy, ratingEstimate+uncertainty, benchmarkEvidence |
| `lessons` | userId, title, topic, sourceType, sourceGameId?, startFen, sideToMove, contentVersion, validationStatus, visibility; byUserTopic |
| `lessonSteps` | lessonId, order, prompt, goal, acceptedMoves/lines, hints, gradingSpec, maxAttempts |
| `lessonAttempts` | userId, lessonId, stepId, triedMoves, hintsUsed, completed, timestamps; byUserDue |
| `fatmaStates` | userId, enabled, mood, disableCount, reenableCount, unlockedIds, recentEventHistory, packVersions; byUser |
| `fatmaPacks` | packId, ownerId, version, source, safeTriggers, dialogue variants, animationRefs, validationStatus; byOwner |
| `fatmaEvents` | userId, eventType, contextHash, consumed?, emittedLineId?, timestamp; byUserDate |
| `mcpAudits` | userId, actor/app, tool, scope, requestId, mutationId?, approvalType, outcome, timestamp; byUser |

### Invariants

1. Chess legality is checked server-side on any persisted user-supplied sequence (even if frontend validates it).
2. `gameNodes` are immutable; new moves append, or reuse an exactly equal existing node under the same parent via idempotent key. A branch HEAD moves through checked transaction.
3. `ratedEligibility` starts `eligible` and can only transition to `ineligible`, with immutable reason(s); never toggles back after assistance.
4. Exactly one rating-ledger entry per eligible completed game/mode/algorithm revision; applying same result twice cannot double-change rating.
5. Branch sessions are always unrated by default and preserve `parentGameId` and `parentNodeId`, so history is traversable.
6. LLM and MCP tools cannot set authoritative game results, Elo, `ownerId`, or server timestamps.
7. Version or migration field on all persistent interpretation-critical formats. No silent data loss on engine upgrade.
8. Offline branch conflicts: keep both branches or explicit UI resolution; never truncate or silently last-write-wins.

### Example: atomic append move

```ts
appendMove({
  gameId, expectedRevision, parentNodeId, uci, clientOperationId
}) -> {
  nodeId, newRevision, headNodeId, ratedEligibility, createdBranchId?
}
```

The backend obtains current game state, checks owner and revision, reconstructs chess state (FEN/checkpoints), verifies UCI legal, and atomically appends node/updates branch. Duplicate operation id returns prior result; mismatched revision returns explicit conflict and sync instructions.

## Rating math and limits

Use a published rating algorithm implementation (Glicko-2 preferred for uncertainty) for *rated* Climb opponents and Timed pools. User `mu` starts provisional with high `phi`; only verified outcomes against opponent pools calibrated under the same system are eligible. Engine `UCI_Elo` values should NOT be assumed to be FIDE Elo; weakest opponents use deterministic beginner behavior with competency caps. Simpler beginner levels are not necessarily monotonic across every position; measure actual win rates and adjust.

Full Power `3000` is a **nominal display label**, not a Glicko opponent rating without benchmarking. Maintain non-rating metrics independently (moves played, loss rate, eval loss/error distribution, blunder trends, lesson retention). Any "estimated overall Elo" derived from engine features must prominently be marked estimate with model methodology; don't pretend to calibrate from one loss.

## Security, reliability, and operations

- Clerk verified on every Convex user route; separate Chess deployment keys from Chaos/Wareed.
- MCP tokens validated for audience, issuer, scopes and user ownership; CSRF/PKCE handled by compliant OAuth flow. No leaking Clerk token to browser logs.
- No arbitrary raw FEN->blind execute; validate SAN/UCI/PGN lengths, count, side to move and king legality; cap depth and request sizes.
- Character text data validated and sanitized; do not execute dynamic code, HTML, scripts, remote sprite URLs in upgrades.
- Sync offline actions with durable operation IDs, acknowledge commits before clearing IndexedDB.
- Capture anonymous/opt-in metrics: first board paint, engine first ready, mobile worker crash count, input response, animation dropped frames, install/offline hit rates.
- Scale threshold: as a personal client-compute app, server costs should be driven primarily by Convex persistence/MCP reads, not engine compute.
