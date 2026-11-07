"use client";

import { useConvexAuth, useQuery } from "convex/react";
import Link from "@/components/navigation/PrefetchLink";
import { useMemo, useState } from "react";
import { api } from "@/convex/_generated/api";
import { PageHeader } from "@/components/shell/AppShell";
import { CURRICULUM, searchTopics, TOPIC_LESSONS } from "@/lib/chess/lessons/curriculum";
import { SiteFooter } from "@/components/site/SiteFooter";
import { MiniBoard } from "@/components/chess/MiniBoard";
import { FatmaSprite } from "@/components/fatma/FatmaSprite";
import { ListIcon, PathMap, StickyAction } from "@/components/ui/PathMap";
import { CoachLine } from "@/components/ui/CoachLine";
import { useSettings } from "@/lib/client/settings";

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
  const allDone = done.size >= CURRICULUM.length;
  const { reducedMotion } = useSettings();

  return (
    <main className="mx-auto min-h-dvh max-w-3xl pb-32">
      <PageHeader title="Learn" />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 px-4">
        <CoachLine reducedMotion={reducedMotion} text={allDone ? "Excellent work! You've finished every lesson. Keep sharp with puzzles." : done.size === 0 ? "Welcome! Let's start with how the pieces move. Tap the glowing tile or Start learning." : `Nice progress. Next up: ${nextLesson.title}.`} />

        <section aria-labelledby="path-title" className="grid gap-1">
          <PathMap
            label="Lesson path"
            reducedMotion={reducedMotion}
            nodes={CURRICULUM.map((l, i) => ({
              key: l.id,
              face: i + 1,
              title: l.title,
              href: `/learn/${l.id}`,
              state: done.has(l.id) ? "done" : l.id === nextLesson.id && !allDone ? "current" : "todo",
            }))}
            marker={<span className="block overflow-hidden rounded-xl bg-surface p-0.5 shadow-[var(--shadow)]"><FatmaSprite expression="idle" size={34} reducedMotion={reducedMotion} /></span>}
          />
          <h2 id="path-title" className="px-1 text-3xl font-black tracking-tight">{nextLesson.section ?? "Lessons"}</h2>
          <div className="flex items-center gap-3 px-1">
            <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-label="Lessons completed" aria-valuemin={0} aria-valuemax={CURRICULUM.length} aria-valuenow={done.size}>
              <div className="h-full rounded-full bg-[#81b64c] transition-[width] duration-700" style={{ width: `${(done.size / CURRICULUM.length) * 100}%` }} />
            </div>
            <span className="text-sm font-semibold tabular-nums text-muted">{done.size}/{CURRICULUM.length}</span>
          </div>
        </section>

        <div className="grid grid-cols-3 gap-2">
          {[
            { href: "/puzzles/rated", title: "Puzzles", detail: "Rated tactics" },
            { href: "/puzzles/rush", title: "Rush", detail: "Beat the clock" },
            { href: "/puzzles/daily", title: "Daily", detail: "Today's puzzle" },
          ].map((item) => (
            <Link key={item.href} href={item.href} className="rounded-2xl bg-surface p-3 shadow-[var(--shadow)]">
              <span className="block font-semibold">{item.title}</span>
              <span className="block text-xs text-muted">{item.detail}</span>
            </Link>
          ))}
        </div>

        {isAuthenticated && practice && (practice.due.length > 0 || practice.upcoming.length > 0) && (
          <Link href="/learn/practice" className="flex items-center justify-between rounded-2xl bg-surface p-4 shadow-[var(--shadow)]">
            <span>
              <span className="font-medium">Made for you</span>
              <span className="block text-sm text-muted">Positions from your own games</span>
            </span>
            <span className="rounded-full bg-surface-2 px-3 py-1 text-sm tabular-nums">{practice.due.length} due</span>
          </Link>
        )}

        <section id="all-lessons" aria-labelledby="path" className="grid scroll-mt-20 gap-5" style={{ contentVisibility: "auto", containIntrinsicSize: "auto 1600px" }}>
          <h2 id="path" className="px-1 text-sm font-medium uppercase tracking-wide text-muted">All lessons</h2>
          {sections.map(([title, lessons]) => {
            const finished = lessons.filter((l) => done.has(l.id)).length;
            return (
              <div key={title} className="rounded-3xl bg-surface p-4 shadow-[var(--shadow)]">
                <div className="mb-3 flex items-end justify-between gap-3 px-1">
                  <div>
                    <h3 className="text-lg font-bold">{title}</h3>
                    <p className="text-xs text-muted">{lessons.length} {lessons.length === 1 ? "lesson" : "lessons"} · {finished} done</p>
                  </div>
                  <div className="h-2 w-24 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-label={`${title} progress`} aria-valuemin={0} aria-valuemax={lessons.length} aria-valuenow={finished}>
                    <div className="h-full rounded-full bg-[#81b64c] transition-[width] duration-500" style={{ width: `${(finished / lessons.length) * 100}%` }} />
                  </div>
                </div>
                <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                  {lessons.map((l) => (
                    <li key={l.id}>
                      <Link href={`/learn/${l.id}`} className="group relative flex h-full flex-col gap-2 rounded-2xl bg-surface-2 p-2.5 transition-transform hover:-translate-y-0.5 active:scale-[.98]">
                        <MiniBoard fen={l.steps[0].fen} size={112} className="mx-auto transition-transform group-hover:scale-[1.03]" />
                        <span className="text-sm font-semibold leading-tight">{l.title}</span>
                        <span className="text-xs text-muted" aria-label={done.has(l.id) ? "completed" : `${l.steps.length} ${l.steps.length === 1 ? "step" : "steps"}`}>
                          {done.has(l.id) ? <span className="font-semibold text-[#5d8a33]">✓ Completed</span> : `${l.steps.length} ${l.steps.length === 1 ? "step" : "steps"}`}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </section>

        <p className="text-sm leading-6 text-muted">Learn chess with short, interactive lessons: start with how the pieces move, then practise rules, checkmate, tactics, endgames, and openings. Make moves on the board, use hints, and learn at your own pace. No account is needed for the curated lessons. <Link href="/search" className="underline">Search all lessons and help</Link>.</p>

        <section aria-labelledby="topics">
          <h2 id="topics" className="mb-2 px-1 text-sm font-medium uppercase tracking-wide text-muted">Learn anything</h2>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Queen's Gambit, Sicilian, forks…"
            aria-label="Search openings and tactics"
            className="mb-2 min-h-12 w-full rounded-2xl bg-surface px-4 shadow-[var(--shadow)]"
          />
          {query && <button onClick={() => setQuery("")} className="mb-2 rounded-full bg-surface-2 px-3 py-1.5 text-sm font-semibold">✕ Clear search</button>}
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
      <StickyAction href={`/learn/${nextLesson.id}`} label={allDone ? "Review lessons" : done.size === 0 ? "Start learning" : "Next lesson"} secondary={{ href: "#all-lessons", label: "All lessons", icon: ListIcon }} />
    </main>
  );
}
