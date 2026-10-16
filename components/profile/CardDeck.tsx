"use client";

import { motion, type PanInfo } from "motion/react";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { ChessCard, type CardData, type CardFace } from "./ChessCard";

export type DeckCard = { id: string; face: CardFace; data: CardData; url: string; label: string };

const SPRING = { type: "spring" as const, stiffness: 300, damping: 30, mass: 0.9 };
/** Most cards shown at once when fanned out (the rest wait off to the sides). */
const FAN_MAX = 9;

/**
 * A stacked deck of cards like Chaos: swipe or drag the front card, or use the
 * arrow keys; tap the front card to flip it to its QR code. Tapping a card
 * behind it fans the whole deck out like a hand; tap one to pick it.
 */
export function CardDeck({ cards, reducedMotion, startIndex = 0, footer }: { cards: DeckCard[]; reducedMotion?: boolean; startIndex?: number; footer?: (card: DeckCard) => ReactNode }) {
  const n = cards.length;
  const [index, setIndex] = useState(Math.min(startIndex, Math.max(0, n - 1)));
  const [flipped, setFlipped] = useState(false);
  const [fanned, setFanned] = useState(false);
  const activeIndex = n > 0 ? index % n : 0;
  const go = useCallback(
    (delta: number) => {
      if (n < 2) return;
      setFlipped(false);
      setIndex((i) => (i + delta + n) % n);
    },
    [n],
  );
  const pick = (i: number) => {
    setIndex(i);
    setFlipped(false);
    setFanned(false);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.target instanceof HTMLElement && e.target.closest("[role=dialog]")) return;
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault();
        go(e.key === "ArrowLeft" ? -1 : 1);
      } else if (e.key === "Escape") setFanned(false);
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
  const fanCount = Math.min(n, FAN_MAX);
  const fanHalf = (fanCount - 1) / 2;
  const fanStep = fanCount > 1 ? Math.min(9, 44 / fanHalf) : 0;
  // The fan shows a window of cards in deck order, centred on the current one.
  const fanStart = (activeIndex - Math.floor(fanHalf) + n) % n;

  return (
    <div className="grid gap-6">
      <div
        className="relative mx-auto my-10 aspect-[1.3] w-full max-w-[620px] [perspective:1200px]"
        role="region"
        dir="ltr"
        aria-roledescription="carousel"
        aria-label={fanned ? "Chess cards, fanned out: pick one" : "Chess cards"}
        onClick={(e) => fanned && e.target === e.currentTarget && setFanned(false)}
      >
        {cards.map((card, i) => {
          const offset = (i - activeIndex + n) % n;
          const pos = offset > n / 2 ? offset - n : offset;
          const front = pos === 0 && !fanned;
          const rank = (i - fanStart + n) % n;
          const fanPos = rank - fanHalf;
          const hidden = fanned ? rank >= fanCount : Math.abs(pos) > 2;
          // Fanned: every visible card rotates about a point far below the deck, like a hand of cards.
          const animate = fanned
            ? {
                x: "0%",
                rotate: hidden ? (rank < n / 2 ? 60 : -60) : reducedMotion ? 0 : fanPos * fanStep,
                scale: 0.78,
                y: reducedMotion ? 0 : -6,
                opacity: hidden ? 0 : 1,
              }
            : {
                x: hidden ? "0%" : `${pos * 22}%`,
                rotate: reducedMotion || hidden ? 0 : pos * 12,
                scale: front ? 1 : 0.94 - Math.min(Math.abs(pos), 2) * 0.03,
                y: front ? 0 : Math.abs(pos) * 10,
                opacity: hidden ? 0 : 1,
              };
          return (
            <motion.div
              key={card.id}
              className={n > 1 ? "absolute inset-x-[14%] top-[12%]" : "absolute inset-x-0 top-[12%]"}
              style={{
                zIndex: hidden ? 0 : fanned ? 20 + rank : 5 - Math.abs(pos),
                pointerEvents: hidden ? "none" : "auto",
                transformOrigin: fanned ? "50% 260%" : "50% 115%",
                touchAction: "pan-y",
              }}
              initial={false}
              animate={animate}
              whileHover={fanned && !reducedMotion ? { y: -26, transition: { duration: 0.18 } } : undefined}
              transition={reducedMotion ? { duration: 0 } : { ...SPRING, delay: fanned ? Math.abs(fanPos) * 0.025 : 0 }}
              drag={front && n > 1 ? "x" : false}
              dragSnapToOrigin
              dragElastic={0.35}
              onDragEnd={front ? onDragEnd : undefined}
              aria-hidden={hidden}
            >
              <ChessCard
                face={card.face}
                data={card.data}
                url={card.url}
                flipped={front && flipped}
                reducedMotion={reducedMotion}
                onFlip={() => {
                  if (fanned) pick(i);
                  else if (front) setFlipped((f) => !f);
                  else setFanned(true);
                }}
                interactive={!hidden}
              />
            </motion.div>
          );
        })}
      </div>
      {n > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button onClick={() => go(-1)} aria-label="Previous card" className="grid h-10 w-10 place-items-center rounded-full bg-surface shadow-[var(--shadow)]">
            <svg viewBox="0 0 24 24" className="h-4 w-4 rtl:rotate-180" aria-hidden="true"><path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
          <button
            onClick={() => setFanned((f) => !f)}
            aria-pressed={fanned}
            className="min-h-10 min-w-28 rounded-full bg-surface px-4 text-center text-sm tabular-nums shadow-[var(--shadow)]"
          >
            <span aria-live="polite">{fanned ? "Close fan" : `${current.label} · ${activeIndex + 1} / ${n}`}</span>
          </button>
          <button onClick={() => go(1)} aria-label="Next card" className="grid h-10 w-10 place-items-center rounded-full bg-surface shadow-[var(--shadow)]">
            <svg viewBox="0 0 24 24" className="h-4 w-4 rtl:rotate-180" aria-hidden="true"><path d="M9 5l7 7-7 7" stroke="currentColor" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        </div>
      )}
      {footer && !fanned && <div className="flex flex-wrap items-center justify-center gap-2">{footer(current)}</div>}
      <p className="text-center text-sm text-muted">
        {fanned ? "Tap a card to pick it. Esc or tap outside to close." : n > 1 ? "Swipe or use the arrows. Tap a card behind to fan the deck out, tap the front card to flip it." : "Tap the card to flip it."}
      </p>
    </div>
  );
}
