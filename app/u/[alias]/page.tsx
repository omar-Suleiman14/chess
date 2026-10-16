"use client";

import { useQuery } from "convex/react";
import { use } from "react";
import { api } from "@/convex/_generated/api";
import { CardDeck } from "@/components/profile/CardDeck";
import { PageHeader } from "@/components/shell/AppShell";
import { useSettings } from "@/lib/client/settings";

/** Public card deck, only when the player opted in. */
export default function PublicCard({ params }: { params: Promise<{ alias: string }> }) {
  const { alias } = use(params);
  const card = useQuery(api.profiles.publicCard, { alias });
  const { reducedMotion } = useSettings();
  const url = typeof window !== "undefined" ? `${window.location.origin}/u/${alias}` : `/u/${alias}`;
  return (
    <main className="mx-auto min-h-dvh max-w-2xl overflow-x-hidden pb-12">
      <PageHeader title="Chess card" />
      <div className="px-6 pt-6">
        {card === undefined && <p className="text-muted" role="status">Loading…</p>}
        {card === null && <p>This card is private or doesn&apos;t exist.</p>}
        {card && <CardDeck data={card} url={url} reducedMotion={reducedMotion} />}
      </div>
    </main>
  );
}
