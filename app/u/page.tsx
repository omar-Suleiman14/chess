"use client";

import { useQuery } from "convex/react";
import { useMemo } from "react";
import { api } from "@/convex/_generated/api";
import type { DeckCard } from "@/components/profile/CardDeck";
import { CardStack } from "@/components/profile/CardStack";
import { FATMA_CARD } from "@/components/profile/ChessCard";
import { PageHeader } from "@/components/shell/AppShell";
import { useOrigin } from "@/lib/client/useOrigin";

/** Every player who made their card public, with Sherine among them. */
export default function PlayersPage() {
  const cards = useQuery(api.profiles.publicCards);
  const origin = useOrigin();
  const deck: DeckCard[] = useMemo(
    () => [
      { id: "sherine", face: "identity", data: FATMA_CARD, url: `${origin}/`, label: "Sherine" },
      ...(cards ?? []).map((c) => ({ id: c.alias, face: "identity" as const, data: c, url: `${origin}/u/${c.alias}`, label: `@${c.alias}` })),
    ],
    [cards, origin],
  );
  return (
    <main className="mx-auto flex min-h-dvh max-w-5xl flex-col overflow-x-clip">
      <PageHeader title="Players" />
      <div className="flex flex-1 flex-col px-4 pb-16 text-center">
        <header className="mx-auto mt-4 max-w-xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">The chess community</p>
          <h2 className="mt-2 text-[clamp(30px,5vw,48px)] font-semibold leading-tight tracking-[-0.035em]">Discover players</h2>
          <p className="mt-3 text-[15px] leading-relaxed text-muted">Everyone with a public card, and Sherine. Swipe or drag to browse. Tap a card to open it.</p>
        </header>
        {cards === undefined ? (
          <p className="py-28 text-muted" role="status">Loading players…</p>
        ) : (
          <CardStack cards={deck} label="Player cards" />
        )}
        {cards && cards.length === 0 && <p className="mt-4 text-sm text-muted">No public players yet. Turn on “Public card” in Profile to join.</p>}
      </div>
    </main>
  );
}
