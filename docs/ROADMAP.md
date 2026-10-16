# Implementation roadmap · dependency order and release gates

**Read first:** [SPECIFICATION](SPECIFICATION.md), [ARCHITECTURE](ARCHITECTURE.md), [UI/UX](UI_UX.md), [MCP](MCP.md). Tracker: [issues](https://github.com/omar-Suleiman14/chess/issues).

**Implementation status (2026-10-16):** every work package below has code and tests on `main`, and production is deployed. Items marked *open* still need evidence from real devices, live OAuth clients or broader rating validation. Issues stay the source of truth for sign-off.

## Delivery gates

| Gate | Objective | Must be true before next gate |
| --- | --- | --- |
| **G0: feasibility** | browser Stockfish Lite + licensing + branch-capable data design | Real iPhone Safari benchmark, engine binary/source attribution, immutable game protocol reviewed |
| **G1: real chess** | board, engine, Undo, persistence | Play full legal game on phone/desktop, reload/resume, no invalid positions, score/eval stable |
| **G2: polished daily play** | gesture/UI, audio, Sherine, cards | A11y/reduced motion, 320px layout, responsive sheet, local/remote sync tests |
| **G3: improvement** | Climb, Timed, ratings, lessons | calibrated opponents, anti-assistance eligibility, timer correctness, puzzle validation |
| **G4: deep history** | replay, Time Machine, nested branches, imported games | replay parity, branch preservation, PGN roundtrips, compare and restore |
| **G5: AI and evolution** | OAuth MCP read/write, Sherine upgrades | ChatGPT and Claude auth, cross-user denial, audit, upgrade rollback |
| **G6: release** | performance, security, resilience | all blockers closed, test matrix, privacy policy/license notices, backups and recovery |

## Ordered implementation work packages

| Order | Work package | Dependencies | Risk/owner gate | Status |
| --- | --- | --- | --- | --- |
| [P00](https://github.com/omar-Suleiman14/chess/issues/1) | Dev setup (Next, TS, Convex, Clerk, lint/CI/testing) | none | blocker for everything | done |
| [P01](https://github.com/omar-Suleiman14/chess/issues/2) | License/third-party assets audit | none | blocker for code reuse/public bundles | done; Sherine art rights: owner to confirm |
| [P02](https://github.com/omar-Suleiman14/chess/issues/3) | iPhone Stockfish Lite benchmark spike | none | blocker for engine UX assumptions | /bench tool + desktop numbers; iPhone run: open |
| [P03](https://github.com/omar-Suleiman14/chess/issues/4) | Chess schema, immutable nodes and branch rules | P00 | blocker for saving/Undo/Time Machine | done |
| [P04](https://github.com/omar-Suleiman14/chess/issues/5) | Chess.js legality + interactive board | P00 | blocker for playable flow | done |
| [P05](https://github.com/omar-Suleiman14/chess/issues/6) | Engine worker, UCI manager, scheduling/failover | P02,P04 | blocker for Sherine play | done |
| [P06](https://github.com/omar-Suleiman14/chess/issues/7) | Full Power game + unrestricted Lite + Undo | P03,P04,P05 | first playable | done |
| [P07](https://github.com/omar-Suleiman14/chess/issues/8) | Convex sync/offline resilience and PGN | P03,P06 | persisted history | done |
| [P08](https://github.com/omar-Suleiman14/chess/issues/9) | Evaluation bar + fast/high-quality analysis | P05,P06 | no stale scores | done |
| [P09](https://github.com/omar-Suleiman14/chess/issues/10) | iOS UI system/navigation sheet/prefetch | P04 | fine after first playable | done |
| [P10](https://github.com/omar-Suleiman14/chess/issues/11) | Board themes, sounds, haptics, accessibility | P04,P09 | must not delay responsiveness | done (haptics Android-only) |
| [P11](https://github.com/omar-Suleiman14/chess/issues/12) | Sherine sprite/dialogue baseline + disable flow | P01,P06 | character opt-in/out | done |
| [P12](https://github.com/omar-Suleiman14/chess/issues/13) | Chess-specific Chaos Card/Blobatar adaptation | P01,P00 | isolated Chess identity | done (independent card, no Chaos code) |
| [P13](https://github.com/omar-Suleiman14/chess/issues/14) | Opponent calibration, Elo policy, anti-assistance | P05,P07 | blocker for rated Climb | 400-game baseline + 200-game retune done; Serious–Focused ordering and human anchors: open |
| [P14](https://github.com/omar-Suleiman14/chess/issues/15) | Climb ladder and separate timed mode | P13,P06 | game modes | done |
| [P15](https://github.com/omar-Suleiman14/chess/issues/16) | Time Machine replay and nested saved branches | P03,P07,P08 | deep history | done |
| [P16](https://github.com/omar-Suleiman14/chess/issues/17) | Fixed interactive micro-curriculum | P04,P07 | core learning | done |
| [P17](https://github.com/omar-Suleiman14/chess/issues/18) | Adaptive + on-demand openings and lessons | P08,P16 | built from real positions | done |
| [P18](https://github.com/omar-Suleiman14/chess/issues/19) | MCP authenticated foundation and read tools | P07,P01 | OAuth and authorization | done; live ChatGPT/Claude OAuth: open |
| [P19](https://github.com/omar-Suleiman14/chess/issues/20) | MCP branch/lesson write operations | P15,P17,P18 | domain validation/audit | done |
| [P20](https://github.com/omar-Suleiman14/chess/issues/21) | Natural Sherine progression + scripted upgrades | P11,P07 | persistence, pack schemas | done |
| [P21](https://github.com/omar-Suleiman14/chess/issues/22) | MCP-proposed/approved Sherine upgrades | P18,P20 | explicit scopes | done |
| [P22](https://github.com/omar-Suleiman14/chess/issues/23) | End-to-end hardening, offline, performance, release | all relevant | final gate | CSP/HSTS, export/delete, notices and deployment done; device matrix: open |

These IDs are specification work-package identifiers. GitHub issues give them exact titles/numbers and acceptance checklists; use [Issues](https://github.com/omar-Suleiman14/chess/issues) as execution source of truth. Work packages can be split into smaller PRs, but preserve dependency order. Browse [all implementation issues](https://github.com/omar-Suleiman14/chess/issues?q=is%3Aissue+is%3Aopen) and filter by **phase:G0–G6**, **priority:P0–P2**, or **area:** labels.

## Top blockers

### BLK-01: iOS browser engine viability
Run real Safari benchmark on intended phone(s): cold/warm worker ready time, WASM size served and cache re-use, movetime latency, memory pressure/background suspension, Worker crash handling, battery consumption, multi-tab, PWA caching/eviction. Avoid invented performance claims; if unusable, revisit architecture rather than putting compute on Wareed.

### BLK-02: Licensing + public sprites
Repo is GPL-3.0. Stockfish.js GPL exact build/source and notices must be supplied in distributions; existing Chaos code is AGPL-3.0-or-later and requires license compatibility/attribution audit before transplant. The Sherine character sprite from chat has not been cleared for public redistribution; use a placeholder until rights are verified.

### BLK-03: Rating calibration
Engine `UCI_Elo` is not a universally comparable human rating; browser Lite run under different think times/devices isn't a stable Elo benchmark. Personal Climb ratings need calibrated opponent pools, provisional/uncertainty display, unassisted result policy. A nominal 3000 maximum is only a *label*.

The [calibration reports](calibration/README.md) retain the 400-game original baseline and 200 fresh games covering the revised presets. The supported reversal is fixed; all five changed matchups clear the harness's approximate 50% interval threshold. Serious–Focused remains inconclusive, and human rating anchors/device validation remain open.

### BLK-04: Data history architecture
Undo and branchable records require immutable node + parent relationships and concurrency conflict protocol at the first persistence PR. Do not first save only a flat PGN and bolt branching on later.

### BLK-05: MCP compatible authorization
OAuth protected resource flows must be tested with both ChatGPT and Claude, with granular scopes, consent, revocation, owner verification, account linking and idempotent tools. MCP cannot execute user's browser-local analysis while the site isn't open.

### BLK-06: Product scope creep
Personal project. No full engine, Wareed compute, voice, multiplayer, social feeds or plans/subscriptions in initial deliverable. Do not let character features delay real chess quality.

## Definition of Done for any implementation issue

- Requirements/spec link, clear screenshots or recordings on mobile and desktop, tests and manual steps documented.
- No fake backend integration/ratings, no AI-made illegal chess moves, no silent data migration failures.
- Accessibility (keyboard focus, reduced motion, control labels, size), errors/retry, clean loading state.
- Regression tests pass; changes do not interfere with active games.
- Dependencies are closed/verified or blocked with reasons.
- Include release note, performance impact and any license/asset provenance changes.

## Suggested validation matrix

| Test class | Cases |
| --- | --- |
| Unit | move legality, undo full-turn semantics, SAN/PGN/FEN, scored UCI parsing, Elo math, schema/pack guards |
| Property | move tree invariants, idempotency, branching unchanged after replay, no turn-order violations |
| Integration | worker restart, stale search discarded, Convex conflict/auth, rating single-application, lesson grading |
| E2E | new/full/resume/undo, Climb unrating, clock pause and timeout, time-machine fork from midgame, OAuth tools |
| Visual/a11y | 320/375/430/768/1280/1600 widths, VoiceOver/keyboard, modal gestures, reduced-motion, high contrast |
| Perf | cold/warm iOS worker init, network slow/offline, battery, memory pressure, drag FPS, route prefetch, sound |
| Security | owner isolation, token revocation, injection attempts in notes/lesson/pack, oversized PGN, stale revisions |

## Release communication

README always honestly reports status. Before public demo, add screenshots generated from real running app, accessibility notes, third-party notices, deployment config, correct link and license links.
