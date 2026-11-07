import { notFound } from "next/navigation";
import { SinglePuzzle } from "@/components/puzzles/SinglePuzzle";
import { findPuzzle } from "@/lib/chess/puzzles";
import { pageMetadata } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ puzzleId: string }> }) {
  const { puzzleId } = await params;
  const puzzle = findPuzzle(puzzleId);
  if (!puzzle) notFound();
  return pageMetadata(`Puzzle ${puzzle.id}`, `A chess puzzle rated ${puzzle.rating}.`, `/puzzles/${puzzle.id}`, false);
}

export default async function PuzzlePage({ params }: { params: Promise<{ puzzleId: string }> }) {
  const { puzzleId } = await params;
  if (!findPuzzle(puzzleId)) notFound();
  return <SinglePuzzle id={puzzleId} />;
}
