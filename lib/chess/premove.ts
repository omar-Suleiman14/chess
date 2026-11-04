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
      const target = occupied.get(to);
      // A speculative reply can create an enemy on an empty diagonal, but it
      // cannot pass through our own stationary pieces. In particular, a
      // bishop on f1 must not offer g2/h3 while our g2 pawn still blocks it.
      if (target?.color === color) continue;
      if (piece.type === "p") {
        const forward = color === "w" ? 1 : -1;
        const emptyForward = dx === 0 && !target;
        const single = emptyForward && dy === forward;
        const double = emptyForward && y === (color === "w" ? 2 : 7) && dy === 2 * forward &&
          !occupied.has(`${FILES[x]}${y + forward}` as Square);
        const possibleCapture = ax === 1 && dy === forward;
        possible = single || double || possibleCapture;
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
      if (piece.type === "b" || piece.type === "r" || piece.type === "q") {
        const steps = Math.max(ax, ay);
        const stepX = Math.sign(dx), stepY = Math.sign(dy);
        let blocked = false;
        for (let step = 1; step < steps; step++) {
          const between = `${FILES[x + stepX * step]}${y + stepY * step}` as Square;
          if (occupied.has(between)) { blocked = true; break; }
        }
        if (blocked) continue;
      }
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
