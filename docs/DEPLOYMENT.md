# Deploy a reviewed change

1. Run lint, type checking, unit/backend tests, the production build, and the relevant browser suite. Read [release status](ROADMAP.md).
2. Inspect `.env.local`, the selected Convex deployment, and whether a deploy key is present. Announce the exact target before any deployment-affecting command.
3. For a preview or development deployment, configure variables from `.env.example` for that environment. Keep Clerk and Convex resources matched.
4. For production Convex changes, obtain fresh approval naming the target and action. The repository's [deployment guard](../.claude/skills/convex-deploy-guard/SKILL.md) requires this per action.
5. Configure Vercel to build the reviewed revision. The existing integrated build uses `npx convex deploy --cmd 'pnpm build'` with the matching deploy key.
6. Verify the deployed browser → API → saved state flow. Confirm old games load, new preferences save, and rematches work on the deployed backend.

Never deploy the guest QA artifact made by `scripts/qa-server.mjs`. Run a normal build with the real `proxy.ts`. Public configuration belongs in `NEXT_PUBLIC_*`; Clerk secrets and Convex deploy keys do not.

The new backend fields are optional for existing documents. An older backend keeps experience preferences device-only. Deploy matching backend functions before relying on new rematch responses or rating nameplates.
