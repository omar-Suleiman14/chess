# Navigation, caching, and indexes

## Navigation and invalidation

Internal links use `PrefetchLink`, which asks Next.js to prefetch full routes when links enter the viewport, before the user taps them. Full prefetch also works for dynamic routes. Closed menu links explicitly disable prefetch; opening the menu enables prefetch for its visible destinations. Next.js schedules the requests rather than fetching every offscreen lesson. Prefetch is skipped on Save-Data and 2G connections. Next.js manages the prefetched route’s lifetime and invalidation.

Link navigation and programmatic card/back navigation feed a shared pending state. If a transition takes longer than 150ms, the existing content dims and a small, fast spinner appears with no visible text. Already-ready routes avoid the flash. Accessible loading text is screen-reader-only. The overlay does not trap pointer input; users can navigate elsewhere while a request is slow, and cancelled/unmounted links release their pending state.

The segmented eight-bar spinner has a 24px glyph on a 36px solid circle, with a 360ms animation cycle and no visible text or artificial minimum display time. Refresh icons were removed from every page header at the owner’s request. Programmatic `router.refresh()` still invalidates and requests the current server route payload while preserving client state and uses the same pending feedback. Search submits through the client router with an HTML GET fallback. Refresh does not erase local games or useful versioned engine analyses.

Public pages and curated lessons are pre-rendered. The global Clerk provider no longer forces every page to read request-time auth state on the server; client authentication and Convex subscriptions still initialize normally. Personal routes explicitly retain dynamic rendering and private/no-store responses. Public HTML contains no server-rendered account data. The startup spinner leaves as soon as the engine is ready, with a 100ms fade and no extra 250ms settling pause; the board remains interactive while it loads. Page entrance motion takes 180ms.

Page entrances commit navigation history in an effect, so prefetch and render retries do not mutate it. Card view transitions respect the app’s reduced-motion setting as well as system preferences, fall back if unsupported, and release their active state on completion. React does not await the browser’s entire view-transition animation, avoiding a circular wait between route commit and animation completion. No blanket loading boundary was added around unknown public routes: their real HTTP 404 responses remain intact.

## Browser caches

- Versioned Stockfish JS/WASM: one-year immutable HTTP cache. Engine version changes use a new path.
- Chess pieces and cleared legacy sound assets: one-day browser cache, stale-while-revalidate for up to one week. Current event sounds are generated PCM buffers, not network recordings. Up to 128 decoded buffers are kept in memory.
- Sherine assets: the existing one-week HTTP cache.
- Next.js build assets: framework-managed hashed immutable files.
- HTML and RSC containing request/session state: private, no-store; never shared through a CDN or service-worker cache.
- Sitemap, robots, manifest, and share image: Next.js generated routes, refreshed with the deployment; sitemap and robots are allowed to revalidate rather than being given an immutable browser lifetime.

The app does not install a service worker or promise a fully offline page reload. Existing local games and engine calculations remain device-local; initial files and account/online features require the network.

Theme preferences use versioned local storage. A validated cache stores light/dark theme tokens for the first paint; the settings provider remains authoritative. Local Web Vitals retain at most 120 observations and never block game storage.

## IndexedDB

Database `chess-by-chaos`, version 2, retains all version-1 stores and adds `analyses` with a `byUpdated` index. Existing games, sync operations, and current-game selection are preserved during upgrade. Connections close for newer upgrades; blocked/denied storage reads fail softly, and a blocked old tab cannot hold engine-cache lookup forever.

- Recent games: descending `games.byUpdated` cursor stops at the requested limit, capped at 500. It no longer loads the entire game archive.
- Pending sync count: `count()` returns the count without loading operation payloads. Replay still reads the ordered durable queue; pending writes are never TTL-evicted.
- Engine analysis: at most 128 completed positions, keyed by exact full FEN, engine build, and analysis settings. Cached results are reused by the evaluation bar and Time Machine. Incompatible engine/settings/position keys are misses. Incomplete results are not cached; oldest writes are evicted as the cache fills.
- Card snapshots: five-minute TTL, at most 64 entries in `kv`, isolated by query arguments and viewer identity. Expired entries are removed when read; oldest snapshots are evicted as the cache fills.
- Local data deletion clears games, pending operations, selection, card snapshots and cached analyses in one transaction.

## Convex caching and database indexes

Convex already automatically caches query results and invalidates them when dependencies change. The persistent root `ConvexReactClient` shares identical active subscriptions. The social screens additionally use `convex-helpers` subscription caching: up to 32 idle queries stay live for 60 seconds after unmount, allowing quick returns to Players, Friends, and `/u/[alias]` without throwing away ready data. This trades a small, bounded amount of extra live-subscription traffic for faster navigation; it is not a disk or HTTP cache. Server authorization and reactive invalidation still apply.

Opening the menu warms public player cards and, when authenticated, friends’ cards and overview. The shared session-time argument lets Friends and the invite banner reuse the same overview subscription rather than issuing separate queries for different mount-time timestamps. Active card stacks and visible friend rows warm both the authorized card-details query and friendship relation. All three screens use the same segmented spinner while a first fetch is needed. Player directories, friends cards, and authorized `/u/[alias]` cards also have IndexedDB snapshots. Snapshots expire after five minutes and are capped at 64 entries. Public discovery uses a public scope; profile details and friends cards use a guest or signed-in user scope. Account switches and sign-out clear the previous account snapshots. Live results always override snapshots, including null results that revoke or remove a card; friendship permissions remain live-only. Cached cards are display data, never authorization.

The code audit checked the existing index paths for games, nodes, analyses, ratings, lessons, practice, cards, friendships, and online rooms. Reads use owner/game/room indexes and bounded takes or pagination; no new indexes or schema deployment were needed for these changes. Small bounded reductions for summaries remain intentional. The configured deployment’s insights reported “No issues found” over the prior 72 hours on 16 October 2026; that is a health snapshot, not a guarantee about future scale or a production load benchmark.

Examples of the existing paths:

- Recent account games: `games.by_owner_and_updatedAt`.
- Game positions: `gameNodes.by_gameId_and_nodeKey` / `by_gameId_and_ply`.
- Saved analyses: `engineAnalyses.by_gameId_and_nodeKey`.
- Ratings: `ratingProfiles.by_owner_and_pool`.
- Practice: `practiceItems.by_owner_and_dueAt`.
- Cards: `chessProfiles.by_owner`, `by_alias`, and `by_visibility`.
- Friendships and room events: requester/addressee/status and room/ply indexes.

## Checks

`npm test` covers the v1→v2 upgrade, storage denial/recovery, blocked upgrades, bounded recent-game reads, count-only queue access, cache key isolation/eviction/deletion, and reduced-motion/view-transition fallbacks. Existing backend tests exercise authenticated data access and game writes.

After building and starting the production server, `node scripts/check-seo.mjs http://localhost:3100` checks sitemap pages, indexing exclusions, private cache headers, static cache policies, ETags/304s, search, assets, and 404s. Browser checks verify hover-prefetch without navigation, a fast client transition using the prefetched result, and a delayed refresh with dimming/spinner followed by normal opacity and no remaining busy state.

References: [Next.js prefetching](https://nextjs.org/docs/app/guides/prefetching), [useLinkStatus](https://nextjs.org/docs/app/api-reference/functions/use-link-status), [router.refresh](https://nextjs.org/docs/app/api-reference/functions/use-router), [Convex queries and automatic caching](https://docs.convex.dev/functions/query-functions), [Convex realtime invalidation](https://docs.convex.dev/realtime).
