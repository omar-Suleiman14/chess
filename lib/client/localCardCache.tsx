"use client";

import { useAuth } from "@clerk/nextjs";
import { useConvexAuth, type OptionalRestArgsOrSkip } from "convex/react";
import type { FunctionArgs, FunctionReference, FunctionReturnType } from "convex/server";
import { getFunctionName } from "convex/server";
import { useQuery } from "convex-helpers/react/cache/hooks";
import { useEffect, useRef, useState } from "react";
import { store } from "./store";

export const cardViewKey = (scope: string, name: string, args: unknown) => JSON.stringify([scope, name, args]);

export function useCardScope() {
  const { isLoaded, userId } = useAuth();
  return isLoaded ? userId ?? "guest" : undefined;
}

/** Disk snapshots make reloads fast; authorized live results always win. */
export function useLocalCardQuery<Query extends FunctionReference<"query">>(query: Query, args: FunctionArgs<Query> | "skip", scope: string | undefined) {
  const { isLoading } = useConvexAuth();
  const liveArgs = !scope || (scope !== "public" && isLoading) ? "skip" : args;
  const live = useQuery(query, ...([liveArgs] as OptionalRestArgsOrSkip<Query>));
  const key = scope && args !== "skip" ? cardViewKey(scope, getFunctionName(query), args) : undefined;
  const [snapshot, setSnapshot] = useState<{ key: string; data: FunctionReturnType<Query> } | null>(null);
  useEffect(() => {
    if (!key) return;
    let active = true;
    void store.getView<FunctionReturnType<Query>>(key).then((data) => {
      if (active && data !== undefined) setSnapshot({ key, data });
    });
    return () => { active = false; };
  }, [key]);
  useEffect(() => {
    if (!key || !scope || live === undefined) return;
    // A missing/revoked card immediately replaces and removes its old snapshot.
    if (live === null) void store.deleteView(key);
    else void store.saveView(key, scope, live);
  }, [key, scope, live]);
  return live !== undefined ? live : snapshot && snapshot.key === key ? snapshot.data : undefined;
}

/** Remove the previous account's local snapshots on sign-out or account switch. */
export function CardCacheIdentity() {
  const scope = useCardScope();
  const previous = useRef<string | undefined>(undefined);
  useEffect(() => {
    const old = previous.current;
    if (!scope) return;
    if (old && old !== "guest" && old !== scope) void store.clearViewScope(old);
    previous.current = scope;
  }, [scope]);
  return null;
}
