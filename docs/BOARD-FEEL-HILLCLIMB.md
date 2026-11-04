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
| H09–H10 | Retained native evaluation and staged source-square/arrow hints; clarified Hint → Show move → Hide hint label; softened overlays for matte UI | Existing `verify-hints.mjs` and new components |
| H11 | Softer original wooden impact fallback when recorded Chess.com cues aren't available; existing selectable recorded-sound option, audio unlock and category cues preserved | Existing `sound.test.ts`, `experience.test.ts` |
| H12 | Retained existing result modal, announcements and result cues | Existing `verify-experience.mjs` |

This is a **code-level improvement**, not a claim that the 95/100 perceptual target has been measured or that all H00–H15 are verified. The benchmark atlas and human/device evaluation still matter.

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
