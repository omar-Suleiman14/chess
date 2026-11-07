"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "@/components/navigation/PrefetchLink";
import { PageHeader } from "@/components/shell/AppShell";
import { pickPuzzle, puzzlesFor, THEMES, type Puzzle } from "@/lib/chess/puzzles";
import { usePuzzleStats } from "@/lib/client/puzzleStats";
import { PuzzlePlayer } from "./PuzzlePlayer";

/** Endless rated puzzles near the player's rating, optionally one theme. */
export function RatedPuzzles() {
  const requested = useSearchParams().get("theme");
  const theme = THEMES.some((t) => t.id === requested) ? requested : null;
  const { stats, record } = usePuzzleStats();
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  const [delta, setDelta] = useState<number | null>(null);
  const [count, setCount] = useState(0);
  const themeLabel = THEMES.find((t) => t.id === theme)?.label;

  const next = () => {
    setDelta(null);
    setCount((c) => c + 1);
    setPuzzle(pickPuzzle(stats.rating, { theme, exclude: new Set(stats.seen) }));
  };

  // First pick happens on the client: it depends on this device's rating and history.
  useEffect(() => {
    const t = setTimeout(() => setPuzzle((current) => current ?? pickPuzzle(stats.rating, { theme, exclude: new Set(stats.seen) })), 0);
    return () => clearTimeout(t);
  }, [stats.rating, stats.seen, theme]);

  const onResult = ({ clean }: { clean: boolean }) => {
    if (!puzzle) return;
    void record(puzzle.id, clean).then((r) => setDelta(r.rated ? Math.round(r.delta) : 0));
  };

  return (
    <main id="main-content" className="mx-auto min-h-dvh max-w-6xl px-3 pb-6">
      <PageHeader title={themeLabel ? `Puzzles · ${themeLabel}` : "Puzzles"} />
      <div className="mb-3 flex items-center justify-between px-1 text-sm">
        <span className="text-muted">Rating <b data-live-rating className="text-ink tabular-nums">{Math.round(stats.rating)}</b> · streak <b className="text-ink tabular-nums">{stats.streak}</b></span>
        {theme && <Link href="/puzzles/rated" data-clear-theme className="flex items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1.5 font-semibold">Theme: {themeLabel} <span aria-hidden="true">✕</span><span className="sr-only">Clear theme filter</span></Link>}
      </div>
      {theme && puzzlesFor(theme).length === 0 ? (
        <div className="mx-auto grid max-w-md gap-3 rounded-3xl bg-surface p-6 text-center shadow-[var(--shadow)]">
          <p className="text-lg font-bold">No {themeLabel?.toLowerCase()} puzzles yet</p>
          <p className="text-sm text-muted">New puzzles are added as more are generated. Try every theme in the meantime.</p>
          <Link href="/puzzles/rated" className="rounded-xl bg-[#81b64c] py-3 font-bold text-white">Solve puzzles from every theme</Link>
          <Link href="/puzzles" className="text-sm underline">Back to Puzzles</Link>
        </div>
      ) : puzzle ? (
        <PuzzlePlayer key={`${puzzle.id}-${count}`} puzzle={puzzle} mode="rated" onResult={onResult} onNext={next} delta={delta} ratingLabel="Your rating change" />
      ) : (
        <div className="mx-auto grid aspect-square w-full max-w-[min(100%,calc(100dvh-220px),720px)] animate-pulse place-items-center rounded-[10px] bg-surface-2 text-sm text-muted" role="status">Picking a puzzle near your rating…</div>
      )}
    </main>
  );
}
