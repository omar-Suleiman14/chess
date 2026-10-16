import { applyUci, piecesOf, sideToMove, type Color } from "./rules";

export type CapturedPiece = "p" | "n" | "b" | "r" | "q";
const VALUE = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
const ORDER: CapturedPiece[] = ["p", "n", "b", "r", "q"];

/** Replay the selected line, so undo, branches, en passant and promotions stay exact. */
export function capturesAlongLine(originFen: string, moves: readonly { uci: string }[]) {
  const captured: Record<Color, CapturedPiece[]> = { w: [], b: [] };
  let fen = originFen;
  for (const move of moves) {
    const applied = applyUci(fen, move.uci);
    if (!applied) break;
    if (applied.captured && applied.captured !== "k") captured[sideToMove(fen)].push(applied.captured);
    fen = applied.fen;
  }
  for (const color of ["w", "b"] as const) captured[color].sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b));
  const material = piecesOf(fen).reduce((sum, piece) => sum + VALUE[piece.type] * (piece.color === "w" ? 1 : -1), 0);
  return { captured, advantage: { w: Math.max(0, material), b: Math.max(0, -material) } };
}
