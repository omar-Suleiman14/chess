# Fix common problems

| Symptom | Check and next step |
| --- | --- |
| Convex reports a missing Clerk issuer | Confirm the selected deployment. Set its `CLERK_JWT_ISSUER_DOMAIN`, then retry the development push. |
| Local online game stays on Connecting | Check `NEXT_PUBLIC_CONVEX_URL`, backend availability, and browser CSP errors. The CSP permits the configured backend origin. |
| Sherine does not reply | Read the engine status. Retry the worker, allow its versioned WASM download, or reload after connectivity returns. Local game history remains in IndexedDB. |
| Hint stays unavailable | Wait for a current depth-10 search. A stale, illegal, missing, or shallow result cannot reveal a move. Retry after moving or reconnecting. |
| Hint confirmation cannot save | Keep the game rated and retry online. Signed-in synced assistance requires acknowledgement before advice appears. |
| No sound | Check master mute, the event category, pack, and volumes. Tap once to unlock browser audio. Hidden tabs drop stale cues. |
| Glass appears opaque | Check Minimal Effects, high contrast, reduced transparency, and browser support. Opaque fallback preserves legibility. |
| A setting does not sync | Read its device/account label. Deploy the matching backend before expecting new experience fields to sync. |
| PGN fails | Use the parser's move/error message. Correct the illegal SAN or starting FEN and import again. |
| A game is missing | Check the same browser's local storage or sign in to the owning account. Private mode and cleared storage can remove device-only games. |

For a reproducible bug, record the route, browser, viewport, theme, game mode, and shortest action sequence. Share a PGN if useful. Never include seat tokens, Clerk secrets, or deployment keys.
