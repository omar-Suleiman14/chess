import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata("Learn", "Learn how chess pieces move, castling, checkmate, forks, pins, endgames, and popular openings through short interactive chess lessons.", "/learn");

export default function Layout({ children }: { children: React.ReactNode }) { return children; }
