# UI contracts

The board remains the visual focus. All designs share the same routes, game state, and actions.

## Classic

One design. Graphite ink on warm paper (`--bg`), white surfaces, and a brass accent (`--brand`, `--switch-on`) reserved for "on" and "here": switches, the active tab, selected states. Light, Dark and System are the only appearance choices. Tokens live in `lib/experience/theme.ts`; a validated first-paint cache avoids flashes. Retired Material / Liquid Glass values stay readable in stored settings and always resolve to Classic.

## Phone navigation

Top-level pages show five bottom tabs (Play / Bots / Learn / Review / More) above the safe area; More opens the menu sheet. Deeper pages (an online room, a lesson, a reviewed game) are full screen. A game hides the tabs once it has moves (`useGameFocus`), and its footer becomes the toolbar: Options, Undo, review arrows. Both bars take the same space, so the board never changes size when they swap. Tabs cross-fade instead of sliding and remember their last page.

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
