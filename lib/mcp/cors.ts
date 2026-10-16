// CORS for the MCP endpoint and OAuth metadata. Browser-based MCP clients
// (web apps) need these; server-side clients (ChatGPT, Claude) ignore them.
export const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, Mcp-Session-Id, Mcp-Protocol-Version, Last-Event-ID",
  "Access-Control-Expose-Headers": "Mcp-Session-Id, WWW-Authenticate",
  "Access-Control-Max-Age": "86400",
};

export function withCors(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [k, v] of Object.entries(CORS_HEADERS)) headers.set(k, v);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

export function preflight(): Response {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

/** Clerk's Frontend API origin is the OAuth authorization server. */
export function issuer(): string {
  const value = process.env.CLERK_ISSUER_URL ?? process.env.CLERK_JWT_ISSUER_DOMAIN;
  if (!value) throw new Error("Set CLERK_JWT_ISSUER_DOMAIN (your Clerk Frontend API URL).");
  return value.replace(/\/$/, "");
}
