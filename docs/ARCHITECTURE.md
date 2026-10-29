# Architecture

Chess runs in the browser. Convex validates saved operations, ownership, and rated outcomes. Clerk authenticates account access. The engine never runs on the application server.

## Code map

| Area | Source |
| --- | --- |
| Routes and app shell | `app/`, `components/shell/`, `components/navigation/` |
| Legal chess, FEN, SAN | `lib/chess/rules.ts` and chess.js |
| Live game controller | `lib/client/useChessGame.ts`, `components/chess/GameScreen.tsx` |
| Worker scheduling and UCI | `lib/chess/engine/controller.ts`, `uci.ts`, `lib/client/engine.ts` |
| Branches, PGN, position explorer | `lib/chess/history/`, `app/time-machine/` |
| Hints and move evidence | `lib/chess/hints.ts`, `review.ts`, `components/chess/HintPanel.tsx` |
| Preferences, themes, generated audio | `lib/client/settings.tsx`, `lib/experience/` |
| Local saves and queued operations | `lib/client/store.ts`, `sync.tsx` |
| Server operations and schemas | `convex/`, `convex/model/` |
| Ratings and ledger | `lib/chess/ratings/glicko2.ts`, `convex/model/ratings.ts` |
| Character and lessons | `lib/chess/personality/`, `lib/chess/lessons/` |
| Existing optional MCP integration | `app/mcp/`, `lib/mcp/`, [MCP reference](MCP.md) |

## Move flow

1. The board resolves input to UCI. chess.js rejects illegal moves.
2. `useChessGame` appends an immutable node, updates local state, and saves to IndexedDB.
3. The durable sync queue sends an idempotent operation to Convex when authenticated.
4. Convex checks ownership, revision, parent position, rules, and clock evidence before committing.
5. Divergent device edits become branches. No device silently replaces another device's history.

Human rooms use server-authoritative moves and seat tokens. The browser may display an optimistic position; sounds wait for acknowledgement. Tokens are never returned by room queries.

## Engine lifecycle

One Stockfish 19 Lite worker handles serialized UCI requests. Gameplay has priority over evaluation, which has priority over review. Cancellation and position keys discard stale work. Scores are White-positive; missing results remain unavailable. Visibility handling releases idle engine work and restarts lazily. No full-weight native Stockfish or server chess compute is required.

Hints use depth-10-or-better current-position evidence and revalidate the UCI move with chess.js. Stage one can fall back to a generic clue; later stages never fabricate a move. `review.ts` owns the stronger evidence requirements for Great and Brilliant classifications.

## Saved data

`games` stores mode, versioned opponent, eligibility, origin FEN, branch pointer, and result. `gameNodes` are immutable move nodes. `gameBranches` store line heads. Analysis records retain engine/options/depth provenance. Imported PGN names and variation heads are preserved.

`ratingProfiles` stores each owner's pool rating, RD, volatility, count, and algorithm version. `ratingLedger` records before/after values once per game. Optional new fields keep old documents readable.

## Invariants

- The authenticated owner comes from Clerk, never a request argument.
- A rated result comes from validated chess or a supported resignation/timeout claim, never a client-supplied score.
- Assistance only removes eligibility. A synced signed-in game acknowledges the change before revealing hints.
- Ratings, the ledger, and game finalization commit transactionally. Reconnects and duplicate reports cannot apply a second result.
- Original games stay unchanged when review creates a continuation.
- Theme, background, and sound are independent preferences over shared game logic.
- Dense text, chess squares, and pieces remain crisp. Ambient rendering stays in the game scene.
- Current sounds and glyphs are original. External artwork and engine distributions retain their notices.

For cache behavior, see [Caching](CACHING.md). For production target checks, see [Deployment](DEPLOYMENT.md).
