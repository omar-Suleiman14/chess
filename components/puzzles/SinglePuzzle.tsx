"use client";

import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/shell/AppShell";
import { findPuzzle } from "@/lib/chess/puzzles";
import { PuzzlePlayer } from "./PuzzlePlayer";

/** One puzzle by id, for reviewing a Rush run or sharing a link. Not rated. */
export function SinglePuzzle({ id }: { id: string }) {
  const router = useRouter();
  const puzzle = findPuzzle(id)!;
  return (
    <main id="main-content" className="mx-auto min-h-dvh max-w-6xl px-3 pb-6">
      <PageHeader title={`Puzzle ${puzzle.id}`} />
      <p className="mb-3 px-1 text-sm text-muted">Rated {puzzle.rating} · practice, not rated</p>
      <PuzzlePlayer key={puzzle.id} puzzle={puzzle} mode="practice" onNext={() => router.push("/puzzles/rated")} />
    </main>
  );
}
