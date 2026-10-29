# Release status

Source of requested work: [live Chess checklist](https://app.notion.com/p/408448cf001c8162b1c4d3ed12e5defa). This file reports repository progress; it does not mark the Notion checklist complete.

## Implemented on the experience branch

- Board-first layout, horizontal evaluation, conservative move feedback, Friends entry, manual PGN, three-language Sherine, and synchronized talking animation.
- Classic default with lighter neutral backgrounds; separate Material 3 Expressive and Liquid Glass; board-derived/custom Material color and independent color mode.
- Bounded glass tiers and opaque fallbacks; game-only Ambient Glyphs with presets, limits, and reduced-motion behavior.
- Original event sound packs, previews, per-event overrides, channel/category controls, cached playback, and licensing ledger.
- Larger accessible results and server-backed request/decline/cancel/expiry/accept rematches.
- Manual Time Machine navigation, row move table, optional insights, preserved PGN names/variations, shared-position branch switching, and session cursor memory.
- Three-stage hints with legal engine evidence and committed unrated consent; pool-correct player ratings, honest bot labels, and committed-only deltas.
- Reproducible interaction/Lighthouse tooling, local Web Vitals dashboard, CI artifact capture, and shorter task guides.

## Evidence

[Verification report](VERIFICATION-2026-10-29.md) covers the earlier gameplay work. The expanded experience report and retained lab artifacts distinguish automated checks from manual release checks. Tests cover legality, engine scheduling, PGN/branches, Glicko-2, ownership, idempotency, assistance, settings, sound fixtures, and rematch transitions.

## Still requires release evidence

| Gate | Required evidence |
| --- | --- |
| Signed-in production flow | Deploy matching backend/frontend, then verify account settings, saved games, rating nameplates, and OAuth in the actual environment |
| Physical browsers | Mid-range Android, older iPhone/Safari, integrated-GPU laptop, touch input, background/resume, low power, audio unlock and latency |
| Assistive technology | VoiceOver, TalkBack, NVDA, zoom, and actual screen-reader result/position announcements |
| Performance | Representative-device presented frames/GPU cost and sufficient field INP/LCP/CLS cohorts; lab scores do not replace these |
| Aspirational improvement | Measure the requested 60% effect-cost reduction and 2× latency/headroom targets; report misses instead of claiming success |
| Rating calibration | Human-strength validation; existing bot matches establish relative evidence only |
| Usability | A fresh reader follows the guides; new players complete review/branch tasks without coaching |

Production deployment remains a separate action under the [deployment guard](../.claude/skills/convex-deploy-guard/SKILL.md). No physical-device or field gate is marked done from a cloud screenshot.
