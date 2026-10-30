"use client";

import { ENGINE_BUILD, EngineFailure, SearchCancelled, type EngineLike, type EngineState, type SearchKind, type SearchRequest, type SearchResult } from "../chess/engine/controller";
import { legalUcis } from "../chess/rules";
import type { EngineResponse } from "../engine/protocol";

/** The cloud engine could not answer (offline, busy, over its allowance). Callers fall back to this device. */
export class CloudUnavailable extends EngineFailure {
  constructor(message: string, readonly retryAfterMs = 60_000) {
    super(message);
    this.name = "CloudUnavailable";
  }
}

/** Extra time on top of the search itself for the network and a cold server start. */
const NETWORK_GRACE_MS = 8_000;

/**
 * Stockfish on a server. Same interface and the same rules as the on-device
 * controller: a newer eval or move replaces the previous one of its kind, and
 * every move the server suggests is checked against the rules before use.
 */
export class CloudEngine implements EngineLike {
  private running = new Map<SearchKind, Set<AbortController>>();
  private listeners = new Set<(state: EngineState) => void>();
  private nextId = 1;
  private busy = 0;

  constructor(private readonly url: string) {}

  get state(): EngineState {
    return this.busy > 0 ? "thinking" : "ready";
  }

  subscribe(listener: (state: EngineState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  start(): Promise<void> {
    return Promise.resolve();
  }

  restart(): Promise<void> {
    this.cancel();
    return Promise.resolve();
  }

  cancel(kind?: SearchKind): void {
    for (const [k, controllers] of this.running) {
      if (kind && k !== kind) continue;
      for (const controller of controllers) controller.abort();
      controllers.clear();
    }
  }

  async search(request: SearchRequest): Promise<SearchResult> {
    if (request.signal?.aborted) throw new SearchCancelled();
    // Only the newest eval or bot move matters.
    if (request.kind !== "review") this.cancel(request.kind);
    const controller = new AbortController();
    const onAbort = () => controller.abort();
    request.signal?.addEventListener("abort", onAbort, { once: true });
    const set = this.running.get(request.kind) ?? new Set();
    this.running.set(request.kind, set);
    set.add(controller);
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; controller.abort(); }, (request.movetimeMs ?? 1_000) + NETWORK_GRACE_MS);
    this.setBusy(1);
    const startedAt = performance.now();
    try {
      let response: Response;
      try {
        response = await fetch(this.url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kind: request.kind, fen: request.fen, movetimeMs: request.movetimeMs, depth: request.depth, multiPv: request.multiPv, options: request.options, gameId: request.gameId }),
          signal: controller.signal,
          cache: "no-store",
        });
      } catch {
        if (controller.signal.aborted && !timedOut) throw new SearchCancelled();
        throw new CloudUnavailable(timedOut ? "The cloud engine took too long." : "Can't reach the cloud engine.");
      }
      if (!response.ok) {
        const retryAfter = Number(response.headers.get("Retry-After"));
        const message = await response.json().then((body: { error?: string }) => body.error ?? "", () => "");
        // A rejected request (400) is a bug, not an outage, but this device can still answer it.
        throw new CloudUnavailable(message || `Cloud engine error ${response.status}.`, Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter, 3_600) * 1_000 : 60_000);
      }
      const body = (await response.json()) as EngineResponse;
      if (body.engineBuild !== ENGINE_BUILD) throw new CloudUnavailable("The cloud engine runs a different Stockfish build.", 3_600_000);
      // Never trust a move the rules do not allow.
      if (body.bestmove !== null && !legalUcis(request.fen).includes(body.bestmove)) throw new CloudUnavailable(`Cloud engine proposed an illegal move ${body.bestmove}`);
      const result: SearchResult = { ...body, requestId: this.nextId++, fen: request.fen, elapsedMs: body.cached ? performance.now() - startedAt : body.elapsedMs };
      if (!controller.signal.aborted && request.onInfo && (result.score.cp !== undefined || result.score.mate !== undefined)) {
        request.onInfo({ requestId: result.requestId, depth: result.depth, score: result.score, pv: result.pv, multipv: 1 });
      }
      if (controller.signal.aborted) throw new SearchCancelled();
      return result;
    } finally {
      clearTimeout(timer);
      request.signal?.removeEventListener("abort", onAbort);
      set.delete(controller);
      this.setBusy(-1);
    }
  }

  private setBusy(delta: number): void {
    const before = this.state;
    this.busy += delta;
    if (this.state !== before) for (const listener of this.listeners) listener(this.state);
  }
}
