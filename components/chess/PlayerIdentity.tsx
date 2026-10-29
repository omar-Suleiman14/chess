"use client";

import { useUser } from "@clerk/nextjs";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useSettings } from "@/lib/client/settings";
import { RatingBadge } from "./RatingBadge";
import type { LocalGameMeta } from "@/lib/client/store";
import { CapturedPieces } from "./CapturedPieces";
import type { CapturedPiece } from "@/lib/chess/captures";
import type { Color } from "@/lib/chess/rules";
import { Avatar } from "@/components/profile/ChessCard";

/** The same chess identity used on the player's public card; guests stay local. */
export function PlayerIdentity({ game, captures, capturedColor, advantage }: { game?: Pick<LocalGameMeta, "gameKey" | "mode" | "rated">; captures?: CapturedPiece[]; capturedColor?: Color; advantage?: number }) {
  const { isAuthenticated } = useConvexAuth();
  const { syncsExperience } = useSettings();
  const { user } = useUser();
  const profile = useQuery(api.profiles.mine, isAuthenticated ? {} : "skip");
  const rating = useQuery(api.progress.nameplate, isAuthenticated && syncsExperience && game ? { gameKey: game.gameKey } : "skip");
  const name = profile?.alias ?? user?.firstName ?? user?.username ?? "You";
  return (
    <div className="flex min-w-0 items-center gap-2.5 py-2" aria-label={`Player: ${name}`}>
      <div className="shrink-0 overflow-hidden rounded-xl bg-surface"><Avatar seed={profile?.avatarSeed ?? "guest"} hue={profile?.hue ?? 210} size={42} /></div>
      <div className="min-w-0"><div className="flex min-w-0 items-center gap-1"><span className="truncate text-sm font-semibold">{name}</span><RatingBadge rating={rating} unrated={!game || game.rated !== "eligible"} /></div><CapturedPieces pieces={captures} color={capturedColor} advantage={advantage} /></div>
    </div>
  );
}
