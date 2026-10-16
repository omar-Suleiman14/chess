"use client";

import { useUser } from "@clerk/nextjs";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Avatar } from "@/components/profile/ChessCard";

/** The same chess identity used on the player's public card; guests stay local. */
export function PlayerIdentity() {
  const { isAuthenticated } = useConvexAuth();
  const { user } = useUser();
  const profile = useQuery(api.profiles.mine, isAuthenticated ? {} : "skip");
  const name = profile?.alias ?? user?.firstName ?? user?.username ?? "You";
  return (
    <div className="flex min-w-0 items-center gap-2.5 py-2" aria-label={`Player: ${name}`}>
      <div className="shrink-0 overflow-hidden rounded-xl bg-surface"><Avatar seed={profile?.avatarSeed ?? "guest"} hue={profile?.hue ?? 210} size={42} /></div>
      <span className="truncate text-sm font-semibold">{name}</span>
    </div>
  );
}
