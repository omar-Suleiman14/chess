# Third-party notices and provenance (planning)

Chess by Chaos is licensed under the repository's existing GPL-3.0 [LICENSE](LICENSE). **No third-party engine bundle or Fatma sprite is currently committed.** This file documents the intended dependencies and the compliance work required before bundling them.

| Dependency | Purpose | Licensing/provenance action |
| --- | --- | --- |
| [Stockfish / Stockfish.js](https://github.com/nmrugg/stockfish.js) | Stockfish 19 Lite single-threaded UCI/WASM in browser Worker | GPL-3.0 for engine; pin **exact version and binaries**, checksum and provide matching source, license and acknowledgments to end users. |
| [Stockfish engine](https://github.com/official-stockfish/Stockfish) | Origin of engine | GPL-3.0 and upstream attribution; do not imply endorsement. |
| [Chaos](https://github.com/omar-Suleiman14/chaos) | Existing card and avatar UI patterns/code | Chaos is AGPL-3.0-or-later. Review compatibility and obligations of actual reused source before copying. Preserve authorship/notices and network-source obligations where they apply. |
| [Blobatar](https://www.npmjs.com/package/blobatar) | Avatar drawings and animated eyes | Verify package license and notices at pinned version before packaging. |
| Fatma sprite shared during planning | Character reference | Source/provenance/public redistribution rights **unverified**. Do not commit publicly until rights cleared. |

If packaged dependencies are added:
1. Pin versions and preserve upstream LICENSE, AUTHORS/COPYING, and exact corresponding source/offer for distributed binaries.
2. Record each third-party package and its license/version/URL in this file and generated license report.
3. Audit transitive asset/voice/sound-font/piece-art licenses and any AGPL code reuse before release.
4. Do not remove required notices from copied components.

This document is a planning compliance checklist, not legal advice or a completed audit. See [P01](https://github.com/omar-Suleiman14/chess/issues/2).
