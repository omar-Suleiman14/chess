"use client";

/** Back / forward through the moves. Chevrons nudge the way they point on hover. */
export function ReviewArrows({ onBack, onForward, backDisabled, forwardDisabled }: { onBack: () => void; onForward: () => void; backDisabled: boolean; forwardDisabled: boolean }) {
  const button = "group grid h-14 w-16 shrink-0 place-items-center disabled:opacity-30";
  // Springy nudge in the arrow's direction; a press squashes it. No background change.
  const chevron = "h-8 w-8 transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] group-active:scale-75 group-disabled:!translate-x-0 group-disabled:!scale-100";
  return (
    <div className="flex h-14 shrink-0 overflow-hidden rounded-full bg-surface shadow-[var(--shadow)]" role="group" aria-label="Review moves">
      <button onClick={onBack} disabled={backDisabled} className={button} aria-label="Previous move" aria-keyshortcuts="ArrowLeft">
        <svg viewBox="0 0 24 24" className={`${chevron} group-hover:-translate-x-1.5`} aria-hidden="true"><path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
      <span className="my-2.5 w-px bg-line" aria-hidden="true" />
      <button onClick={onForward} disabled={forwardDisabled} className={button} aria-label="Next move" aria-keyshortcuts="ArrowRight">
        <svg viewBox="0 0 24 24" className={`${chevron} group-hover:translate-x-1.5`} aria-hidden="true"><path d="M9 5l7 7-7 7" stroke="currentColor" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
    </div>
  );
}

/** Same footprint as ReviewArrows, so the footer stays symmetric. */
export const FOOTER_BUTTON_SIZE = "h-14 w-[8.0625rem]";
