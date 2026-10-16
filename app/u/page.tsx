"use client";

import { useQuery } from "convex/react";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/convex/_generated/api";
import { CardDeck, type DeckCard } from "@/components/profile/CardDeck";
import { FATMA_CARD } from "@/components/profile/ChessCard";
import { PageHeader } from "@/components/shell/AppShell";
import { useSettings } from "@/lib/client/settings";

/** Every player who made their card public, with Fatma among them. */
export default function PlayersPage() {
  const cards = useQuery(api.profiles.publicCards);
  const { reducedMotion } = useSettings();
  const [origin, setOrigin] = useState("");
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOrigin(window.location.origin);
  }, []);
  const deck: DeckCard[] = useMemo(
    () => [
      { id: "fatma", face: "identity", data: FATMA_CARD, url: `${origin}/`, label: "Fatma" },
      ...(cards ?? []).map((c) => ({ id: c.alias, face: "identity" as const, data: c, url: `${origin}/u/${c.alias}`, label: `@${c.alias}` })),
    ],
    [cards, origin],
  );
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col">
      <PageHeader title="Players" />
      <div className="flex flex-1 flex-col justify-center px-6 pb-16">
        {cards === undefined ? <p className="text-muted" role="status">Loading…</p> : <CardDeck cards={deck} reducedMotion={reducedMotion} />}
        {cards && cards.length === 0 && <p className="mt-6 text-center text-sm text-muted">No public players yet. Turn on “Public card” in Profile to join.</p>}
      </div>
    </main>
  );
}
