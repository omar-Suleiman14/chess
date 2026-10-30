"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

export type OfflineStatus =
  | { state: "unsupported" }
  | { state: "preparing"; done: number; total: number }
  | { state: "ready"; version: string; updateReady: boolean }
  | { state: "error"; message: string };

let status: OfflineStatus = { state: "unsupported" };
const listeners = new Set<() => void>();
const set = (next: OfflineStatus) => { status = next; listeners.forEach((listener) => listener()); };
let started = false;
let waiting: ServiceWorker | null = null;

async function ask(worker: ServiceWorker): Promise<void> {
  const channel = new MessageChannel();
  const reply = new Promise<{ ready: boolean; version: string; done: number; total: number; error: string | null }>((resolve) => { channel.port1.onmessage = (event) => resolve(event.data); });
  worker.postMessage({ type: "offline-status" }, [channel.port2]);
  const answer = await reply;
  if (answer.ready) {
    set({ state: "ready", version: answer.version, updateReady: !!waiting });
    // Ask the browser to keep our files and games through storage cleanup (best effort).
    void navigator.storage?.persist?.().catch(() => {});
  } else if (answer.error) set({ state: "error", message: answer.error });
  else set({ state: "preparing", done: answer.done, total: answer.total });
}

/** Register the offline worker once (production builds only) and track its state. */
function start(): void {
  if (started || typeof window === "undefined") return;
  started = true;
  if (!("serviceWorker" in navigator) || process.env.NODE_ENV !== "production") return;
  set({ state: "preparing", done: 0, total: 0 });
  navigator.serviceWorker.addEventListener("message", (event) => {
    const data = event.data ?? {};
    if (data.type === "offline-progress") set({ state: "preparing", done: data.done, total: data.total });
    else if (data.type === "offline-ready") set({ state: "ready", version: data.version, updateReady: !!waiting });
    else if (data.type === "offline-error") set({ state: "error", message: data.message });
  });
  // Wait for the page to finish loading so caching never competes with first paint.
  const register = () => {
    void navigator.serviceWorker.register("/sw.js", { scope: "/" }).then((registration) => {
      const track = (worker: ServiceWorker | null) => {
        if (!worker) return;
        worker.addEventListener("statechange", () => {
          if (worker.state === "installed" && registration.active) { waiting = worker; if (status.state === "ready") set({ ...status, updateReady: true }); }
          if (worker.state === "activated") void ask(worker);
          if (worker.state === "redundant" && status.state === "preparing") set({ state: "error", message: "Download interrupted. It will retry next time you're online." });
        });
      };
      if (registration.waiting && registration.active) waiting = registration.waiting;
      track(registration.installing);
      registration.addEventListener("updatefound", () => track(registration.installing));
      if (registration.active) void ask(registration.active);
    }).catch(() => set({ state: "unsupported" }));
  };
  if (document.readyState === "complete") register();
  else window.addEventListener("load", register, { once: true });
}

const subscribe = (listener: () => void) => { listeners.add(listener); return () => listeners.delete(listener); };

export function useOfflineStatus(): { status: OfflineStatus; applyUpdate: () => void } {
  useEffect(start, []);
  const current = useSyncExternalStore(subscribe, () => status, () => status);
  const applyUpdate = useCallback(() => {
    if (!waiting) return;
    navigator.serviceWorker.addEventListener("controllerchange", () => window.location.reload(), { once: true });
    waiting.postMessage({ type: "skip-waiting" });
  }, []);
  return { status: current, applyUpdate };
}

/** Registers the worker; mount once in the root layout. */
export function OfflineSupport() {
  useEffect(start, []);
  return null;
}

/** Browser connectivity hint (not proof of reachability), for honest labels. */
export function useOnline(): boolean {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => { window.removeEventListener("online", update); window.removeEventListener("offline", update); };
  }, []);
  return online;
}
