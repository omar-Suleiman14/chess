import type { Metadata } from "next";

export const SITE_NAME = "Chess by Chaos";
export const SITE_DESCRIPTION = "Play free chess against Stockfish in your browser, challenge a friend, learn chess with interactive lessons, and review your games.";
export const CONTACT_EMAIL = "support@wareed.io";
export const REPOSITORY = "https://github.com/omar-Suleiman14/chess";

function siteOrigin(): string {
  const url = new URL(process.env.NEXT_PUBLIC_APP_URL || "https://chess.chaos.fail");
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) {
    throw new Error("NEXT_PUBLIC_APP_URL must be a public HTTP(S) origin");
  }
  return url.origin;
}

export const SITE_URL = siteOrigin();
// Vercel previews must not compete with the production site in search.
export const INDEXABLE = process.env.VERCEL_ENV !== "preview" && process.env.SEO_NOINDEX !== "true";
export const absoluteUrl = (path: string) => new URL(path, `${SITE_URL}/`).toString();

export function pageMetadata(title: string, description: string, path: string, index = true): Metadata {
  return {
    title: { absolute: `${title} · ${SITE_NAME}` },
    description,
    alternates: { canonical: absoluteUrl(path) },
    robots: { index: index && INDEXABLE, follow: true },
    openGraph: { type: "website", siteName: SITE_NAME, locale: "en_US", title: `${title} · ${SITE_NAME}`, description, url: absoluteUrl(path), images: [{ url: absoluteUrl("/opengraph-image"), width: 1200, height: 630, alt: "Chess by Chaos — play, learn, replay" }] },
    twitter: { card: "summary_large_image", title: `${title} · ${SITE_NAME}`, description, images: [absoluteUrl("/opengraph-image")] },
  };
}

export const PUBLIC_PAGES = [
  { path: "/", title: "Play", description: SITE_DESCRIPTION },
  { path: "/climb", title: "The Climb", description: "Build confidence with an 11-level chess bot ladder, from beginner opponents to full-power Stockfish. Undo, learn, and track your progress." },
  { path: "/timed", title: "Timed", description: "Practise chess with 3+2, 5+3, 10+5, and 15+10 clocks against browser-based chess bots. Choose your opponent and colour." },
  { path: "/play", title: "Play a friend", description: "Create a chess room and invite a friend with a link, QR code, or PIN. Play a live game together in your browsers." },
  { path: "/learn", title: "Learn", description: "Learn how chess pieces move, castling, checkmate, forks, pins, endgames, and popular openings through short interactive chess lessons." },
  { path: "/about", title: "About", description: "Meet Chess by Chaos, a free, open-source chess gym with local Stockfish, interactive lessons, game review, and optional AI coaching." },
  { path: "/help", title: "Help", description: "Get help with chess games, ratings, lessons, game analysis, PGN files, account sync, and optional AI coaches." },
  { path: "/contact", title: "Contact", description: "Contact Chess by Chaos for support, privacy requests, bug reports, accessibility feedback, or security concerns." },
  { path: "/privacy", title: "Privacy", description: "How Chess by Chaos handles local games, synced account data, public profiles, cookies, and optional AI-coach access." },
  { path: "/terms", title: "Terms", description: "Terms for using Chess by Chaos, including fair play, public content, AI integrations, and open-source licensing." },
  { path: "/cookies", title: "Cookies", description: "Understand the cookies, local storage, and IndexedDB used for sign-in, chess games, preferences, and online rooms." },
  { path: "/accessibility", title: "Accessibility", description: "Accessibility features, known limitations, and ways to report barriers in Chess by Chaos." },
  { path: "/licenses", title: "Licences", description: "Open-source licences and corresponding source for Chess by Chaos, Stockfish 19 Lite, chess pieces, sounds, and dependencies." },
] as const;
