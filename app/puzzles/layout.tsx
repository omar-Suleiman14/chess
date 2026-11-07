import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata("Puzzles", "Solve rated chess puzzles, race the clock in Puzzle Rush, and try a new daily puzzle. Tactics by theme: mates, forks, sacrifices and endgames.", "/puzzles");

export default function Layout({ children }: { children: React.ReactNode }) { return children; }
