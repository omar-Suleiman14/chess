// Standalone cloud engine for a VM or VPS (Oracle Always Free, a spare VPS…).
// Same engine service as /api/engine, behind a tiny HTTP server.
//   POST /api/engine   one search (JSON in, JSON out)
//   GET  /health       "ok"
import { createServer } from "node:http";
import { EngineService, configFromEnv } from "../lib/engine/service";

const port = Number.parseInt(process.env.PORT ?? "8080", 10);
const allowed = new Set((process.env.ENGINE_ALLOWED_ORIGINS ?? "https://chess.chaos.fail").split(",").map((origin) => origin.trim()).filter(Boolean));
const config = configFromEnv();
const service = new EngineService(config);
const MAX_BODY = 4_096;

const server = createServer((req, res) => {
  const origin = req.headers.origin ?? "";
  const cors: Record<string, string> = allowed.has(origin)
    ? { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Max-Age": "86400", Vary: "Origin" }
    : {};
  const send = (status: number, body: unknown, headers: Record<string, string> = {}) => {
    res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store", ...cors, ...headers });
    res.end(JSON.stringify(body));
  };
  if (req.method === "GET" && req.url === "/health") return send(200, { ok: true, engines: config.engines });
  if (req.url !== "/api/engine") return send(404, { error: "Not found." });
  if (req.method === "OPTIONS") return send(allowed.has(origin) ? 204 : 403, {});
  if (req.method !== "POST") return send(405, { error: "Use POST." });
  // Browsers always send Origin on cross-site POSTs; only this app's pages may use the engine.
  if (origin && !allowed.has(origin)) return send(403, { error: "Forbidden." });

  let raw = "";
  let tooLarge = false;
  req.setEncoding("utf8");
  req.on("data", (chunk: string) => {
    raw += chunk;
    if (raw.length > MAX_BODY) { tooLarge = true; req.destroy(); }
  });
  req.on("end", () => {
    if (tooLarge) return;
    let body: unknown;
    try { body = JSON.parse(raw); } catch { return send(400, { error: "Invalid engine request." }); }
    const abort = new AbortController();
    res.on("close", () => { if (!res.writableEnded) abort.abort(); });
    const visitor = (process.env.ENGINE_TRUST_PROXY === "1" ? String(req.headers["x-forwarded-for"] ?? "").split(",")[0]?.trim() : "") || req.socket.remoteAddress || "unknown";
    void service.handle(body, visitor, abort.signal).then((reply) => {
      if (!res.writableEnded && !abort.signal.aborted) send(reply.status, reply.body, reply.headers);
    });
  });
});

server.listen(port, () => {
  console.log(`Chess by Chaos engine listening on :${port} with ${config.engines} engine(s); origins: ${[...allowed].join(", ")}`);
});
