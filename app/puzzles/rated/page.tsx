import { Suspense } from "react";
import { RatedPuzzles } from "@/components/puzzles/RatedPuzzles";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata("Solve puzzles", "Rated chess puzzles picked for your level.", "/puzzles/rated", false);

// The theme is read in the browser, so one cached page serves every theme offline.
export default function RatedPage() {
  return (
    <Suspense>
      <RatedPuzzles />
    </Suspense>
  );
}
