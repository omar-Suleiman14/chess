# Gameplay sound provenance

Updated 2026-10-29. Current source: `lib/experience/audio.ts`; dispatch: `lib/client/sound.ts`; exact event/pack catalog: `lib/experience/config.ts`.

| Asset family | Creator and source | Licence | Attribution and permitted use | Rights evidence |
| --- | --- | --- | --- | --- |
| Classic Chess and Traditional Digital Chess | Original synthesis authored for this repository | GPL-3.0 | Redistribution/commercial use under GPL terms; retain repository licence/source notices | Complete oscillator/envelope/noise source in this repository; no sampled input |
| Piano, Electric Piano, Marimba, Xylophone, Celesta, Kalimba, Harp, Acoustic Guitar, Plucked Strings, Bells, Soft Percussion, Analog Synth | Original instrument-inspired synthesis authored for this repository | GPL-3.0 | Same repository terms; these are short timbres, not recordings of instruments or songs | Deterministic synthesis coefficients and envelopes in `audio.ts` |
| Wooden Board, Soft Mechanical, Ceramic, Clockwork, Minimal Click, Modern Digital, Arcade | Original synthesis authored for this repository | GPL-3.0 | Same repository terms | Deterministic harmonic/noise/transient synthesis, no external assets |
| Silent | Zero-valued generated PCM; playback omitted | Repository terms | No additional attribution | Source and cross-pack fixtures |
| Legacy result MP3s | Kenney Interface Sounds | CC0-1.0 | Commercial/redistribution allowed, attribution optional; retained credit | `public/sounds/results/LICENSE.txt`, sources in THIRD_PARTY_NOTICES.md |
| Removed Lichess standard MP3s | Historical upstream files, removed from current builds | Upstream non-free exceptions; no new rights asserted | Not distributed by the current build | Provenance retained in Git history and THIRD_PARTY_NOTICES.md |

The user-provided Chess.com forum sound index and ZIP are event-coverage/design references only. No file was downloaded, sampled, hotlinked, copied or bundled. No permission to redistribute those sounds has been obtained or claimed. “Traditional Digital Chess” is an original profile with no Chess.com branding.

Every pack maps every typed event. Checkmate/stalemate/repetition/insufficient-material take precedence over move/capture and generic result cues. Normal moves distinguish the local and remote player. Premoves sound on queue and committed execution. Online sounds wait for the server mutation acknowledgement; keyed dispatch prevents repeat result cues. Manual review uses a quiet selection tick, independent of reduced motion. Browser unlock uses user gestures; hidden tabs drop cues; no loops or ongoing audio exist.

Buffers are generated once and cached, with a 128-buffer bound and six-voice cap. Clips last at most 320 ms, normalized below 0.34 PCM peak before channel/master gain. Unit fixtures cover all 22 × 26 combinations, finite PCM, bounded duration/peak, determinism, and distinct timbres. Physical iOS latency and subjective listening remain release checks; synthetic voicing does not claim sampled-instrument realism.
