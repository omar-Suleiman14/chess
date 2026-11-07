"use client";

import { useRef, useState } from "react";
import { placementFromFen, placementToFen, positionProblem, type EditorPiece, type Placement } from "@/lib/chess/editor";
import { DEFAULT_POSITION, type Color, type Square } from "@/lib/chess/rules";
import { VARIANTS, variantFen } from "@/lib/chess/variants";
import { isBoardFlipSwipe, type TouchPoint } from "@/lib/chess/boardGesture";
import { useSettings } from "@/lib/client/settings";
import { haptic } from "@/lib/client/haptics";
import { Piece } from "./Pieces";

type Tool = EditorPiece | "erase";

const ORDER = ["k", "q", "r", "b", "n", "p"] as const;
const NAMES: Record<string, string> = { k: "king", q: "queen", r: "rook", b: "bishop", n: "knight", p: "pawn" };

/**
 * Build any position: pick a piece (or the eraser) and tap or drag across
 * squares. Right-click or long-press a square to clear it.
 */
export function PositionEditor({ initialFen = DEFAULT_POSITION, onDone, onCancel, doneLabel = "Use this position" }: {
  initialFen?: string;
  onDone: (fen: string) => void;
  onCancel?: () => void;
  doneLabel?: string;
}) {
  const { settings } = useSettings();
  const start = placementFromFen(initialFen);
  const [placement, setPlacement] = useState<Placement>(start.placement);
  const [turn, setTurn] = useState<Color>(start.turn);
  const [tool, setTool] = useState<Tool>("wq");
  const [orientation, setOrientation] = useState<Color>("w");
  const painting = useRef<{ pointerId: number; mode: "place" | "erase"; last: Square | null } | null>(null);
  const twoFinger = useRef<{ start: [TouchPoint, TouchPoint]; done: boolean } | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);

  const problem = positionProblem(placement, turn);
  const count = (color: Color) => Object.values(placement).filter((p) => p?.[0] === color).length;

  const squareAt = (x: number, y: number): Square | null => {
    const rect = boardRef.current?.getBoundingClientRect();
    if (!rect || x < rect.left || y < rect.top || x >= rect.right || y >= rect.bottom) return null;
    const col = Math.floor(((x - rect.left) / rect.width) * 8);
    const row = Math.floor(((y - rect.top) / rect.height) * 8);
    const file = orientation === "w" ? col : 7 - col;
    const rank = orientation === "w" ? 8 - row : row + 1;
    return `${"abcdefgh"[file]}${rank}` as Square;
  };

  const apply = (square: Square, mode: "place" | "erase") => {
    setPlacement((current) => {
      const next = { ...current };
      if (mode === "erase" || tool === "erase") delete next[square];
      else {
        // Only one king per side: placing a king moves it.
        if (tool[1] === "k") for (const [sq, piece] of Object.entries(next)) if (piece === tool) delete next[sq as Square];
        next[square] = tool;
      }
      return next;
    });
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (twoFinger.current) return;
    const square = squareAt(e.clientX, e.clientY);
    if (!square) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    // Tapping a square that already holds the chosen piece removes it; right-click always erases.
    const mode: "place" | "erase" = e.button === 2 || tool === "erase" || placement[square] === tool ? "erase" : "place";
    painting.current = { pointerId: e.pointerId, mode, last: square };
    haptic("select");
    apply(square, mode);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const paint = painting.current;
    if (!paint || paint.pointerId !== e.pointerId) return;
    const square = squareAt(e.clientX, e.clientY);
    if (!square || square === paint.last) return;
    paint.last = square;
    // Kings can't be painted across the board.
    if (paint.mode === "place" && tool !== "erase" && tool[1] === "k") return;
    apply(square, paint.mode);
  };
  const endPaint = () => { painting.current = null; };

  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 2) return;
    painting.current = null;
    const [a, b] = Array.from(e.touches);
    twoFinger.current = { start: [{ x: a.clientX, y: a.clientY }, { x: b.clientX, y: b.clientY }], done: false };
  };
  const onTouchMove = (e: React.TouchEvent) => {
    const t = twoFinger.current;
    if (!t || t.done || e.touches.length !== 2) return;
    const [a, b] = Array.from(e.touches);
    if (isBoardFlipSwipe(t.start, [{ x: a.clientX, y: a.clientY }, { x: b.clientX, y: b.clientY }])) {
      t.done = true;
      setOrientation((o) => (o === "w" ? "b" : "w"));
      haptic("select");
    }
  };
  const onTouchEnd = (e: React.TouchEvent) => { if (e.touches.length === 0) twoFinger.current = null; };

  const load = (fen: string) => {
    const next = placementFromFen(fen);
    setPlacement(next.placement);
    setTurn(next.turn);
  };

  const cells = [];
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const file = orientation === "w" ? col : 7 - col;
      const rank = orientation === "w" ? 8 - row : row + 1;
      const square = `${"abcdefgh"[file]}${rank}` as Square;
      const piece = placement[square];
      const light = (file + rank) % 2 === 1;
      cells.push(
        <div key={square} data-square={square} className={`relative ${light ? "sq-light" : "sq-dark"}`} aria-label={`${square}: ${piece ? `${piece[0] === "w" ? "white" : "black"} ${NAMES[piece[1]]}` : "empty"}`} role="gridcell">
          {piece && <Piece type={piece[1]} color={piece[0] as Color} set={settings.pieceSet} className="board-piece pointer-events-none h-full w-full" />}
          {col === 0 && <span aria-hidden="true" className={`pointer-events-none absolute left-[3%] top-[2%] text-[10px] font-semibold ${light ? "coord-on-light" : "coord-on-dark"}`}>{rank}</span>}
          {row === 7 && <span aria-hidden="true" className={`pointer-events-none absolute bottom-[1%] right-[4%] text-[10px] font-semibold ${light ? "coord-on-light" : "coord-on-dark"}`}>{"abcdefgh"[file]}</span>}
        </div>,
      );
    }
  }

  const palette = (color: Color) => (
    <div className="grid grid-cols-6 gap-1" role="radiogroup" aria-label={`${color === "w" ? "White" : "Black"} pieces`}>
      {ORDER.map((type) => {
        const id = `${color}${type}` as EditorPiece;
        return (
          <button key={id} role="radio" aria-checked={tool === id} aria-label={`${color === "w" ? "White" : "Black"} ${NAMES[type]}`} data-tool={id} onClick={() => setTool(id)}
            className={`grid aspect-square place-items-center rounded-xl p-1 transition-colors ${tool === id ? "bg-[#81b64c] shadow-[0_3px_0_#5d8a33]" : "bg-surface-2"}`}>
            <Piece type={type} color={color} set={settings.pieceSet} className="h-full w-full" />
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
      <div className="mx-auto w-full max-w-[min(100%,calc(100dvh-260px),640px)]">
        <div
          ref={boardRef}
          role="grid"
          aria-label="Position editor board. Tap or drag to place the chosen piece."
          data-position-editor
          className="board grid aspect-square w-full touch-none select-none grid-cols-8 grid-rows-8 overflow-hidden rounded-[10px] shadow-[var(--shadow)]"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endPaint}
          onPointerCancel={endPaint}
          onContextMenu={(e) => e.preventDefault()}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          {cells}
        </div>
        <p className="mt-1.5 text-center text-xs text-muted">Tap or drag to place · tap the same piece or right-click to remove · two-finger swipe to flip</p>
      </div>

      <aside className="grid gap-3 rounded-2xl bg-surface p-4 shadow-[var(--shadow)]">
        {palette("w")}
        {palette("b")}
        <div className="grid grid-cols-3 gap-1.5 text-sm font-semibold">
          <button role="radio" aria-checked={tool === "erase"} data-tool="erase" onClick={() => setTool("erase")} className={`min-h-10 rounded-xl ${tool === "erase" ? "bg-[#e05f4e] text-white" : "bg-surface-2"}`}>Eraser</button>
          <button onClick={() => load("4k3/8/8/8/8/8/8/4K3 w - - 0 1")} className="min-h-10 rounded-xl bg-surface-2">Clear</button>
          <button onClick={() => setOrientation((o) => (o === "w" ? "b" : "w"))} className="min-h-10 rounded-xl bg-surface-2" aria-label="Flip board">⇅ Flip</button>
        </div>
        <label className="grid gap-1 text-sm">
          <span className="px-1 text-muted">Start from</span>
          <select
            className="min-h-11 rounded-xl bg-surface-2 px-3"
            defaultValue=""
            onChange={(e) => { if (e.target.value) load(variantFen(e.target.value as never, "w")); e.target.value = ""; }}
          >
            <option value="" disabled>Choose a preset…</option>
            {VARIANTS.filter((v) => !v.id.startsWith("odds")).map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
          </select>
        </label>
        <div role="radiogroup" aria-label="Side to move" className="grid grid-cols-2 gap-1 rounded-[14px] bg-surface-2 p-[3px] text-sm">
          {(["w", "b"] as const).map((c) => (
            <button key={c} role="radio" aria-checked={turn === c} onClick={() => setTurn(c)} className={`min-h-10 rounded-[11px] ${turn === c ? "bg-surface font-semibold shadow-[0_3px_8px_rgba(0,0,0,0.12)]" : "text-muted"}`}>
              {c === "w" ? "White" : "Black"} moves first
            </button>
          ))}
        </div>
        <p className="text-xs text-muted">White {count("w")} pieces · Black {count("b")} pieces · castling is allowed when king and rook are on their starting squares.</p>
        {problem && <p role="alert" data-editor-problem className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{problem}</p>}
        <div className="grid gap-2">
          <button data-editor-done disabled={!!problem} onClick={() => onDone(placementToFen(placement, turn))} className="min-h-12 rounded-xl bg-[#81b64c] text-base font-bold text-white shadow-[0_4px_0_#5d8a33] transition-transform active:translate-y-[2px] active:shadow-[0_2px_0_#5d8a33] disabled:opacity-40">
            {doneLabel}
          </button>
          {onCancel && <button onClick={onCancel} className="min-h-11 rounded-xl bg-surface-2 text-sm font-semibold">Cancel</button>}
        </div>
      </aside>
    </div>
  );
}
