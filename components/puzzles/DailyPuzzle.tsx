"use client";

import { useSyncExternalStore } from "react";
import Link from "@/components/navigation/PrefetchLink";
import { PageHeader } from "@/components/shell/AppShell";
import { dailyPuzzle } from "@/lib/chess/puzzles";
import { PuzzlePlayer } from "./PuzzlePlayer";

const subscribeNever = () => () => {};

/** The puzzle of the day (UTC), unrated so everyone can share it. */
export function DailyPuzzle() {
  // The date is read on the client so a cached page never shows yesterday's puzzle.
  const day = useSyncExternalStore(subscribeNever, () => new Date().toISOString().slice(0, 10), () => null);
  const puzzle = day ? dailyPuzzle(new Date(`${day}T12:00:00Z`)) : null;
  return (
    <main id="main-content" className="mx-auto min-h-dvh max-w-6xl px-3 pb-6">
      <PageHeader title="Daily puzzle" />
      <p className="mb-3 px-1 text-sm text-muted">{day ? new Date(`${day}T12:00:00Z`).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" }) : " "} · not rated · <Link className="underline" href="/puzzles/rated">rated puzzles</Link></p>
      {puzzle && <PuzzlePlayer key={puzzle.id} puzzle={puzzle} mode="practice" />}
    </main>
  );
}
