"use client";

import { useConvexAuth, useMutation, usePaginatedQuery } from "convex/react";
import Link from "@/components/navigation/PrefetchLink";
import { useAppRouter as useRouter } from "@/components/navigation/useAppRouter";
import { useEffect, useState } from "react";
import { api } from "@/convex/_generated/api";
import { PageHeader } from "@/components/shell/AppShell";
import { findOpponent } from "@/lib/chess/engine/opponents";
import { newKey } from "@/lib/client/ids";
import { store, type LocalGame } from "@/lib/client/store";

const MODE: Record<string, string> = { full_power: "Full Power", climb: "Climb", timed: "Timed", practice: "Branch", import: "Imported" };

export default function TimeMachinePage() {
  const { isAuthenticated } = useConvexAuth();
  const router = useRouter();
  const remote = usePaginatedQuery(api.games.list, isAuthenticated ? {} : "skip", { initialNumItems: 25 });
  const importGame = useMutation(api.games.importGame);
  const [local, setLocal] = useState<LocalGame[]>([]);
  const [pgn, setPgn] = useState("");
  const [importError, setImportError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    void store.recentGames(30).then(setLocal);
  }, []);

  const remoteKeys = new Set(remote.results.map((g) => g.gameKey));
  const localOnly = local.filter((g) => !remoteKeys.has(g.meta.gameKey) && Object.keys(g.tree.nodes).length > 1);

  const doImport = async () => {
    setImportError(null);
    setImporting(true);
    try {
      const gameKey = newKey("i");
      await importGame({ opId: newKey("op"), gameKey, pgn, humanColor: "w" });
      router.push(`/time-machine/${gameKey}`);
    } catch (error) {
      const data = (error as { data?: { message?: string } }).data;
      setImportError(data?.message ?? "Could not import that PGN.");
    } finally {
      setImporting(false);
    }
  };

  return (
    <main className="mx-auto min-h-dvh max-w-xl pb-12">
      <PageHeader title="Time Machine" />
      <div className="grid gap-5 px-4">
        <p className="text-sm text-muted">Replay any game, scrub through it, and continue from any move. Originals are never changed.</p>
        <ul className="overflow-hidden rounded-2xl bg-surface shadow-[var(--shadow)]">
          {remote.results.map((g) => (
            <li key={g.gameKey} className="border-b border-line last:border-b-0">
              <Link href={`/time-machine/${g.gameKey}`} className="flex min-h-14 items-center justify-between gap-3 px-4 py-3">
                <span className="min-w-0">
                  <span className="block truncate font-medium">{g.label ?? `${MODE[g.mode]} vs ${findOpponent(g.opponentId)?.name ?? "Sherine"}`}</span>
                  <span className="text-xs text-muted">
                    {new Date(g.startedAt).toLocaleDateString()} · {Math.ceil(g.moveCount / 2)} moves{g.parentGameKey ? " · branch" : ""}
                  </span>
                </span>
                <span className="shrink-0 text-sm tabular-nums text-muted">{g.status === "finished" ? g.result ?? "–" : "in play"}</span>
              </Link>
            </li>
          ))}
          {localOnly.map((g) => (
            <li key={g.meta.gameKey} className="border-b border-line last:border-b-0">
              <Link href={`/time-machine/${g.meta.gameKey}`} className="flex min-h-14 items-center justify-between gap-3 px-4 py-3">
                <span>
                  <span className="block font-medium">{MODE[g.meta.mode]} · on this device</span>
                  <span className="text-xs text-muted">{new Date(g.meta.updatedAt).toLocaleDateString()}</span>
                </span>
                <span className="text-sm text-muted">{g.meta.result ?? "in play"}</span>
              </Link>
            </li>
          ))}
          {remote.results.length === 0 && localOnly.length === 0 && <li className="px-4 py-4 text-sm text-muted">No games yet. Play one first.</li>}
        </ul>
        {remote.status === "CanLoadMore" && (
          <button onClick={() => remote.loadMore(25)} className="min-h-12 rounded-2xl bg-surface shadow-[var(--shadow)]">
            Load more
          </button>
        )}

        {isAuthenticated && (
          <details className="rounded-2xl bg-surface p-4 shadow-[var(--shadow)]">
            <summary className="cursor-pointer font-medium">Import PGN</summary>
            <textarea
              value={pgn}
              onChange={(e) => setPgn(e.target.value)}
              rows={6}
              maxLength={200_000}
              aria-label="PGN text"
              placeholder="1. e4 e5 2. Nf3 (2. f4) Nc6 *"
              className="mt-3 w-full rounded-xl bg-surface-2 p-3 font-mono text-sm"
            />
            {importError && <p className="mt-2 text-sm text-danger" role="alert">{importError}</p>}
            <button onClick={() => void doImport()} disabled={!pgn.trim() || importing} className="mt-2 min-h-11 w-full rounded-xl bg-accent font-medium text-accent-text disabled:opacity-40">
              {importing ? "Importing…" : "Import"}
            </button>
          </details>
        )}
      </div>
    </main>
  );
}
