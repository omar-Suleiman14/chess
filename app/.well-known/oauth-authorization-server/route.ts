import { issuer, preflight, withCors } from "@/lib/mcp/cors";

/**
 * Mirrors Clerk's authorization-server metadata for MCP clients that use the
 * older discovery flow (looking on the resource origin instead of following
 * the protected-resource metadata).
 */
export async function GET(): Promise<Response> {
  const upstream = await fetch(`${issuer()}/.well-known/oauth-authorization-server`, { next: { revalidate: 3600 } });
  if (!upstream.ok) return withCors(new Response("Authorization server metadata unavailable", { status: 502 }));
  return withCors(Response.json(await upstream.json(), { headers: { "Cache-Control": "public, max-age=3600" } }));
}

export const OPTIONS = preflight;
