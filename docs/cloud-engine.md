# Cloud engine

Stockfish can run on a server instead of the player's phone, which keeps phones cool and saves battery. It is the same Stockfish 19 Lite build the browser uses, so bot strength and cached analysis are identical either way.

- **Off by default.** Until `NEXT_PUBLIC_ENGINE_URL` is set, everything runs on the device, exactly as before.
- **Automatic fallback.** If the cloud is offline, busy or over its allowance, the phone takes over for that request (Settings → Engine → Auto). A game never gets stuck.
- **Players choose.** Settings → Engine offers *Auto* (default), *Cloud only* (analysis needs internet; bots still play offline) and *This device*.

## How it works

| Piece | File |
| --- | --- |
| Wire format and limits (max 4s per search, 3 lines, bot strength options only) | `lib/engine/protocol.ts` |
| Server: Stockfish child processes, result cache, shared searches, per-visitor and daily limits | `lib/engine/service.ts` |
| Next.js route `POST /api/engine` (needs `ENGINE_SERVER=on`) | `app/api/engine/route.ts` |
| Standalone server for a VM or VPS | `engine-server/main.ts`, `engine-server/Dockerfile` |
| Browser: cloud client, hybrid cloud/device engine, mode setting | `lib/client/cloudEngine.ts`, `lib/client/engine.ts`, `lib/client/engineMode.ts` |

Every move the server suggests is checked against the rules in the browser before it is played.

## Option A: a VM or VPS (recommended)

An Oracle Cloud Always Free VM, or spare room on an existing VPS. Each engine uses one CPU core while thinking.

```bash
npm ci
```

```bash
npm run build:engine-server
```

```bash
docker build -f engine-server/Dockerfile -t cbc-engine .
```

```bash
docker run -d --restart unless-stopped -p 8080:8080 -e ENGINE_POOL_SIZE=2 -e ENGINE_ALLOWED_ORIGINS=https://chess.chaos.fail --cpus 2 --memory 1g --name cbc-engine cbc-engine
```

Put it behind HTTPS (Caddy, nginx or a Cloudflare Tunnel), for example at `https://engine.chaos.fail`. If the proxy is the only thing that can reach port 8080, also pass `-e ENGINE_TRUST_PROXY=1` so limits apply per real visitor. Then set this in Vercel (Production) and redeploy:

```
NEXT_PUBLIC_ENGINE_URL=https://engine.chaos.fail/api/engine
```

`GET /health` answers `{"ok":true}`. On a shared VPS, keep `--cpus` low so chess never slows other services.

## Option B: Vercel (this deployment)

Set both, then redeploy:

```
ENGINE_SERVER=on
NEXT_PUBLIC_ENGINE_URL=/api/engine
ENGINE_DAILY_SECONDS=200
```

**Read this first.** Vercel Hobby includes 4 hours of active CPU a month for the whole project, and going over can pause the entire site until usage falls back under the limit. One game with the eval bar, move feedback and a strong bot uses roughly 3 to 5 minutes of engine time, so the free allowance covers only a couple of games a day. `ENGINE_DAILY_SECONDS` stops the cloud engine once it has used that much in a UTC day (players then fall back to their device). The counter lives in each server instance's memory, so treat it as a soft limit and watch usage in the Vercel dashboard.

## Settings

| Variable | Default | Meaning |
| --- | --- | --- |
| `ENGINE_POOL_SIZE` | 1 | Engines running side by side |
| `ENGINE_HASH_MB` | 32 | Hash per engine |
| `ENGINE_VISITOR_SECONDS` | 300 | Engine seconds one visitor may use per 10 minutes |
| `ENGINE_DAILY_SECONDS` | 0 (no limit) | Engine seconds per UTC day for everyone |
| `ENGINE_MAX_QUEUE` | 24 | Waiting searches per engine before answering "busy" |
| `ENGINE_ALLOWED_ORIGINS` | `https://chess.chaos.fail` | Sites allowed to call the standalone server |
| `ENGINE_TRUST_PROXY` | off | Use `X-Forwarded-For` for per-visitor limits |
