"use client";

import { useQuery } from "convex/react";
import Link from "next/link";
import { use, useEffect, useState } from "react";
import { api } from "@/convex/_generated/api";
import { CardDeck } from "@/components/profile/CardDeck";
import { PageHeader } from "@/components/shell/AppShell";
import { useSettings } from "@/lib/client/settings";

/** One player's public card (only when they opted in). */
export default function PublicCard({ params }: { params: Promise<{ alias: string }> }) {
  const { alias } = use(params);
  const card = useQuery(api.profiles.publicCard, { alias });
  const { reducedMotion } = useSettings();
  const [origin, setOrigin] = useState("");
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOrigin(window.location.origin);
  }, []);
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col">
      <PageHeader title="Chess card" />
      <div className="flex flex-1 flex-col justify-center px-6 pb-16">
        {card === undefined && <p className="text-muted" role="status">Loading…</p>}
        {card === null && <p>This card is private or doesn&apos;t exist.</p>}
        {card && <CardDeck cards={[{ id: card.alias, face: "identity", data: card, url: `${origin}/u/${alias}`, label: `@${card.alias}` }]} reducedMotion={reducedMotion} />}
        <Link href="/u" className="mt-6 block text-center text-sm underline">
          See all players
        </Link>
      </div>
    </main>
  );
}
