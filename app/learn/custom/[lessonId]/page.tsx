"use client";

import { useConvexAuth, useQuery } from "convex/react";
import { use } from "react";
import { api } from "@/convex/_generated/api";
import { LessonPlayer } from "@/components/learn/LessonPlayer";
import { PageHeader } from "@/components/shell/AppShell";
import type { Lesson } from "@/lib/chess/lessons/schema";

export default function CustomLessonPage({ params }: { params: Promise<{ lessonId: string }> }) {
  const { lessonId } = use(params);
  const { isAuthenticated, isLoading } = useConvexAuth();
  const doc = useQuery(api.lessons.customLesson, isAuthenticated ? { lessonId } : "skip");
  if (isLoading || (isAuthenticated && doc === undefined)) {
    return <p className="p-6 text-muted" role="status">Loading lesson…</p>;
  }
  if (!isAuthenticated) return <p className="p-6">Sign in to open your lessons.</p>;
  if (!doc) return <p className="p-6">Lesson not found.</p>;
  const lesson: Lesson = {
    id: doc.lessonId,
    version: doc.version,
    title: doc.title,
    topic: doc.topic,
    summary: doc.summary,
    source: doc.source,
    steps: doc.steps,
  };
  return (
    <main className="mx-auto min-h-dvh max-w-2xl px-3 pb-6">
      <PageHeader title={lesson.title} />
      <p className="-mt-1 mb-3 px-1 text-xs text-muted">
        {doc.provenance.createdBy === "mcp" ? "Created by your AI coach · validated by chess.js" : "Your lesson"}
      </p>
      <LessonPlayer key={lesson.id} lesson={lesson} />
    </main>
  );
}
