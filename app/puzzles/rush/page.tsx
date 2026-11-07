import { PuzzleRush } from "@/components/puzzles/PuzzleRush";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata("Puzzle Rush", "Solve as many chess puzzles as you can before time runs out. Three strikes and you're out.", "/puzzles/rush");

export default function RushPage() {
  return <PuzzleRush />;
}
