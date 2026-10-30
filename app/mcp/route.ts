// Remote MCP endpoint (Streamable HTTP) for ChatGPT and Claude on web,
// desktop and mobile. OAuth 2.1 via Clerk (dynamic client registration +
// PKCE handled by Clerk); this route only accepts Clerk OAuth access tokens.
import { auth } from "@clerk/nextjs/server";
import { createMcpHandler, getPublicOrigin, withMcpAuth } from "mcp-handler";
import { registerTools } from "@/lib/mcp/tools";
import { preflight, withCors } from "@/lib/mcp/cors";

export const runtime = "nodejs";
export const maxDuration = 60;

async function verifyToken(_req: Request, bearerToken?: string) {
  if (!bearerToken) return undefined;
  const result = await auth({ acceptsToken: "oauth_token" });
  if (!result.isAuthenticated || !result.userId) return undefined;
  return {
    token: bearerToken,
    clientId: result.clientId ?? "unknown",
    scopes: result.scopes ?? [],
    extra: { userId: result.userId },
  };
}

async function handle(req: Request): Promise<Response> {
  const origin = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? getPublicOrigin(req);
  const handler = createMcpHandler((server) => registerTools(server, { origin }), {
    serverInfo: { name: "chess-by-chaos", version: "1.0.0" },
    instructions:
      "Chess by Chaos: the player's own chess games and lessons, and two characters: Maya, the strongest bot (Stockfish 19 Lite at full strength, " +
      "calm and exact), and Sherine, the friendly companion who plays the weaker levels. Use get_bots for the line-up. You are a coach, not a chessboard: " +
      "link the player to the website for play. Never invent engine evaluations; use saved analysis or say it is missing. " +
      "Maya's 3000 is a nominal label, not a measured Elo. Write tools require the player's in-app permission.",
  });
  const authed = withMcpAuth(handler, verifyToken, {
    required: true,
    resourceMetadataPath: "/.well-known/oauth-protected-resource/mcp",
  });
  return withCors(await authed(req));
}

export { handle as GET, handle as POST, handle as DELETE };
export const OPTIONS = preflight;
