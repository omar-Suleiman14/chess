"use client";

import Link from "@/components/navigation/PrefetchLink";
import { PageHeader } from "@/components/shell/AppShell";
import { dailyPuzzle, puzzlesFor, PUZZLES, RUSH_MODES, THEMES } from "@/lib/chess/puzzles";
import { rushBest, usePuzzleStats } from "@/lib/client/puzzleStats";
import { RatingSparkline } from "./RatingSparkline";

export function PuzzlesHome() {
  const { stats, synced } = usePuzzleStats();
  const daily = dailyPuzzle(new Date());
  const solvedPct = stats.attempts ? Math.round((stats.solved / stats.attempts) * 100) : null;
  const themes = THEMES.map((t) => ({ ...t, count: puzzlesFor(t.id).length })).filter((t) => t.count > 0);

  return (
    <main id="main-content" className="mx-auto min-h-dvh max-w-3xl pb-12">
      <PageHeader title="Puzzles" back={false} />
      <div className="grid gap-5 px-4">
        <section aria-label="Your puzzle rating" className="grid gap-4 rounded-3xl bg-surface p-5 shadow-[var(--shadow)] sm:grid-cols-[1fr_auto] sm:items-center">
          <div>
            <p className="text-sm text-muted">Puzzle rating{synced ? "" : " · this device"}</p>
            <p data-puzzle-rating className="text-5xl font-black tabular-nums tracking-tight">{Math.round(stats.rating)}</p>
            <p className="mt-1 text-sm text-muted">
              {stats.attempts === 0 ? "Solve your first puzzle to start your rating." : `${stats.attempts} rated · ${solvedPct}% solved · best streak ${stats.bestStreak}`}
            </p>
          </div>
          <RatingSparkline points={stats.history} />
        </section>

        <Link href="/puzzles/rated" className="group flex items-center justify-between gap-4 rounded-3xl bg-accent p-5 text-accent-text transition-transform active:scale-[.99]">
          <span>
            <span className="block text-2xl font-black">Solve puzzles</span>
            <span className="block text-sm opacity-80">Rated tactics picked for your level</span>
          </span>
          <span aria-hidden="true" className="text-3xl transition-transform group-hover:translate-x-1">→</span>
        </Link>

        <div className="grid gap-3 sm:grid-cols-2">
          <Link href="/puzzles/rush" className="rounded-3xl bg-surface p-5 shadow-[var(--shadow)] transition-transform active:scale-[.99]">
            <span className="text-sm font-semibold uppercase tracking-wide text-[#e0a43a]">Puzzle Rush</span>
            <span className="mt-1 block text-xl font-bold">Beat the clock</span>
            <span className="mt-1 block text-sm text-muted">Three strikes and you&apos;re out.</span>
            <span className="mt-3 flex gap-3 text-sm tabular-nums">
              {RUSH_MODES.map((m) => (
                <span key={m.id} className="rounded-full bg-surface-2 px-2.5 py-1"><span className="text-muted">{m.label.replace(" minutes", "m")}</span> <b>{rushBest(stats, m.id)}</b></span>
              ))}
            </span>
          </Link>
          <Link href="/puzzles/daily" className="rounded-3xl bg-surface p-5 shadow-[var(--shadow)] transition-transform active:scale-[.99]">
            <span className="text-sm font-semibold uppercase tracking-wide text-[#5aa0d6]">Daily puzzle</span>
            <span className="mt-1 block text-xl font-bold">{new Date().toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}</span>
            <span className="mt-1 block text-sm text-muted">One new puzzle every day · rated {daily.rating}</span>
          </Link>
        </div>

        <section aria-labelledby="themes">
          <h2 id="themes" className="mb-2 px-1 text-sm font-medium uppercase tracking-wide text-muted">Themes</h2>
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {themes.map((t) => (
              <li key={t.id}>
                <Link href={`/puzzles/rated?theme=${t.id}`} className="flex h-full min-h-20 flex-col justify-between rounded-2xl bg-surface p-3 shadow-[var(--shadow)]">
                  <span className="font-semibold">{t.label}</span>
                  <span className="text-xs text-muted">{t.description} · {t.count}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <p className="px-1 text-sm leading-6 text-muted">
          {PUZZLES.length.toLocaleString()} original puzzles, mined from Stockfish games and checked so every move you play is the only winning one. Any checkmate counts. Using a hint or the solution counts as a miss for your rating; each puzzle is rated once.
        </p>
      </div>
    </main>
  );
}
