"use client";

import { useSyncExternalStore } from "react";

/**
 * The page origin, hydration-safe: "" during server render and hydration,
 * the real origin afterwards (no text mismatch, no effect-driven setState).
 */
export function useOrigin(): string {
  return useSyncExternalStore(
    () => () => {},
    () => window.location.origin,
    () => "",
  );
}
