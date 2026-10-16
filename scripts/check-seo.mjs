// Run against a running production build: npm run check:seo -- http://localhost:3100
import assert from "node:assert/strict";

const origin = new URL(process.argv[2] || "http://localhost:3100").origin;
const canonicalOrigin = new URL(process.env.NEXT_PUBLIC_APP_URL || "https://chess.chaos.fail").origin;
const read = async (path) => {
  const response = await fetch(new URL(path, origin), { headers: { "User-Agent": "Googlebot" }, redirect: "manual" });
  return { response, body: await response.text() };
};
const decode = (value) => value.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#x27;/g, "'");
const tag = (html, name) => [...html.matchAll(/<meta\s[^>]*>/g)].find(([match]) => match.includes(`name="${name}"`) || match.includes(`property="${name}"`))?.[0].match(/content="([^"]*)"/)?.[1];
const errors = [];
const check = async (name, fn) => { try { await fn(); console.log(`PASS ${name}`); } catch (error) { errors.push(`${name}: ${error.message}`); console.error(`FAIL ${name}: ${error.message}`); } };
let paths = [];
await check("sitemap is public, canonical, unique, and excludes personal pages", async () => {
  const { response, body } = await read("/sitemap.xml");
  assert.equal(response.status, 200);
  const urls = [...body.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => decode(match[1]));
  assert.ok(urls.length >= 30, `Expected public pages and lessons, got ${urls.length}`);
  assert.equal(new Set(urls).size, urls.length);
  for (const url of urls) {
    assert.equal(new URL(url).origin, canonicalOrigin);
    assert.doesNotMatch(new URL(url).pathname, /^\/(profile|settings|friends|u|game|progress|time-machine|bench|search)(\/|$)/);
  }
  paths = urls.map((url) => new URL(url).pathname);
});
await check("robots points to sitemap and permits public resources", async () => {
  const { response, body } = await read("/robots.txt");
  assert.equal(response.status, 200);
  assert.ok(body.includes(`${canonicalOrigin}/sitemap.xml`));
  assert.ok(body.includes("Allow: /"));
  assert.doesNotMatch(body, /Disallow: \/(engine|_next|learn|profile)/);
});
const titles = new Set();
// Keep concurrency modest for local production servers.
for (let i = 0; i < paths.length; i += 4) {
  await Promise.all(paths.slice(i, i + 4).map((path) => check(`public page ${path}`, async () => {
    const { response, body } = await read(path);
    assert.equal(response.status, 200);
    assert.doesNotMatch(response.headers.get("x-robots-tag") || "", /noindex/);
    const title = body.match(/<title>(.*?)<\/title>/)?.[1];
    assert.ok(title?.includes("Chess by Chaos"));
    assert.ok(!titles.has(title), `Duplicate title: ${title}`);
    titles.add(title);
    assert.ok((tag(body, "description") || "").length >= 40);
    const canonical = body.match(/<link[^>]*rel="canonical"[^>]*href="([^"]+)"/)?.[1];
    assert.equal(new URL(canonical).toString(), new URL(path, `${canonicalOrigin}/`).toString());
    assert.doesNotMatch(tag(body, "robots") || "", /noindex/);
    assert.equal(new URL(decode(tag(body, "og:url") || "")).toString(), new URL(canonical).toString());
    assert.ok(tag(body, "og:image"));
    assert.equal(tag(body, "twitter:card"), "summary_large_image");
    assert.match(body, /<h1[\s>]/);
    if (path.startsWith("/learn/")) assert.ok(body.includes("What you’ll practise"));
    const schemas = [...body.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)].map((match) => JSON.parse(match[1]));
    if (path === "/" || path.startsWith("/learn/")) assert.ok(schemas.length > 0);
  })));
}
for (const path of ["/profile", "/settings", "/friends", "/u", "/progress", "/time-machine", "/bench", "/play/123456", "/game/test-key", "/learn/practice", "/learn/custom/test-key", "/search?q=knight"]) {
  await check(`personal/search page excluded ${path}`, async () => {
    const { response, body } = await read(path);
    assert.equal(response.status, 200);
    assert.match(response.headers.get("x-robots-tag") || "", /noindex/);
    assert.match(response.headers.get("cache-control") || "", /private/);
    assert.match(response.headers.get("cache-control") || "", /no-store/);
    assert.match(tag(body, "robots") || "", /noindex/);
    assert.match(tag(body, "googlebot") || tag(body, "robots") || "", /noindex/);
    assert.ok(!body.includes('rel="canonical" href="https://chess.chaos.fail/learn"'));
  });
}
await check("home stays focused on play and About contains the overview", async () => {
  const home = (await read("/")).body;
  assert.ok(!home.includes("Ways to play"));
  assert.ok(!home.includes('aria-label="Site information"'));
  const about = (await read("/about")).body;
  assert.ok(about.includes("Ways to play"));
  assert.ok(about.includes('href="/sitemap.xml"'));
  assert.match(about, /<title>About/);
});
await check("content pages have article titles and a separate revision date", async () => {
  for (const [path, title] of [["/terms", "Terms of use"], ["/privacy", "Privacy policy"], ["/cookies", "Cookie and browser storage policy"], ["/about", "About Chess by Chaos"], ["/contact", "Contact us"], ["/accessibility", "Accessibility"], ["/help", "Help and frequently asked questions"], ["/licenses", "Open-source licences"]]) {
    const { body } = await read(path);
    assert.ok(body.includes(`>${title}</h1>`), path);
    assert.ok(body.includes('<time dateTime="2026-10-16">') || body.includes('<time datetime="2026-10-16">'), path);
    assert.ok(!body.includes('aria-label="Breadcrumb"'), path);
    assert.ok(!body.includes("Updated 16 October 2026."), path);
  }
});
await check("site search returns lessons, handles misses, and escapes input", async () => {
  assert.ok((await read("/search?q=knight")).body.includes("/learn/pieces-knight"));
  assert.ok((await read("/search?q=zzzznonexistent")).body.includes("Try a shorter phrase"));
  const payload = '<script>alert("seo")</script>';
  const { body } = await read(`/search?q=${encodeURIComponent(payload)}`);
  assert.ok(!body.includes(payload));
});
await check("unknown pages and lessons return a real 404", async () => {
  assert.equal((await read("/this-page-does-not-exist")).response.status, 404);
  assert.equal((await read("/learn/this-lesson-does-not-exist")).response.status, 404);
});
await check("manifest, icons, and share image are served", async () => {
  const manifest = await fetch(`${origin}/manifest.webmanifest`).then((response) => response.json());
  assert.equal(manifest.name, "Chess by Chaos");
  for (const path of ["/opengraph-image", "/favicon.ico", "/apple-touch-icon.png", ...manifest.icons.map((icon) => icon.src)]) {
    const response = await fetch(`${origin}${path}`);
    assert.equal(response.status, 200, path);
    assert.match(response.headers.get("content-type") || "", /image\//);
    assert.ok((await response.arrayBuffer()).byteLength > 0);
  }
});
await check("static asset caches and conditional revalidation work", async () => {
  for (const path of ["/engine/19.0.1/stockfish-19-lite-single.wasm", "/pieces/cburnett/wK.svg", "/sounds/standard/Move.mp3"]) {
    const response = await fetch(`${origin}${path}`, { method: "HEAD" });
    assert.equal(response.status, 200);
    const policy = response.headers.get("cache-control") || "";
    assert.match(policy, /public/);
    assert.match(policy, path.startsWith("/engine/") ? /max-age=31536000, immutable/ : /max-age=86400, stale-while-revalidate=604800/);
    const etag = response.headers.get("etag");
    assert.ok(etag, `${path} needs an ETag for conditional requests`);
    const conditional = await fetch(`${origin}${path}`, { method: "HEAD", cache: "no-cache", headers: { "If-None-Match": etag } });
    assert.equal(conditional.status, 304, `${path} should reuse unchanged content`);
  }
});
if (errors.length) { console.error(`\n${errors.length} SEO checks failed.`); process.exitCode = 1; }
else console.log(`\nSEO checks passed for ${paths.length} public URLs, personal-route exclusions, search, 404s, and assets.`);
