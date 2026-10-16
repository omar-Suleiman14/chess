import Link from "@/components/navigation/PrefetchLink";
import { InfoPage } from "@/components/site/InfoPage";
import { ALL_STATIC_LESSONS } from "@/lib/chess/lessons/curriculum";
import { pageMetadata, PUBLIC_PAGES } from "@/lib/seo";
import { FAQ } from "@/lib/site-content";
import { SearchForm } from "@/components/navigation/SearchForm";

export const metadata = pageMetadata("Search", "Search Chess by Chaos for chess lessons, openings, game modes, help, and policies.", "/search", false);
const entries: { path: string; title: string; description: string; keywords?: string }[] = [
  ...PUBLIC_PAGES,
  ...ALL_STATIC_LESSONS.map((lesson) => ({ path: `/learn/${lesson.id}`, title: lesson.title, description: lesson.summary, keywords: `${lesson.topic} ${lesson.section ?? ""}` })),
  ...FAQ.map((item) => ({ path: "/help", title: item.question, description: item.answer })),
];
const normalize = (value: string) => value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
  const params = await searchParams;
  const query = (typeof params.q === "string" ? params.q : "").trim().slice(0, 160);
  const tokens = normalize(query).split(" ").filter(Boolean);
  const results = tokens.length ? entries.filter((entry) => tokens.every((token) => normalize(`${entry.title} ${entry.description} ${entry.keywords ?? ""}`).includes(token))) : [];
  return <InfoPage title="Search" path="/search" updated={false}>
    <SearchForm key={query} query={query} />
    {!tokens.length ? <p>Search public lessons, openings, features, and help. For example: <Link href="/search?q=knight">knight</Link>, <Link href="/search?q=PGN">PGN</Link>, or <Link href="/search?q=sync">sync</Link>.</p> : <>
      <p role="status">{results.length} {results.length === 1 ? "result" : "results"} for “{query}”</p>
      <ul className="grid gap-4">{results.map((entry) => <li key={`${entry.path}-${entry.title}`} className="rounded-2xl bg-surface p-4"><h2 className="font-semibold"><Link href={entry.path}>{entry.title}</Link></h2><p className="mt-1 text-sm text-muted">{entry.description}</p></li>)}</ul>
      {!results.length && <p>Try a shorter phrase or <Link href="/learn">browse all lessons</Link>. <Link href="/contact">Contact support</Link> if you need help.</p>}
    </>}
  </InfoPage>;
}
