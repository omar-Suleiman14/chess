# Measure performance

## Run the browser matrix

1. Run `corepack pnpm test:experience` on a quiet machine with Chromium installed.
2. Read `.cache/performance/current/summary.json` and the functional/Lighthouse reports.
3. Open the sanitized `.trace.json` files in DevTools. Compare the same hardware, browser, viewport, game state, and engine setting.

The suite tests Classic, Material 3 Expressive, and Glass Full/Balanced/Minimal with evaluation on/off and Minimal/Ambient/Off scenes. Each cohort has five fresh contexts. It records drag response, ten Friends open/close interactions, resize, rAF gaps, long tasks, paint/layout work, memory, and lab LCP/CLS. Artifacts strip URL queries, headers, request bodies, and token fields.

For an extended scroll/history run against an existing guest QA server:

```bash
node scripts/benchmark-ui.mjs --label extended --background all --runs 5 --scroll-ms 30000 --review-steps 10
```

Do not run unit tests, builds, or other browser suites beside a controlled benchmark. The CI gate flags move p95 above 50 ms, CLS above .05, browser errors, and large Lighthouse blocking time. A cloud scheduling failure remains evidence; rerun a suspected interference case separately and retain both reports.

## Read the results correctly

[Release evidence](EXPERIENCE-VERIFICATION.md) contains before/after metadata and measured exceptions. rAF timing is a scheduling proxy, not presented frames. Lighthouse uses simulated throttling; its score is not gameplay smoothness or field p75. Total paint time is not isolated effect cost. GPU power, battery, and actual display frames need representative hardware tools.

Targets: normal move response ≤50 ms; field INP ≤100 ms, LCP ≤1.25 s, CLS ≤.05 at p75; dropped presented frames below 2.5%. The 60% effect-cost and 2× improvement goals remain aspirational until demonstrated.

## Measure a real device

1. Open `/bench` on the deployment. Keep the tab visible and run the real Stockfish benchmark once cold, then warm.
2. Export the local Web Vitals observations. Label device, browser, theme/tier, scene mode, evaluation, and network.
3. Background for more than 60 seconds, return, and play. Confirm the worker restarts and clocks remain correct.
4. Repeat with low-power mode, cellular, touch drag, sound unlock, and reduced motion/transparency.
5. Capture browser performance traces for drag, rapid review, 30-second scroll, Friends ×10, and resize. Record median/p95 and inspect actual presented frames where available.

Use a mid-range Android, older iPhone/Safari, integrated-GPU laptop, and modern desktop. Physical-device runs are still required. [Issue #3](https://github.com/omar-Suleiman14/chess/issues/3) retains the older engine spike: Windows/Chromium worker startup 354 ms cold, 226 ms warm median; depths 16/19/24 at 0.4/1.2/3.5 seconds. That pane throttled rAF and could not measure smoothness.
