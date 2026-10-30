"use client";

import { SignInButton } from "@clerk/nextjs";
import { useConvexAuth, useMutation } from "convex/react";
import { useQuery } from "convex-helpers/react/cache/hooks";
import Link from "@/components/navigation/PrefetchLink";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { useSocialTime } from "@/lib/client/socialCache";
import { CardProfileLink } from "@/components/profile/CardProfileLink";
import { useCardScope, useLocalCardQuery } from "@/lib/client/localCardCache";
import { useEffect, useState } from "react";
import { api } from "@/convex/_generated/api";
import { ChallengeDialog } from "@/components/online/ChallengeDialog";
import { errorText } from "@/components/online/OnlineShared";
import { Segmented } from "@/components/chess/GameScreen";
import { CardStack } from "@/components/profile/CardStack";
import { Avatar } from "@/components/profile/ChessCard";
import { PageHeader } from "@/components/shell/AppShell";
import { useOrigin } from "@/lib/client/useOrigin";

type Person = { alias: string; avatarSeed: string; hue: number };

function PersonRow({ person, children }: { person: Person; children?: React.ReactNode }) {
  return (
    <li className="flex items-center gap-3 py-2.5">
      <CardProfileLink alias={person.alias} className="flex min-w-0 flex-1 items-center gap-3">
        <span className="shrink-0 overflow-hidden rounded-xl"><Avatar seed={person.avatarSeed} hue={person.hue} size={40} /></span>
        <span className="truncate font-medium">@{person.alias}</span>
      </CardProfileLink>
      <div className="flex shrink-0 items-center gap-1.5">{children}</div>
    </li>
  );
}

function Section({ title, children, flat = false }: { title: string; children: React.ReactNode; flat?: boolean }) {
  return (
    <section className={flat ? "rounded-2xl bg-surface-2/60 px-3.5 py-2 ring-1 ring-inset ring-line" : "rounded-3xl bg-surface px-4 py-3 shadow-[var(--shadow)]"}>
      <h2 className={`pb-1 font-semibold text-muted ${flat ? "text-xs uppercase tracking-wide" : "text-sm"}`}>{title}</h2>
      <ul className="divide-y divide-line">{children}</ul>
    </section>
  );
}

const pill = "min-h-9 rounded-full px-3.5 text-sm font-medium";

export function FriendsContent({ embedded = false }: { embedded?: boolean }) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const mountedAt = useSocialTime();
  const data = useQuery(api.friends.overview, isAuthenticated ? { now: mountedAt } : "skip");
  const ensure = useMutation(api.profiles.ensure);
  const request = useMutation(api.friends.request);
  const respond = useMutation(api.friends.respond);
  const remove = useMutation(api.friends.remove);
  const dismiss = useMutation(api.friends.dismissChallenge);
  const [alias, setAlias] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [challenging, setChallenging] = useState<string | null>(null);
  const scope = useCardScope();
  const cards = useLocalCardQuery(api.friends.cards, isAuthenticated && !embedded ? {} : "skip", scope);
  const origin = useOrigin();
  const [view, setView] = useState<"cards" | "list">("cards");
  useEffect(() => {
    try {
      const saved = localStorage.getItem("cbc.friends.view");
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved === "list" || saved === "cards") setView(saved);
    } catch {
      // ignore
    }
  }, []);
  const changeView = (v: "cards" | "list") => {
    setView(v);
    try {
      localStorage.setItem("cbc.friends.view", v);
    } catch {
      // ignore
    }
  };

  // Friends need a card (alias) to find each other.
  useEffect(() => {
    if (isAuthenticated && data && !data.me) void ensure({});
  }, [isAuthenticated, data, ensure]);

  const add = async () => {
    const target = alias.trim().replace(/^@/, "").toLowerCase();
    if (!target || busy) return;
    setBusy(true);
    setMessage(null);
    try {
      await request({ alias: target });
      setAlias("");
      setMessage({ ok: true, text: `Request sent to @${target}.` });
    } catch (e) {
      setMessage({ ok: false, text: errorText(e) });
    } finally {
      setBusy(false);
    }
  };
  const act = async (action: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try { await action(); } catch (error) { setMessage({ ok: false, text: errorText(error) }); }
    finally { setBusy(false); }
  };

  if (!isLoading && !isAuthenticated) {
    return (
      <div className={embedded ? "min-w-0" : "mx-auto min-h-dvh max-w-xl overflow-x-clip pb-10"}>
        {!embedded && <PageHeader title="Friends" />}
        <div className="grid gap-4 px-4 text-center">
          <p className="text-sm text-muted">Sign in to add friends, see their cards and challenge them. You can still play anyone with a link or PIN without an account.</p>
          <SignInButton mode="modal">
            <button className="min-h-12 rounded-2xl bg-accent font-semibold text-accent-text">Sign in</button>
          </SignInButton>
          <Link href="/play" className="text-sm underline">Play a friend without an account</Link>
        </div>
      </div>
    );
  }

  const addForm = (
      <>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void add();
          }}
        >
          <input
            value={alias}
            onChange={(e) => setAlias(e.target.value)}
            placeholder="Add by username, e.g. @omar"
            aria-label="Friend's username"
            autoCapitalize="none"
            autoCorrect="off"
            className="min-h-12 min-w-0 flex-1 rounded-2xl bg-surface px-4 shadow-[var(--shadow)] outline-none focus-visible:ring-2 focus-visible:ring-accent"
          />
          <button type="submit" disabled={!alias.trim() || busy} className="min-h-12 shrink-0 rounded-2xl bg-accent px-3 font-semibold text-accent-text disabled:opacity-40">
            {busy ? "Working…" : "Add Friend"}
          </button>
        </form>
        {message && <p role="status" className={`text-sm ${message.ok ? "text-ok" : "text-danger"}`}>{message.text}</p>}
        {data?.me && (
          <p className="text-xs text-muted">
            Your username is <Link href={`/u/${data.me.alias}`} className="font-medium text-ink underline">@{data.me.alias}</Link>. Friends can also scan the QR on the back of your card in <Link href="/profile" className="underline">Profile</Link>.
          </p>
        )}

      </>
  );

  return (
    <div className={embedded ? "min-w-0" : "mx-auto min-h-dvh max-w-xl overflow-x-clip pb-10"}>
      {!embedded && <PageHeader title="Friends" />}
      <div className={embedded ? "grid gap-3" : "grid gap-4 px-4"}>
        {!embedded && addForm}
        {(data === undefined || (!embedded && view === "cards" && cards === undefined)) && <LoadingSpinner label="Loading friends" />}

        {data && data.challenges.length > 0 && (
          <Section flat={embedded} title="Challenges for you">
            {data.challenges.map((c) => (
              <PersonRow key={c.id} person={c.from}>
                <Link href={`/play/${c.code}`} className={`${pill} grid place-items-center bg-accent text-accent-text`}>Play</Link>
                <button disabled={busy} onClick={() => void act(() => dismiss({ id: c.id }))} className={`${pill} bg-surface-2`} aria-label={`Dismiss invite from @${c.from.alias}`}>✕</button>
              </PersonRow>
            ))}
          </Section>
        )}

        {data && data.incoming.length > 0 && (
          <Section flat={embedded} title="Friend requests">
            {data.incoming.map((p) => (
              <PersonRow key={p.alias} person={p}>
                <button disabled={busy} onClick={() => void act(() => respond({ alias: p.alias, accept: true }))} className={`${pill} bg-accent text-accent-text`}>Accept</button>
                <button disabled={busy} onClick={() => void act(() => respond({ alias: p.alias, accept: false }))} className={`${pill} bg-surface-2`}>Decline</button>
              </PersonRow>
            ))}
          </Section>
        )}

        {!embedded && data && data.friends.length > 0 && <Segmented label="Show friends as" value={view} onChange={changeView} options={[["cards", "Cards"], ["list", "List"]]} />}

        {!embedded && data && view === "cards" && cards && cards.length > 0 && (
          <CardStack
            cards={cards.map((c) => ({ id: c.alias, face: "identity" as const, data: c, url: `${origin}/u/${c.alias}`, label: `@${c.alias}` }))}
            label="Friends' cards"
            footer={(card) => (
              <>
                <button onClick={() => setChallenging(card.id)} className={`${pill} min-h-11 bg-accent px-5 text-accent-text`}>Challenge @{card.id}</button>
                <Link href={`/u/${card.id}`} className={`${pill} grid min-h-11 place-items-center bg-surface px-5 shadow-[var(--shadow)]`}>Open profile</Link>
              </>
            )}
          />
        )}

        {data && (embedded || view === "list" || data.friends.length === 0) && (
          <Section flat={embedded} title={`Friends${data.friends.length ? ` · ${data.friends.length}` : ""}`}>
            {data.friends.length === 0 && <li className="py-3 text-sm text-muted">{embedded ? "No friends yet. Add someone below, or play anyone with a link." : "No friends yet. Add someone by username, or scan their card."}</li>}
            {data.friends.map((p) => (
              <PersonRow key={p.alias} person={p}>
                <button onClick={() => setChallenging(p.alias)} className={`${pill} bg-accent text-accent-text`}>Challenge</button>
              </PersonRow>
            ))}
          </Section>
        )}

        {data && data.outgoing.length > 0 && (
          <Section flat={embedded} title="Sent requests">
            {data.outgoing.map((p) => (
              <PersonRow key={p.alias} person={p}>
                <button disabled={busy} onClick={() => void act(() => remove({ alias: p.alias }))} className={`${pill} bg-surface-2`}>Cancel</button>
              </PersonRow>
            ))}
          </Section>
        )}
        {embedded && addForm}
      </div>
      {challenging && <ChallengeDialog alias={challenging} myName={data?.me?.alias ?? ""} onClose={() => setChallenging(null)} />}
    </div>
  );
}
