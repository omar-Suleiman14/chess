"use client";

import { FatmaSprite } from "@/components/fatma/FatmaSprite";

/** Sherine with a speech bubble: the friendly line at the top of Learn and Puzzles. */
export function CoachLine({ text, reducedMotion = false }: { text: string; reducedMotion?: boolean }) {
  return (
    <div className="flex min-w-0 items-end gap-2" aria-live="polite">
      <span className="block h-16 w-16 shrink-0 overflow-hidden"><FatmaSprite expression="idle" size={64} reducedMotion={reducedMotion} /></span>
      <p
        key={text}
        data-coach-line
        className="coach-bubble relative mb-3 min-w-0 flex-1 rounded-2xl rounded-bl-sm bg-surface px-4 py-3 text-[15px] font-medium leading-snug shadow-[var(--shadow)]"
      >
        {text}
      </p>
    </div>
  );
}
