"use client";

import { LessonPlayer } from "@/components/learn/LessonPlayer";
import { useFatma } from "@/lib/client/useFatma";
import type { Lesson } from "@/lib/chess/lessons/schema";

export function StaticLesson({ lesson }: { lesson: Lesson }) {
  const fatma = useFatma();
  return <LessonPlayer key={lesson.id} lesson={lesson} onComplete={() => fatma.say("lesson_complete")} />;
}
