import { applyUci, FILES, piecesOf, sideToMove, type Color, type PromotionPiece, type Square } from "./rules";

/** Speculative destinations, not legal moves: the opponent has not moved yet. */
export function premoveMoves(fen: string, color: Color) {
  const pieces = piecesOf(fen);
  const occupied = new Map(pieces.map((piece) => [piece.square, piece]));
  const rights = fen.split(" ")[2] ?? "-";
  const moves: { from: Square; to: Square; captured?: string; promotion?: PromotionPiece }[] = [];
  for (const piece of pieces) {
    if (piece.color !== color) continue;
    const x = piece.square.charCodeAt(0) - 97;
    const y = Number(piece.square[1]);
    for (const file of FILES) for (let rank = 1; rank <= 8; rank++) {
      const to = `${file}${rank}` as Square;
      const dx = file.charCodeAt(0) - 97 - x;
      const dy = rank - y;
      if (!dx && !dy) continue;
      const ax = Math.abs(dx), ay = Math.abs(dy);
      let possible = false;
      if (piece.type === "p") {
        const forward = color === "w" ? 1 : -1;
        possible = (dy === forward && ax <= 1) || (dx === 0 && y === (color === "w" ? 2 : 7) && dy === 2 * forward);
      } else if (piece.type === "n") possible = ax * ay === 2;
      else if (piece.type === "b") possible = ax === ay;
      else if (piece.type === "r") possible = dx === 0 || dy === 0;
      else if (piece.type === "q") possible = ax === ay || dx === 0 || dy === 0;
      else if (piece.type === "k") {
        const home = color === "w" ? 1 : 8;
        const castle = piece.square === `e${home}` && rank === home &&
          ((dx === 2 && rights.includes(color === "w" ? "K" : "k")) || (dx === -2 && rights.includes(color === "w" ? "Q" : "q")));
        possible = Math.max(ax, ay) === 1 || castle;
      }
      if (!possible) continue;
      const target = occupied.get(to);
      moves.push({ from: piece.square, to, captured: target?.color !== color ? target?.type : undefined,
        promotion: piece.type === "p" && rank === (color === "w" ? 8 : 1) ? "q" : undefined });
    }
  }
  return moves;
}

export type QueuedPremove = { uci: string; context: string; fen: string; ply: number; player: Color };
export type PremovePosition = { context: string; fen: string; ply: number; active: boolean; player: Color | null; ready: boolean };

/** A queue is valid for exactly the next opponent move in this game/branch. */
export function resolvePremove(queued: QueuedPremove, position: PremovePosition): "wait" | "play" | "clear" {
  if (!position.active || position.context !== queued.context || position.player !== queued.player) return "clear";
  if (position.ply === queued.ply && position.fen === queued.fen) return "wait";
  if (position.ply !== queued.ply + 1 || sideToMove(position.fen) !== queued.player) return "clear";
  if (!position.ready) return "wait";
  return applyUci(position.fen, queued.uci) ? "play" : "clear";
}
