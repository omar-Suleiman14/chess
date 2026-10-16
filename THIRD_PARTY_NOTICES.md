# Third-party notices and provenance

Chess by Chaos is licensed under the repository's GPL-3.0 [LICENSE](LICENSE). This file lists what is bundled or redistributed, under which terms, and what is still open. It is a compliance record, not legal advice. Tracking issue: [P01 #2](https://github.com/omar-Suleiman14/chess/issues/2).

## Bundled engine: Stockfish 19 (Lite, single-threaded WebAssembly)

| Item | Value |
| --- | --- |
| Package | [`stockfish@19.0.1`](https://www.npmjs.com/package/stockfish) (Stockfish.js by Nathan Rugg), GPL-3.0 |
| Upstream engine | [official-stockfish/Stockfish](https://github.com/official-stockfish/Stockfish), tag `sf_19`, GPL-3.0 |
| Distributed files | `public/engine/19.0.1/stockfish-19-lite-single.js`, `public/engine/19.0.1/stockfish-19-lite-single.wasm` |
| SHA-256 (`.js`) | `ccb130d7ff29408531c47d859a49f91d59d4f482d05a53eb1a3231a4f624c91a` |
| SHA-256 (`.wasm`) | `ee4f115bdb2d32cadf96cada104a05b5ec257d7ad6f57582190b49bc71f096de` |
| Licence text shipped | `public/engine/19.0.1/COPYING.txt` (from the npm package), served at `/engine/19.0.1/COPYING.txt` |
| Corresponding source | [nmrugg/stockfish.js @ v19.0.1](https://github.com/nmrugg/stockfish.js/tree/v19.0.1) (build scripts and Emscripten glue) and [Stockfish @ sf_19](https://github.com/official-stockfish/Stockfish/tree/sf_19) (engine). The files are byte-identical to the npm tarball; `.gitattributes` keeps them binary-exact. |
| Modifications | None. |

The in-app [/licenses](app/licenses/page.tsx) page links to the licence and source. Chess by Chaos is not an official Stockfish project. The full 94 MB engine is **not** used.

## npm dependencies (runtime)

| Package | Licence | Use |
| --- | --- | --- |
| chess.js 1.4.0 | BSD-2-Clause | Rules, FEN, SAN, PGN (browser and Convex) |
| blobatar 2.7.0 | MIT | Chess profile avatars |
| motion 14.3.0 | MIT | Springs and gestures |
| mcp-handler 2.3.0 | Apache-2.0 | MCP route adapter |
| @modelcontextprotocol/server 2.3.1 | MIT | MCP server |
| @convex-dev/rate-limiter 0.4.2 | Apache-2.0 | Per-player MCP rate limits |
| zod 4.6.7 | MIT | MCP and upgrade-pack schemas |
| idb 8.0.4 | ISC | IndexedDB offline storage |
| qrcode 1.5.4 | MIT | QR code on the card back |
| next, react, react-dom | MIT | App framework |
| convex | Apache-2.0 | Backend client |
| @clerk/nextjs | MIT | Authentication |

## Piece sets (from lichess-org/lila `public/piece/`)

| Folder | Set | Author | Licence |
| --- | --- | --- | --- |
| `public/pieces/cburnett` | Classic (default) | Colin M.L. Burnett | GPL-2.0-or-later |
| `public/pieces/merida` | Merida | Armando Hernandez Marroquin | GPL-2.0-or-later |
| `public/pieces/chessnut` | Chessnut | Alexis Luengas | Apache-2.0 |
| `public/pieces/mpchess` | MP Chess | Maxime Chupin | GPL-3.0-or-later |
| `public/pieces/fantasy` | Fantasy | Maurizio Monge | MIT |

Licences as listed in [lila's COPYING.md](https://github.com/lichess-org/lila/blob/master/COPYING.md). Files are unmodified.

## Sounds

### Result chimes (CC0)

`public/sounds/results/` contains three short cues from **Kenney Interface Sounds 1.0**, [official source and download](https://kenney.nl/assets/interface-sounds), **CC0 1.0**. The original licence is shipped as `public/sounds/results/LICENSE.txt`.

- `Victory.mp3`: `Audio/confirmation_001.ogg`, a short rising chime (0.29 seconds).
- `Defeat.mp3`: `Audio/question_002.ogg`, a short falling chime (0.33 seconds).
- `Draw.mp3`: `Audio/bong_001.ogg`, a single neutral tone (0.12 seconds).

Source archive: [kenney_interface-sounds.zip](https://kenney.nl/media/pages/assets/interface-sounds/fa43c1dd4d-1677589452/kenney_interface-sounds.zip). Converted from Ogg Vorbis to MP3 using FFmpeg/libmp3lame (`-q:a 3`) for browser compatibility; no cropping or pitch changes. Playback volume is reduced in the app. The existing move, capture and utility sounds are unchanged.

### Existing Lichess Standard recordings

`public/sounds/standard/*.mp3` (Move, Capture, GenericNotify, Select, Confirmation, Error, LowTime) were previously copied from [lichess-org/lila](https://github.com/lichess-org/lila/tree/master/public/sound/standard). Upstream [COPYING.md](https://github.com/lichess-org/lila/blob/master/COPYING.md) lists the other sounds in `public/sound` as **non-free exceptions**. The previous claim that these Standard assets were AGPL-3.0-or-later was incorrect. These existing recordings are retained unchanged; this update adds only CC0 result cues.

## Liquid Glass technique (kube.io)

`lib/client/liquidGlass.ts` and the filter chain in `components/ui/Glass.tsx` implement the refraction technique described in Chris Kube's article [Liquid Glass in the Browser: Refraction with CSS and SVG](https://kube.io/blog/liquid-glass-css-svg/) (source: [kube/kube.io](https://github.com/kube/kube.io)). The physics (Snell's law, displacement maps) is standard; the surface profiles, map layout and SVG filter order follow the article's published code, credited here and in the source. The repository owner has reviewed the article and repository, considers them openly published for reuse, and accepted this adaptation on 2026-10-16. Note for future audits: as of that date the kube.io repository carried no licence file.

## Original assets (GPL-3.0, this repository)

- **Board palettes, icon and UI.**

## Sherine sprite

- Files: `public/fatma/fatma-atlas.png` and `public/fatma/atlas.json`, generated by `scripts/slice-fatma.mjs` from the sheet the repository owner supplied on 2026-10-16.
- Provenance: original artwork drawn by the repository owner ([@omar-Suleiman14](https://github.com/omar-Suleiman14)), confirmed by the owner on 2026-10-16.
- Licence: distributed with this repository under GPL-3.0, like the other original assets. The app only references the atlas through `components/fatma/FatmaSprite.tsx`.

## Chaos (AGPL-3.0-or-later) audit result

**No source code from [Chaos](https://github.com/omar-Suleiman14/chaos) was copied.** The Chess card (`components/profile/ChessCard.tsx`) is an independent implementation inspired by Chaos member cards, so no AGPL obligations arise. If Chaos components are copied later, they must keep their AGPL notices and network-source obligations, and be listed here.
