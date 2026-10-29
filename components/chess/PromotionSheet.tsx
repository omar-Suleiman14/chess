"use client";

import { useEffect, useRef } from "react";
import { pieceName, type Color, type PromotionPiece } from "@/lib/chess/rules";
import { useSettings } from "@/lib/client/settings";
import { Piece } from "./Pieces";
import { GlassLayer } from "@/components/ui/Glass";

const OPTIONS: PromotionPiece[] = ["q", "r", "b", "n"];

export function PromotionSheet({ color, onPick, onCancel }: { color: Color; onPick: (p: PromotionPiece) => void; onCancel: () => void }) {
  const first = useRef<HTMLButtonElement>(null);
  const { settings, glassOn } = useSettings();
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
        className={glassOn ? "glass-panel w-full max-w-sm rounded-[22px] p-3" : "bubble-in w-full max-w-sm rounded-2xl bg-surface p-3 shadow-[var(--shadow)]"}
        onClick={(e) => e.stopPropagation()}
      >
        <GlassLayer radius={22} tier="sheet" />
        <p className="mb-2 text-center text-sm text-muted">Promote to</p>
        <div className="grid grid-cols-4 gap-2">
          {OPTIONS.map((p, i) => (
            <button
              key={p}
              ref={i === 0 ? first : undefined}
              onClick={() => onPick(p)}
              aria-label={pieceName(p)}
              className={`aspect-square rounded-xl p-2 transition-transform active:scale-95 ${glassOn ? "bg-surface-2/70" : "bg-surface-2"}`}
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
