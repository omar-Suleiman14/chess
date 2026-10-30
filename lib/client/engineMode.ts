"use client";

import { useSyncExternalStore } from "react";

/**
 * Where Stockfish runs.
 * - auto: the cloud engine when online, this device when offline or the cloud is unavailable.
 * - cloud: keep analysis off the phone; the eval bar, hints, feedback and reviews need internet.
 *   Bot moves still fall back to this device so a game never gets stuck.
 * - device: always this device (works offline, uses more battery).
 */
export type EngineMode = "auto" | "cloud" | "device";

const KEY = "cbc.engine.v1";
const EVENT = "cbc:engine-mode";
let snapshot: EngineMode = "auto";
let loaded = false;

/** The cloud engine's address, if this build has one. */
export function cloudEngineUrl(): string | null {
  const url = process.env.NEXT_PUBLIC_ENGINE_URL;
  return url ? url : null;
}

export function engineMode(): EngineMode {
  if (loaded || typeof window === "undefined") return snapshot;
  loaded = true;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw === "auto" || raw === "cloud" || raw === "device") snapshot = raw;
  } catch { /* Storage blocked: keep the default. */ }
  return snapshot;
}

export function setEngineMode(mode: EngineMode): void {
  snapshot = mode;
  loaded = true;
  try { localStorage.setItem(KEY, mode); } catch { /* Session only. */ }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(notify: () => void) {
  const onStorage = (event: StorageEvent) => { if (event.key === KEY) { loaded = false; notify(); } };
  window.addEventListener(EVENT, notify);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(EVENT, notify);
    window.removeEventListener("storage", onStorage);
  };
}

export function useEngineMode(): [EngineMode, (mode: EngineMode) => void] {
  return [useSyncExternalStore(subscribe, engineMode, () => "auto" as EngineMode), setEngineMode];
}
