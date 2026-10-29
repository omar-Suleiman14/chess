# Experience release verification

Updated 29 October 2026. Requested scope: the [live checklist](https://app.notion.com/p/408448cf001c8162b1c4d3ed12e5defa), last edited 06:56 UTC. The user explicitly authorized the Time Machine implementation and the review, merge, and production release.

## Review result

No known blocking code defect remains after review. The final fixes cover long imported histories, repetition-result sound precedence, rejected timeout acknowledgements, durable hint eligibility, modal Shift+Tab, and removal of uncleared legacy recordings. Production Convex deployment still requires its deploy credential in the release environment.

## Automated evidence

| Check | Result |
| --- | --- |
| Lint and TypeScript | Pass |
| Unit/backend suite | 23 files, 223 tests pass |
| Production build | Pass; 44 generated pages |
| Documentation links | All local links resolve |
| Chromium | Three themes × light/dark; moves, Friends, results, focus trap, reopen/play again, saved preferences, board-derived/custom color, scene boundaries, reduced motion, manual review and branches |
| Hints | Real engine in all themes; three stages, legal arrow, no automatic move, stale clearing, rating consent and irreversible assistance |
| Phone results | Three themes × English/Egyptian Arabic/Franco; RTL, reduced motion, 390px width and 200% CSS text scale |
| Human rematches | Real local Convex and two browser contexts: request, duplicate prevention, decline, cancel, accept, both clients following the same new room, preserved original |
| Firefox | Functional theme and review matrix passes |
| WebKit | Functional matrix completes; Clerk protection-probe CORS diagnostics and an intermittent local blob access-control error remain recorded |

[Machine-readable results](performance/functional.json). Browser tests use a temporary guest middleware fixture because production Clerk secrets are not exported. The real middleware is restored after builds. Local online tests use an anonymous localhost backend and disposable seat tokens. These results do not claim signed-in production or physical-device verification.

## Performance evidence

The retained baseline is the earlier `aa7f258` UI on the same cloud host: Chromium 154, AMD EPYC, three logical CPUs, 1366×768 followed by 1280×800, five repeats per theme/evaluation cohort. Files retain exact metadata:

- [Baseline](performance/baseline.json): Classic and legacy glass, evaluation on/off, 20 runs.
- [Full current matrix](performance/full-matrix.json): five appearance tiers, evaluation on/off, 50 runs. One Balanced/off cohort reached 58.6 ms p95 while other local validation shared the host.
- [Quiet targeted recheck](performance/quiet-recheck.json): Balanced glass, five repeats per evaluation state with other validation stopped. Move-to-rAF p95: 28.5 ms without evaluation, 21.3 ms with evaluation. Both pass the 50 ms lab budget.
- [Lighthouse](performance/lighthouse.json): accessibility 100 on desktop/mobile; simulated LCP 5.21 s desktop and 0.91 s mobile; CLS below .001. Desktop simulated LCP misses the aspirational 1.25 s target.

The earlier full matrix had other cohorts between 16.1 and 22 ms p95. The noisy failure is retained rather than overwritten or relabeled as a pass. Five samples give a coarse p95; a single outlier is the maximum under the nearest-rank method.

These are lab scheduling measurements, not presented compositor frames, physical battery/GPU cost, or population field p75. Paint totals include the scenario, not isolated glass work. No 60% effect-cost reduction, halved latency, or universal 120 FPS is claimed. Ambient/Off comparisons and extended scroll runs are supported by the runner; CI now exercises all three scene modes.

## Screenshots

[Classic result](screenshots/experience/classic-light-result.png) · [Material result](screenshots/experience/expressive-light-result.png) · [Glass result](screenshots/experience/glass-dark-result.png) · [Hint](screenshots/experience/glass-hint.png) · [Mobile review](screenshots/experience/time-machine-mobile.png) · [Desktop review](screenshots/experience/time-machine-desktop.png) · [Arabic phone text scale](screenshots/experience/glass-egy-phone-text-200.png)

## Remaining release evidence

Physical iPhone/Android audio and touch behavior, integrated-GPU performance, native zoom, VoiceOver/TalkBack/NVDA, sufficient field cohorts, human rating calibration, and uncoached usability sessions remain unverified. The local Web Vitals dashboard supports collecting/exporting real observations without claiming population statistics. See [release status](ROADMAP.md) and [benchmark protocol](BENCHMARKS.md).
