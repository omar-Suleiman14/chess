"use client";

import { useEffect, useRef } from "react";
import { pieceName, type Color, type PromotionPiece } from "@/lib/chess/rules";
import { useSettings } from "@/lib/client/settings";
import { Piece } from "./Pieces";

const OPTIONS: PromotionPiece[] = ["q", "r", "b", "n"];

export function PromotionSheet({ color, onPick, onCancel }: { color: Color; onPick: (p: PromotionPiece) => void; onCancel: () => void }) {
  const first = useRef<HTMLButtonElement>(null);
  const { settings } = useSettings();
  useEffect(() => {
    first.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCancel();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);
  return (
    <div className="absolute inset-0 z-40 flex items-end justify-center bg-black/25 p-3 sm:items-center" onClick={onCancel}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Choose a promotion piece"
        className="bubble-in w-full max-w-sm rounded-2xl bg-surface p-3 shadow-[var(--shadow)]"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="mb-2 text-center text-sm text-muted">Promote to</p>
        <div className="grid grid-cols-4 gap-2">
          {OPTIONS.map((p, i) => (
            <button
              key={p}
              ref={i === 0 ? first : undefined}
              onClick={() => onPick(p)}
              aria-label={pieceName(p)}
              className="aspect-square rounded-xl bg-surface-2 p-2 transition-transform active:scale-95"
            >
              <Piece type={p} color={color} set={settings.pieceSet} className="h-full w-full" />
            </button>
          ))}
        </div>
        <button onClick={onCancel} className="mt-2 w-full rounded-xl py-3 text-sm text-muted">
          Cancel
        </button>
      </div>
    </div>
  );
}
