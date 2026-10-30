// Server-side Stockfish: the same Stockfish 19 Lite build the browser runs
// (so bot strength and cached analysis match exactly), started as a child
// Node process that speaks UCI over stdin/stdout, and driven by the app's own
// EngineController. Used by the Next.js route (/api/engine) and by the
// standalone engine server (engine-server/main.ts) for a VM or VPS.
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { EngineController, EngineFailure, SearchCancelled, type WorkerLike } from "../chess/engine/controller";
import { parseEngineRequest, resultCacheKey, type EngineResponse } from "./protocol";

export type EngineServiceConfig = {
  /** Engines running side by side (one per CPU core you want to give chess). */
  engines: number;
  hashMb: number;
  /** Engine seconds one visitor (IP) may use per 10 minutes. */
  perVisitorSeconds: number;
  /** Engine seconds this server may use per UTC day, across everyone. 0 = unlimited. */
  dailySeconds: number;
  /** Longest a request may wait in line before giving up. */
  maxQueue: number;
};

export function configFromEnv(env: NodeJS.ProcessEnv = process.env): EngineServiceConfig {
  const int = (value: string | undefined, fallback: number) => {
    const n = Number.parseInt(value ?? "", 10);
    return Number.isFinite(n) && n >= 0 ? n : fallback;
  };
  return {
    engines: Math.max(1, int(env.ENGINE_POOL_SIZE, 1)),
    hashMb: Math.max(16, int(env.ENGINE_HASH_MB, 32)),
    perVisitorSeconds: int(env.ENGINE_VISITOR_SECONDS, 300),
    dailySeconds: int(env.ENGINE_DAILY_SECONDS, 0),
    maxQueue: Math.max(1, int(env.ENGINE_MAX_QUEUE, 24)),
  };
}

const ENGINE_FILE = "stockfish-19-lite-single.js";

function enginePath(): string {
  const candidates = [
    process.env.STOCKFISH_PATH,
    path.join(process.cwd(), "node_modules", "stockfish", "bin", ENGINE_FILE),
    path.join(process.cwd(), "stockfish", ENGINE_FILE),
  ];
  const found = candidates.find((candidate): candidate is string => !!candidate && existsSync(candidate));
  if (!found) throw new EngineFailure("Stockfish is not installed on this server.");
  return found;
}

/** Adapts a Stockfish child process to the worker interface the controller expects. */
function processWorker(): WorkerLike {
  const child: ChildProcessWithoutNullStreams = spawn(process.execPath, [enginePath()], { stdio: "pipe" });
  let buffer = "";
  const worker: WorkerLike = {
    onmessage: null,
    onerror: null,
    postMessage(message) {
      if (child.stdin.writable) child.stdin.write(`${message}\n`);
    },
    terminate() {
      child.kill();
    },
  };
  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (chunk: string) => {
    buffer += chunk;
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) worker.onmessage?.({ data: line });
  });
  child.on("exit", (code) => {
    if (code !== null && code !== 0) worker.onerror?.(new Error(`Stockfish exited with ${code}`));
  });
  child.on("error", (error) => worker.onerror?.(error));
  return worker;
}

/** A small least-recently-used map. */
class Lru<V> {
  private map = new Map<string, V>();
  constructor(private readonly limit: number) {}
  get(key: string): V | undefined {
    const value = this.map.get(key);
    if (value === undefined) return undefined;
    this.map.delete(key);
    this.map.set(key, value);
    return value;
  }
  set(key: string, value: V): void {
    this.map.delete(key);
    this.map.set(key, value);
    if (this.map.size > this.limit) this.map.delete(this.map.keys().next().value!);
  }
}

export type EngineReply = { status: number; body: EngineResponse | { error: string }; headers?: Record<string, string> };

const WINDOW_MS = 10 * 60_000;

export class EngineService {
  private engines: EngineController[] = [];
  private cache = new Lru<EngineResponse>(4_000);
  private inflight = new Map<string, Promise<EngineResponse>>();
  private visitors = new Map<string, { since: number; usedMs: number }>();
  private day = { date: "", usedMs: 0 };

  constructor(private readonly config: EngineServiceConfig) {}

  private engine(): EngineController {
    while (this.engines.length < this.config.engines) {
      this.engines.push(new EngineController(processWorker, { supersede: false, hashMb: this.config.hashMb }));
    }
    // Least busy engine first.
    return this.engines.reduce((best, engine) => (engine.load < best.load ? engine : best));
  }

  private budget(visitor: string, now: number): { ok: true } | { ok: false; reason: string; retryAfterS: number } {
    const today = new Date(now).toISOString().slice(0, 10);
    if (this.day.date !== today) this.day = { date: today, usedMs: 0 };
    if (this.config.dailySeconds > 0 && this.day.usedMs >= this.config.dailySeconds * 1_000) {
      const midnight = Date.parse(`${today}T00:00:00Z`) + 86_400_000;
      return { ok: false, reason: "The cloud engine has used today's allowance.", retryAfterS: Math.ceil((midnight - now) / 1_000) };
    }
    const entry = this.visitors.get(visitor);
    if (entry && now - entry.since < WINDOW_MS && this.config.perVisitorSeconds > 0 && entry.usedMs >= this.config.perVisitorSeconds * 1_000) {
      return { ok: false, reason: "Too many engine requests. Using this device for a few minutes.", retryAfterS: Math.ceil((entry.since + WINDOW_MS - now) / 1_000) };
    }
    return { ok: true };
  }

  private charge(visitor: string, ms: number, now: number): void {
    this.day.usedMs += ms;
    const entry = this.visitors.get(visitor);
    if (!entry || now - entry.since >= WINDOW_MS) this.visitors.set(visitor, { since: now, usedMs: ms });
    else entry.usedMs += ms;
    if (this.visitors.size > 10_000) {
      for (const [key, value] of this.visitors) if (now - value.since >= WINDOW_MS) this.visitors.delete(key);
    }
  }

  /** Handles one request body from one visitor. `signal` aborts when the client goes away. */
  async handle(body: unknown, visitor: string, signal?: AbortSignal): Promise<EngineReply> {
    const parsed = parseEngineRequest(body);
    if (!parsed.ok) return { status: 400, body: { error: parsed.error } };
    const { request } = parsed;
    const key = resultCacheKey(request);
    const hit = key ? this.cache.get(key) : undefined;
    if (hit) return { status: 200, body: { ...hit, cached: true } };

    const now = Date.now();
    const allowed = this.budget(visitor, now);
    if (!allowed.ok) return { status: 429, body: { error: allowed.reason }, headers: { "Retry-After": String(allowed.retryAfterS) } };

    // Two players asking for the same position share one search.
    const shared = key ? this.inflight.get(key) : undefined;
    if (shared) {
      try {
        return { status: 200, body: { ...(await shared), cached: true } };
      } catch {
        // The original asker went away; search on our own below.
      }
    }

    const engine = this.engine();
    if (engine.load >= this.config.maxQueue) return { status: 503, body: { error: "The cloud engine is busy." }, headers: { "Retry-After": "5" } };
    const run = (async (): Promise<EngineResponse> => {
      const result = await engine.search({ ...request, signal });
      const { requestId: _requestId, ...rest } = result;
      void _requestId;
      return { ...rest, cached: false };
    })();
    if (key) this.inflight.set(key, run);
    try {
      const response = await run;
      this.charge(visitor, response.elapsedMs, Date.now());
      if (key && response.depth) this.cache.set(key, response);
      return { status: 200, body: response };
    } catch (error) {
      if (error instanceof SearchCancelled) return { status: 499, body: { error: "Cancelled." } };
      return { status: 500, body: { error: error instanceof Error ? error.message : "Engine failed." } };
    } finally {
      if (key && this.inflight.get(key) === run) this.inflight.delete(key);
    }
  }
}

let shared: EngineService | null = null;

/** One service per server process, shared by every request. */
export function engineService(): EngineService {
  shared ??= new EngineService(configFromEnv());
  return shared;
}
