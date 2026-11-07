"use client";

import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { useDeferredValue, useState } from "react";
import Link from "@/components/navigation/PrefetchLink";
import { api } from "@/convex/_generated/api";
import { Avatar } from "@/components/profile/ChessCard";
import { ChallengeDialog } from "@/components/online/ChallengeDialog";
import { errorText } from "@/components/online/OnlineShared";

const pill = "grid min-h-9 place-items-center rounded-full px-3.5 text-sm font-semibold";

/** Search every player by username; add, accept or challenge from the results. */
export function PlayerSearch({ myAlias, autoFocus = false }: { myAlias?: string; autoFocus?: boolean }) {
  const { isAuthenticated } = useConvexAuth();
  const [q, setQ] = useState("");
  const query = useDeferredValue(q.trim());
  const results = useQuery(api.friends.search, query ? { q: query } : "skip");
  const request = useMutation(api.friends.request);
  const respond = useMutation(api.friends.respond);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [challenging, setChallenging] = useState<string | null>(null);

  const act = async (alias: string, action: () => Promise<unknown>, done: string) => {
    setBusy(alias);
    setMessage(null);
    try { await action(); setMessage({ ok: true, text: done }); }
    catch (error) { setMessage({ ok: false, text: errorText(error) }); }
    finally { setBusy(null); }
  };

  return (
    <div className="grid gap-2">
      <label className="relative block">
        <span className="sr-only">Search players by username</span>
        <svg viewBox="0 0 24 24" aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted"><circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.8" /><path d="m16 16 4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search players by username"
          autoCapitalize="none"
          autoCorrect="off"
          autoFocus={autoFocus}
          className="min-h-12 w-full rounded-2xl bg-surface pl-11 pr-4 shadow-[var(--shadow)] outline-none focus-visible:ring-2 focus-visible:ring-accent"
        />
      </label>
      {message && <p role="status" className={`px-1 text-sm ${message.ok ? "text-ok" : "text-danger"}`}>{message.text}</p>}
      {query && (
        <ul className="divide-y divide-line overflow-hidden rounded-2xl bg-surface shadow-[var(--shadow)]" aria-label="Search results">
          {results === undefined && <li className="px-4 py-3 text-sm text-muted">Searching…</li>}
          {results && results.length === 0 && <li className="px-4 py-3 text-sm text-muted">No player called “{query.replace(/^@/, "")}”.</li>}
          {results?.map((p) => (
            <li key={p.alias} className="flex items-center gap-3 px-3 py-2.5">
              <Link href={`/u/${p.alias}`} className="flex min-w-0 flex-1 items-center gap-3">
                <span className="shrink-0 overflow-hidden rounded-xl"><Avatar seed={p.avatarSeed} hue={p.hue} size={40} /></span>
                <span className="min-w-0">
                  <span className="block truncate font-semibold">@{p.alias}</span>
                  <span className="block text-xs text-muted">{p.relation === "me" ? "You" : p.relation === "friends" ? "Friend" : p.relation === "outgoing" ? "Request sent" : p.relation === "incoming" ? "Wants to be friends" : p.isPublic ? "Public profile" : "Private profile"}</span>
                </span>
              </Link>
              {isAuthenticated && p.relation !== "me" && (
                <div className="flex shrink-0 gap-1.5">
                  {p.relation === "none" && <button disabled={busy === p.alias} onClick={() => void act(p.alias, () => request({ alias: p.alias }), `Request sent to @${p.alias}.`)} className={`${pill} bg-accent text-accent-text disabled:opacity-50`}>Add friend</button>}
                  {p.relation === "incoming" && <button disabled={busy === p.alias} onClick={() => void act(p.alias, () => respond({ alias: p.alias, accept: true }), `You and @${p.alias} are friends.`)} className={`${pill} bg-accent text-accent-text disabled:opacity-50`}>Accept</button>}
                  {p.relation === "friends" && <button onClick={() => setChallenging(p.alias)} className={`${pill} bg-accent text-accent-text`}>Challenge</button>}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {challenging && <ChallengeDialog alias={challenging} myName={myAlias ?? ""} onClose={() => setChallenging(null)} />}
    </div>
  );
}
