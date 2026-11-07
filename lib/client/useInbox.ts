"use client";

import { useConvexAuth } from "convex/react";
import { useQuery } from "convex-helpers/react/cache/hooks";
import { api } from "@/convex/_generated/api";
import { useSocialTime } from "./socialCache";

/** Open challenges plus friend requests waiting for this player (0 when signed out). */
export function useInboxCount(): number {
  const { isAuthenticated } = useConvexAuth();
  const now = useSocialTime();
  const data = useQuery(api.friends.overview, isAuthenticated ? { now } : "skip");
  return (data?.challenges.length ?? 0) + (data?.incoming.length ?? 0);
}
