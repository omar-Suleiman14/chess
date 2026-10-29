# UI contracts

The board remains the visual focus. All designs share the same routes, game state, and actions.

## Three designs

| Design | Treatment |
| --- | --- |
| Classic / Standard | Default. Neutral paper backgrounds, crisp text, restrained surfaces and controls |
| Material 3 Expressive | Board-derived or chosen tonal color, expressive shapes, stronger headings, selected states, short interaction motion |
| Liquid Glass | Small translucent navigation/control surfaces; dense text and dialogs use strong opaque material |

Light, Dark, and System are separate choices. Theme tokens come from `lib/experience/theme.ts`; the provider applies them without restarting gameplay. A validated first-paint cache reduces theme flashes. Contrast, reduced motion, and reduced transparency apply across designs.

## Glass tiers

Navigation uses bounded blur up to 8 px. Controls use 8 px in Balanced and 12 px in Full. Modal sheets use 97% opaque material without backdrop blur. Minimal, reduced transparency, high contrast, and unsupported-browser fallbacks are opaque. No SVG displacement maps, animated blur, or idle glass shimmer remain.

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

Use actual screenshots and interactions across themes, light/dark, languages, small phones, desktop, zoom, and reduced motion. Browser automation does not replace VoiceOver, TalkBack, tactile device tests, or usability sessions. See [release status](ROADMAP.md).
