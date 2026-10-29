# MCP reference

MCP is remote authenticated API access to chess records and authoring. No MCP App board in chat. Game, lesson, and branch deep links open the actual chess.chaos.fail web experience.

## Security model

- HTTPS server with MCP transport and protected-resource metadata/OAuth-compatible flow accepted by ChatGPT and Claude.
- User authenticates as the owner via browser flow; use short-lived audience-scoped access tokens, PKCE where applicable, rotation and revocation.
- Tools enforce `chess.read`, `chess.write`, `lessons.write`, and `fatma.write` scopes independently; application-specific approval if an action is consequential.
- Do not expose internal Convex mutations directly without authorization wrappers.
- Explicit user permission for profile/game write operations; never assume an LLM may modify saved play.
- Per-user and per-client rate limits; audit exact params schema version, tool, actor, owner, timestamp, success/failure.
- MCP errors should be actionable: authentication required, permission denied, stale branch revision, illegal move/FEN, bad lesson definition.

## Tool catalog

| Tool | Permission | Contract |
| --- | --- | --- |
| `get_chess_profile` | chess.read | Ratings/pools, trends, Sherine status, privacy |
| `list_games` | chess.read | Pagination, mode/date/result, immutable ids |
| `get_game` | chess.read | PGN, start FEN, mode, branch metadata, move nodes (bounded/paged) |
| `get_game_analysis` | chess.read | Stored eval snapshots, mistakes, quality/depth/source |
| `get_progress` | chess.read | Separate rating/skill trends with sample size/uncertainty |
| `list_lessons` | chess.read | Fixed, adaptive and user-created playable lessons |
| `get_fatma_profile` | chess.read | Enabled, safe mood summaries, installed upgrades |
| `create_branch` | chess.write | sourceGameId + sourceNodeId + chosen engine preset + idempotency key, returns linked session |
| `queue_practice` | lessons.write | From saved mistakes/positions; adds one or more practice prompts |
| `create_lesson` | lessons.write | Validated title/steps/FEN/solutions/hints, provenance, version; opens web link |
| `propose_fatma_upgrade` | fatma.write | Draft validated dialogue/reaction pack, not installed |
| `install_fatma_upgrade` | fatma.write | Explicitly user-confirmed pack id/version; undoable/uninstallable |

Optional later: `rename_branch`, `list_game_branches`, `get_opening_summary`, `import_pgn`, `update_lesson`. Avoid 100 tools; prefer compact task-oriented surfaces and clear descriptions.

## Example structured objects

```json
{
  "create_branch": {
    "sourceGameId": "game-id",
    "sourceNodeId": "move-node-id",
    "enginePreset": "full_power_lite",
    "label": "Try 17.Nf3 instead",
    "clientOperationId": "unique-idempotency-key"
  },
  "result": {
    "sessionId": "new-game-session",
    "sourceFen": "fen-at-node",
    "url": "https://chess.chaos.fail/game/new-game-session"
  }
}
```

```json
{
  "create_lesson": {
    "title": "Sicilian Defense basics",
    "topic": "sicilian-defense",
    "source": "mcp",
    "steps": [
      {
        "fen": "valid FEN position",
        "instruction": "Find Black's principled first reply.",
        "acceptedUci": ["c7c5"],
        "hint": "Challenge the centre from the side."
      }
    ]
  }
}
```

These are illustrative payloads, **not valid runnable FENs**. Validation enforces legal moves, side to move, safe text lengths, max step count, no unsafe remote URLs/code, no arbitrary rating changes. Tools write through Convex domain services shared with the website.

## Analysis boundary

No VPS compute: a headless MCP call cannot silently run browser WASM on the user's phone. It can read saved analysis and cached results, reconstruct moves, compute deterministic descriptive chess features cheaply, or create a lesson to be validated/fully analyzed later when the browser opens. If a future remote analysis backend is explicitly approved, version it and gate it separately. Always indicate when analysis is missing or shallow rather than inventing engine scores.

## Example user flows

- "Review my last five games" -> `list_games` -> `get_game` -> `get_game_analysis`/progress -> concise feedback with game links.
- "I blundered at move 24; start another line" -> `get_game` to resolve move node -> `create_branch` -> link opens exact position on website.
- "Teach me Queen's Gambit with no reading" -> `create_lesson` -> link to playable mini-lesson.
- "Upgrade Sherine so she thanks me and has new insults" -> `propose_fatma_upgrade` -> user reviews -> `install_fatma_upgrade`; audited, reversible, bounded.

## Acceptance

Test OAuth with both ChatGPT and Claude independently; do not assume one client proves another works. Tests must assert denial for missing consent, wrong-owner game access, stale node references, bad FEN, malformed PGN, infinite chain attempts, duplicate writes, unauthorized upgrade installation, missing scope and compromised prompts.
