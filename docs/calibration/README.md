# Climb calibration evidence

The original pool was measured over **400 games: 40 per adjacent pair**. The revised pool changes three presets and adds **200 fresh games over its five affected pairs**. Its other five pairs reuse the original evidence because both policies are unchanged.

## Changes in climb-v2

- Tidy Bishop no longer injects random blunders (8% to 0%). The original separation from Nervous Knight was inconclusive.
- Distracted now uses Skill 1, depth 3, 90 ms; Warming Up uses Skill 2, depth 2, 120 ms. The original depth-4/Skill-3 Distracted beat the nominally stronger UCI-1450 Warming Up 29–2–9, a supported reversal.
- Changed presets have opponent version 2. Existing local/server games retain version 1, including their engine policy and rating-ledger attribution. New games explicitly send the selected version; old queued creates default to version 1.
- IDs, unlock progress, nominal rating labels and rating deviations are unchanged. All human-rating calibration flags remain false.

## Revised pool

[Raw report and preset snapshots](climb-v2.json). Fresh evidence covers levels 3→4, 4→5, 5→6, 6→7 and 7→8; all other rows reference [the baseline](climb-v1.json).

| Higher level vs lower level | W–D–L | Higher score | Approx. 95% score interval | Evidence |
| --- | ---: | ---: | ---: | --- |
| Snack Grabber vs Wobbly Pawn | 32–8–0 | 90.0% | 76.9%–96.0% | Higher supported |
| Nervous Knight vs Snack Grabber | 28–11–1 | 83.8% | 69.5%–92.1% | Higher supported |
| Tidy Bishop vs Nervous Knight | 23–8–9 | 67.5% | 52.0%–79.9% | Higher supported |
| Sherine (sleepy) vs Tidy Bishop | 38–1–1 | 96.3% | 85.3%–99.1% | Higher supported |
| Sherine (distracted) vs Sherine (sleepy) | 27–2–11 | 70.0% | 54.6%–81.9% | Higher supported |
| Sherine (warming up) vs Sherine (distracted) | 25–4–11 | 67.5% | 52.0%–79.9% | Higher supported |
| Sherine (focused) vs Sherine (warming up) | 31–0–9 | 77.5% | 62.5%–87.7% | Higher supported |
| Sherine (serious) vs Sherine (focused) | 24–2–14 | 62.5% | 47.0%–75.8% | Inconclusive |
| Sherine (ruthless) vs Sherine (serious) | 30–2–8 | 77.5% | 62.5%–87.7% | Higher supported |
| Sherine · Full Power vs Sherine (ruthless) | 40–0–0 | 100.0% | 91.2%–100.0% | Higher supported |

Some intervals still cross 50%; these steps remain inconclusive at this sample size. Positive point estimates alone do not establish strict ordering.

## Original pool

[Raw baseline and original preset snapshots](climb-v1.json).

| Higher level vs lower level | W–D–L | Higher score | Approx. 95% score interval | Evidence |
| --- | ---: | ---: | ---: | --- |
| Snack Grabber vs Wobbly Pawn | 32–8–0 | 90.0% | 76.9%–96.0% | Higher supported |
| Nervous Knight vs Snack Grabber | 28–11–1 | 83.8% | 69.5%–92.1% | Higher supported |
| Tidy Bishop vs Nervous Knight | 21–7–12 | 61.3% | 45.8%–74.7% | Inconclusive |
| Sherine (sleepy) vs Tidy Bishop | 38–2–0 | 97.5% | 87.1%–99.6% | Higher supported |
| Sherine (distracted) vs Sherine (sleepy) | 35–1–4 | 88.7% | 75.4%–95.3% | Higher supported |
| Sherine (warming up) vs Sherine (distracted) | 9–2–29 | 25.0% | 14.2%–40.2% | Reversed |
| Sherine (focused) vs Sherine (warming up) | 30–1–9 | 76.2% | 61.1%–86.8% | Higher supported |
| Sherine (serious) vs Sherine (focused) | 24–2–14 | 62.5% | 47.0%–75.8% | Inconclusive |
| Sherine (ruthless) vs Sherine (serious) | 30–2–8 | 77.5% | 62.5%–87.7% | Higher supported |
| Sherine · Full Power vs Sherine (ruthless) | 40–0–0 | 100.0% | 91.2%–100.0% | Higher supported |

## Method and limits

Stockfish 19.0.1 Lite single-threaded on Windows x64 / Node 22.23.2. Each pair uses ten fixed openings, alternating colors, with each opening/color combination repeated twice. The harness clears engine state between games, uses the app's policies, and caps games at 240 plies; games without checkmate count as draws, including the cap.

The first seven baseline pairs ran serially. The final three baseline pairs and the revised matchup workers ran independently on the same host. They preserve search settings, openings, game IDs and sample sizes; runtime and host load can still affect movetime searches. Incomplete duplicate/abandoned work is excluded.

Intervals are the harness's approximate Wilson score intervals, treating a draw as half a point. Fixed repeated openings, stochastic search and shared-host execution limit statistical interpretation. Implied Elo gaps are relative transformations of scores, capped at 1%/99%; they are not measured human Elo.

Presets were tuned using this opening suite. [Completed alternative trials](climb-v2-trials.json) are retained separately; they are not added to the selected sample. This is exploratory development evidence, not an independent holdout. A fresh opening suite, larger samples for inconclusive steps, and real browser/device runs are still needed for stronger calibration claims.

The older [six-game smoke sample](climb-v1-sample.json) predates the current harness and is not used in these conclusions.

## Reproduce the current pool

```sh
pnpm calibrate -- --games 40 --pairs 0-10
```

The default output is named for the current pool (`climb-v2.json`); use `--out <path>` to preserve an existing run. Single-pair workers use, for example, `--pairs 6-7 --out <path>`. The reports embed all opponent settings so historical policies can be reconstructed without treating current presets as the baseline. `--game-offset N` assigns disjoint global game indices when splitting a pair across workers; combine W/D/L counts before recomputing an interval, rather than averaging chunk intervals.
