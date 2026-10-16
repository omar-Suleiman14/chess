# Engine benchmarks (P02 / BLK-01)

Run `/bench` on the device you want to measure (keep the tab in front), then paste the JSON into [issue #3](https://github.com/omar-Suleiman14/chess/issues/3). Nothing on that page is simulated: it starts real Stockfish workers and runs real searches.

Engine: Stockfish.js **19.0.1**, `stockfish-19-lite-single.{js,wasm}` (single-threaded, ~1.8 MB WASM), served from `/engine/19.0.1/` with immutable caching.

## Measured results

| Device / browser | Worker ready (first) | Worker ready (warm, median) | Depth @ 0.4 s / 1.2 s / 3.5 s | First standard reply | Main-thread smoothness |
| --- | --- | --- | --- | --- | --- |
| Windows desktop (28 threads, 16 GB), Chromium 152 in the Claude app pane, dev server | 354 ms | 226 ms | 16 / 19 / 24 | 1205 ms | **Not measurable here**: the pane throttles `requestAnimationFrame` to ~1 fps even when idle |
| iPhone Safari | **not yet measured** | | | | |
| Android Chrome | **not yet measured** | | | | |

Search overshoot past the requested `movetime` was 5–9 ms (median) on desktop.

## Go / no-go

- Desktop: **go**. Start-up is well under a second and depth at Standard (1.2 s) is about 19.
- iPhone: **open**. This is the BLK-01 gate. Needs a real-device run of `/bench`, plus manual checks: backgrounding and returning (the app terminates the worker after 60 s hidden and restarts it lazily), a second tab, Low Power Mode, cellular, and offline after the first load.

## Protocol for the device run

1. Open `https://<deployment>/bench` on the device. Run it once after a fresh install or cache clear (cold), then run it again (warm).
2. Background the tab for over 60 s, return, and play a move on `/`. Sherine must still reply. The worker restarts automatically.
3. Repeat in Low Power Mode, and on cellular.
4. Paste both JSON blobs and notes into issue #3.
