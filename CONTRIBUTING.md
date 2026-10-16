# Contributing to Chess by Chaos

Thanks for considering contributions. This is a small open-source *personal chess learning* project. It is **playable and pre-release**. Please check [ROADMAP](docs/ROADMAP.md) and existing [issues](https://github.com/omar-Suleiman14/chess/issues) before starting work.

## Start here

1. Pick an issue whose prerequisites are satisfied and comment with your approach.
2. Read [SPECIFICATION](docs/SPECIFICATION.md) and its architecture/UI/MCP companion docs. Decisions there are deliberate; propose changes before replacing them.
3. Make a focused branch and pull request tied to one issue/work package (rather than merging multiple unrelated features).
4. Include tested behavior and screenshots/screen recordings for layout and animation changes.
5. Explain any changes to data schemas, game rating integrity, licenses, performance or engine build.

## Core constraints

- Chess legality is never determined by an LLM or by UI animations.
- Stockfish Lite single-threaded in a local Worker only; no full engine, no hosted Stockfish on Wareed.
- A maximum Fatma label of 3000 means in-app nominal strength; do not describe it as official rating.
- Undo/branching must not corrupt original games, and assisted rated games stay unrated.
- Respect low-text, board-first, Apple-inspired design; no Liquid Glass and no generic browser alert/confirm.
- OAuth MCP tool writes must be authenticated, authorized, auditable and safe.
- Never commit secrets, user's private game data, private asset licenses, or unapproved Fatma sprites.

## Licensing

The repository has an existing GPL-3.0 [LICENSE](LICENSE). Contributions are accepted under that license unless a documented exception applies. Third-party libraries/assets retain their own licenses and require notices. Stockfish/Stockfish.js are GPL v3; ensure matching build source is offered with bundled assets.

Chaos source is AGPL-3.0-or-later. Do not blindly copy its components into this repository; maintain attribution and handle AGPL/GPL obligations after an explicit compatibility review. The avatar library may have additional upstream license terms. Record every new dependency or asset in `THIRD_PARTY_NOTICES.md`.

## Review checklist

- [ ] Implements issue acceptance criteria or documents deliberate exceptions
- [ ] Includes relevant unit/integration/e2e tests
- [ ] Handles mobile touch, keyboard, VoiceOver and reduced motion
- [ ] No invented analytics, accuracy, Elo numbers or fake server responses
- [ ] Network/offline/worker failure mode is recoverable
- [ ] Contains adequate documentation and third-party attributions

Run `pnpm test`, `pnpm lint` and `pnpm typecheck` before opening a PR. Setup commands are in the README; the environment template is `.env.example`.
