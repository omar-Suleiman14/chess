import Link from "@/components/navigation/PrefetchLink";
import { InfoPage } from "@/components/site/InfoPage";
import { FAQ } from "@/lib/site-content";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata("Help", "Answers about free chess, beginner lessons, Stockfish, timed games, PGN analysis, ratings, account sync, and AI coaches.", "/help");

export default function HelpPage() {
  return <InfoPage title="Help" path="/help">
    <p>Start with a game, work through a lesson, or find help with your account.</p>
    <nav aria-label="Quick actions" className="flex flex-wrap gap-4"><Link href="/learn">Learn chess</Link><Link href="/climb">Beginner opponents</Link><Link href="/play">Play a friend</Link><Link href="/time-machine">Review games</Link><Link href="/search">Search the site</Link></nav>
    {FAQ.map(({ question, answer }) => <section key={question} className="grid gap-2 border-t border-line pt-4"><h2 className="text-lg font-semibold">{question}</h2><p>{answer}</p></section>)}
    <p>Still stuck? <Link href="/contact">Contact support</Link>. Read the <Link href="/privacy">Privacy policy</Link> before sharing account information.</p>
  </InfoPage>;
}
