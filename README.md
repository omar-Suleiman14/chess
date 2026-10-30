# Chess by Chaos ♟️

Play Sherine in your browser, explore saved games, and practise from your mistakes. Games work locally; sign in to sync them. [Open Chess](https://chess.chaos.fail) · [Guides](docs/README.md)

## Run it

You need Node.js 24, pnpm, a Chess-only Clerk app, and a Convex development deployment.

1. Run `corepack pnpm install`.
2. Copy `.env.example` to `.env.local` and fill in the browser URLs and Clerk keys.
3. Run `corepack pnpm dev`. Confirm the CLI targets your development deployment.
4. Open `http://localhost:3000`. You should see the board; Sherine's engine loads in a worker.

For Clerk issuer setup and optional MCP variables, follow [Getting started](docs/GETTING-STARTED.md). Never put secret keys in `NEXT_PUBLIC_*` variables.

## Play

1. Open the homepage and move a piece. Choose **The Climb** or **Timed** from the menu for a rated bot mode.
2. Tap **Hint** for a clue, then a highlight, then a suggested move. Confirm the unrated change if the game is rating-eligible.
3. Open **Time Machine** to inspect moves or import a PGN. **Explore from this position** creates a separate unrated game.
4. Open **Settings** for light/dark mode, board colors, game backgrounds, event sound packs and haptics.

[Gameplay](docs/GAMEPLAY.md) · [Time Machine](docs/TIME-MACHINE.md) · [Ratings and fair play](docs/RATINGS.md) · [Settings](docs/SETTINGS.md)

## Check a change

```bash
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test
corepack pnpm build
```

`corepack pnpm test:experience` builds a temporary guest QA artifact, runs browser regressions, measures interactions, and collects Lighthouse reports. The real auth middleware is restored automatically. See [testing and benchmarks](docs/BENCHMARKS.md) for scope and limitations.

## Project status

The repository contains playable games, immutable history, local persistence, optional account sync, and automated tests. New experience work belongs to the feature branch until reviewed and deployed. [Release status](docs/ROADMAP.md) distinguishes implementation, verified evidence, and remaining checks. Bot ratings are estimates; Full Power's historical 3000 label is nominal.

[Architecture](docs/ARCHITECTURE.md) · [Deployment](docs/DEPLOYMENT.md) · [Troubleshooting](docs/TROUBLESHOOTING.md) · [Advanced MCP reference](docs/MCP.md)

## Licence

GPL-3.0. Retain [LICENSE](LICENSE) and [third-party notices](THIRD_PARTY_NOTICES.md). Stockfish source links and artwork attribution are included there. Current event sounds use original synthesis; [sound rights ledger](docs/SOUND-LEDGER.md). No Chess.com accounts, scripts, or sound recordings are required.
