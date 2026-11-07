import { AnalysisBoard } from "@/components/analysis/AnalysisBoard";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata("Analysis board", "Analyse any chess position with Stockfish: move both sides, see the top engine lines, draw arrows and load a FEN.", "/analysis");

export default async function AnalysisPage({ searchParams }: { searchParams: Promise<{ fen?: string }> }) {
  const { fen } = await searchParams;
  return <AnalysisBoard initialFen={typeof fen === "string" ? fen.slice(0, 120) : null} />;
}
