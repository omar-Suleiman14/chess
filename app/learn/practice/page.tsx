"use client";

import { useConvexAuth, useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { api } from "@/convex/_generated/api";
import { LessonPlayer } from "@/components/learn/LessonPlayer";
import { PageHeader } from "@/components/shell/AppShell";
import type { Lesson } from "@/lib/chess/lessons/schema";

const THEME_PROMPT: Record<string, string> = {
  material: "You missed a chance to win material. Find it.",
  checkmate: "There was a mate here. Find it.",
  checks: "A strong check was available.",
  positional: "Find the stronger move you missed.",
  coach: "Your coach picked this position. Find the best move.",
};

/** Spaced-repetition practice from your own saved mistakes. */
export default function PracticePage() {
  const { isAuthenticated } = useConvexAuth();
  const [now] = useState(() => Date.now());
  const data = useQuery(api.lessons.duePractice, isAuthenticated ? { now } : "skip");
  const record = useMutation(api.lessons.recordPractice);
  const [index, setIndex] = useState(0);
  const [done, setDone] = useState<string[]>([]);
  const queue = useMemo(() => (data?.due ?? []).filter((i) => !done.includes(i.itemKey)), [data, done]);
  const item = queue[Math.min(index, queue.length - 1)];

  if (!isAuthenticated) return <Shell><p>Sign in to get practice from your own games.</p></Shell>;
  if (!data) return <Shell><p role="status" className="text-muted">Loading…</p></Shell>;
  if (!item) {
    return (
      <Shell>
        <p className="text-lg font-medium">Nothing due right now.</p>
        <p className="mt-1 text-sm text-muted">
          {data.upcoming.length > 0 ? `${data.upcoming.length} position${data.upcoming.length === 1 ? "" : "s"} scheduled for later.` : "Play some games with the eval bar on, then tap “Make practice” in Time Machine."}
        </p>
        <Link href="/learn" className="mt-4 inline-block underline">Back to Learn</Link>
      </Shell>
    );
  }

  const lesson: Lesson = {
    id: `practice-${item.itemKey}`,
    version: 1,
    title: "Practice",
    topic: item.theme,
    summary: "",
    source: "adaptive",
    steps: [
      {
        id: item.itemKey,
        fen: item.fen,
        prompt: item.note ?? THEME_PROMPT[item.theme] ?? "Find the best move.",
        lines: item.accepted.map((u) => [u]),
        hints: item.played ? [`In the game you played ${item.played}. There was better.`] : [],
      },
    ],
  };

  return (
    <main className="mx-auto min-h-dvh max-w-2xl px-3 pb-6">
      <PageHeader title={`Practice · ${queue.length} left`} />
      <LessonPlayer
        key={item.itemKey}
        lesson={lesson}
        onComplete={({ hints, mistakes }) => {
          void record({ itemKey: item.itemKey, outcome: mistakes > 0 ? "failed" : hints > 0 ? "hinted" : "clean" });
          setTimeout(() => {
            setDone((d) => [...d, item.itemKey]);
            setIndex(0);
          }, 900);
        }}
      />
    </main>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto min-h-dvh max-w-xl">
      <PageHeader title="Practice" />
      <div className="px-4">{children}</div>
    </main>
  );
}
