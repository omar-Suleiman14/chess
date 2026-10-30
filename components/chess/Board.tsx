"use client";

import { motion } from "motion/react";
import { memo, useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode, type KeyboardEvent, type PointerEvent } from "react";
import { FILES, legalMoves, pieceName, piecesOf, type BoardPiece, type Color, type PromotionPiece, type Square } from "@/lib/chess/rules";
import { premoveMoves } from "@/lib/chess/premove";
import { useSettings } from "@/lib/client/settings";
import { playSound } from "@/lib/client/sound";
import { haptic } from "@/lib/client/haptics";
import { Piece } from "./Pieces";
import { PromotionSheet } from "./PromotionSheet";

export type BoardResult = { result?: string; reason?: string };

export type LastMove = { from: Square; to: Square; rookFrom?: Square; rookTo?: Square; key: string } | null;

type Props = {
  fen: string;
  orientation: Color;
  /** Side the user may move (null = view only). */
  movable: Color | null;
  onMove: (uci: string) => void | boolean | Promise<boolean | void>;
  /** Side allowed to queue a move while the opponent is playing. */
  premovable?: Color | null;
  premove?: string | null;
  onPremove?: (uci: string | null) => void;
  lastMove?: LastMove;
  checkSquare?: Square | null;
  showLegalDots?: boolean;
  coordinates?: boolean;
  reducedMotion?: boolean;
  /** Extra squares to outline (lesson hints). */
  hintSquares?: Square[];
  hintMove?: { from: Square; to: Square };
  label?: string;
  /** Animate this move instead of lastMove (e.g. a move played in reverse). null = no animation. */
  motionMove?: LastMove;
  /** Short, non-bouncy glide for replay/scrubbing. */
  fast?: boolean;
  onSelect?: () => void;
  result?: BoardResult;
  moveBadge?: { square: Square; symbol: string; label: string; color: string };
};

const SQUARE_RE = /^[a-h][1-8]$/;

function squareAt(col: number, row: number, orientation: Color): Square {
  // row 0 is the top of the board on screen.
  const file = orientation === "w" ? col : 7 - col;
  const rank = orientation === "w" ? 7 - row : row;
  return `${FILES[file]}${rank + 1}` as Square;
}

function coordsOf(square: Square, orientation: Color): { col: number; row: number } {
  const file = square.charCodeAt(0) - 97;
  const rank = Number(square[1]) - 1;
  return orientation === "w" ? { col: file, row: 7 - rank } : { col: 7 - file, row: rank };
}

/**
 * Piece travel time, bounded: 130-220 ms for a normal move and 150-240 ms
 * for a capture, growing with distance so a one-square step and a long
 * diagonal both feel natural. Never a teleport, never a slow slide.
 */
export function moveDuration(from: Square, to: Square, capture: boolean): number {
  const dx = Math.abs(from.charCodeAt(0) - to.charCodeAt(0));
  const dy = Math.abs(Number(from[1]) - Number(to[1]));
  const distance = Math.hypot(dx, dy);
  const base = 118 + 16 * distance;
  return capture ? Math.min(240, Math.max(150, base + 20)) : Math.min(220, Math.max(130, base));
}

/** Fast out, soft landing: the piece is decisive but doesn't thud. */
const MOVE_EASE = [0.22, 0.8, 0.3, 1] as const;

export const Board = memo(function Board({
  fen,
  orientation,
  movable,
  onMove,
  premovable = null,
  premove = null,
  onPremove,
  lastMove,
  checkSquare,
  showLegalDots = true,
  coordinates = true,
  reducedMotion = false,
  hintSquares = [],
  hintMove,
  label = "Chess board",
  onSelect,
  motionMove,
  fast = false,
  result,
  moveBadge,
}: Props) {
  const winner: Color | null = result?.result === "1-0" ? "w" : result?.result === "0-1" ? "b" : null;
  const drawn = result?.result === "1/2-1/2";
  const animMove = motionMove === undefined ? lastMove : motionMove;
  const boardRef = useRef<HTMLDivElement>(null);
  const { settings } = useSettings();
  const [selected, setSelected] = useState<Square | null>(null);
  const [cursor, setCursor] = useState<Square>(orientation === "w" ? "e2" : "e7");
  const [drag, setDrag] = useState<{ from: Square; x: number; y: number; active: boolean; size: number } | null>(null);
  const [promotion, setPromotion] = useState<{ from: Square; to: Square; color: Color; queued: boolean } | null>(null);
  const dragStart = useRef<{ x: number; y: number } | null>(null);

  const pieces = useMemo(() => piecesOf(fen), [fen]);
  const bySquare = useMemo(() => new Map<Square, BoardPiece>(pieces.map((p) => [p.square, p])), [pieces]);
  const selectableColor = movable ?? premovable;
  const queuing = !movable && !!premovable && !!onPremove;
  const moves = useMemo(() => queuing && premovable ? premoveMoves(fen, premovable) : movable ? legalMoves(fen).filter((m) => m.color === movable) : [], [fen, movable, premovable, queuing]);
  const targets = useMemo(() => {
    const map = new Map<Square, Map<Square, { capture: boolean; promotion: boolean }>>();
    for (const m of moves) {
      if (!map.has(m.from)) map.set(m.from, new Map());
      map.get(m.from)!.set(m.to, { capture: Boolean(m.captured), promotion: Boolean(m.promotion) });
    }
    return map;
  }, [moves]);

  // Illegal attempt: shake the piece (and the king, if the move ignored check), buzz, error sound.
  const [illegal, setIllegal] = useState<{ squares: Square[]; key: number } | null>(null);
  const flagIllegal = useCallback(
    (from: Square) => {
      setIllegal({ squares: checkSquare && checkSquare !== from ? [from, checkSquare] : [from], key: Date.now() });
      haptic("illegal");
      if (settings.sound) playSound("illegal", settings.volume);
    },
    [checkSquare, settings.sound, settings.volume],
  );
  useEffect(() => {
    if (!illegal) return;
    const t = setTimeout(() => setIllegal(null), 600);
    return () => clearTimeout(t);
  }, [illegal]);

  // Drop selection whenever the position changes.
  useEffect(() => {
    setSelected(null);
    setPromotion(null);
  }, [fen]);

  // A piece dropped by drag is already on its square: don't slide it there again.
  const [dropped, setDropped] = useState<{ from: Square; to: Square } | null>(null);

  // The piece a move captured stays on its square until the attacker lands, then fades.
  // `before` is the position just before the latest one, so the victim is known
  // even if the last-move highlight arrives a render later.
  const [positions, setPositions] = useState<{ fen: string; map: Map<Square, BoardPiece>; before: Map<Square, BoardPiece> | null }>({ fen, map: bySquare, before: null });
  if (positions.fen !== fen) setPositions({ fen, map: bySquare, before: positions.map });
  const before = positions.fen === fen ? positions.before : positions.map;
  const victim = useMemo(() => {
    if (reducedMotion || !animMove || !before) return null;
    const landed = before.get(animMove.to);
    const mover = bySquare.get(animMove.to);
    const origin = before.get(animMove.from);
    // Only a forward move: the mover really came from `from` in the previous position.
    if (!landed || !mover || !origin || landed.color === mover.color || origin.color !== mover.color) return null;
    return { piece: landed, key: animMove.key };
  }, [reducedMotion, animMove, before, bySquare]);

  /** Instant, physical acknowledgement of your own move (before any engine or server reply). */
  const feelMove = useCallback((from: Square, to: Square, promotion?: PromotionPiece) => {
    if (queuing) return haptic("premove");
    const move = moves.find((m) => m.from === from && m.to === to && (!promotion || m.promotion === promotion));
    if (!move || !("san" in move)) return;
    haptic(move.san.includes("+") || move.san.includes("#") ? "check" : move.captured ? "capture" : move.flags.includes("k") || move.flags.includes("q") ? "castle" : move.promotion ? "promote" : "move");
  }, [moves, queuing]);

  const tryMove = useCallback(
    (from: Square, to: Square) => {
      const info = targets.get(from)?.get(to);
      if (!info) return false;
      setSelected(null);
      if (info.promotion) {
        setPromotion({ from, to, color: bySquare.get(from)!.color, queued: queuing });
        return true;
      }
      feelMove(from, to);
      if (queuing) onPremove?.(`${from}${to}`);
      else void onMove(`${from}${to}`);
      return true;
    },
    [targets, bySquare, onMove, queuing, onPremove, feelMove],
  );

  const activate = useCallback(
    (square: Square) => {
      const piece = bySquare.get(square);
      // Like chess.com: with a premove queued, tapping its squares (or any square
      // that doesn't start a new move) cancels it. Picking another piece re-plans.
      if (premove && onPremove && !selected && !movable) {
        const startsNew = !!piece && !!selectableColor && piece.color === selectableColor && targets.has(square);
        if (square === premove.slice(0, 2) || square === premove.slice(2, 4) || !startsNew) {
          onPremove(null);
          haptic("select");
          return;
        }
      }
      if (selected && selected !== square && tryMove(selected, square)) return;
      if (piece && selectableColor && piece.color === selectableColor && targets.has(square)) {
        setSelected(selected === square ? null : square);
        if (selected !== square) haptic("select");
        onSelect?.();
      } else {
        const ownPiece = !!piece && !!selectableColor && piece.color === selectableColor;
        // Tried to move the selected piece somewhere it can't go, or picked a piece with no legal moves.
        if (selected && selected !== square && !ownPiece) flagIllegal(selected);
        else if (ownPiece) flagIllegal(square);
        setSelected(null);
      }
    },
    [bySquare, selected, tryMove, selectableColor, targets, onSelect, flagIllegal, premove, onPremove, movable],
  );

  const squareFromPoint = (clientX: number, clientY: number): Square | null => {
    const rect = boardRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const col = Math.floor(((clientX - rect.left) / rect.width) * 8);
    const row = Math.floor(((clientY - rect.top) / rect.height) * 8);
    if (col < 0 || col > 7 || row < 0 || row > 7) return null;
    return squareAt(col, row, orientation);
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || promotion) return;
    const square = squareFromPoint(e.clientX, e.clientY);
    if (!square) return;
    const piece = bySquare.get(square);
    if (piece && selectableColor && piece.color === selectableColor && targets.has(square)) {
      (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
      dragStart.current = { x: e.clientX, y: e.clientY };
      const size = (boardRef.current?.getBoundingClientRect().width ?? 0) / 8;
      setDrag({ from: square, x: e.clientX, y: e.clientY, active: false, size });
    }
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!drag || !dragStart.current) return;
    const moved = Math.hypot(e.clientX - dragStart.current.x, e.clientY - dragStart.current.y) > 6;
    if (moved || drag.active) {
      if (!drag.active) {
        setSelected(drag.from);
        // Picking the piece up: one light tick, never a buzz while dragging.
        if (selected !== drag.from) haptic("select");
        onSelect?.();
      }
      setDrag({ ...drag, x: e.clientX, y: e.clientY, active: true });
    }
  };

  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    const square = squareFromPoint(e.clientX, e.clientY);
    if (drag?.active) {
      const from = drag.from;
      setDrag(null);
      dragStart.current = null;
      // A dropped premove stays on its origin until it runs, so it must still slide then.
      if (square && square !== from && !queuing && targets.get(from)?.has(square)) setDropped({ from, to: square });
      if (square && square !== from && tryMove(from, square)) return;
      if (square && square !== from) flagIllegal(from);
      setSelected(from);
      return;
    }
    setDrag(null);
    dragStart.current = null;
    if (square) {
      setCursor(square);
      setDropped(null);
      activate(square);
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const { col, row } = coordsOf(cursor, orientation);
    const delta: Record<string, [number, number]> = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
    if (delta[e.key]) {
      e.preventDefault();
      const [dc, dr] = delta[e.key];
      const next = squareAt(Math.min(7, Math.max(0, col + dc)), Math.min(7, Math.max(0, row + dr)), orientation);
      setCursor(next);
      document.getElementById(`sq-${next}`)?.focus();
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      activate(cursor);
    } else if (e.key === "Escape") {
      setSelected(null);
      onPremove?.(null);
    }
  };

  const arrowId = useId();
  const selectedTargets = selected ? targets.get(selected) : undefined;

  const cells: ReactNode[] = [];
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const square = squareAt(col, row, orientation);
      const light = (square.charCodeAt(0) - 97 + Number(square[1])) % 2 === 1;
      const piece = bySquare.get(square);
      const target = selectedTargets?.get(square);
      const isLast = lastMove && (lastMove.from === square || lastMove.to === square);
      const isPremove = premove && (premove.slice(0, 2) === square || premove.slice(2, 4) === square);
      const isCheck = checkSquare === square;
      const shaking = !!illegal?.squares.includes(square);
      const isSelected = selected === square;
      const isHint = hintSquares.includes(square);
      const hidden = drag?.active && drag.from === square;
      const description = [
        square,
        piece ? `${piece.color === "w" ? "white" : "black"} ${pieceName(piece.type)}` : "empty",
        isSelected ? "selected" : "",
        target ? (queuing ? "premove target" : target.capture ? "capture available" : "legal move") : "",
        isPremove ? "queued premove" : "",
        isCheck ? "king in check" : "",
        isLast ? "last move" : "",
      ]
        .filter(Boolean)
        .join(", ");
      let anim: { x: string; y: string; duration: number } | null = null;
      if (!reducedMotion && animMove && piece) {
        const from = animMove.to === square ? animMove.from : animMove.rookTo === square ? animMove.rookFrom : undefined;
        const alreadyThere = animMove.to === square && dropped?.from === animMove.from && dropped.to === animMove.to;
        if (from && SQUARE_RE.test(from) && !alreadyThere) {
          const a = coordsOf(from, orientation);
          const capture = animMove.to === square && victim !== null;
          anim = { x: `${(a.col - col) * 100}%`, y: `${(a.row - row) * 100}%`, duration: moveDuration(from as Square, square, capture) / 1000 };
        }
      }
      const fallen = victim && animMove?.to === square && !(dropped?.from === animMove.from && dropped.to === animMove.to) ? victim : null;
      cells.push(
        <div
          key={square}
          id={`sq-${square}`}
          role="gridcell"
          aria-rowindex={row + 1}
          aria-colindex={col + 1}
          tabIndex={cursor === square ? 0 : -1}
          aria-label={description}
          aria-selected={isSelected}
          onFocus={() => setCursor(square)}
          className={`relative ${light ? "sq-light" : "sq-dark"} ${piece && selectableColor && piece.color === selectableColor ? "cursor-grab" : target ? "cursor-pointer" : ""}`}
        >
          {isLast && <div className="absolute inset-0" style={{ background: "var(--hl-last)" }} />}
          {isPremove && <div className="pointer-events-none absolute inset-0 bg-[#4277b7]/35 ring-2 ring-inset ring-[#4277b7]/80" />}
          {isSelected && <div className="absolute inset-0" style={{ background: "var(--hl-select)" }} />}
          {isCheck && <div className="absolute inset-0" style={{ background: "radial-gradient(circle, var(--hl-check) 0%, transparent 72%)" }} />}
          {shaking && <div key={`flash-${illegal!.key}`} className="illegal-flash absolute inset-0" style={{ background: "rgba(220, 60, 50, 0.45)" }} />}
          {isHint && <div className="absolute inset-[6%] rounded-md border-[3px] border-dashed" style={{ borderColor: "var(--hl-target)" }} />}
          {coordinates && col === 0 && (
            <span aria-hidden="true" className={`pointer-events-none absolute left-[3%] top-[2%] text-[clamp(8px,2.2vw,12px)] font-semibold ${light ? "coord-on-light" : "coord-on-dark"}`}>{square[1]}</span>
          )}
          {coordinates && row === 7 && (
            <span aria-hidden="true" className={`pointer-events-none absolute bottom-[1%] right-[4%] text-[clamp(8px,2.2vw,12px)] font-semibold ${light ? "coord-on-light" : "coord-on-dark"}`}>{square[0]}</span>
          )}
          {fallen && (
            // The captured piece holds its square until the attacker arrives, then is gone.
            <motion.div
              key={`victim-${fallen.key}`}
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 z-[9]"
              initial={{ opacity: 1, scale: 1 }}
              animate={{ opacity: 0, scale: 0.92 }}
              transition={{ duration: 0.09, delay: Math.max(0, (anim?.duration ?? 0.18) - 0.07), ease: "easeOut" }}
            >
              <Piece type={fallen.piece.type} color={fallen.piece.color} set={settings.pieceSet} className="h-full w-full" />
            </motion.div>
          )}
          {piece && !hidden && (
            <motion.div
              key={anim ? `${animMove?.key}-${square}` : `${square}-${piece.color}${piece.type}`}
              className="absolute inset-0 z-10"
              initial={anim ? { x: anim.x, y: anim.y } : false}
              animate={{ x: 0, y: 0, scale: isSelected ? 1.04 : 1 }}
              transition={fast ? { type: "tween", ease: [0.25, 0.1, 0.25, 1], duration: 0.14 } : anim ? { type: "tween", ease: MOVE_EASE, duration: anim.duration } : { type: "spring", stiffness: 700, damping: 42, mass: 0.6 }}
            >
              <motion.div
                key={`${piece.color}${piece.type}:${result?.result ?? "live"}:${result?.reason ?? ""}`}
                className="h-full w-full origin-center"
                initial={false}
                animate={piece.type !== "k" || !result?.result ? { rotate: 0, scale: 1, y: 0 } : drawn
                  ? { rotate: 0, scale: reducedMotion ? 1 : [1, 1.08, 1], y: 0 }
                  : winner && piece.color !== winner
                    ? { rotate: reducedMotion ? 65 : [0, -8, 72, 65], scale: 0.78, y: 0 }
                    : { rotate: 0, scale: reducedMotion ? 1 : [1, 1.18, 1], y: 0 }}
                transition={{ duration: reducedMotion ? 0 : 0.45 }}
              >
                <div key={shaking ? `shake-${illegal!.key}` : "still"} className={`h-full w-full ${shaking && !reducedMotion ? "illegal-shake" : ""}`}>
                  <Piece type={piece.type} color={piece.color} set={settings.pieceSet} className="h-full w-full" />
                </div>
              </motion.div>
            </motion.div>
          )}
          {piece?.type === "k" && result && (winner || drawn) && (
            <>
              <motion.div className="pointer-events-none absolute inset-[5%] z-[5] rounded-full border-[3px]" style={{ borderColor: drawn ? "#d5c5a1" : piece.color === winner ? "#81b64c" : "#e87865" }}
                initial={reducedMotion ? false : { opacity: 0, scale: 0.6 }} animate={{ opacity: 0.8, scale: 1 }} transition={{ duration: reducedMotion ? 0 : 0.25 }} />
              <motion.span className="pointer-events-none absolute right-0 top-0 z-30 grid h-[40%] w-[40%] place-items-center rounded-full text-[clamp(10px,3vw,22px)] font-bold text-white shadow-md" style={{ backgroundColor: drawn ? "#99876a" : piece.color === winner ? "#81b64c" : "#c45140" }}
                role="img" aria-label={`${piece.color === "w" ? "White" : "Black"}: ${drawn ? "draw" : piece.color === winner ? "winner" : result.reason === "resign" ? "resigned" : "lost"}`}
                initial={reducedMotion ? false : { scale: 0 }} animate={{ scale: 1 }} transition={{ duration: reducedMotion ? 0 : 0.2, delay: reducedMotion ? 0 : 0.3 }}>
                {drawn ? "½" : piece.color === winner ? "♛" : result.reason === "resign" ? "⚑" : "×"}
              </motion.span>
            </>
          )}
          {moveBadge?.square === square && (
            <span role="img" aria-label={moveBadge.label} className="pointer-events-none absolute right-0 top-0 z-30 grid h-[42%] min-w-[42%] place-items-center rounded-full px-0.5 text-[clamp(10px,3vw,20px)] font-bold text-white shadow-md" style={{ backgroundColor: moveBadge.color }}>{moveBadge.symbol}</span>
          )}
          {target && showLegalDots && !target.capture && (
            <div className="absolute left-1/2 top-1/2 z-20 h-[28%] w-[28%] -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ background: "var(--hl-target)" }} />
          )}
          {target && showLegalDots && target.capture && (
            <div className="absolute inset-[4%] z-20 rounded-full border-[5px]" style={{ borderColor: "var(--hl-target)" }} />
          )}
        </div>,
      );
    }
  }

  const ghost = drag?.active ? bySquare.get(drag.from) : undefined;
  const size = drag?.size ?? 0;

  return (
    // The board is always left-to-right (files a-h), even when the page is RTL.
    <div className="relative w-full" dir="ltr">
      <div
        ref={boardRef}
        role="grid"
        aria-label={label}
        aria-rowcount={8}
        aria-colcount={8}
        className={`board relative grid aspect-square w-full grid-cols-8 grid-rows-8 overflow-hidden rounded-[10px] shadow-[var(--shadow)] ${drag ? "[&_*]:!cursor-grabbing !cursor-grabbing" : ""}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => setDrag(null)}
        onKeyDown={onKeyDown}
        onContextMenu={(event) => { event.preventDefault(); setSelected(null); onPremove?.(null); }}
      >
        {Array.from({ length: 8 }, (_, row) => <div key={row} role="row" className="contents">{cells.slice(row * 8, row * 8 + 8)}</div>)}
      </div>
      {hintMove && (() => {
        const from = coordsOf(hintMove.from, orientation), to = coordsOf(hintMove.to, orientation);
        return <svg aria-hidden="true" data-hint-arrow className="pointer-events-none absolute inset-0 z-30 h-full w-full" viewBox="0 0 8 8"><defs><marker id={arrowId} markerWidth="3" markerHeight="3" refX="2.5" refY="1.5" orient="auto"><path d="M0,0 L3,1.5 L0,3 Z" fill="var(--focus)" /></marker></defs><line x1={from.col + 0.5} y1={from.row + 0.5} x2={to.col + 0.5} y2={to.row + 0.5} stroke="var(--focus)" strokeWidth="0.14" strokeLinecap="round" markerEnd={`url(#${arrowId})`} /></svg>;
      })()}
      <span className="sr-only" aria-live="polite">{premove ? `Premove queued: ${premove.slice(0, 2)} to ${premove.slice(2, 4)}. Press Escape to cancel.` : ""}</span>
      {ghost && drag && size > 0 && (
        <div
          className="pointer-events-none fixed z-50"
          style={{ left: drag.x - size * 0.6, top: drag.y - size * 0.75, width: size * 1.2, height: size * 1.2 }}
        >
          <Piece type={ghost.type} color={ghost.color} set={settings.pieceSet} className="h-full w-full drop-shadow-[0_8px_10px_rgba(0,0,0,0.3)]" />
        </div>
      )}
      {promotion && (
        <PromotionSheet
          color={promotion.color}
          onPick={(piece: PromotionPiece) => {
            const { from, to } = promotion;
            setPromotion(null);
            feelMove(from, to, piece);
            if (promotion.queued) onPremove?.(`${from}${to}${piece}`);
            else void onMove(`${from}${to}${piece}`);
          }}
          onCancel={() => setPromotion(null)}
        />
      )}
    </div>
  );
});
