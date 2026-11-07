"use client";

// The website can be deployed before its matching Convex functions. Calling a
// function the server doesn't have throws during render and takes the whole
// page down, so newer features first check what the server supports.
import { useConvex } from "convex/react";
import { useEffect, useSyncExternalStore } from "react";
import { api } from "@/convex/_generated/api";

export type BackendFeatures = { puzzles: boolean; push: boolean; search: boolean; matchmaking: boolean };

const NONE: BackendFeatures = { puzzles: false, push: false, search: false, matchmaking: false };
let features: BackendFeatures | null = null;
let loading = false;
const listeners = new Set<() => void>();

const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
const snapshot = () => features;

/** null while unknown; then which newer server features exist (all false on an older deployment). */
export function useBackendFeatures(): BackendFeatures | null {
  const convex = useConvex();
  const current = useSyncExternalStore(subscribe, snapshot, () => null);
  useEffect(() => {
    if (features || loading) return;
    loading = true;
    convex
      .query(api.settings.capabilities, {})
      .then((caps) => { features = (caps as { features?: BackendFeatures }).features ?? NONE; })
      .catch(() => { features = NONE; })
      .finally(() => { loading = false; for (const l of listeners) l(); });
  }, [convex]);
  return current;
}
