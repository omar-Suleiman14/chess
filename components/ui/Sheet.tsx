"use client";

import { animate, motion, useDragControls, useMotionValue, useTransform } from "motion/react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useSettings } from "@/lib/client/settings";
import { haptic } from "@/lib/client/haptics";

const SPRING = { type: "spring" as const, stiffness: 420, damping: 40, mass: 0.9 };

/**
 * A native-style bottom drawer: opens to half the screen over a dimmed
 * background, drag the handle up for more room, swipe down (or tap outside,
 * or Escape) to close. Rendered at the top of the page so nothing can trap it.
 */
export function Sheet({ title, onClose, children, footer }: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  const { reducedMotion } = useSettings();
  const titleId = useId();
  const ref = useRef<HTMLDivElement>(null);
  const controls = useDragControls();
  // Screen height (read once on open; the sheet uses dvh for its own size).
  const [height] = useState(() => (typeof window === "undefined" ? 800 : window.innerHeight));
  const [expanded, setExpanded] = useState(false);
  const y = useMotionValue(height);
  const dim = useTransform(y, [height, 0], [0, 0.4], { clamp: true });
  const closing = useRef(false);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; });

  const close = () => {
    if (closing.current) return;
    closing.current = true;
    if (reducedMotion) { onCloseRef.current(); return; }
    void animate(y, height, { type: "tween", duration: 0.2, ease: [0.4, 0, 1, 1] }).then(() => onCloseRef.current());
  };
  const closeRef = useRef(close);
  useEffect(() => { closeRef.current = close; });

  // Open: measure the screen, then spring up to the half-screen detent.
  useEffect(() => {
    haptic("select");
    if (reducedMotion) y.set(0);
    else void animate(y, 0, SPRING);
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>("button,a[href],input,select,[tabindex='0']")?.focus({ preventScroll: true });
    const onKey = (event: KeyboardEvent) => {
      // Only the top-most dialog answers Escape (e.g. a challenge dialog opened from this sheet).
      if (event.key !== "Escape" || [...document.querySelectorAll("[role=dialog]")].at(-1) !== ref.current) return;
      event.stopPropagation();
      closeRef.current();
    };
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, [reducedMotion, y]);

  const sheet = (
    <div className="fixed inset-0 z-[85]" role="presentation">
      <motion.div className="absolute inset-0 bg-black" style={{ opacity: dim }} onClick={close} aria-hidden="true" />
      <motion.div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`absolute inset-x-0 bottom-0 mx-auto flex max-w-xl flex-col overflow-hidden rounded-t-[24px] bg-surface shadow-[0_-10px_40px_rgb(0_0_0/0.25)] transition-[height] duration-300 ease-out ${expanded ? "h-[92dvh]" : "h-[58dvh]"}`}
        style={{ y }}
        drag="y"
        dragControls={controls}
        dragListener={false}
        dragConstraints={{ top: 0, bottom: height }}
        dragElastic={{ top: 0.08, bottom: 0.5 }}
        onDragEnd={(_, info) => {
          if (info.offset.y < -60 || info.velocity.y < -500) { setExpanded(true); void animate(y, 0, SPRING); return; }
          if (info.offset.y > 110 || info.velocity.y > 650) {
            if (expanded && info.offset.y < 320) { setExpanded(false); void animate(y, 0, SPRING); return; }
            close();
            return;
          }
          void animate(y, 0, SPRING);
        }}
      >
        <div className="shrink-0 cursor-grab touch-none px-5 pb-2 pt-2.5 active:cursor-grabbing" onPointerDown={(event) => controls.start(event)}>
          <div className="mx-auto h-1.5 w-10 rounded-full bg-line" aria-hidden="true" />
          <div className="mt-2.5 flex min-h-9 items-center justify-between gap-3">
            <h2 id={titleId} className="text-lg font-bold tracking-tight">{title}</h2>
            <button onClick={close} className="grid h-9 w-9 place-items-center rounded-full bg-surface-2 text-muted" aria-label={`Close ${title}`}>
              <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /></svg>
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4">{children}</div>
        {footer && <div className="shrink-0 border-t border-line px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))]">{footer}</div>}
        {!footer && <div className="h-[env(safe-area-inset-bottom)] shrink-0" />}
      </motion.div>
    </div>
  );
  return typeof document === "undefined" ? sheet : createPortal(sheet, document.body);
}
