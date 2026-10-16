"use client";

import { useRouter } from "next/navigation";
import { useNavigation } from "./NavigationProvider";

export function SearchForm({ query }: { query: string }) {
  const router = useRouter();
  const { navigate } = useNavigation();
  return <form action="/search" method="get" role="search" className="flex flex-wrap gap-2" onSubmit={(event) => {
    event.preventDefault();
    const value = String(new FormData(event.currentTarget).get("q") ?? "").slice(0, 160);
    navigate(() => router.push(`/search?${new URLSearchParams({ q: value })}`));
  }}>
    <label htmlFor="site-search" className="w-full font-medium">Find a lesson, game mode, or answer</label>
    <input id="site-search" type="search" name="q" defaultValue={query} maxLength={160} placeholder="Try castling, PGN, or privacy" className="min-h-12 min-w-0 flex-1 rounded-xl border border-line bg-surface px-4" />
    <button type="submit" className="rounded-xl bg-accent px-5 py-2 font-medium text-accent-text">Search</button>
  </form>;
}
