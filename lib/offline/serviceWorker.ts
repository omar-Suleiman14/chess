/**
 * Offline service worker (served from /sw.js by app/sw.js/route.ts, which
 * fills in the version, pages and files at build time).
 *
 * - Pages are precached signed-out (credentials omitted), so no account HTML,
 *   tokens or private data are ever stored. Online, navigation always uses
 *   the network; the cached copy is the offline fallback.
 * - Every public file (Stockfish, pieces, sprites, sounds, icons) and every
 *   script/style a precached page references is cached, so a cold launch in
 *   Airplane Mode can play, hint, analyse, review and learn.
 * - Never cached: API, MCP, auth, RSC payloads, other origins.
 * - "Offline ready" is only reported after every mandatory file is stored.
 * - An update installs alongside the working version and waits; the app
 *   activates it only when asked (never in the middle of a game).
 */
export const SERVICE_WORKER_SOURCE = String.raw`
const VERSION = __VERSION__;
const PAGES = __PAGES__;
const FILES = __FILES__;
const SHELL = "cbc-shell-" + VERSION;
const ASSETS = "cbc-assets-" + VERSION;
const RUNTIME = "cbc-runtime";
const READY = "/__offline_ready";
const NETWORK_ONLY = /^\/(api|mcp|trpc|sw\.js|__clerk|\.well-known|_next\/image|bench)(\/|$)/;
let progress = { done: 0, total: PAGES.length + FILES.length, error: null };

function broadcast(message) {
  self.clients.matchAll({ includeUncontrolled: true }).then((clients) => clients.forEach((client) => client.postMessage(message)));
}

function assetsIn(html) {
  const found = new Set();
  for (const match of html.matchAll(/\/_next\/static\/[^"'\s\\)<>]+/g)) found.add(match[0]);
  // App Router flight data names lazily loaded chunks without the leading slash.
  for (const match of html.matchAll(/(?:^|["'\s(])(static\/(?:chunks|css|media)\/[^"'\s\\)<>]+)/g)) found.add("/_next/" + match[1]);
  return [...found];
}

async function fetchOk(url, init) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(url, init);
      if (response.ok) return response;
    } catch (error) { /* Retry below. */ }
    await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
  }
  throw new Error("Could not download " + url);
}

async function precache() {
  const shell = await caches.open(SHELL);
  const assets = await caches.open(ASSETS);
  const runtime = await caches.open(RUNTIME);
  const discovered = new Set();
  progress = { done: 0, total: PAGES.length + FILES.length, error: null };
  for (const page of PAGES) {
    const response = await fetchOk(page, { credentials: "omit", cache: "no-store", redirect: "follow" });
    const html = await response.text();
    for (const asset of assetsIn(html)) if (!FILES.includes(asset)) discovered.add(asset);
    // Store a plain (non-redirected) copy: browsers refuse redirected responses for navigations.
    await shell.put(page, new Response(html, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } }));
    progress.done++;
    progress.total = PAGES.length + FILES.length + discovered.size;
    broadcast({ type: "offline-progress", done: progress.done, total: progress.total });
  }
  const files = [...FILES, ...discovered];
  for (let index = 0; index < files.length; index += 6) {
    await Promise.all(files.slice(index, index + 6).map(async (file) => {
      // Hashed Next.js files never change: reuse them across versions.
      const immutable = file.startsWith("/_next/static/");
      const cache = immutable ? runtime : assets;
      if (!(await cache.match(file))) await cache.put(file, await fetchOk(file, { credentials: "omit" }));
      progress.done++;
    }));
    broadcast({ type: "offline-progress", done: progress.done, total: progress.total });
  }
  await assets.put(READY, new Response(JSON.stringify({ version: VERSION, at: Date.now(), files: progress.total }), { headers: { "Content-Type": "application/json" } }));
  broadcast({ type: "offline-ready", version: VERSION });
}

self.addEventListener("install", (event) => {
  event.waitUntil(precache().catch((error) => {
    progress.error = String(error && error.message || error);
    broadcast({ type: "offline-error", message: progress.error });
    // Fail the install: a half-downloaded version must never take over.
    throw error;
  }));
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) {
      if ((name.startsWith("cbc-shell-") && name !== SHELL) || (name.startsWith("cbc-assets-") && name !== ASSETS)) await caches.delete(name);
    }
    // First install: take over open pages so they work offline without a reload.
    await self.clients.claim();
  })());
});

self.addEventListener("message", (event) => {
  const data = event.data || {};
  const reply = (message) => (event.ports && event.ports[0] ? event.ports[0].postMessage(message) : event.source && event.source.postMessage(message));
  if (data.type === "offline-status") {
    caches.open(ASSETS).then((cache) => cache.match(READY)).then((ready) => reply({ type: "offline-status", version: VERSION, ready: !!ready, done: progress.done, total: progress.total, error: progress.error }));
  } else if (data.type === "skip-waiting") {
    self.skipWaiting();
  }
});

async function fromCaches(request) {
  return (await caches.match(request, { ignoreSearch: false })) || null;
}

async function navigation(request) {
  const url = new URL(request.url);
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    const response = await fetch(request, { signal: controller.signal });
    clearTimeout(timer);
    return response;
  } catch (error) {
    const shell = await caches.open(SHELL);
    const path = url.pathname.replace(/\/$/, "") || "/";
    return (await shell.match(path)) || (await shell.match("/")) || new Response("<!doctype html><meta name=viewport content='width=device-width'><title>Offline</title><body style='font-family:system-ui;padding:24px'><h1>Offline</h1><p>Open Chess by Chaos once with internet to get it ready for offline play.</p>", { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } });
  }
}

async function cacheFirst(request, cacheName) {
  const hit = await fromCaches(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(cacheName);
    await cache.put(request, response.clone());
  }
  return response;
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || NETWORK_ONLY.test(url.pathname)) return;
  if (request.mode === "navigate") { event.respondWith(navigation(request)); return; }
  // Route data (RSC) is never cached; if it fails, Next.js falls back to a full navigation, which the shell serves.
  if (request.headers.get("RSC") || url.searchParams.has("_rsc")) return;
  if (url.pathname.startsWith("/_next/static/")) { event.respondWith(cacheFirst(request, RUNTIME)); return; }
  if (FILES.includes(url.pathname)) event.respondWith(cacheFirst(request, ASSETS));
});
`;
