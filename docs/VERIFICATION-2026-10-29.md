# Chess polish verification, 29 October 2026

Source checklist: [Board-first homepage, analysis, friends and Sherine](https://app.notion.com/p/408448cf001c8162b1c4d3ed12e5defa).
Character rules: [Sherine](SHERINE.md).

## Delivered

- Height-aware board layout, horizontal White-perspective evaluation, an immediate
  saved visibility toggle, compact phone controls and collapsible desktop move history.
- Engine result handling preserves the last scored principal variation. Missing
  scores stay unavailable. Gameplay retains priority over optional cached review.
- Independent move classification, explanations and hint settings. Depth requirements,
  forced-mate handling, a small verified opening book, and conservative Great/Brilliant
  rules are documented in the review UI. Rated bot assistance requires consent and
  permanently removes rating eligibility. Human online games receive no live analysis.
- Friends opens from the game header and reuses the existing friend/request/challenge
  system. Mutations show failures and disable repeated submissions. Existing profiles
  and the full friends page remain available. Presence is not invented when unknown.
- Guest and signed-in manual PGN entry, readable parse errors, export with variations,
  replay and saved practice. Device-only practice retains its source game/node links.
- English, Egyptian Arabic and Franco dialogue, browser/greeting language detection,
  device-persistent banter controls and independent dialogue chimes. Existing language
  and sound preferences retain their account sync. New coaching/banter controls are
  explicitly labeled as device preferences.
- Talking frames and grapheme-safe typing share one utterance clock. Follow-ups,
  dismissals, disabling and unmounting cancel old timers. Reduced motion is static.
- Commentary covers legal checks/captures/promotions, verified strong moves and
  sacrifices, clock pressure, near mates, rematches and repeated Undo interactions.
  Sharper personal insults and unsupported opening/queen claims were removed.

## Automated checks

`npm run typecheck`, `npm run lint`, `npm run test`, and `npm run build`.
The suite includes engine scheduling, legality, ratings, Convex ownership/settings,
PGN/history, lessons, personality gates and review correctness. New regressions cover
depth-only UCI messages, missing scores, deep alternative-line requirements,
multilingual completeness, sanitized memory keys and direct-reply unlock gates.

## Browser checks

Headless Chromium with the actual Stockfish WASM and IndexedDB. The local runtime
used a temporary signed-out middleware fixture because Vercel's sensitive Clerk
secret cannot be exported. The original authentication middleware was restored
before the final build and commit. This is guest-flow evidence, not a claim of
signed-in OAuth or production authentication validation.

| Viewport | Board width | Board bottom | Undo bottom | Horizontal overflow |
| --- | ---: | ---: | ---: | --- |
| 320 × 568 | 284 | 406 | 564 | None |
| 375 × 812 | 351 | 503 | 800 | None |
| 430 × 932 | 406 | 558 | 920 | None |
| 768 × 1024 | 674 | 826 | 1012 | None |
| 1024 × 768 | 560 | 668 | 732 | None |
| 1366 × 768 | 560 | 668 | 732 | None |
| 1920 × 1080 | 872 | 980 | 1044 | None |
| 2560 × 1440 | 1232 | 1340 | 1404 | None |

Verified with no browser exceptions:

- Play e4, receive the engine's e5 reply, reload/resume and Undo the complete turn.
- Open Friends without navigation; Escape closes it and restores focus.
- Follow an Arabizi greeting with Arabic; verify the reply language and typing animation.
- Reduced motion produces no talking animation. Mute survives navigation; re-enable works.
- Invalid `Bh8` PGN reports the move and ply. Valid PGN imports locally, exports its
  `Bc4` variation, and creates a separate practice game retaining its parent metadata.
- Enable classifications and explanations, play a fresh bot game, and receive a
  real engine-supported `e4: Book` review. No substitute material evaluation is used.

Screenshots: [phone](screenshots/2026-10-29/phone.png),
[desktop](screenshots/2026-10-29/desktop.png),
[Arabic](screenshots/2026-10-29/arabic.png),
[coaching](screenshots/2026-10-29/coaching.png).

## Remaining external validation

Physical iPhone Safari/Android, screen-reader and battery/memory tests, and signed-in
friend acceptance/challenge flows need real-device/account validation. The existing
backend tests pass, but these browser journeys were not exercised with a signed-in
account. Human rating calibration and live OAuth-client sign-off from the older
roadmap remain separate existing release gates. No Notion checkbox was marked
complete without its required evidence.
