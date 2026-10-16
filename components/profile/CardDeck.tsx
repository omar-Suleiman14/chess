"use client";

import { motion, type PanInfo } from "motion/react";
import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { ChessCard, type CardData, type CardFace } from "./ChessCard";

const FACES: CardFace[] = ["identity", "climb", "rivalry"];
const SPRING = { type: "spring" as const, stiffness: 300, damping: 30, mass: 0.9 };

/**
 * A fanned deck of Chess cards like Chaos: swipe or drag the front card, or
 * use the arrow keys. Tap the front card to flip it to its QR code.
 */
export function CardDeck({ data, url, reducedMotion }: { data: CardData; url: string; reducedMotion?: boolean }) {
  const faces = data.climb || data.rivalry ? FACES : (["identity"] as CardFace[]);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const go = useCallback(
    (delta: number) => {
      setFlipped(false);
      setIndex((i) => (i + delta + faces.length) % faces.length);
    },
    [faces.length],
  );

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "ArrowRight") go(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x < -70 || info.velocity.x < -500) go(1);
    else if (info.offset.x > 70 || info.velocity.x > 500) go(-1);
  };

  return (
    <div className="grid gap-4">
      <div
        ref={root}
        className="relative mx-auto aspect-[1.586] w-full max-w-[520px] [perspective:1200px]"
        role="region"
        aria-roledescription="carousel"
        aria-label="Chess cards"
        onKeyDown={(e: KeyboardEvent) => e.stopPropagation()}
      >
        {faces.map((face, i) => {
          const offset = ((i - index + faces.length) % faces.length);
          // 0 = front, 1 = peeking right, last = peeking left.
          const pos = offset === 0 ? 0 : offset === 1 ? 1 : -1;
          const front = pos === 0;
          return (
            <motion.div
              key={face}
              className="absolute inset-0"
              style={{ zIndex: front ? 3 : 1 }}
              initial={false}
              animate={
                reducedMotion
                  ? { x: `${pos * 8}%`, scale: front ? 1 : 0.9, opacity: front ? 1 : 0.6 }
                  : { x: `${pos * 26}%`, rotate: pos * 7, scale: front ? 1 : 0.86, y: front ? 0 : 14, opacity: front ? 1 : 0.85 }
              }
              transition={SPRING}
              drag={front ? "x" : false}
              dragSnapToOrigin
              dragElastic={0.35}
              onDragEnd={front ? onDragEnd : undefined}
              aria-hidden={!front}
            >
              <ChessCard face={face} data={data} url={url} flipped={front && flipped} onFlip={() => setFlipped((f) => !f)} interactive={front} />
            </motion.div>
          );
        })}
      </div>
      {faces.length > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button onClick={() => go(-1)} aria-label="Previous card" className="grid h-10 w-10 place-items-center rounded-full bg-surface shadow-[var(--shadow)]">
            <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true"><path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
          <div className="flex gap-1.5" aria-hidden="true">
            {faces.map((f, i) => (
              <span key={f} className={`h-1.5 rounded-full transition-all ${i === index ? "w-5 bg-ink" : "w-1.5 bg-line"}`} />
            ))}
          </div>
          <button onClick={() => go(1)} aria-label="Next card" className="grid h-10 w-10 place-items-center rounded-full bg-surface shadow-[var(--shadow)]">
            <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true"><path d="M9 5l7 7-7 7" stroke="currentColor" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        </div>
      )}
      <p className="text-center text-sm text-muted">Swipe or drag the card, or use the arrow keys. Tap to flip.</p>
    </div>
  );
}
