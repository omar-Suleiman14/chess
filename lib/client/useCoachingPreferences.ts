"use client";

import { useSyncExternalStore } from "react";

export type CoachingPreferences = {
  autoLanguage: boolean;
  frequency: "quiet" | "balanced" | "chatty";
  intensity: "gentle" | "playful" | "spicy";
  moveFeedback: boolean;
  explanations: boolean;
  hints: boolean;
};

const KEY = "cbc.coaching.v1";
const EVENT = "cbc:coaching";
const DEFAULTS: CoachingPreferences = { autoLanguage: false, frequency: "balanced", intensity: "playful", moveFeedback: false, explanations: false, hints: true };
let serialized: string | null = null;
let snapshot = DEFAULTS;
let memoryOnly = false;

function read() {
  if (memoryOnly) return snapshot;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw === serialized) return snapshot;
    serialized = raw;
    const data: unknown = raw ? JSON.parse(raw) : null;
    snapshot = { ...DEFAULTS };
    if (!data || typeof data !== "object") return snapshot;
    const fields: Record<string, unknown> = Object.fromEntries(Object.entries(data));
    for (const key of ["autoLanguage", "moveFeedback", "explanations", "hints"] as const) {
      if (typeof fields[key] === "boolean") snapshot[key] = fields[key];
    }
    if ("frequency" in data && (data.frequency === "quiet" || data.frequency === "balanced" || data.frequency === "chatty")) snapshot.frequency = data.frequency;
    if ("intensity" in data && (data.intensity === "gentle" || data.intensity === "playful" || data.intensity === "spicy")) snapshot.intensity = data.intensity;
  } catch { /* Keep the current session's preferences when storage is blocked. */ }
  return snapshot;
}

function subscribe(notify: () => void) {
  window.addEventListener(EVENT, notify);
  window.addEventListener("storage", notify);
  return () => {
    window.removeEventListener(EVENT, notify);
    window.removeEventListener("storage", notify);
  };
}

function update(patch: Partial<CoachingPreferences>) {
  snapshot = { ...read(), ...patch };
  serialized = JSON.stringify(snapshot);
  try { localStorage.setItem(KEY, serialized); } catch { memoryOnly = true; }
  window.dispatchEvent(new Event(EVENT));
}

/** Device preferences stay separate from the existing account schema for safe rollout. */
export function useCoachingPreferences() {
  return { coaching: useSyncExternalStore(subscribe, read, () => DEFAULTS), updateCoaching: update };
}
