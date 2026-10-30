"use client";

import { useEffect, useSyncExternalStore } from "react";
import { EngineController, ENGINE_URL, SearchCancelled, type EngineLike, type EngineState, type SearchKind, type SearchRequest, type SearchResult, type WorkerLike } from "../chess/engine/controller";
import { CloudEngine, CloudUnavailable } from "./cloudEngine";
import { cloudEngineUrl, engineMode } from "./engineMode";

// One engine worker per tab (one active worker on mobile, per the spec).
let controller: EngineController | null = null;
let hiddenTimer: ReturnType<typeof setTimeout> | null = null;
const BACKGROUND_TERMINATE_MS = 60_000;

export function supportsEngine(): boolean {
  return typeof window !== "undefined" && typeof Worker !== "undefined" && typeof WebAssembly !== "undefined";
}

/** Stockfish on this device (a Web Worker). Created only when something actually needs it. */
export function getLocalEngine(): EngineController {
  if (!controller) {
    controller = new EngineController(() => new Worker(ENGINE_URL) as unknown as WorkerLike);
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "hidden") {
          // Free memory if the tab stays in the background; restarts lazily.
          hiddenTimer = setTimeout(() => controller?.terminate(), BACKGROUND_TERMINATE_MS);
        } else if (hiddenTimer) {
          clearTimeout(hiddenTimer);
          hiddenTimer = null;
        }
      });
    }
  }
  return controller;
}

/**
 * Picks where each search runs (see EngineMode): the cloud engine keeps the
 * phone cool; this device is the fallback whenever the cloud can't answer,
 * so play never stops. The on-device worker is not even loaded until needed.
 */
class HybridEngine implements EngineLike {
  private cloud: CloudEngine | null;
  private downUntil = 0;
  private listeners = new Set<(state: EngineState) => void>();
  private localUnsubscribe: (() => void) | null = null;

  constructor(url: string | null) {
    this.cloud = url ? new CloudEngine(url) : null;
    this.cloud?.subscribe(() => this.emit());
  }

  /** Whether the cloud should be asked first right now. */
  private cloudFirst(): boolean {
    if (!this.cloud || engineMode() === "device") return false;
    if (typeof navigator !== "undefined" && navigator.onLine === false) return false;
    return Date.now() >= this.downUntil;
  }

  private local(): EngineController {
    const engine = getLocalEngine();
    if (!this.localUnsubscribe) this.localUnsubscribe = engine.subscribe(() => this.emit());
    return engine;
  }

  get state(): EngineState {
    const local = controller?.state;
    if (local === "loading" || local === "thinking") return local;
    if (this.cloudFirst()) return this.cloud!.state;
    return local ?? "idle";
  }

  subscribe(listener: (state: EngineState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(): void {
    const state = this.state;
    for (const listener of this.listeners) listener(state);
  }

  start(): Promise<void> {
    return this.cloudFirst() ? Promise.resolve() : this.local().start();
  }

  async restart(): Promise<void> {
    // A retry also gives the cloud another chance.
    this.downUntil = 0;
    this.cloud?.cancel();
    if (controller) await controller.restart();
    this.emit();
  }

  cancel(kind?: SearchKind): void {
    this.cloud?.cancel(kind);
    controller?.cancel(kind);
  }

  async search(request: SearchRequest): Promise<SearchResult> {
    if (this.cloudFirst()) {
      try {
        return await this.cloud!.search(request);
      } catch (error) {
        if (!(error instanceof CloudUnavailable)) throw error;
        this.downUntil = Date.now() + error.retryAfterMs;
        this.emit();
        if (request.signal?.aborted) throw new SearchCancelled();
      }
    }
    // Cloud only: analysis waits for the internet, but a bot always gets to move.
    if (this.cloud && engineMode() === "cloud" && request.kind !== "move") {
      throw new CloudUnavailable("Analysis needs the cloud engine (Settings → Engine).");
    }
    return this.local().search(request);
  }
}

let hybrid: HybridEngine | null = null;

/** The engine everything uses: cloud, this device, or both (Settings → Engine). */
export function getEngine(): EngineLike {
  hybrid ??= new HybridEngine(cloudEngineUrl());
  return hybrid;
}

/** Whether this build has a cloud engine to talk to. */
export function hasCloudEngine(): boolean {
  return cloudEngineUrl() !== null;
}

export function useEngineState(): EngineState {
  return useSyncExternalStore(
    (cb) => (supportsEngine() ? getEngine().subscribe(cb) : () => {}),
    () => (supportsEngine() ? getEngine().state : "error"),
    () => "idle",
  );
}

/** Warm the worker after the board has painted. */
export function usePrewarmEngine(enabled = true): void {
  useEffect(() => {
    if (!enabled || !supportsEngine()) return;
    const idle = window.requestIdleCallback?.bind(window);
    const start = () => void getEngine().start().catch(() => {});
    if (idle) {
      const id = idle(start, { timeout: 1500 });
      return () => window.cancelIdleCallback(id);
    }
    const id = setTimeout(start, 300);
    return () => clearTimeout(id);
  }, [enabled]);
}

const WASM_URL = ENGINE_URL.replace(/\.js$/, ".wasm");
let warmup: Promise<void> | null = null;

/**
 * Downloads the engine WASM with real byte progress (warming the HTTP cache the
 * worker then reads from), then completes the UCI handshake. Progress is 0..1.
 */
export function preloadEngine(onProgress: (p: number) => void): Promise<void> {
  if (!supportsEngine()) return Promise.resolve();
  if (warmup) {
    void warmup.then(() => onProgress(1));
    return warmup;
  }
  warmup = (async () => {
    try {
      const res = await fetch(WASM_URL);
      const total = Number(res.headers.get("content-length")) || 1_850_000;
      if (res.body) {
        const reader = res.body.getReader();
        let received = 0;
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          received += value.byteLength;
          onProgress(Math.min(0.85, (received / total) * 0.85));
        }
      } else {
        await res.arrayBuffer();
      }
    } catch {
      // Network hiccup: the worker will try again itself.
    }
    onProgress(0.9);
    await getEngine().start().catch(() => {});
    onProgress(1);
  })();
  return warmup;
}
