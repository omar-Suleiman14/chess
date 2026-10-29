import type { NextConfig } from "next";

/** Clerk Frontend API host, decoded from the publishable key (pk_<env>_<base64(host$)>). */
function clerkHost(): string | null {
  const key = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  if (!key) return null;
  try {
    const decoded = Buffer.from(key.split("_").slice(2).join("_"), "base64").toString("utf8");
    return decoded.replace(/\$$/, "") || null;
  } catch {
    return null;
  }
}

function contentSecurityPolicy(): string {
  const clerk = clerkHost();
  // Permit exactly the configured backend, including explicit local QA/dev URLs.
  // No wildcard localhost allowance is added to hosted production builds.
  const configuredConvex = process.env.NEXT_PUBLIC_CONVEX_URL;
  const convexOrigin = configuredConvex ? new URL(configuredConvex).origin : "";
  const convexSources = convexOrigin ? `${convexOrigin} ${convexOrigin.replace(/^http/, "ws")}` : "";
  const clerkSrc = clerk ? `https://${clerk}` : "https://*.clerk.accounts.dev";
  return [
    "default-src 'self'",
    // Next.js inline bootstrap scripts; WebAssembly for Stockfish.
    `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' ${clerkSrc} https://*.protect.clerk.com https://challenges.cloudflare.com`,
    "worker-src 'self' blob:",
    `connect-src 'self' https://*.convex.cloud wss://*.convex.cloud ${convexSources} ${clerkSrc} https://*.protect.clerk.com:* https://clerk-telemetry.com`,
    "img-src 'self' data: blob: https://img.clerk.com",
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self' data:",
    `frame-src ${clerkSrc} https://challenges.cloudflare.com`,
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
  ].join("; ");
}

const nextConfig: NextConfig = {
  // The dev badge sits over the bottom-left game controls.
  devIndicators: false,
  // The build script runs TypeScript 7 before Next.js. Next still needs the
  // older TypeScript compiler API for configuration and editor tooling.
  typescript: {
    ignoreBuildErrors: true,
  },
  async headers() {
    const security = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
    ];
    if (process.env.NODE_ENV === "production") {
      security.push({ key: "Content-Security-Policy", value: contentSecurityPolicy() });
      security.push({ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" });
    }
    return [
      { source: "/:path*", headers: security },
      ...["/profile/:path*", "/settings/:path*", "/friends/:path*", "/u/:path*", "/progress/:path*", "/game/:path*", "/time-machine/:path*", "/bench/:path*", "/play/:code", "/learn/custom/:path*", "/learn/practice/:path*", "/search", "/mcp/:path*", "/api/:path*"].map((source) => ({ source, headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] })),
      ...(process.env.VERCEL_ENV === "preview" || process.env.SEO_NOINDEX === "true" ? [{ source: "/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] }] : []),
      {
        // Engine files live under a version directory, so they can be cached forever.
        source: "/engine/:version/:file*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
          { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
        ],
      },
      { source: "/fatma/:file*", headers: [{ key: "Cache-Control", value: "public, max-age=604800" }] },
      ...["/pieces/:path*", "/sounds/:path*"].map((source) => ({ source, headers: [{ key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" }] })),
    ];
  },
};

export default nextConfig;
