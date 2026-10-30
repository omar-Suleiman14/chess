# UI contracts

The board remains the visual focus. All designs share the same routes, game state, and actions.

## Classic

One design. Graphite ink on warm paper (`--bg`), white surfaces, and a brass accent (`--brand`, `--switch-on`) reserved for "on" and "here": switches, the active tab, selected states. Light, Dark and System are the only appearance choices. Tokens live in `lib/experience/theme.ts`; a validated first-paint cache avoids flashes. Retired Material / Liquid Glass values stay readable in stored settings and always resolve to Classic.

## Navigation (mobile first, chess.com style)

One list of destinations (`components/shell/navigation.ts`) drives every surface, so they never disagree:

- **Phones:** five bottom tabs (Play / Bots / Learn / Review / More). **More** is a page (`/more`) listing everything else with the account card; there is no drawer. Tabs remember their last page and cross-fade.
- **Game screens** (Play, a Climb or Timed game) are full screen: the move list on top, an edge-to-edge board, and a bar pinned to the bottom edge (Options · Hint · Back · Forward). Options holds Undo, Friends, eval bar, live background, flip, mute, resign, board theme and "Go to".
- **Desktop:** a left sidebar with the same destinations (icons with small labels on laptops, full labels from 1280 px), plus Settings, More and the account. Pages offset by `--sidebar-w`; the game board size accounts for it.
- Back buttons appear only on deeper pages (a lesson, a reviewed game, a theme page).

## Haptics

UI code emits semantic events (`select`, `move`, `capture`, `check`, `illegal`, `success`…) to `lib/client/haptics.ts`; nothing calls `navigator.vibrate` directly. Your own moves are felt on the board at the tap, before the engine or server answers. Opponent moves, premove execution and results are felt once per committed event (keyed). Selection ticks are throttled so scrubbing never buzzes continuously.

## Board and input

The board is square, left-to-right, and height-aware. Each of eight semantic grid rows contains eight cells with named squares. Keyboard focus, legal targets, check, last move, and premoves have visible states. Coordinates are decorative because each cell already names its square.

Player rows follow their board colors when flipped. The horizontal evaluation uses White's perspective. Human games never expose live engine help. Missing evidence stays unavailable.

## Hints and review

Hints reveal one short sentence at each of Clue, Highlight, and Show move. They never play a move. Eligible-game consent is explicit and irreversible. Stale hints disappear after position changes.

Time Machine uses manual navigation and a White/Black move table before optional insights. Selecting a move never changes a saved game. Analysis can be stopped. Branch changes retain the shared position. A continuation requires confirmation and creates a new unrated game.

## Dialogs and motion

Results have one applicable primary action, a review action when available, and a quiet dismissal. Opening focuses the title; Enter does not automatically request a rematch. Escape closes safely and focus returns. Safe-area padding and scrolling keep actions reachable.

Short transforms and opacity communicate interactions. Reduced motion removes movement. Touch controls target at least 44 CSS pixels. Animated backgrounds are decorative, pointer-transparent, and limited to the game scene. Sound is controlled independently from motion.

## Verification

Use actual screenshots and interactions in light/dark, languages, small phones, desktop, zoom, and reduced motion. Browser automation does not replace VoiceOver, TalkBack, tactile device tests, or usability sessions. See [release status](ROADMAP.md).

## Launch screen and offline

A CSS-only launch screen (`components/shell/LaunchSplash.tsx`) plays once per launch (~1.4 s) in the app icon's look: the dark tile's eight light squares land one by one, then the name. It is pointer-transparent, skipped on later pages via `sessionStorage`, and shortened under reduced motion.

The offline service worker (`lib/offline/serviceWorker.ts`, served at `/sw.js`) precaches signed-out page shells, every public file and the scripts those pages reference. Navigation is network-first with the cached shell as the fallback; API, MCP, auth, RSC data and other origins are never cached. `scripts/verify-offline.mjs` proves an Airplane Mode cold start, an engine reply, a reload and route navigation.
