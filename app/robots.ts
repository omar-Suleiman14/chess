import type { MetadataRoute } from "next";
import { absoluteUrl, INDEXABLE } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: INDEXABLE ? { userAgent: "*", allow: "/", disallow: ["/mcp", "/api/"] } : { userAgent: "*", disallow: "/" },
    ...(INDEXABLE ? { sitemap: absoluteUrl("/sitemap.xml") } : {}),
  };
}
