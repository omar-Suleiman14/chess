# Security policy

**Status:** planning stage; no deployed app yet.

For sensitive reports, please avoid posting exploit details, credentials, or private chess data in a public issue. Use GitHub's private security advisory reporting if enabled for this repository; otherwise contact the repository owner through a private channel listed on their GitHub profile. Never share tokens in issue comments.

Security expectations before launch:

- Clerk login with verified Convex auth and strict per-user owner checks.
- OAuth-protected MCP tool endpoints with least-privilege scopes, revocation, rate limits, idempotency and audit logs.
- Disallow mutations that arbitrarily set rating, completed rated result, user ownership or raw evaluation cache authority.
- Validate PGN/FEN and lesson solution data with library/game rules; bound input lengths and complexity.
- Treat MCP-supplied text and Fatma dialogue packs as untrusted content; never execute arbitrary HTML/JS.
- Ensure secrets are server-side, not bundled into browser assets or recorded in telemetry.
- Security and license audit must pass prior to public deployment.
