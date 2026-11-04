"use client";

import { SignInButton } from "@clerk/nextjs";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { PageHeader } from "@/components/shell/AppShell";

export default function ProgressPage() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const summary = useQuery(api.progress.summary, isAuthenticated ? {} : "skip");

  if (!isLoading && !isAuthenticated) {
    return (
      <main className="mx-auto max-w-xl">
        <PageHeader title="Progress" />
        <div className="px-4">
          <p>Sign in to track ratings and progress across devices.</p>
          <SignInButton mode="modal">
            <button className="mt-3 rounded-full bg-accent px-4 py-2 text-accent-text">Sign in</button>
          </SignInButton>
        </div>
      </main>
    );
  }
  if (!summary) return <p className="p-6 text-muted" role="status">Loading…</p>;

  const pool = (name: string) => (name === "climb" ? "The Climb" : name.startsWith("timed:") ? `Timed ${name.slice(6).replace("+", " + ")}` : name);
  const record = (r: { games: number; wins: number; draws: number; losses: number }) => `${r.wins}W · ${r.draws}D · ${r.losses}L`;

  return (
    <main className="mx-auto min-h-dvh max-w-xl pb-12">
      <PageHeader title="Progress" />
      <div className="grid gap-4 px-4">
        <section className="rounded-2xl bg-surface p-4 shadow-[var(--shadow)]" aria-labelledby="ratings">
          <h2 id="ratings" className="font-semibold">Ratings</h2>
          {summary.ratings.length === 0 ? (
            <p className="mt-1 text-sm text-muted">No rated games yet. Rated games come from The Climb and Timed without undo, hints or the eval bar.</p>
          ) : (
            <ul className="mt-2 grid gap-2">
              {summary.ratings.map((r) => (
                <li key={r.pool} className="flex items-baseline justify-between">
                  <span>{pool(r.pool)}</span>
                  <span className="tabular-nums">
                    <span className="text-xl font-semibold">{r.rating}</span>
                    <span className="text-sm text-muted"> ({r.interval.low}–{r.interval.high}) · {r.games} games{r.provisional ? " · provisional" : ""}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-muted">
            Glicko-2 ratings against this app&apos;s own opponent pool. They are not FIDE, Chess.com or Lichess ratings, and opponent strengths are uncalibrated estimates until benchmarked.
          </p>
        </section>

        <section className="rounded-2xl bg-surface p-4 shadow-[var(--shadow)]" aria-labelledby="climb">
          <h2 id="climb" className="font-semibold">The Climb</h2>
          <div className="mt-2 flex gap-1" aria-label={`Level ${summary.climb.unlockedLevel + 1} of ${summary.climb.ladder.length} unlocked`}>
            {summary.climb.ladder.map((o, i) => (
              <span
                key={o.id}
                title={o.name}
                className={`h-2 flex-1 rounded-full ${summary.climb.beaten.includes(o.id) ? "bg-ok" : i <= summary.climb.unlockedLevel ? "bg-ink/40" : "bg-line"}`}
              />
            ))}
          </div>
          <p className="mt-2 text-sm text-muted">{summary.climb.beaten.length} of {summary.climb.ladder.length} levels beaten · {record(summary.climbGames)}</p>
        </section>

        <section className="rounded-2xl bg-surface p-4 shadow-[var(--shadow)]" aria-labelledby="fp">
          <h2 id="fp" className="font-semibold">Full Power</h2>
          <p className="mt-1 text-sm">{summary.fullPower.games} finished · {record(summary.fullPower)}</p>
          <p className="text-sm text-muted">Average length {summary.fullPower.averageLength} plies. Not a rating: Sherine&apos;s 3000 is a nominal label.</p>
        </section>

        <section className="rounded-2xl bg-surface p-4 shadow-[var(--shadow)]" aria-labelledby="timed">
          <h2 id="timed" className="font-semibold">Timed</h2>
          <p className="mt-1 text-sm">{summary.timedGames.games} finished · {record(summary.timedGames)}</p>
        </section>
        <p className="px-1 text-xs text-muted">Based on your last {summary.sampleWindow} games.</p>
      </div>
    </main>
  );
}
