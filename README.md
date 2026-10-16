# Chess by Chaos ♟️

**A personal chess gym, open source for anyone who wants to learn by playing.**

[Roadmap](docs/ROADMAP.md) · [Specification](docs/SPECIFICATION.md) · [Architecture](docs/ARCHITECTURE.md) · [UI/UX](docs/UI_UX.md) · [MCP design](docs/MCP.md) · [Benchmarks](docs/BENCHMARKS.md) · [Issues](https://github.com/omar-Suleiman14/chess/issues)

> **Status: playable, pre-release.** Every roadmap package has code and automated tests. Real-device iPhone measurements, rating calibration at scale, live ChatGPT/Claude OAuth runs and the production deployment are still open. See [what's verified](#whats-verified-and-whats-not). Target home: `https://chess.chaos.fail` (not yet deployed).

## The idea

Open the site, see the board, and play against **Sherine**: Stockfish 19 Lite running locally in a browser Web Worker. Lose, learn, undo, replay, and try again. ChatGPT and Claude are optional coaches through MCP; the board never moves into a chat.

## What's in the app

| Area | What you get |
| --- | --- |
| **Full Power** (`/`) | Boot screen with real engine-download progress, then unhandicapped Stockfish 19 Lite, shown as **Sherine · 3000**. That's a nominal label, not a measured Elo. Fast / Standard / Deep thinking time, unlimited full-turn Undo (old lines are kept as variations), ‹ › move review without undoing, resign, colour choice, eval bar, resume after reload. |
| **The Climb** (`/climb`) | 11-level ladder: four scripted beginner bots below Stockfish's weakest setting, then limited Stockfish, then Full Power. Glicko-2 provisional rating, applied exactly once per eligible game. Undo, hints or the eval bar make a game unrated, permanently. |
| **Timed** (`/timed`) | Clock presets picked before the game (3+2, 5+3, 10+5, 15+10). Monotonic clock, increments, timeout adjudication with insufficient-material draws. The server re-checks rated timeouts. One rating pool per time control. |
| **Time Machine** (`/time-machine`) | Animated replay, drag scrubber, play/pause/speed, move list, branch switching, on-device analysis with mistake markers, **Continue from here** (a new linked unrated game; the original is untouched), PGN export, and PGN import with variations. |
| **Learn** (`/learn`) | Fixed micro-path (pieces → special moves → check → mate → tactics → endgames → opening principles), curated topics (Queen's Gambit, Sicilian, Italian, Ruy Lopez, London, French, Caro-Kann, forks, pins), progressive hints, explanations of wrong moves, and spaced-repetition practice built from your own analysed mistakes. |
| **Sherine** | Pixel-art sprite, short rate-limited lines, playful disable confirmation with an immediate "Turn off", grudges when re-enabled, achievements, and validated data-only upgrade packs. She never chooses moves. |
| **Profile** (`/profile`) | Separate Chess identity card (alias, blobatar avatar, hue, theme, tilt/flip, optional public `/u/<alias>`), AI-coach permissions with audit log and revocation, JSON export, full data deletion. |
| **Settings** | Ivory / Sage / Slate / Blue boards, five open-licensed piece sets, recorded move/capture sounds and volume, iOS-style switches and sliders, haptics (Android), reduced motion. |

Offline: games live in IndexedDB first and sync through an idempotent operation queue. Guests can play and their games upload after sign-in. Concurrent edits from two devices become separate branches instead of overwriting each other.

## Development

### Search visibility and public policies

See [SEO and launch operations](docs/SEO.md) for metadata, sitemap and indexing rules, site search, public policy pages, Google/Bing verification, and the production crawl check. The public support address is `support@wareed.io`; activate the mailbox before publishing it.

Requirements: Node 22+, pnpm, a Convex project and a Clerk application (both Chess-only).

```bash
pnpm install
```

```bash
cp .env.example .env.local
```

```bash
pnpm dev
```

`pnpm dev` runs `convex dev` (pushes functions and regenerates types) together with `next dev`. Other commands:

| Command | What it does |
| --- | --- |
| `pnpm test` | Vitest: rules, engine controller, PGN/tree, Glicko-2, clock, lessons, Sherine, and Convex backend tests (ownership, idempotency, branching, rating ledger, MCP gating) |
| `pnpm lint` | ESLint (Next, TypeScript, Convex rules) |
| `pnpm typecheck` | TypeScript, whole repo |
| `pnpm build` | Typecheck, then production Next build |
| `pnpm calibrate -- --games 40 --pairs 0-10` | Bot-vs-bot Climb calibration; writes evidence to `docs/calibration/` |
| `pnpm slice-fatma <sheet.webp>` | Regenerates the Sherine sprite atlas |

Convex needs these environment variables (`npx convex env set ...`): `CLERK_JWT_ISSUER_DOMAIN` and `MCP_SERVICE_SECRET` (the same value as in `.env.local`).

### Deploying (Vercel)

1. Import the repo in Vercel and set the variables from `.env.example`, with `NEXT_PUBLIC_APP_URL=https://chess.chaos.fail`.
2. Set the build command to `npx convex deploy --cmd 'pnpm build'` with a Convex production deploy key.
3. Add the `chess.chaos.fail` domain in Vercel. Production builds send a CSP and HSTS (see `next.config.ts`).

## Connecting ChatGPT or Claude (web, desktop and mobile)

The MCP server is a **remote** Streamable HTTP endpoint at `https://<your-domain>/mcp` with OAuth through Clerk. Remote connectors work in the web, desktop and mobile apps of both ChatGPT and Claude, because the AI provider's servers make the connection, not your phone.

1. **Clerk dashboard → Configure → OAuth applications → enable "Dynamic client registration".** ChatGPT and Claude register themselves this way. It's currently off on the dev instance.
2. **Claude:** Settings → Connectors → Add custom connector → paste `https://<your-domain>/mcp`. **ChatGPT:** Settings → Apps & Connectors → Create (developer mode) → paste the same URL. Add it once on the web; it then shows up in the mobile apps on the same account.
3. In Chess by Chaos → **Profile → AI coaches**, switch on the scopes you want (`chess.read`, `chess.write`, `lessons.write`, `fatma.write`). Every tool call is denied until you do, and each call appears in the activity log, where you can revoke a client.

Tools: `get_chess_profile`, `list_games`, `get_game`, `get_game_analysis`, `get_progress`, `list_lessons`, `get_fatma_profile`, `create_branch`, `queue_practice`, `create_lesson`, `propose_fatma_upgrade`, `install_fatma_upgrade`. Write tools validate every FEN and move with chess.js, are idempotent, and return links that open the real board. MCP can never write results, ratings or ownership.

## What's verified and what's not

Verified in this repo: 57 automated tests (rules, PGN round-trips with variations, undo/branch invariants, idempotent writes, single rating application, unrated-after-undo, timeout checks, MCP scope denial, cross-user denial, stale revisions, pack/lesson validation). Also checked by hand in a desktop browser: playing against the real engine, the eval bar, the menu sheet, a keyboard-only lesson, the 375 px layout, and MCP OAuth discovery (401 with resource metadata, protected-resource and authorization-server metadata).

Not yet verified:
- iPhone Safari performance (BLK-01). Run `/bench` on a device; see [BENCHMARKS](docs/BENCHMARKS.md).
- Climb opponent strengths are **uncalibrated estimates**. A 6-games-per-pair sample is in `docs/calibration/`. A large run is needed before calling ratings calibrated.
- End-to-end OAuth with ChatGPT and with Claude: needs a public HTTPS deployment and Dynamic Client Registration enabled.
- Screen-reader passes with VoiceOver and TalkBack, and Playwright E2E/visual suites.

## Open source and licences

GPL-3.0 ([LICENSE](LICENSE)). Stockfish / Stockfish.js are GPL-3.0; the exact distributed engine files, checksums and source links are in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) and on the in-app `/licenses` page. Chess by Chaos is not an official Stockfish project. No Chaos (AGPL) source was copied.

**A personal learning experiment that welcomes contributions.** No paid plans, ads or SaaS roadmap.
