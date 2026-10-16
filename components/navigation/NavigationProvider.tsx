"use client";

import { useRouter } from "next/navigation";
import { Spinner } from "@/components/ui/Spinner";
import { createContext, useCallback, useContext, useMemo, useState, useTransition, type ReactNode } from "react";

type Navigation = { track: () => () => void; navigate: (action: () => void | Promise<void>) => void; refresh: () => void };
const Context = createContext<Navigation | null>(null);

export function NavigationProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [links, setLinks] = useState<Set<symbol>>(() => new Set());
  const [refreshing, setRefreshing] = useState(false);
  const track = useCallback(() => {
    const token = Symbol();
    setLinks((previous) => new Set(previous).add(token));
    return () => setLinks((previous) => { const next = new Set(previous); next.delete(token); return next; });
  }, []);
  const navigate = useCallback((action: () => void | Promise<void>) => {
    setRefreshing(false);
    startTransition(async () => { await action(); });
  }, []);
  const refresh = useCallback(() => {
    setRefreshing(true);
    // Invalidates the current Next.js route payload; live Convex data has its
    // own dependency-based invalidation and must not go in an HTTP cache.
    startTransition(() => router.refresh());
  }, [router]);
  const value = useMemo(() => ({ track, navigate, refresh }), [track, navigate, refresh]);
  const busy = pending || links.size > 0;
  return <Context.Provider value={value}>
    <div aria-busy={busy} data-navigation-busy={busy ? "true" : undefined} className="navigation-content">{children}</div>
    {busy && <div role="status" aria-live="polite" className="navigation-feedback pointer-events-none fixed inset-0 z-[100] grid place-items-center">
      <Spinner className="navigation-spinner h-9 w-9 text-muted" />
      <span className="sr-only">{pending && refreshing ? "Refreshing page" : "Loading page"}</span>
    </div>}
  </Context.Provider>;
}

export function useNavigation() {
  const value = useContext(Context);
  if (!value) throw new Error("useNavigation outside NavigationProvider");
  return value;
}
