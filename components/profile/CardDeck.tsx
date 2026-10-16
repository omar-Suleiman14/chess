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
  const activeIndex = n > 0 ? index % n : 0;
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
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault();
        go(e.key === "ArrowLeft" ? -1 : 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x < -70 || info.velocity.x < -500) go(1);
    else if (info.offset.x > 70 || info.velocity.x > 500) go(-1);
  };

  if (n === 0) return null;
  const current = cards[activeIndex];

  return (
    <div className="grid gap-6">
      <div className="relative mx-auto my-10 aspect-[1.3] w-full max-w-[620px] [perspective:1200px]" role="region" aria-roledescription="carousel" aria-label="Chess cards">
        {cards.map((card, i) => {
          const offset = (i - activeIndex + n) % n;
          const pos = offset > n / 2 ? offset - n : offset;
          const front = pos === 0;
          const hidden = Math.abs(pos) > 2;
          return (
            <motion.div
              key={card.id}
              className={n > 1 ? "absolute inset-x-[14%] top-[12%]" : "absolute inset-x-0 top-[12%]"}
              style={{ zIndex: hidden ? 0 : 5 - Math.abs(pos), pointerEvents: hidden ? "none" : "auto", transformOrigin: "50% 115%", touchAction: "pan-y" }}
              initial={false}
              animate={{
                x: hidden ? "0%" : `${pos * 22}%`,
                rotate: reducedMotion || hidden ? 0 : pos * 12,
                scale: front ? 1 : 0.94 - Math.min(Math.abs(pos), 2) * 0.03,
                y: front ? 0 : Math.abs(pos) * 10,
                opacity: hidden ? 0 : 1,
              }}
              transition={reducedMotion ? { duration: 0 } : SPRING}
              drag={front && n > 1 ? "x" : false}
              dragSnapToOrigin
              dragElastic={0.35}
              onDragEnd={front ? onDragEnd : undefined}
              aria-hidden={hidden}
            >
              <ChessCard face={card.face} data={card.data} url={card.url} flipped={front && flipped} reducedMotion={reducedMotion} onFlip={() => {
                if (front) setFlipped((f) => !f);
                else { setIndex(i); setFlipped(false); }
              }} interactive={!hidden} />
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
            {current.label} · {activeIndex + 1} / {n}
          </span>
          <button onClick={() => go(1)} aria-label="Next card" className="grid h-10 w-10 place-items-center rounded-full bg-surface shadow-[var(--shadow)]">
            <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true"><path d="M9 5l7 7-7 7" stroke="currentColor" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        </div>
      )}
      <p className="text-center text-sm text-muted">{n > 1 ? "Swipe, tap an exposed card, or use the arrows. Tap the front card to flip." : "Tap the card to flip it."}</p>
    </div>
  );
}
