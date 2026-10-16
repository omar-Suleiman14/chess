"use client";

import { SignInButton } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { use, useEffect, useState } from "react";
import { api } from "@/convex/_generated/api";
import { ChallengeDialog } from "@/components/online/ChallengeDialog";
import { CardDeck } from "@/components/profile/CardDeck";
import { PageHeader } from "@/components/shell/AppShell";
import { useSettings } from "@/lib/client/settings";
import { useOrigin } from "@/lib/client/useOrigin";

const primary = "inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-accent px-5 text-sm font-semibold text-accent-text disabled:opacity-60";
const secondary = "inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-surface px-5 text-sm font-medium shadow-[var(--shadow)]";

/** A player's card, the page their QR code opens: add them, challenge them, share it. */
export default function PlayerPage({ params }: { params: Promise<{ alias: string }> }) {
  const { alias } = use(params);
  const card = useQuery(api.profiles.publicCard, { alias });
  const relation = useQuery(api.friends.relation, { alias });
  const { reducedMotion } = useSettings();
  const origin = useOrigin();
  const url = `${origin}/u/${alias}`;
  const [challenging, setChallenging] = useState(false);
  const [canShare, setCanShare] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCanShare(typeof navigator.share === "function");
  }, []);

  const share = async () => {
    try {
      if (canShare) await navigator.share({ title: `@${alias} on Chess by Chaos`, url });
      else await navigator.clipboard.writeText(url);
    } catch {
      // Dismissed.
    }
  };

  const state = relation?.state;
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col">
      <PageHeader title={`@${alias}`} />
      <div className="flex flex-1 flex-col justify-center gap-6 px-6 pb-16">
        {(card === undefined || relation === undefined) && <p className="text-center text-muted" role="status">Loading…</p>}
        {state === "missing" && (
          <div className="grid gap-3 text-center">
            <p className="text-lg font-semibold">No player called @{alias}</p>
            <Link href="/u" className="text-sm underline">See all players</Link>
          </div>
        )}
        {card && <CardDeck cards={[{ id: card.alias, face: "identity", data: card, url, label: `@${card.alias}` }]} reducedMotion={reducedMotion} />}
        {card === null && state && state !== "missing" && (
          <div className="mx-auto grid max-w-sm gap-2 rounded-3xl bg-surface p-6 text-center shadow-[var(--shadow)]">
            <p className="text-lg font-semibold">@{alias}</p>
            <p className="text-sm text-muted">This card is private. Become friends to see it.</p>
          </div>
        )}

        {state && state !== "missing" && (
          <div className="flex flex-wrap items-center justify-center gap-2">
            <FriendButton alias={alias} state={state} />
            {state === "friends" && (
              <button onClick={() => setChallenging(true)} className={primary}>
                <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true"><path d="M7 3l10 9-10 9" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                Challenge
              </button>
            )}
            {card && (
              <button onClick={() => void share()} className={secondary}>
                <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true"><path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /></svg>
                {canShare ? "Share card" : "Copy link"}
              </button>
            )}
            {state === "signed_out" && (
              <Link href="/profile" className={secondary}>Get your own card →</Link>
            )}
          </div>
        )}
        <Link href="/friends" className="text-center text-sm text-muted underline">Your friends</Link>
      </div>
      {challenging && <ChallengeDialog alias={alias} myName="" onClose={() => setChallenging(false)} />}
    </main>
  );
}

function FriendButton({ alias, state }: { alias: string; state: "signed_out" | "self" | "none" | "outgoing" | "incoming" | "friends" }) {
  const request = useMutation(api.friends.request);
  const respond = useMutation(api.friends.respond);
  const remove = useMutation(api.friends.remove);
  const [busy, setBusy] = useState(false);
  const run = (work: () => Promise<unknown>) => {
    setBusy(true);
    void work().finally(() => setBusy(false));
  };

  switch (state) {
    case "signed_out":
      return (
        <SignInButton mode="modal">
          <button className={primary}>Sign in to add friend</button>
        </SignInButton>
      );
    case "self":
      return <Link href="/profile" className={primary}>Edit your card</Link>;
    case "none":
      return (
        <button disabled={busy} onClick={() => run(() => request({ alias }))} className={primary}>
          <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true"><path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /></svg>
          Add friend
        </button>
      );
    case "outgoing":
      return (
        <button disabled={busy} onClick={() => run(() => remove({ alias }))} className={secondary} title="Cancel request">
          Request sent · Cancel
        </button>
      );
    case "incoming":
      return (
        <>
          <button disabled={busy} onClick={() => run(() => respond({ alias, accept: true }))} className={primary}>Accept friend request</button>
          <button disabled={busy} onClick={() => run(() => respond({ alias, accept: false }))} className={secondary}>Decline</button>
        </>
      );
    case "friends":
      return (
        <button disabled={busy} onClick={() => confirm(`Remove @${alias} from your friends?`) && run(() => remove({ alias }))} className={secondary} title="Remove friend">
          <svg viewBox="0 0 24 24" className="h-4 w-4 text-ok" aria-hidden="true"><path d="m5 12 5 5 9-10" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
          Friends
        </button>
      );
  }
}
