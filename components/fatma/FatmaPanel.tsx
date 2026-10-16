"use client";

import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { IOS_SPRING } from "@/components/ui/Switch";
import type { FatmaApi } from "@/lib/client/useFatma";
import { FatmaSprite } from "./FatmaSprite";

/** Fatma's corner: sprite + one-sentence bubble. Never blocks the board. */
export function FatmaPanel({ fatma, thinking, reducedMotion }: { fatma: FatmaApi; thinking: boolean; reducedMotion: boolean }) {
  if (!fatma.enabled) return null;
  const expression = fatma.line ? fatma.expression : thinking ? "thinking" : "idle";
  return (
    <div className="pointer-events-none flex items-end gap-2">
      <FatmaSprite expression={expression} size={56} reducedMotion={reducedMotion} />
      <div aria-live="polite" className="min-h-[1px]">
        {fatma.line && (
          <button
            onClick={fatma.dismiss}
            className="bubble-in pointer-events-auto mb-3 max-w-[220px] rounded-2xl rounded-bl-sm bg-surface px-3 py-2 text-left text-sm shadow-[var(--shadow)]"
            aria-label={`Fatma says: ${fatma.line.text}. Tap to dismiss.`}
          >
            {fatma.line.text}
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * The disable flow: Fatma pleads, but "Turn off" is always immediate and
 * clearly labelled. Keeping her on softens her briefly.
 */
export function FatmaToggle({ fatma }: { fatma: FatmaApi }) {
  const [asking, setAsking] = useState(false);
  const offButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (asking) offButton.current?.focus();
  }, [asking]);

  if (!fatma.enabled) {
    return (
      <button onClick={() => void fatma.setEnabled("enable")} className="rounded-full bg-surface-2 px-4 py-2 text-sm">
        Bring Fatma back
      </button>
    );
  }
  return (
    <>
      <button
        onClick={() => {
          setAsking(true);
          fatma.plead();
        }}
        className="rounded-full bg-surface-2 px-4 py-2 text-sm"
      >
        Turn Fatma off
      </button>
      {asking && (
        <motion.div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/30 p-4 sm:items-center" onClick={() => setAsking(false)} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <motion.div
            initial={{ opacity: 0, y: 48, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={IOS_SPRING}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="fatma-plea-title"
            className="w-full max-w-sm rounded-3xl bg-surface p-5 shadow-[var(--shadow)]"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.key === "Escape" && setAsking(false)}
          >
            <div className="flex items-center gap-3">
              <FatmaSprite expression="plea" size={64} />
              <p id="fatma-plea-title" className="text-base font-medium">
                Wait! Don&apos;t. I&apos;ll be cool. Promise.
              </p>
            </div>
            <div className="mt-5 grid gap-2">
              <button
                ref={offButton}
                onClick={() => {
                  setAsking(false);
                  void fatma.setEnabled("disable");
                }}
                className="w-full rounded-2xl bg-accent py-3 font-medium text-accent-text"
              >
                Turn off Fatma
              </button>
              <button
                onClick={() => {
                  setAsking(false);
                  void fatma.setEnabled("keep");
                }}
                className="w-full rounded-2xl bg-surface-2 py-3"
              >
                Keep her
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </>
  );
}
