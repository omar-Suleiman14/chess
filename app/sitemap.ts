import type { MetadataRoute } from "next";
import { ALL_STATIC_LESSONS } from "@/lib/chess/lessons/curriculum";
import { absoluteUrl, INDEXABLE, PUBLIC_PAGES } from "@/lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  if (!INDEXABLE) return [];
  // Only public canonical content. Never publish account, game, invite or custom-lesson URLs.
  return [...PUBLIC_PAGES.map(({ path }) => ({ url: absoluteUrl(path) })), ...ALL_STATIC_LESSONS.map(({ id }) => ({ url: absoluteUrl(`/learn/${id}`) }))];
}
