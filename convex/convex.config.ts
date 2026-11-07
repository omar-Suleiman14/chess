import { defineApp } from "convex/server";
import { v } from "convex/values";
import rateLimiter from "@convex-dev/rate-limiter/convex.config";

const app = defineApp({
  env: {
    CLERK_JWT_ISSUER_DOMAIN: v.string(),
    // Shared secret between the Next.js MCP route and Convex. Without it the
    // MCP service functions refuse every call.
    MCP_SERVICE_SECRET: v.optional(v.string()),
    // Web Push (challenge and friend-request notifications). Without both keys
    // pushes are skipped; in-app banners still work.
    VAPID_PUBLIC_KEY: v.optional(v.string()),
    VAPID_PRIVATE_KEY: v.optional(v.string()),
    VAPID_SUBJECT: v.optional(v.string()),
  },
});
app.use(rateLimiter);

export default app;
