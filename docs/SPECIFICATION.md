# Product and behavior specification · v2.0

> Normative product decisions for Chess by Chaos. `docs/ARCHITECTURE.md`, `docs/UI_UX.md`, `docs/MCP.md` and `docs/ROADMAP.md` expand these contracts. All design examples are proposals until validated on working devices.

## 0. Product constraints

- Personal, open-source, play-to-learn chess app at `chess.chaos.fail`.
- Load the playable board first. Minimal labels; progressive disclosure. Treat mobile as a full experience.
- Stockfish **19 Lite single-threaded WASM only**, downloaded to device and run in a browser worker. No native Stockfish/VPS, no Cloudflare Worker compute, no full-weight Stockfish in this scope.
- Sherine has the fixed **nominal label 3000 Elo** in Full Power. This is NOT verified FIDE/Chess.com/CCRL Elo; never present it as factual strength.
- The app must function as chess software without an external LLM. MCP adds coaching and authoring, not game correctness.
- Clerk login; separate Convex Chess deployment. Separate customizable Chess identity based on existing Chaos Cards and Blobatar patterns.
- Existing Chaos source/component licensing must be audited before copying code. GPL repo currently exists; Chaos code is AGPL.
- Avoid Liquid Glass, verbose articles, full-screen onboarding and generic browser prompts.

## 1. Landing and active board

After opening the site: lightweight branded launch state (respect reduced motion), board and game controls appear with no forced onboarding. For signed-in users, offer Resume or start Full Power; guest/local play may be offered but saving/sync requires account. Never hide board behind heavyweight analytics or engine download. Main surface contains Sherine identity, current mode, nominal strength, board, narrow Stockfish evaluation bar, player identity and Undo action. A circular horizontal-ellipsis opens the main menu as an iOS-style bottom sheet. Game controls are touch-friendly and keyboard accessible; a tool-tip may explain evaluations on demand. Optional evaluation-bar visibility and hints avoid spoilage.

### Modes

**Full Power (default)**: unrestricted Stockfish Lite strength, with bounded selectable thinking-time preset (e.g. Fast / Standard / Deep; no pretending to be different Elo). Untimed by default. Unlimited Undo goes back a **full turn** where possible and permits a different continuation. Preserve alternate moves in local/Convex history; rating-affecting competition is not inferred from Full Power wins/losses. Hybrid mistake coaching: no interruption by default; after a clear mistake optionally offer a spoiler-free Rewind, without auto-selecting best move.

**The Climb**: staged opponents from very weak up to Sherine Full Power, including beginner behavior below Stockfish's available `UCI_Elo` minimum. Never assume setting `UCI_Elo=100` is supported; build a calibrated opponent pool with explicit versioned presets and benchmarked results. Climb has an independent **provisional** Elo-style rating based on rated results versus calibrated opponents. Undo/hints/rewinds/engine lines during the match change status to unrated, with no way to re-rate that result afterward. Build a clear progression without noisy gamification.

**Timed Chess**: a separate menu-selected mode, not a clock toggle. Match clocks use monotonic elapsed time and survive visibility changes/reconnects correctly. Support explicit presets (e.g. 3+2, 10+5, 15+10), paused/unrated local practice as an option; timeouts are adjudicated using chess rules for insufficient mating material. Timed ratings are separate by applicable time-control pool and only available for eligible unassisted results.

**Practice/Branch**: chosen FEN/position or a node from an existing game. Default unrated. Can adjust engine strength and retry freely. Never overwrite the parent recording.

## 2. Engine/evaluation

`chess.js` is the source of legal move validity, FEN, SAN and PGN. Stockfish Lite operates behind `EngineController` abstraction with one worker per active player session, lifecycle events, serialized UCI commands and generation IDs to discard stale results. Provide `uci`, `isready`, `ucinewgame`, `position fen ...`, `go movetime ...`, `stop`, `bestmove`, and parsed `info` (depth, score cp/mate, PV). Concurrency policy: gameplay move request is priority one, eval bar is bounded/secondary, deep analysis is queued and pausable. Never spawn unlimited workers on phones. Normalize scores to White-positive and mate-in-N; evaluation visual should not misleadingly jump because of stale searches. Don't extrapolate one shallow `cp` into win probability without a disclosed mapping. A UI evaluation bar is available during play, hideable for self-testing and inaccessible as live help in eligible rated games.

Start rendering the board while worker initializes. Version engine assets, serve with appropriate caching, optionally prewarm after intent; use a robust recovery state for unsupported WASM/crashes/low-memory conditions. Test first paint/worker init on iOS Safari, Android Chrome and desktop. No guaranteed benchmark numbers before hardware tests.

## 3. History, Undo, replay and Time Machine

The replay format must be **branch-capable from first persisted game**. A game has one immutable origin (initial FEN, ruleset, mode, engine-version and time settings), a sequence/tree of move nodes, and one or more named branches. A node stores parent ID, ply, UCI, SAN, resulting FEN or periodic checkpoint, side-to-move, clock snapshot (if relevant), timestamp, and optional engine metadata. Derived analyses belong in independent records keyed to position + engine/options. Treat move/event history as append-only for trust and recoverability; nodes can be reached by different branch heads. Revision/idempotency keys prevent double moves on flaky networks.

**Undo** returns to a prior decision, normally undoing both the user's move and Sherine's response. If before an engine reply, cancel that pending search safely. Replaying a new choice creates a divergent branch path. The original result remains immutable. Undo in Climb/Timed immediately marks the game unrated. Offline moves stay local and sync with conflict resolution; never silently overwrite a concurrently extended branch.

**Time Machine (later full UI)**: replay the game visually as animated piece moves (not a recorded MP4), scrub by drag, tap move list, play/pause/speed, navigate error markers and analysis, jump to any node, and choose **Continue from here**. Creates a new session with `parentGameId`, `parentNodeId`, starter FEN, selected Stockfish strength, branch label and revision. Original and child games remain independent; allow nested branching and comparison. The menu animation can reference Apple Time Machine depth/stacking, but be restrained and respect reduced motion. Share/import/export via PGN with variations where supported. MCP must be able to create an equivalent branch safely without chat chessboard UI.

## 4. Learn

Micro-lessons must be board-first, short and interactive: show one idea, ask for 1–3 moves/decisions, offer progressively stronger hints, let Sherine respond and show why another move fails; no reading-heavy walls. Three sources:
- **Fixed mini-path**: board orientation, each piece, legal captures, check/checkmate/stalemate, opening principles, tactical themes, endgame basics, named openings/defenses. Very short lessons, not an endless school.
- **Adaptive**: identify recurring user mistakes from completed games using bounded engine analysis + rules/classifiers; convert examples to playable puzzles; spaced retry and mastery tracking; do not infer skill from accuracy alone.
- **Topic/on-demand**: e.g. Queen's Gambit, Sicilian Defense, forks, pins. Curated templates can provide deterministic lesson scaffolds; ChatGPT or Claude can author validated scenarios through MCP. Persist provenance, source game if used, validation status, creator and version.

Lesson schema must describe starting FEN, permitted side, target idea, accepted move set/continuations, grading rules, hint stages, text under character budget, and completion conditions. Chess engine verifies legality; author-provided solutions do not bypass validation. Do not let arbitrary AI code execute.

## 5. Sherine personality

Sherine is character presentation over Stockfish, **never** a second source of chess moves or arbitrary engine overrides. Use user-provided sprite sheet only after confirming redistribution rights. Character on/off is optional, non-blocking, and a user's preference (not chess mechanic). Default on; a playful custom confirmation pleads 'don't, I'll be cool', with an accessible immediate disable action. If kept on, she is briefly grateful before her sarcastic behavior gradually returns. If disabled, she remains silent; re-enable triggers context-sensitive annoyed dialogue and remembers count/history. Never lock basic settings behind manipulation; allow quiet mode and full mute independently.

Persist temperament, trust/grudge signals, seen dialogue IDs, upgrade IDs, version, unlock history and safe recent events in Convex. Evolve by natural achievements/events AND explicit upgrades requested via authenticated MCP. Character upgrades may add curated dialogue/event triggers, unlockable expressions, sprite variants and outfits; never execute user-supplied JS or bypass permission. Separate game audio from Sherine chatter, add frequency/rate caps, profanity boundaries, cooldowns, and reduced motion/sound options. Voice/TTS is deferred.

## 6. Identity, profiles and progress

Use a *separate* Chess profile (username, nickname, card skin, avatar seed, palette, privacy) but reuse compatible reusable UI from Chaos (MemberCardView, CardCustomization, Blobatar, tilt/eyes, theme generator), subject to license/privacy audit. Avoid coupling Chess auth runtime to Chaos production. Chess cards may show ratings/progress and unlocks; cards should not fill the main board screen. Consent before publishing profile/game data. Provide private mode, PGN export, account/data deletion and backup.

Profile shows **multiple meaningful metrics**: Climb rating with uncertainty, Timed rating(s), Full Power trend (mistakes/game, blunders per game, repeat mistakes, puzzle retention, outcomes), and general performance estimate clearly labeled if model-based. Stockfish eval is not a person's Elo. Display 'unrated' or 'provisional' until confidence threshold; rating math/version and history must be auditable.

## 7. MCP

No interactive chessboard in ChatGPT. Expose authenticated resource/tools for read games and snapshots, progress, analysis, openings, lesson listing; write ops for `create_branch`, `create_lesson`, `queue_practice`, `propose_fatma_upgrade`, `install_fatma_upgrade` with explicit write scopes and user approval when appropriate. Inputs are strict schemas: server validates owner, FEN, source node, expected revision, engine settings, reply limits, idempotency keys, safe text and reasonable counts. Tools return canonical web deep links opening the actual board at a lesson or branch. Engine analysis performed locally when client is open; remote MCP analysis can use saved evaluation snapshots or a separately approved analysis service later—no hidden VPS dependency. Rate limit operations; don't let MCP write rated match results, ratings, or arbitrary user profile ownership.

## 8. UI boundaries

Warm neutral modern iOS-inspired design without Liquid Glass. Board-first, 8x8 responsive (keyboard/focus labels), palette selector with contrast checks, captured piece presentation optional, narrow eval bar that moves smoothly and never conceals coordinates. Natural move/capture/castling/check/checkmate sounds and subtle effects, gesture scrubbing, board flips, long-press preview, optimistic move transitions. Layout:
- Phone portrait: board scaled to safe width, Sherine identity and controls around it, bottom game action row with **Undo**; circular ellipsis reveals navigation.
- Desktop/tablet: centered large board, optional narrow contextual side panels, same design language.
- iOS-style sheet: page underneath scales/recedes, rounded corners, subtle shadow/dim, coordinated spring animation; drag to dismiss and correct safe areas. No separate permanently visible navigation on phone.
- Loading: crisp lightweight branded progress/fallback, never block board paint on engine init or other route data. Only prefetch secondaries after active board/game is interactive, on intent, visibility, connectivity and resource budget. Avoid prefetching heavy assets on cellular without signal.

## 9. Non-functional requirements

Correct legal move results before polish. Make play resilient to refresh/engine crashes and recover positions. Performance budgets (hypotheses pending device benchmark): board interaction <50ms local, input to visual move <100ms at p95, UI 60fps on common devices, route change perceived <200ms when prefetched; first-worker ready and move/search latency require empirical Safari measurements. Accessibility: reduced motion, meaningful focus/click targets, voiceover square/board descriptions, color-agnostic status, keyboard chess moves, contrast AA, captions for audio-free state. Security: authenticated Convex and OAuth MCP, no trusted browser-generated ratings, CSP, upload sanitization, input size ceilings, threat model for long game histories and prompt content.

## 10. Hard exclusions

No multiplayer/public matchmaking, commercialization, ads, paywalls, full-engine 94 MB release, native VPS/Wareed compute, Cloudflare Worker chess compute, voice v1, heavy literary courses, chessboard inside ChatGPT, fake verified Elo, background remote engine pretending to be local, or production launch without mobile smoke tests.
