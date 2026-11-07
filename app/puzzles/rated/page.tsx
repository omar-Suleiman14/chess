import { RatedPuzzles } from "@/components/puzzles/RatedPuzzles";
import { THEMES } from "@/lib/chess/puzzles";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata("Solve puzzles", "Rated chess puzzles picked for your level.", "/puzzles/rated", false);

export default async function RatedPage({ searchParams }: { searchParams: Promise<{ theme?: string }> }) {
  const { theme } = await searchParams;
  const known = THEMES.some((t) => t.id === theme) ? theme! : null;
  return <RatedPuzzles theme={known} />;
}
