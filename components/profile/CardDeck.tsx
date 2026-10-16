"use client";

import { motion, type PanInfo } from "motion/react";
import { useCallback, useEffect, useState } from "react";
import { ChessCard, type CardData, type CardFace } from "./ChessCard";

export type DeckCard = { id: string; face: CardFace; data: CardData; url: string; label: string };

const SPRING = { type: "spring" as const, stiffness: 300, damping: 30, mass: 0.9 };

/**
 * A fanned deck of cards like Chaos: swipe or drag the front card, or use the
 * arrow keys. Tap the front card to flip it to its QR code.
 */
export function CardDeck({ cards, reducedMotion, startIndex = 0 }: { cards: DeckCard[]; reducedMotion?: boolean; startIndex?: number }) {
  const n = cards.length;
  const [index, setIndex] = useState(Math.min(startIndex, Math.max(0, n - 1)));
  const [flipped, setFlipped] = useState(false);
  const go = useCallback(
    (delta: number) => {
      if (n < 2) return;
      setFlipped(false);
      setIndex((i) => (i + delta + n) % n);
    },
    [n],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
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

  if (n === 0) return null;
  const current = cards[index];

  return (
    <div className="grid gap-4">
      <div className="relative mx-auto aspect-[1.586] w-full max-w-[520px] [perspective:1200px]" role="region" aria-roledescription="carousel" aria-label="Chess cards">
        {cards.map((card, i) => {
          const offset = (i - index + n) % n;
          // 0 = front, 1 = peeking right, n-1 = peeking left, others tucked away.
          // With only two cards the back one sits centred behind the front.
          const pos = offset === 0 ? 0 : n === 2 ? 3 : offset === 1 ? 1 : offset === n - 1 ? -1 : 2;
          const front = pos === 0;
          const hidden = pos === 2;
          const behind = pos === 3;
          return (
            <motion.div
              key={card.id}
              className="absolute inset-0"
              style={{ zIndex: front ? 3 : hidden ? 0 : 1, pointerEvents: front ? "auto" : "none" }}
              initial={false}
              animate={
                behind
                  ? { x: "0%", rotate: reducedMotion ? 0 : 4, scale: 0.94, y: -14, opacity: 0.7 }
                  : reducedMotion
                    ? { x: `${(hidden ? 0 : pos) * 8}%`, scale: front ? 1 : 0.9, opacity: front ? 1 : hidden ? 0 : 0.6 }
                    : { x: `${(hidden ? 0 : pos) * 18}%`, rotate: hidden ? 0 : pos * 6, scale: front ? 1 : 0.88, y: front ? 0 : 12, opacity: front ? 1 : hidden ? 0 : 0.85 }
              }
              transition={SPRING}
              drag={front && n > 1 ? "x" : false}
              dragSnapToOrigin
              dragElastic={0.35}
              onDragEnd={front ? onDragEnd : undefined}
              aria-hidden={!front}
            >
              <ChessCard face={card.face} data={card.data} url={card.url} flipped={front && flipped} onFlip={() => setFlipped((f) => !f)} interactive={front} />
            </motion.div>
          );
        })}
      </div>
      {n > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button onClick={() => go(-1)} aria-label="Previous card" className="grid h-10 w-10 place-items-center rounded-full bg-surface shadow-[var(--shadow)]">
            <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true"><path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
          <span className="min-w-28 text-center text-sm tabular-nums text-muted" aria-live="polite">
            {current.label} · {index + 1} / {n}
          </span>
          <button onClick={() => go(1)} aria-label="Next card" className="grid h-10 w-10 place-items-center rounded-full bg-surface shadow-[var(--shadow)]">
            <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true"><path d="M9 5l7 7-7 7" stroke="currentColor" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        </div>
      )}
      <p className="text-center text-sm text-muted">{n > 1 ? "Swipe or drag the card, or use the arrow keys. Tap to flip." : "Tap the card to flip it."}</p>
    </div>
  );
}
