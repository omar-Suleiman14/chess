"use client";

import { useConvexAuth, useQuery } from "convex/react";
import Link from "@/components/navigation/PrefetchLink";
import { useMemo, useState } from "react";
import { api } from "@/convex/_generated/api";
import { PageHeader } from "@/components/shell/AppShell";
import { CURRICULUM, searchTopics, TOPIC_LESSONS } from "@/lib/chess/lessons/curriculum";
import { SiteFooter } from "@/components/site/SiteFooter";

export default function LearnPage() {
  const { isAuthenticated } = useConvexAuth();
  const progress = useQuery(api.lessons.progress, isAuthenticated ? {} : "skip");
  const custom = useQuery(api.lessons.customLessons, isAuthenticated ? {} : "skip");
  const [now] = useState(() => Date.now());
  const practice = useQuery(api.lessons.duePractice, isAuthenticated ? { now } : "skip");
  const [query, setQuery] = useState("");
  const done = useMemo(() => new Set((progress ?? []).filter((p) => p.completed).map((p) => p.lessonId)), [progress]);
  const results = useMemo(() => (query.trim() ? searchTopics(query) : TOPIC_LESSONS), [query]);
  const sections = useMemo(() => {
    const map = new Map<string, typeof CURRICULUM>();
    for (const l of CURRICULUM) map.set(l.section ?? "Other", [...(map.get(l.section ?? "Other") ?? []), l]);
    return [...map.entries()];
  }, []);
  const nextLesson = CURRICULUM.find((l) => !done.has(l.id)) ?? CURRICULUM[0];

  return (
    <main className="mx-auto min-h-dvh max-w-xl pb-12">
      <PageHeader title="Learn" />
      <div className="grid gap-6 px-4">
        <p className="text-sm leading-6 text-muted">Learn chess with short, interactive lessons: start with how the pieces move, then practise rules, checkmate, tactics, endgames, and openings. Make moves on the board, use hints, and learn at your own pace. No account is needed for the curated lessons.</p>
        <Link href="/search" className="text-sm underline">Search all lessons and help</Link>
        <Link href={`/learn/${nextLesson.id}`} className="rounded-3xl bg-accent p-5 text-accent-text">
          <p className="text-sm opacity-70">{done.size === 0 ? "Start here" : "Continue"}</p>
          <p className="text-2xl font-semibold">{nextLesson.title}</p>
          <p className="mt-1 text-sm opacity-80">{nextLesson.summary}</p>
        </Link>

        {isAuthenticated && practice && (practice.due.length > 0 || practice.upcoming.length > 0) && (
          <Link href="/learn/practice" className="flex items-center justify-between rounded-2xl bg-surface p-4 shadow-[var(--shadow)]">
            <span>
              <span className="font-medium">Made for you</span>
              <span className="block text-sm text-muted">Positions from your own games</span>
            </span>
            <span className="rounded-full bg-surface-2 px-3 py-1 text-sm tabular-nums">{practice.due.length} due</span>
          </Link>
        )}

        <section aria-labelledby="path">
          <h2 id="path" className="mb-2 px-1 text-sm font-medium uppercase tracking-wide text-muted">Path</h2>
          <div className="grid gap-3">
            {sections.map(([title, lessons]) => (
              <div key={title}>
                <p className="mb-1 px-1 text-sm font-medium">{title}</p>
                <ul className="overflow-hidden rounded-2xl bg-surface shadow-[var(--shadow)]">
                  {lessons.map((l) => (
                    <li key={l.id} className="border-b border-line last:border-b-0">
                      <Link href={`/learn/${l.id}`} className="flex min-h-12 items-center justify-between px-4 py-3">
                        <span>{l.title}</span>
                        <span className="text-sm text-muted" aria-label={done.has(l.id) ? "completed" : `${l.steps.length} steps`}>
                          {done.has(l.id) ? "✓" : `${l.steps.length} steps`}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <section aria-labelledby="topics">
          <h2 id="topics" className="mb-2 px-1 text-sm font-medium uppercase tracking-wide text-muted">Learn anything</h2>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Queen's Gambit, Sicilian, forks…"
            aria-label="Search openings and tactics"
            className="mb-2 min-h-12 w-full rounded-2xl bg-surface px-4 shadow-[var(--shadow)]"
          />
          <ul className="overflow-hidden rounded-2xl bg-surface shadow-[var(--shadow)]">
            {results.map((l) => (
              <li key={l.id} className="border-b border-line last:border-b-0">
                <Link href={`/learn/${l.id}`} className="flex min-h-12 items-center justify-between px-4 py-3">
                  <span>{l.title}</span>
                  <span className="text-sm text-muted">{done.has(l.id) ? "✓" : l.summary}</span>
                </Link>
              </li>
            ))}
            {results.length === 0 && (
              <li className="px-4 py-3 text-sm text-muted">
                Nothing curated yet. Ask ChatGPT or Claude to create it through the Chess by Chaos MCP connector.
              </li>
            )}
          </ul>
        </section>

        {custom && custom.length > 0 && (
          <section aria-labelledby="custom">
            <h2 id="custom" className="mb-2 px-1 text-sm font-medium uppercase tracking-wide text-muted">Your lessons</h2>
            <ul className="overflow-hidden rounded-2xl bg-surface shadow-[var(--shadow)]">
              {custom.map((l) => (
                <li key={l.lessonId} className="border-b border-line last:border-b-0">
                  <Link href={`/learn/custom/${l.lessonId}`} className="flex min-h-12 items-center justify-between px-4 py-3">
                    <span>{l.title}</span>
                    <span className="text-xs text-muted">{l.source === "mcp" ? "by your AI coach" : l.source}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
      <SiteFooter />
    </main>
  );
}
