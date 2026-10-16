"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { useConvexAuth } from "convex/react";
import { useQuery } from "convex-helpers/react/cache/hooks";
import { api } from "@/convex/_generated/api";
import { useCardScope, useLocalCardQuery } from "./localCardCache";

// One session anchor lets the banner, Friends and menu prefetch reuse the same
// query. A new timestamp on every mount defeats subscription caching.
let sessionTime: number | undefined;
const snapshot = () => sessionTime ??= Date.now();
const subscribe = () => () => {};
export const useSocialTime = () => useSyncExternalStore(subscribe, snapshot, () => 0);

export function SocialPrefetch({ enabled }: { enabled: boolean }) {
  const { isAuthenticated } = useConvexAuth();
  const now = useSocialTime();
  const scope = useCardScope();
  useLocalCardQuery(api.profiles.publicCards, enabled ? {} : "skip", "public");
  useLocalCardQuery(api.friends.cards, enabled && isAuthenticated ? {} : "skip", scope);
  useQuery(api.friends.overview, enabled && isAuthenticated ? { now } : "skip");
  return null;
}

/** Preload authorized card snapshots and the live permission query. */
export function CardQueryPrefetch({ alias, enabled = true }: { alias: string; enabled?: boolean }) {
  const router = useRouter();
  useEffect(() => { if (enabled) router.prefetch(`/u/${encodeURIComponent(alias)}`); }, [alias, enabled, router]);
  const scope = useCardScope();
  useLocalCardQuery(api.profiles.publicCard, enabled ? { alias } : "skip", scope);
  useQuery(api.friends.relation, enabled ? { alias } : "skip");
  return null;
}
