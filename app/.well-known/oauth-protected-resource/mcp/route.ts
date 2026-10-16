import { generateProtectedResourceMetadata, getPublicOrigin } from "mcp-handler";
import { issuer, preflight, withCors } from "@/lib/mcp/cors";

const SCOPES = ["openid", "profile", "email"];

/** RFC 9728 metadata for the /mcp resource. */
export function GET(req: Request): Response {
  const origin = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? getPublicOrigin(req);
  const metadata = generateProtectedResourceMetadata({
    authServerUrls: [issuer()],
    resourceUrl: `${origin}/mcp`,
    additionalMetadata: { scopes_supported: SCOPES, resource_name: "Chess by Chaos" },
  });
  return withCors(Response.json(metadata, { headers: { "Cache-Control": "public, max-age=3600" } }));
}

export const OPTIONS = preflight;
