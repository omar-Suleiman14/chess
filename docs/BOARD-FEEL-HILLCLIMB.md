# Board feel hill climb · 4 November 2026

Reference: [Notion hill and 16 experiments](https://app.notion.com/p/40e448cf001c81f49f4cdc99cf0dacbf) · [10-screen atlas from both supplied videos](https://chatgpt.com/library?file_id=libfile_91f33d4e9ae081919d89433c9135acc6&account_id=personal).

This change **keeps the custom Chess by Chaos board**. The benchmark is the *feel* of Chess.com's move input and board feedback, not a new app design or a copy of Chess.com's code/assets.

## Observed gap from the recordings

- Chess.com: quick pickup with a finger-following enlarged piece, decisive drop, muted last-move feedback, distinct move sounds; board dominates the screen.
- Chaos: the custom board and themes are already strong, but dragging was driven by a React state update on **every pointermove**, which reconciled 64 squares and Motion elements at touch frequency. Sherine's quick engine responses could also be difficult to follow. Hint highlighting was louder than the matte palette.
- The clips do **not** show a comparable Chess.com premove or hint sequence. The original endgame state is also not comparable to a Chaos endgame in these two recordings. Missing references are not invented.

## Implemented iterations

| Hill | Change | Automated evidence |
| --- | --- | --- |
| H01–H03 | React state only on drag activation, square hover and release; piece follows pointer via one compositor transform; a calibrated maximum 8px vertical offset; drop-target ring; cancellation on pointercancel, lost capture, Escape and context menu; unchanged click-to-move | `boardGesture.test.ts`; `verify-board-feel.mjs` mouse and touch scripts |
| H04–H05 | Retained existing legal/capture markers, flipped-board coordinate mapping, speculative premoves, one-move queue, legality check after reply, and Escape/click cancellation | Existing `premove.test.ts`; new hit-test bounds/orientation cases |
| H06 | Retained existing distance-bounded 130–240ms motion, rook/capture/replay treatment and reduced-motion support | Existing component; production build |
| H07 | Opponent pacing: Instant, Natural (650ms untimed / 240ms timed) or Relaxed (1150ms / 600ms) minimum **total** think time, including search; stale replies remain cancellable | `botPace.test.ts`; manual QA steps below |
| H08 | Device-local Compact/Balanced/Bold piece sizing (1.0×, 1.07×, 1.14×) that retains existing board themes and piece sets | Settings controls; real-browser QA script |
| H09–H10 | Retained native evaluation and staged source-square/arrow hints; clarified Hint → Cancel hint while loading → Show move → Hide hint; accessible labels match the visible action; softened overlays for matte UI | Updated `verify-hints.mjs` and components |
| H11 | Softer original wooden impact fallback when recorded Chess.com cues aren't available; existing selectable recorded-sound option, audio unlock and category cues preserved | Existing `sound.test.ts`, `experience.test.ts` |
| H12 | Retained existing result modal, announcements and result cues | Existing `verify-experience.mjs` |

This is a **code-level improvement**, not a claim that the 95/100 perceptual target has been measured or that all H00–H15 are verified. The benchmark atlas and human/device evaluation still matter.

## Follow-up hill: input cues, hand reach and piece identity

| Hill | Change | Verification |
| --- | --- | --- |
| H16 | Show a small muted origin disc while holding a piece, legal destination discs, capture rings and a subtle rounded hover/drop ring. Premove targets use a separate quiet blue. Preserve click selection, drag cancellation and board themes. | The browser drag test asserts one origin, two legal targets from e2, and an active drop target. |
| H17 | Move the board down into the thumb-accessible lower-middle zone on tall mobile screens by splitting flexible whitespace above and below it, with the board and touch controls retaining priority on compact screens. | A 390 × 844 browser trace checks board top ≥150px and bottom ≤740px and captures before/drag/after screenshots. |
| H18 | Give Sherine's spoken text a wider bubble, 64px mobile player row and more breathing space while keeping the desktop layout unchanged. | Review phone screenshot and compare at matching viewport with video reference. |
| H19 | Include an original hand-authored inline SVG **Studio** piece set for all six piece types in both colors, preserving other existing piece sets and saved settings. | Twelve server-rendered SVG variants, schema-backed settings test and persisted piece-style selection in browser; `desktop-studio.png`. |
| H20 | Prefer Chess.com recorded cues from the existing opt-in Chess.com sound pack sooner: prepare browser media immediately, decode Web Audio in parallel, retain the original built-in fallback if media cannot play. | Sound unit tests verify early media preparation and rejected-media fallback; browser QA requests original move, capture, check and premove cues and checks the response is audio. No third-party sound files are committed. |
| H21 | Provide **Chess.com · Neo** as a separate, exact-source image set: transparently stream the original 150px PNG art through a same-origin route, with the existing six custom piece sets and Studio preserved. A hand-drawn SVG is not pixel-identical to the source artwork; this source-backed option is. | Unit-check 12 path mappings; browser-select and load all 32 actual images; capture `desktop-chesscom-neo.png` for reference comparison. Dependence on Chess.com's external asset host is explicit. |

### H22–H27: reference-clip iteration (2026-11-04)

H19–H21 describe the previous hill and are kept as history. The newest recording, screenshot and owner-provided Standard sound ZIP exposed further work:

| Hill | Correction | Measurable acceptance criterion |
| --- | --- | --- |
| H22 | Remove Studio from selectable art, present the original Neo PNG option simply as **Neo**, and migrate a saved Studio choice to Neo. | Piece set enumeration omits Studio; settings migration unit test; Chrome selects Neo and renders 32 images after navigation. |
| H23 | Stop speculative bishop/rook/queen premoves at blockers; don't show capture rings for own-color pieces. Fix bishop f1 falsely showing g2/h3 on the reference screenshot. | `premove.test.ts` covers initial blocked bishop and open e-file diagonal; no dots beyond own-color pawn. |
| H24 | Distinguish selection from attempted illegal movement. Picking a trapped bishop never produces a buzz/error; dropping onto an invalid square produces one. | Browser clicks c1 with no illegal flash, then clicks e3 and gets one; unit tests exercise legality. |
| H25 | Use the exact MP3 bytes from the owner's archive without streaming/transcoding. Map illegal moves to `illegal.mp3`, not `incorrect.mp3`, and use distinct win/lose/draw files. | SHA-256 fixtures for illegal, move and capture; browser fetches eight local audio URLs; local sound player supports existing fallback if unavailable. Third-party redistribution rights require clearance. |
| H26 | Remove the colored badge on an individual board square, move per-move evaluation to the top move strip on phones and top move history area on desktop. Reserve height so feedback doesn't jump. | Board no longer accepts `moveBadge`; phone top region has accessible `Move feedback` display; bottom status never shows move quality. |
| H27 | Lock the mobile game viewport to `100dvh`, shrink internal flexible tracks, retain fixed controls and board lower-middle reach. | Browser at 390×844 checks `scrollHeight ≤ innerHeight + 2`, `scrollTo(0,400)` stays at zero, board top ≥150 and bottom ≤740. |

### H28–H32: real-iPhone turn changes and controls (2026-11-04)

The owner's 9-second Safari recording showed that the previous emulated-Chromium no-scroll gate was insufficient. These corrections do not imply that physical iOS Safari has been verified.

| Hill | Correction | Measurable acceptance criterion |
| --- | --- | --- |
| H28 | Keep a silent, tactile piece selection. Do not fire a harsh `click` cue just for picking up a piece; retain recorded move/capture/illegal cues for the actual action. | No sound handler is attached to game-board selection; haptic selection and move sound remain. |
| H29 | Remove `empty:hidden` from the 24px thinking/status row. It must not collapse when Maya's thinking text appears/disappears. | Browser asserts status height remains 24px before and after a move. |
| H30 | Pin the phone game and body to the viewport and size the square board against `svh` rather than dynamic `dvh`, preventing Safari's browser-bar transitions from changing board size. | Browser checks fixed game position, no document scroll before/after move and lower-middle board reach. Real Safari must still be observed. |
| H31 | Integrate the horizontal evaluation meter (or rated-game consent) into the feedback strip. Reserve a single, stable row and remove its doubled top border; the meter must not occupy space above the mobile board. | Browser asserts the meter/consent lives inside the feedback bar and is absent above the board. |
| H32 | Flip the board with a deliberate two-finger vertical swipe without making a move or turning a pinch/tap into a flip. Keep the menu and keyboard option. | Unit tests for swipe/pinch, and touch-browser test flipping twice with unchanged piece state. Works on online as well as bot board. |

Earlier browser CI for the first hill verified mouse p95 held-piece offset at **8px**, desktop drop, a CDP-emulated 390px touch drag and the broader experience checks. Its Lighthouse desktop startup TBT gate still failed at ~1039ms; a baseline run before the hill already failed around 1067ms. This is a tracked unrelated performance problem, **not a green CI claim**. The follow-up hill must pass its new browser checks before being considered validated.

## Verification protocol

### Automated

```sh
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm test:board-feel
pnpm test:experience
```

`test:board-feel` uses the repository's reversible guest-only QA fixture. It takes desktop and 390px phone screenshots in `.cache/board-feel/`, checks a 24-sample pointer trace against the **≤10px p95** ghost-anchor goal, verifies off-board drop cancellation and the two new settings, and performs a Chromium CDP touch drag. Keep its `results.json` and screenshots with the PR/test run. The full experience suite additionally checks actual engine hints, rated consent, result dialogs, orientation, languages and accessibility.

### Physical-device review required before declaring the apex

1. On an older iPhone Safari, a modern iPhone Safari, midrange Android Chrome and desktop mouse/trackpad: capture 3 identical e2→e4 drags each, at compact and bold piece size. Record p95 offset, missed drops and subjective ease. Compare with equivalent Chess.com traces from the same device.
2. Queue and cancel a premove on Sherine's turn. Check legal and invalidated premoves after a bot response, both orientations, promotion and rapid tap/drag switching.
3. Compare Natural and Relaxed bot responses, game clock fairness, 20-second time pressure and cancellation by Undo/New.
4. Record audio output on device: fresh tab tap/audio unlock, Chess.com clip available/unavailable, move/capture/check/castle/promotion/premove/result, background/resume and silent mode. No doubled sound.
5. Check reduced motion, 200% text scale, VoiceOver/TalkBack/NVDA, hint consent and focus, result recovery. Record reference and result screenshots at identical viewport/theme/FEN/scale.
6. Run blind A/B ranking from the supplied atlas and fresh captures; score touch, premoves, motion, geometry, hints, audio and regression behavior. Only mark H14/H15 Verified if the score and gate actually pass.

## Known evidence boundary

The test suite and build can run without accounts, but this scratch execution environment has no Chromium executable and the Playwright browser download failed. Its networking interface also prevents local `next dev` from listening. No local browser screenshots or physical-device results are claimed; the new QA script is committed for an environment with Chromium. Existing lab benchmarks in [EXPERIENCE-VERIFICATION.md](EXPERIENCE-VERIFICATION.md) predate this change and are **not** a measured after result.
