// EngineController: one Stockfish worker, serialised UCI, priority scheduling.
//
// Priorities: "move" (Fatma's reply) > "eval" (bar) > "review" (background).
// A higher-priority request stops the running search; the stopped search's
// late `bestmove` is consumed and discarded by generation tracking.
import { legalUcis, sideToMove } from "../rules";
import { parseBestMove, parseInfo, toWhiteScore, type UciInfo, type WhiteScore } from "./uci";

export const ENGINE_BUILD = "stockfish-19.0.1-lite-single";
export const ENGINE_URL = "/engine/19.0.1/stockfish-19-lite-single.js";

export type SearchKind = "move" | "eval" | "review";
export type EngineState = "idle" | "loading" | "ready" | "thinking" | "error" | "terminated";
export type EngineOptions = Record<string, string | number | boolean>;

export type SearchRequest = {
  kind: SearchKind;
  fen: string;
  movetimeMs?: number;
  depth?: number;
  multiPv?: number;
  /** UCI options for this search; omitted options are reset to defaults. */
  options?: EngineOptions;
  onInfo?: (info: SearchInfo) => void;
};

export type SearchInfo = {
  requestId: number;
  depth?: number;
  score: WhiteScore;
  pv: string[];
  multipv: number;
};

export type SearchResult = {
  requestId: number;
  engineBuild: string;
  fen: string;
  bestmove: string | null;
  depth?: number;
  score: WhiteScore;
  pv: string[];
  elapsedMs: number;
  options: EngineOptions;
};

export class SearchCancelled extends Error {
  constructor() {
    super("Search cancelled");
    this.name = "SearchCancelled";
  }
}

export class EngineFailure extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EngineFailure";
  }
}

export interface WorkerLike {
  postMessage(message: string): void;
  terminate(): void;
  onmessage: ((event: { data: unknown }) => void) | null;
  onerror: ((event: unknown) => void) | null;
}

/** Options every search starts from, so a weak Climb preset never leaks into Full Power or eval. */
export const DEFAULT_ENGINE_OPTIONS: EngineOptions = {
  UCI_LimitStrength: false,
  "Skill Level": 20,
  MultiPV: 1,
};

const PRIORITY: Record<SearchKind, number> = { move: 3, eval: 2, review: 1 };
const HANDSHAKE_TIMEOUT_MS = 20_000;

type Pending = {
  id: number;
  request: SearchRequest;
  resolve: (result: SearchResult) => void;
  reject: (error: Error) => void;
  cancelled: boolean;
  startedAt: number;
  last?: UciInfo;
  options: EngineOptions;
};

export class EngineController {
  private worker: WorkerLike | null = null;
  private readyPromise: Promise<void> | null = null;
  private lineWaiters: Array<{ match: (line: string) => boolean; resolve: () => void }> = [];
  private queue: Pending[] = [];
  private active: Pending | null = null;
  private nextId = 1;
  private currentOptions: EngineOptions = {};
  private listeners = new Set<(state: EngineState) => void>();
  private _state: EngineState = "idle";

  constructor(private readonly createWorker: () => WorkerLike) {}

  get state(): EngineState {
    return this._state;
  }

  subscribe(listener: (state: EngineState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Starts the worker and completes the UCI handshake. Idempotent. */
  start(): Promise<void> {
    if (this.readyPromise) return this.readyPromise;
    this.setState("loading");
    this.readyPromise = this.boot().catch((error: unknown) => {
      this.fail(error instanceof Error ? error.message : "Engine failed to start");
      throw error;
    });
    return this.readyPromise;
  }

  private async boot(): Promise<void> {
    const worker = this.createWorker();
    this.worker = worker;
    worker.onmessage = (event) => {
      if (typeof event.data === "string") {
        for (const line of event.data.split("\n")) this.onLine(line.trim());
      }
    };
    worker.onerror = () => this.fail("The engine worker crashed.");
    await this.withTimeout(this.send("uci", (l) => l === "uciok"), "UCI handshake timed out");
    this.post("setoption name Threads value 1");
    this.post("setoption name Hash value 16");
    await this.withTimeout(this.send("isready", (l) => l === "readyok"), "Engine did not become ready");
    this.currentOptions = {};
    this.setState("ready");
  }

  search(request: SearchRequest): Promise<SearchResult> {
    return new Promise<SearchResult>((resolve, reject) => {
      const pending: Pending = {
        id: this.nextId++,
        request,
        resolve,
        reject,
        cancelled: false,
        startedAt: 0,
        options: { ...DEFAULT_ENGINE_OPTIONS, ...request.options },
      };
      // Only the newest eval matters; drop queued stale ones.
      if (request.kind === "eval") this.dropQueued("eval");
      if (request.kind === "move") this.dropQueued("move");
      this.queue.push(pending);
      this.queue.sort((a, b) => PRIORITY[b.request.kind] - PRIORITY[a.request.kind] || a.id - b.id);
      if (this.active && PRIORITY[request.kind] > PRIORITY[this.active.request.kind]) {
        this.stopActive();
      } else if (this.active && request.kind === this.active.request.kind && request.kind !== "review") {
        // A newer request of the same kind supersedes the running one.
        this.stopActive();
      }
      void this.pump();
    });
  }

  /** Cancels queued and running searches, optionally only of one kind. */
  cancel(kind?: SearchKind): void {
    this.dropQueued(kind);
    if (this.active && (!kind || this.active.request.kind === kind)) this.stopActive();
  }

  terminate(): void {
    this.cancel();
    this.worker?.terminate();
    this.worker = null;
    this.readyPromise = null;
    this.active = null;
    this.setState("terminated");
  }

  async restart(): Promise<void> {
    this.terminate();
    await this.start();
  }

  private dropQueued(kind?: SearchKind): void {
    const keep: Pending[] = [];
    for (const p of this.queue) {
      if (!kind || p.request.kind === kind) p.reject(new SearchCancelled());
      else keep.push(p);
    }
    this.queue = keep;
  }

  private stopActive(): void {
    if (!this.active || this.active.cancelled) return;
    this.active.cancelled = true;
    this.post("stop");
  }

  private async pump(): Promise<void> {
    if (this.active || this.queue.length === 0) return;
    try {
      await this.start();
    } catch {
      return;
    }
    if (this.active || this.queue.length === 0) return;
    const next = this.queue.shift()!;
    this.active = next;
    this.setState("thinking");
    this.applyOptions(next.options);
    // Make sure option changes are applied before the search starts.
    await this.send("isready", (l) => l === "readyok");
    if (this.active !== next) return;
    if (next.cancelled) {
      this.finishActive(null);
      return;
    }
    const { request } = next;
    next.startedAt = now();
    this.post(`position fen ${request.fen}`);
    const parts = ["go"];
    if (request.depth) parts.push(`depth ${request.depth}`);
    if (request.movetimeMs) parts.push(`movetime ${Math.round(request.movetimeMs)}`);
    if (!request.depth && !request.movetimeMs) parts.push("movetime 1000");
    this.post(parts.join(" "));
  }

  private applyOptions(options: EngineOptions): void {
    for (const [name, value] of Object.entries(options)) {
      if (this.currentOptions[name] === value) continue;
      this.post(`setoption name ${name} value ${value}`);
      this.currentOptions[name] = value;
    }
  }

  private onLine(line: string): void {
    if (!line) return;
    for (const waiter of [...this.lineWaiters]) {
      if (waiter.match(line)) {
        this.lineWaiters.splice(this.lineWaiters.indexOf(waiter), 1);
        waiter.resolve();
      }
    }
    const active = this.active;
    if (!active) return;
    const info = parseInfo(line);
    if (info) {
      if (info.bound) return; // Aspiration-window bounds are not reliable scores.
      if ((info.multipv ?? 1) === 1) active.last = info;
      if (!active.cancelled && active.request.onInfo && (info.scoreCp !== undefined || info.scoreMate !== undefined)) {
        active.request.onInfo({
          requestId: active.id,
          depth: info.depth,
          score: toWhiteScore(info, sideToMove(active.request.fen)),
          pv: info.pv ?? [],
          multipv: info.multipv ?? 1,
        });
      }
      return;
    }
    const best = parseBestMove(line);
    if (best) this.finishActive(best.bestmove);
  }

  private finishActive(bestmove: string | null): void {
    const active = this.active;
    if (!active) return;
    this.active = null;
    if (active.cancelled) {
      active.reject(new SearchCancelled());
    } else if (bestmove !== null && !legalUcis(active.request.fen).includes(bestmove)) {
      // Never trust an engine move the rules do not allow.
      active.reject(new EngineFailure(`Engine proposed an illegal move ${bestmove}`));
    } else {
      const last = active.last ?? {};
      active.resolve({
        requestId: active.id,
        engineBuild: ENGINE_BUILD,
        fen: active.request.fen,
        bestmove,
        depth: last.depth,
        score: toWhiteScore(last, sideToMove(active.request.fen)),
        pv: last.pv ?? [],
        elapsedMs: now() - active.startedAt,
        options: active.options,
      });
    }
    this.setState(this.worker ? "ready" : "terminated");
    void this.pump();
  }

  private fail(message: string): void {
    const error = new EngineFailure(message);
    this.active?.reject(error);
    this.active = null;
    for (const p of this.queue) p.reject(error);
    this.queue = [];
    this.lineWaiters = [];
    this.worker?.terminate();
    this.worker = null;
    this.readyPromise = null;
    this.setState("error");
  }

  private post(command: string): void {
    this.worker?.postMessage(command);
  }

  private send(command: string, match: (line: string) => boolean): Promise<void> {
    return new Promise<void>((resolve) => {
      this.lineWaiters.push({ match, resolve });
      this.post(command);
    });
  }

  private withTimeout(promise: Promise<void>, message: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new EngineFailure(message)), HANDSHAKE_TIMEOUT_MS);
      promise.then(
        () => {
          clearTimeout(timer);
          resolve();
        },
        (error: unknown) => {
          clearTimeout(timer);
          reject(error);
        },
      );
    });
  }

  private setState(state: EngineState): void {
    if (this._state === state) return;
    this._state = state;
    for (const listener of this.listeners) listener(state);
  }
}

function now(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}
