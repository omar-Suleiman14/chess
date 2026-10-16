"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { cardTransitionName, navigateWithTransition } from "@/lib/client/viewTransition";
import { ChessCard } from "./ChessCard";
import type { DeckCard } from "./CardDeck";
import { useShyTilt } from "./useShyTilt";

/**
 * Up to five cards in a 3D stack: the front one upright, neighbours leaning
 * back to each side. Swipe, drag, sideways-scroll or use the arrow keys to
 * browse; tap a card behind to fan the stack out (tap again or Esc to close);
 * tap the front card to open its page, which it morphs into.
 */
export function CardStack({ cards, label = "Chess cards", footer }: { cards: DeckCard[]; label?: string; footer?: (card: DeckCard) => ReactNode }) {
  const router = useRouter();
  const n = cards.length;
  const [selected, setSelected] = useState(0);
  const index = Math.min(selected, Math.max(0, n - 1));
  const [fanned, setFanned] = useState(false);
  const stage = useRef<HTMLDivElement>(null);
  const gesture = useRef<{ x: number; y: number } | null>(null);
  const swallowClick = useRef(false);
  const wheelAt = useRef(0);

  const next = useCallback(() => n > 1 && setSelected((i) => (Math.min(i, n - 1) + 1) % n), [n]);
  const previous = useCallback(() => n > 1 && setSelected((i) => (Math.min(i, n - 1) - 1 + n) % n), [n]);

  const tiltTargets = useCallback(() => Array.from(stage.current?.querySelectorAll<HTMLElement>(".card-stack__card") ?? []), []);
  useShyTilt(stage, tiltTargets);

  // Close the fan on Escape or a tap anywhere outside the cards.
  useEffect(() => {
    if (!fanned) return;
    const away = (e: PointerEvent) => {
      if (!(e.target instanceof Element) || !e.target.closest(".card-stack__card")) setFanned(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setFanned(false);
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [fanned]);

  // Arrow keys anywhere on the page (except while typing or in a dialog).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || n < 2) return;
      if (e.target instanceof HTMLElement && e.target.closest("input, textarea, select, [contenteditable], [role=dialog], [role=radiogroup]")) return;
      if (e.key === "ArrowRight") {
        e.preventDefault();
        next();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        previous();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [n, next, previous]);

  // A sideways trackpad swipe browses; vertical scrolling still scrolls the page.
  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || Math.abs(e.deltaX) <= Math.abs(e.deltaY) || Math.abs(e.deltaX) < 12 || n < 2) return;
      e.preventDefault();
      if (performance.now() - wheelAt.current < 420) return;
      wheelAt.current = performance.now();
      if (e.deltaX > 0) next();
      else previous();
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [n, next, previous]);

  if (n === 0) return null;
  const offsets = n >= 5 ? [-2, -1, 0, 1, 2] : n >= 3 ? [-1, 0, 1, ...(n === 4 ? [2] : [])] : n === 2 ? [0, 1] : [0];
  const shown = offsets.map((position) => ({ position, card: cards[(index + position + n) % n] }));
  const current = cards[index];

  return (
    <div className="grid justify-items-center gap-2">
      <div className="card-stack-scene w-full" style={{ ["--fan-count" as string]: shown.length } as CSSProperties}>
        <div
          ref={stage}
          className="card-stack"
          data-fanned={fanned}
          role="region"
          aria-roledescription="carousel"
          aria-label={label}
          tabIndex={0}
          dir="ltr"
          onKeyDown={(e) => {
            if (e.key === "Home") {
              e.preventDefault();
              setSelected(0);
            }
          }}
          onPointerDown={(e) => {
            swallowClick.current = false;
            gesture.current = { x: e.clientX, y: e.clientY };
          }}
          onPointerUp={(e) => {
            if (!gesture.current) return;
            const dx = e.clientX - gesture.current.x;
            const dy = e.clientY - gesture.current.y;
            gesture.current = null;
            swallowClick.current = Math.abs(dx) > 12 || Math.abs(dy) > 12;
            if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) {
              if (dx < 0) next();
              else previous();
            }
          }}
          onPointerCancel={() => {
            gesture.current = null;
            swallowClick.current = true;
          }}
          onClickCapture={(e) => {
            // A swipe that ends on a card isn't a tap on it.
            if (swallowClick.current) {
              e.preventDefault();
              e.stopPropagation();
              swallowClick.current = false;
            }
          }}
          onDragStart={(e) => e.preventDefault()}
        >
          {shown.map(({ card, position }) => {
            const depth = Math.abs(position);
            const style = { ["--depth" as string]: depth, ["--pos" as string]: position, zIndex: 5 - depth } as CSSProperties;
            const art = (
              <span className="card-stack__art" style={position === 0 ? { viewTransitionName: cardTransitionName(card.id) } : undefined}>
                <ChessCard face={card.face} data={card.data} url={card.url} flipped={false} interactive={false} />
              </span>
            );
            return position === 0 ? (
              <a
                key={card.id}
                href={card.url}
                className="card-stack__card"
                data-active="true"
                style={style}
                draggable={false}
                aria-label={`Open ${card.label}'s card`}
                onClick={(e) => {
                  if (e.metaKey || e.ctrlKey || e.shiftKey) return;
                  e.preventDefault();
                  const path = new URL(card.url, window.location.href).pathname;
                  // Only a card page has the matching card to morph into.
                  if (path.startsWith("/u/")) navigateWithTransition(router, path);
                  else router.push(path);
                }}
              >
                {art}
              </a>
            ) : (
              <button
                key={card.id}
                type="button"
                className="card-stack__card"
                data-active="false"
                style={style}
                aria-expanded={fanned}
                aria-label={`${fanned ? "Close" : "Fan out"} the cards (${card.label} is behind)`}
                onClick={() => setFanned((f) => !f)}
              >
                {art}
              </button>
            );
          })}
        </div>
      </div>
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {current.label}, {index + 1} of {n}
      </p>
      {footer && <div className="flex flex-wrap items-center justify-center gap-2">{footer(current)}</div>}
      <p className="text-center text-xs text-muted">{n > 1 ? "Swipe or drag the card, or use the arrow keys. Tap a card behind to fan them out." : "Tap the card to open it."}</p>
    </div>
  );
}
