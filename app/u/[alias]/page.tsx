"use client";

import { useQuery } from "convex/react";
import { use } from "react";
import { api } from "@/convex/_generated/api";
import { ChessCard } from "@/components/profile/ChessCard";
import { PageHeader } from "@/components/shell/AppShell";

/** Public card, only when the player opted in. */
export default function PublicCard({ params }: { params: Promise<{ alias: string }> }) {
  const { alias } = use(params);
  const card = useQuery(api.profiles.publicCard, { alias });
  return (
    <main className="mx-auto min-h-dvh max-w-md">
      <PageHeader title="Chess card" />
      <div className="px-4">
        {card === undefined && <p className="text-muted" role="status">Loading…</p>}
        {card === null && <p>This card is private or doesn&apos;t exist.</p>}
        {card && (
          <ChessCard
            alias={card.alias}
            seed={card.avatarSeed}
            hue={card.hue}
            theme={card.cardTheme}
            stats={card.climb ? [{ label: "Climb", value: String(card.climb.rating), note: `±${Math.round(card.climb.rd * 1.96)} · ${card.climb.games} games` }] : []}
          />
        )}
      </div>
    </main>
  );
}
