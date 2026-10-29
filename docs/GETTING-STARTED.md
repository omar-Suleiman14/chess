# Run Chess locally

1. Install Node.js 24 and enable Corepack. Run `corepack pnpm install` in the repository.
2. Copy `.env.example` to `.env.local`. Add your Clerk publishable key, Clerk secret key, and Convex browser URLs.
3. Run `corepack pnpm exec convex dev`. Select a development deployment, not production. The CLI writes `CONVEX_DEPLOYMENT`.
4. Set `CLERK_JWT_ISSUER_DOMAIN` on that development deployment to your Clerk issuer URL. Configure Clerk's Convex JWT integration for this app.
5. Run `corepack pnpm dev`. Open `http://localhost:3000` and move e2 to e4. Sherine should reply after the worker is ready.
6. Sign in, finish a game, and reload. Confirm the saved game remains available in Time Machine.

For local guest-only QA, `corepack pnpm test:experience` uses public browser configuration and a temporary signed-out middleware fixture. It does not test account sign-in. It restores `proxy.ts` even when tests fail; do not deploy that QA build.

## Optional MCP setup

Normal chess does not need an external AI account. For an existing MCP integration, set `MCP_SERVICE_SECRET` in both Next.js and the matching Convex deployment. Follow the [MCP reference](MCP.md) for scopes, ownership, OAuth, and revocation.

## If setup fails

Check [Troubleshooting](TROUBLESHOOTING.md). A missing issuer error belongs to the selected Convex deployment; adding a variable only to Next.js does not configure Convex.
