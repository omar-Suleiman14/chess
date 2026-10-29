# Product contracts

This reference describes implemented behavior in the repository. [Release status](ROADMAP.md) identifies unverified or undeployed work.

| Area | Contract |
| --- | --- |
| Homepage | Board first, height-aware layout, horizontal hideable evaluation, visible Friends and Hint entry points |
| Full Power | Unrestricted browser Stockfish Lite, selectable thinking time, no claimed measured 3000 Elo |
| Climb | Versioned opponent ladder and its own provisional Glicko-2 pool |
| Timed | Explicit clock preset, monotonic local clock, server validation, separate pool per control |
| Assistance | Opt-in hints/evaluation; eligible games become permanently unrated before help is revealed |
| Human play | Server-authoritative legal moves and results, no live engine hints |
| Time Machine | Manual first/back/next/last, row move table, optional analysis, preserved variations and starting FEN |
| Continuations | Separate unrated games linked to an unchanged source position |
| PGN | Manual import/export; no automatic Chess.com account connection |
| Sherine | Original character; English, Egyptian Arabic, Franco; controlled banter and synchronized talking frames |
| Appearance | Classic default, optional Material 3 Expressive and Liquid Glass; independent light/dark/system |
| Game scene | Minimal default, optional Ambient Glyphs, or Off; isolated from other routes |
| Sound | Original short event packs, previews, categories, volumes, overrides, and mute; no background music |
| Results | Accessible large modal, bot Play again, human rematch lifecycle, available review actions |
| Persistence | IndexedDB first, authenticated idempotent sync, immutable nodes and non-destructive branches |
| Learn | Validated lessons, progressive hints, mistakes-based practice, spaced repetition |

## Boundaries

The app works without an external AI service. The existing optional MCP system has separate scopes and audit rules; this roadmap does not add ChatGPT gameplay or Chess.com imports. User ratings are app-specific; bot strength is nominal or estimated until human calibration supports stronger claims.

Performance targets are measurements to pursue, not promises: move response ≤50 ms, field INP ≤100 ms, field LCP ≤1.25 s, and CLS ≤0.05. Physical-device and field evidence remain distinct from cloud lab results. [Benchmark protocol](BENCHMARKS.md)
