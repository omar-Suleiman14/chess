"use client";

import { useEffect, useRef, type PointerEvent } from "react";

const HOLD_DELAY_MS = 320;
const REPEAT_START_MS = 120;
const REPEAT_MIN_MS = 35;

/**
 * Tap to step once; press and hold to scrub, accelerating. Keyboard
 * (Enter/Space) still steps once per press, and auto-repeats while held.
 */
function useHoldRepeat(action: () => void, disabled: boolean) {
  const actionRef = useRef(action);
  const disabledRef = useRef(disabled);
  useEffect(() => {
    actionRef.current = action;
    disabledRef.current = disabled;
  });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pointerStep = useRef(false);

  const stop = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  useEffect(() => stop, []);

  const repeat = (interval: number) => {
    timer.current = setTimeout(() => {
      if (disabledRef.current) return stop();
      actionRef.current();
      repeat(Math.max(REPEAT_MIN_MS, interval * 0.85));
    }, interval);
  };

  return {
    onPointerDown: (e: PointerEvent<HTMLButtonElement>) => {
      if (e.button !== 0 || disabledRef.current) return;
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // Some browsers refuse capture (e.g. synthetic pointers); holding still works.
      }
      pointerStep.current = true;
      actionRef.current();
      stop();
      timer.current = setTimeout(() => repeat(REPEAT_START_MS), HOLD_DELAY_MS);
    },
    onPointerUp: stop,
    onPointerCancel: stop,
    onLostPointerCapture: stop,
    // Pointer presses already stepped on pointerdown; clicks from the keyboard step here.
    onClick: () => {
      if (pointerStep.current) {
        pointerStep.current = false;
        return;
      }
      actionRef.current();
    },
    // No long-press menu or text selection while scrubbing.
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  };
}

/** Fixed surface; only the chevrons shrink during a press. */
export function ReviewArrows({ onBack, onForward, backDisabled, forwardDisabled }: { onBack: () => void; onForward: () => void; backDisabled: boolean; forwardDisabled: boolean }) {
  const back = useHoldRepeat(onBack, backDisabled);
  const forward = useHoldRepeat(onForward, forwardDisabled);
  const button =
    "press-overlay grid h-14 w-16 shrink-0 touch-manipulation select-none place-items-center [-webkit-touch-callout:none] [-webkit-user-select:none] focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-accent disabled:opacity-30";
  const chevron = "pointer-events-none h-8 w-8";
  return (
    <div className="flex h-14 shrink-0 select-none overflow-hidden rounded-full bg-surface shadow-[var(--shadow)]" role="group" aria-label="Review moves" dir="ltr">
      <button {...back} disabled={backDisabled} className={button} aria-label="Previous move (hold to rewind)" aria-keyshortcuts="ArrowLeft Home">
        <svg viewBox="0 0 24 24" className={chevron} aria-hidden="true"><path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
      <span className="my-2.5 w-px bg-line" aria-hidden="true" />
      <button {...forward} disabled={forwardDisabled} className={button} aria-label="Next move (hold to fast-forward)" aria-keyshortcuts="ArrowRight End">
        <svg viewBox="0 0 24 24" className={chevron} aria-hidden="true"><path d="M9 5l7 7-7 7" stroke="currentColor" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
    </div>
  );
}

/** Same footprint as ReviewArrows, so the footer stays symmetric. */
export const FOOTER_BUTTON_SIZE = "h-14 w-[8.0625rem]";
