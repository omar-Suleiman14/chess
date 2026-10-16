"use client";

import { useEffect, useSyncExternalStore } from "react";
import { EngineController, ENGINE_URL, type EngineState, type WorkerLike } from "../chess/engine/controller";

// One engine worker per tab (one active worker on mobile, per the spec).
let controller: EngineController | null = null;
let hiddenTimer: ReturnType<typeof setTimeout> | null = null;
const BACKGROUND_TERMINATE_MS = 60_000;

export function supportsEngine(): boolean {
  return typeof window !== "undefined" && typeof Worker !== "undefined" && typeof WebAssembly !== "undefined";
}

export function getEngine(): EngineController {
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
    const idle = (window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
    const start = () => void getEngine().start().catch(() => {});
    if (idle) idle(start, { timeout: 1500 });
    else setTimeout(start, 300);
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
