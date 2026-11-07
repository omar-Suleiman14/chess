// Position editor logic: any placement of pieces becomes a playable FEN,
// with castling rights inferred and plain-language reasons when it can't.
import { checkFen, positionStatus, type Color, type Square } from "./rules";

export type EditorPiece = `${Color}${"k" | "q" | "r" | "b" | "n" | "p"}`;
export type Placement = Partial<Record<Square, EditorPiece>>;

const FILES = "abcdefgh";

export function placementFromFen(fen: string): { placement: Placement; turn: Color } {
  const [board, turn] = fen.split(" ");
  const placement: Placement = {};
  board.split("/").forEach((row, r) => {
    let file = 0;
    for (const ch of row) {
      if (/\d/.test(ch)) { file += Number(ch); continue; }
      const color: Color = ch === ch.toUpperCase() ? "w" : "b";
      placement[`${FILES[file]}${8 - r}` as Square] = `${color}${ch.toLowerCase()}` as EditorPiece;
      file += 1;
    }
  });
  return { placement, turn: turn === "b" ? "b" : "w" };
}

/** Castling is allowed whenever king and rook still stand on their starting squares. */
export function inferCastling(p: Placement): string {
  let rights = "";
  if (p.e1 === "wk" && p.h1 === "wr") rights += "K";
  if (p.e1 === "wk" && p.a1 === "wr") rights += "Q";
  if (p.e8 === "bk" && p.h8 === "br") rights += "k";
  if (p.e8 === "bk" && p.a8 === "br") rights += "q";
  return rights || "-";
}

export function placementToFen(p: Placement, turn: Color): string {
  const rows: string[] = [];
  for (let rank = 8; rank >= 1; rank--) {
    let row = "";
    let empty = 0;
    for (const file of FILES) {
      const piece = p[`${file}${rank}` as Square];
      if (!piece) { empty += 1; continue; }
      if (empty) { row += empty; empty = 0; }
      row += piece[0] === "w" ? piece[1].toUpperCase() : piece[1];
    }
    rows.push(row + (empty ? empty : ""));
  }
  return `${rows.join("/")} ${turn} ${inferCastling(p)} - 0 1`;
}

/** Why this position can't be played, or null when it's fine. */
export function positionProblem(p: Placement, turn: Color): string | null {
  const pieces = Object.entries(p) as Array<[Square, EditorPiece]>;
  for (const color of ["w", "b"] as const) {
    const kings = pieces.filter(([, piece]) => piece === `${color}k`).length;
    const name = color === "w" ? "White" : "Black";
    if (kings === 0) return `${name} needs a king.`;
    if (kings > 1) return `${name} can only have one king.`;
  }
  if (pieces.some(([square, piece]) => piece[1] === "p" && (square[1] === "1" || square[1] === "8"))) return "Pawns can't stand on the first or last rank.";
  const fen = placementToFen(p, turn);
  const checked = checkFen(fen);
  if (!checked.ok) {
    return /check/i.test(checked.error) ? `${turn === "w" ? "Black" : "White"} is in check but it's ${turn === "w" ? "White" : "Black"}'s move. Switch who moves first or move a piece.` : checked.error;
  }
  const status = positionStatus(fen);
  if (status.over) return status.reason === "checkmate" ? "That's already checkmate." : status.reason === "stalemate" ? "That's already stalemate." : "That position is already a draw (not enough pieces to mate).";
  return null;
}
