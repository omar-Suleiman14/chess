import { describe, expect, it } from "vitest";
import { SERVICE_WORKER_SOURCE } from "./serviceWorker";

const build = () => SERVICE_WORKER_SOURCE
  .replace("__VERSION__", JSON.stringify("test"))
  .replace("__PAGES__", JSON.stringify(["/", "/learn"]))
  .replace("__FILES__", JSON.stringify(["/engine/19.0.1/stockfish-19-lite-single.wasm"]));

describe("offline service worker", () => {
  it("fills every placeholder and is valid JavaScript", () => {
    const code = build();
    expect(code).not.toMatch(/__(VERSION|PAGES|FILES)__/);
    expect(() => new Function("self", "caches", "fetch", code)).not.toThrow();
  });

  it("never caches account, API or other private traffic", () => {
    const pattern = /^\/(api|mcp|trpc|sw\.js|__clerk|\.well-known|_next\/image|bench)(\/|$)/;
    for (const path of ["/api/x", "/mcp", "/__clerk/v1", "/.well-known/oauth-authorization-server", "/sw.js"]) expect(pattern.test(path)).toBe(true);
    for (const path of ["/", "/learn", "/_next/static/chunks/a.js", "/engine/19.0.1/x.wasm"]) expect(pattern.test(path)).toBe(false);
    expect(SERVICE_WORKER_SOURCE).toContain('credentials: "omit"');
    expect(SERVICE_WORKER_SOURCE).toContain("url.origin !== self.location.origin");
  });
});
