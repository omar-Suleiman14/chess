# Chess by Chaos ♟️

**A personal chess gym, open source for anyone who wants to learn by playing.**

[Roadmap](docs/ROADMAP.md) · [Complete specification](docs/SPECIFICATION.md) · [Architecture](docs/ARCHITECTURE.md) · [UI/UX](docs/UI_UX.md) · [MCP design](docs/MCP.md) · [Issues](https://github.com/omar-Suleiman14/chess/issues)

> **Status: planning / not yet playable.** This repository currently contains specifications and tracked implementation tasks, not a finished chess application. Target home: `https://chess.chaos.fail` (not yet deployed).

## The idea

Open the site, see the board, and play against **Fatma**—Stockfish 19 Lite running locally in a browser Web Worker. Lose, learn, undo, replay, and try again. No chessboard in ChatGPT; ChatGPT and Claude are optional coaches through MCP.

Minimal Apple-inspired UI, not Liquid Glass. Little text, large touch targets, natural springs, mobile-first gestures, iOS-style receding background sheet, attractive board palettes, intentional sounds, and a bit of personality.

## Game modes

| Mode | Description | Ratings and Undo |
| --- | --- | --- |
| **Full Power** | Main mode: Stockfish 19 Lite, unrestricted strength, displayed as **Fatma · 3000** | Unlimited Undo; record skill/performance metrics separately |
| **The Climb** | Start very weak and face stronger calibrated opponents | Independent provisional rating; Undo makes a match unrated |
| **Timed** | Deliberately selected time-control mode, not a clock toggle | Separate time-control ratings; assistance invalidates rating |
| **Time Machine** | Replay recordings, scrub positions, create **new saved branches** | Originals remain immutable; analysis/branches are practice |

**3000 is a chosen in-app strength label, not a verified human-comparable Elo.** Stockfish's evaluation is not an Elo calculator. Ratings earned in The Climb must come from calibrated results and be shown with uncertainty where applicable.

## Learning

- **Learn Chess:** tiny, hands-on lessons from piece movement through tactics and openings.
- **Made for You:** automatically propose interactive exercises from mistakes in saved games.
- **Learn Anything:** request a Queen's Gambit, Sicilian Defense, or custom tactic lesson.
- **ChatGPT/Claude through MCP:** inspect games and progress; create validated playable lessons, analysis, game branches, and approved Fatma upgrades. MCP does **not** put the board inside a chat.

## Fatma

Fatma is the engine's optional character and rival. She's sarcastic, a little mean, and expressive—but can be silenced. When you disable her, a playful confirmation asks you to reconsider, and she remembers when you bring her back. She unlocks new reactions naturally or via carefully validated upgrade packs created through MCP. Voice is **out of scope** for the initial release.

## Tech / boundaries

| Concern | Decision |
| --- | --- |
| Web | Next.js + TypeScript + Tailwind + Motion |
| Chess legality | `chess.js` |
| Engine | **Stockfish 19 Lite single-threaded WebAssembly**; local Web Worker; no server engine |
| Backend | Convex (isolated Chess deployment) |
| Authentication | Clerk |
| Cards/avatar | Reuse/adapt Chaos Cards and Blobatar after license review; separate chess identity |
| MCP | OAuth-protected server endpoints for ChatGPT and Claude |
| Hosting | Vercel for app, custom domain `chess.chaos.fail` |
| Explicitly excluded | Wareed VPS, Cloudflare Worker compute, full 94 MB Stockfish build, voice in v1 |

## Build sequence

1. **Foundation / blockers:** license audit, iPhone Safari WASM performance spike, data model and build tooling.
2. **First playable build:** instant board, legal moves, Fatma engine, evaluation bar, Undo, persistence.
3. **Polish:** iOS navigation sheet, responsive layouts, audio/haptics, selectable board themes, Fatma character, Chaos Card/Blobatar adaptation.
4. **Progression:** calibrated Climb opponents, honest Elo estimates, separate Timed mode.
5. **Replay and education:** Time Machine branches, micro-lessons, adaptive and topic lessons.
6. **Integrations and character:** secure MCP read/write, personality evolution, upgrade packs.
7. **Release hardening:** accessibility, offline/recovery behavior, compatibility/performance checks.

The detailed dependency matrix, **blockers, scope, test requirements and exit criteria** live in [docs/ROADMAP.md](docs/ROADMAP.md). Issues are the source of execution progress.

## Development

This is a **planning-only repository for now**. App scaffolding, environment variables, commands, and deployments will be added in the first implementation issue. Do not treat an invented `npm run dev` command as working yet.

Please read [CONTRIBUTING.md](CONTRIBUTING.md) before implementing and [SECURITY.md](SECURITY.md) before reporting vulnerabilities.

## Open source and third-party licenses

Chess by Chaos is public and distributed under the repository's existing [GNU GPL v3 license](LICENSE). Stockfish / Stockfish.js are separate GPL-v3 software; when bundling engine binaries, preserve their notices and provide source for **the exact distributed build** and any modifications. `Chess by Chaos` is not an official Stockfish project.

The existing Chaos application is [AGPL-3.0-or-later](https://github.com/omar-Suleiman14/chaos/blob/main/LICENSE). Reuse of its card/avatar code requires a compatibility/attribution audit; copying AGPL-covered code without preserving its obligations is **not** approved by this specification. Third-party assets (including the supplied Fatma character sprite) require provenance and redistribution permission before committing them publicly.

**This project starts as a personal learning experiment and welcomes open-source contributions.** No paid plans, ads, or SaaS roadmap are in scope.
