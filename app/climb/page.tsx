"use client";

import { useConvexAuth, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "@/convex/_generated/api";
import { GameScreen } from "@/components/chess/GameScreen";
import { PageHeader } from "@/components/shell/AppShell";
import { CLIMB_OPPONENTS, ratingLabel } from "@/lib/chess/engine/opponents";

export default function ClimbPage() {
  const { isAuthenticated } = useConvexAuth();
  const climb = useQuery(api.progress.climb, isAuthenticated ? {} : "skip");
  const [level, setLevel] = useState<string | null>(null);
  const unlocked = climb?.unlockedLevel ?? 0;

  if (level) {
    return <GameScreen key={level} startFresh defaults={{ mode: "climb", opponentId: level, humanColor: "w" }} />;
  }

  return (
    <main className="mx-auto min-h-dvh max-w-xl pb-10">
      <PageHeader title="The Climb" />
      <div className="px-4">
        <div className="rounded-2xl bg-surface p-4 shadow-[var(--shadow)]">
          {climb?.rating ? (
            <p className="text-2xl font-semibold">
              {climb.rating.rating} <span className="text-base font-normal text-muted">± {Math.round(climb.rating.rd * 1.96)}</span>
            </p>
          ) : (
            <p className="text-2xl font-semibold">Unrated</p>
          )}
          <p className="mt-1 text-sm text-muted">
            {climb?.rating?.provisional !== false ? "Provisional Climb rating (Glicko-2). " : "Climb rating (Glicko-2). "}
            Opponent ratings are uncalibrated estimates until benchmarked. Undo, hints or the eval bar make a game unrated.
          </p>
          {!isAuthenticated && <p className="mt-2 text-sm">Sign in to keep a rating. Guest games are practice.</p>}
        </div>
        <ol className="mt-4 overflow-hidden rounded-2xl bg-surface shadow-[var(--shadow)]">
          {CLIMB_OPPONENTS.map((o, i) => {
            const locked = i > unlocked;
            const beaten = climb?.beaten.includes(o.id);
            return (
              <li key={o.id} className="border-b border-line last:border-b-0">
                <button
                  disabled={locked}
                  onClick={() => setLevel(o.id)}
                  className="flex min-h-14 w-full items-center justify-between px-4 py-3 text-left disabled:opacity-40"
                  aria-label={`${o.name}, rating ${ratingLabel(o)}${locked ? ", locked" : ""}${beaten ? ", beaten" : ""}`}
                >
                  <span>
                    <span className="mr-3 text-sm tabular-nums text-muted">{String(i + 1).padStart(2, "0")}</span>
                    <span className="font-medium">{o.name}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1.5 text-sm text-muted">
                    {beaten ? <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true"><path d="m5 12 4 4L19 6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg> : locked ? <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.7" /><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg> : null}
                    {ratingLabel(o)}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
        <p className="mt-3 px-1 text-xs text-muted">Beat a level to unlock the next. Levels 1-4 are scripted beginner bots below Stockfish&apos;s weakest setting.</p>
      </div>
    </main>
  );
}
