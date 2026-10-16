# UI/UX system · Apple simplicity, not Liquid Glass

> Visual direction is *minimal Apple-inspired*, not an iOS clone. Board is the product. Interactions are what feel premium. Keep onboarding and explanatory copy short.

## Principles

1. One primary action per screen; board occupies central attention.
2. 8×8 board is fully legible and interactive in narrow iPhone portrait and desktop; do not shrink square hit targets under usability threshold where avoidable.
3. Typography, spacing, contrast and restrained motion matter more than cards/gradients.
4. No Liquid Glass, frosted-glass mania, huge dashboards, toy-like colors, heavy shadows or marketing banners.
5. Controls are obvious, named to accessibility APIs, and large enough for hands, not just mouse cursors.
6. Character presence is secondary and opt-out. No interrupts in competitive modes.

## First entry

- Display lightweight Sherine/Chess mark while essential code loads; respect reduced motion.
- Render board shell and game status immediately. Load/cache chess rules synchronously; engine downloads/initializes after board UI starts.
- Signed-in returning player: Resume current game or Start Full Power as the default action. Auth may be deferred until a save needs syncing; sign-in must not discard local game.
- Start only Full Power in v1 play surface; enter Climb and Timed via the navigation sheet when released.
- Bottom area contains Undo as primary secondary control; **no clock on/off switch**. Timed mode has dedicated entry with preset clock selection.

## Board geometry

- Use CSS grid/aspect-ratio 1 and accurate piece layer/drag hit testing; mobile portrait width = min(content, viewport - safe margins); CSS transform animations must not distort input coordinates.
- White/black orientation switch; left or right small evaluation bar respecting chosen side and user's preferences, score label/mate symbol available in detail sheet.
- Source/destination highlights, legal move dots (toggleable), last move highlight, king-in-check cue, promotion picker as custom action sheet, move input with tap-tap and drag-drop.
- Short nonintrusive labels for Sherine, mode, your Elo/Climb state; temporary toast for game finish or blunders; no walls of moves covering board.
- Board palettes: Ivory/Sage/Slate/Blue as initial curated tokens, separate piece contrast against each square. Persist palette; respect high contrast settings.
- Engine not ready: allow premove/select, show short 'Sherine is waking up' indicator, no fake reply; permit restart worker from unobtrusive sheet.
- Evaluation bar color/label always identifiable without depending on color alone. Hide option; search updates throttle ≤8 times/second.

## iOS-like menu sheet

Tap circular horizontal ellipsis near top-right. Sheet opens from bottom; **entire app content (not only board) recedes**:

- Backdrop app scales toward ~0.95–0.97, gets 14–22px radius and moves backward/down slightly; light dim/shadow.
- Sheet translation and backdrop depth are driven by a **single progress state** (0–1), linked to drag movement; no separated timers.
- Animate scale, opacity and translate via transform/opacity; tune springs on real iPhone. Proposed start: stiffness 330–440, damping 32–42, mass 1; adjust on device.
- Dismiss via drag down, tap outside, Escape, accessible close button; handle scrollable sheet inner content correctly, avoid accidental drag while scrolling.
- Respect iOS safe area home indicator, keyboard appearance, screen rotation, and reduced motion. Focus trapped while modal is active and restored on close.
- Menu entries: Play (Full Power/Climb/Timed), Learn, Time Machine, Progress, Profile & Sherine, Settings. No persistent sidebar on mobile.
- On desktop: same modal vocabulary, optionally centered/side anchored if bottom sheet is awkward; never break parity of functionality.

## Motion specification

| Event | Motion (tunable) | Sound/haptic |
| --- | --- | --- |
| Piece selected | brief 0.98→1.00 scale / low latency | very subtle pick tick |
| Piece move | 120–200ms eased translate; input is immediate | authentic wood/tone |
| Capture | 180ms layered fade, tiny impact | distinct capture |
| Castle | king+rook coordinated slide | castle cue |
| Promotion | custom sheet with 4 legal options | select |
| Evaluation change | damped number/height transition, bounded update rate | none |
| Sherine reaction | sprite state transition, 0.5–2s max unless persistent | optional personality cue |
| Menu sheet | coherent drag-following spring | light open/close |
| Time Machine scrub | ≤150ms piece snap/tween, no long blocking animations | optional timeline tick |
| Lesson correct | brief restrained flourish / success | soft affirmative |

No VFX on every click; game sounds should not sound like a UI pop kit. Independent toggles for chess effects, game sound, Sherine dialogue/sound and animations. Reduced motion disables depth/tilt/cinematic scrubbing while preserving state clarity.

## Responsive & input handling

| Context | Layout |
| --- | --- |
| 320–390px iPhone portrait | square board full allowed width, ellipsis, labels minimal, bottom actions within thumb reach |
| >390px mobile | roomy board, large controls; safe areas on notched devices |
| Tablet portrait/landscape | board center, optionally contextual panel for move list |
| Laptop/desktop | board 520–760px (based on space), optional moves/analysis without distracting from primary board |
| Keyboard | arrows to move square focus, enter/space activate, shortcuts for undo/replay/pause, Escape sheet dismiss |
| Screen reader | announce side to move, piece, square, legal targets, move outcome/check, clock status as needed |

Prevent browser page scroll from hijacking piece drag; use pointer capture; stylus and touch parity. Do not rely on hover-only affordances.

## Loading / prefetch rules

- Stage critical path: shell -> board -> auth/session restore -> worker -> eval bar / Sherine -> secondary routes/prefetch.
- Avoid prefetching all pages/assets before gameplay is stable. Use Next.js route prefetch on navigation intent/hover and `requestIdleCallback`-style idle scheduling where available, with explicit fallback and resource constraints.
- Heavy character sprite/outfit assets lazy load. Engine worker version cache with immutable hashed assets where possible.
- Every async path has a retry, offline, stale-data or engine-start-failed UX that preserves active board.

## Sherine character presentation

Use supplied pixel sprite as a **reference**; licensing/provenance must be cleared prior to adding to public repo. Animation state machine: idle, thinking, amused, smug, annoyed, impressed, plea-disable, angry-reenable, win, lose. Tone: teasing/mean, briefly apologetic when saved from disabling, annoyed when brought back, rewards occasional achievement without becoming generic. Dialogue short (prefer one sentence max), optional and rate-limited. Acknowledge click/tap to dismiss; never block a chess move. Confirmation to disable is playful **but** must offer an immediate clear disable, and keep preference even after reload.

## Quality checks

- Visual screenshots at 320/375/430px widths and desktop 1280/1600; Safari, Chrome, Firefox as available.
- 60fps animation goal on current phone hardware; avoid frame drops during engine search, drag and sheet gestures.
- Avoid CLS on first board paint; accessible contrast/touch targets; dark and light if supported with same palette clarity.
- Mobile keyboard/safe-area, route switching during active game, background/foreground engine worker restore, OS reduced-motion + no-audio tests.
