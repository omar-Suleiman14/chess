import type { MetadataRoute } from "next";
import { SITE_DESCRIPTION, SITE_NAME } from "@/lib/seo";

export default function manifest(): MetadataRoute.Manifest {
  return { name: SITE_NAME, short_name: "Chaos Chess", description: SITE_DESCRIPTION, id: "/", start_url: "/", scope: "/", lang: "en", display: "standalone", background_color: "#f6f4ef", theme_color: "#1d1c1a", icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }, { src: "/icon-192.png", sizes: "192x192", type: "image/png" }, { src: "/icon-512.png", sizes: "512x512", type: "image/png" }], shortcuts: [{ name: "Learn chess", url: "/learn" }, { name: "Play a friend", url: "/play" }] };
}
