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
