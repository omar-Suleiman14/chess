import { clerkMiddleware } from "@clerk/nextjs/server";

// Every page is usable signed out (local play). Data routes are protected by
// Convex auth; the MCP endpoint verifies OAuth tokens itself.
export default clerkMiddleware();

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|engine/|fatma/|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest|wasm)).*)",
    // Always run for API routes
    "/(api|trpc|mcp)(.*)",
  ],
};
