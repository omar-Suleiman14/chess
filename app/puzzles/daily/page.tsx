import { DailyPuzzle } from "@/components/puzzles/DailyPuzzle";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata("Daily puzzle", "A new chess puzzle every day.", "/puzzles/daily");

export default function DailyPage() {
  return <DailyPuzzle />;
}
