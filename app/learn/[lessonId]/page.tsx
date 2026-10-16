"use client";

import { notFound } from "next/navigation";
import { use } from "react";
import { LessonPlayer } from "@/components/learn/LessonPlayer";
import { PageHeader } from "@/components/shell/AppShell";
import { findStaticLesson } from "@/lib/chess/lessons/curriculum";
import { useFatma } from "@/lib/client/useFatma";

export default function LessonPage({ params }: { params: Promise<{ lessonId: string }> }) {
  const { lessonId } = use(params);
  const lesson = findStaticLesson(lessonId);
  const fatma = useFatma();
  if (!lesson) notFound();
  return (
    <main className="mx-auto min-h-dvh max-w-2xl px-3 pb-6">
      <PageHeader title={lesson.title} />
      <LessonPlayer key={lesson.id} lesson={lesson} onComplete={() => fatma.say("lesson_complete")} />
    </main>
  );
}
