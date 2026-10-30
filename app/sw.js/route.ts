import { readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { ALL_STATIC_LESSONS } from "@/lib/chess/lessons/curriculum";
import { SERVICE_WORKER_SOURCE } from "@/lib/offline/serviceWorker";

// Built once per deploy: the worker carries its own version and file list.
export const dynamic = "force-static";

/** Same-origin pages that must open offline (fetched signed-out, so no private HTML is ever stored). */
const PAGES = ["/", "/climb", "/timed", "/learn", "/time-machine", "/progress", "/settings", "/settings/theme", "/play", "/friends", ...ALL_STATIC_LESSONS.map((lesson) => `/learn/${lesson.id}`)];

function publicFiles(): string[] {
  const root = join(process.cwd(), "public");
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) walk(path);
      else if (!/\.(txt|md)$/i.test(name)) files.push(`/${relative(root, path).split(sep).join("/")}`);
    }
  };
  try { walk(root); } catch { /* No public folder: pages and their scripts are still cached. */ }
  return files;
}

export function GET() {
  const version = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ?? new Date().toISOString();
  const body = SERVICE_WORKER_SOURCE
    // Replacer functions: "$&"-style patterns in file names must stay literal.
    .replace("__VERSION__", () => JSON.stringify(version))
    .replace("__PAGES__", () => JSON.stringify(PAGES))
    .replace("__FILES__", () => JSON.stringify([...publicFiles(), "/manifest.webmanifest"]));
  return new Response(body, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      // Browsers re-check the worker on every visit; it must never be stale.
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "Service-Worker-Allowed": "/",
    },
  });
}
