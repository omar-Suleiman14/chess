import { sideToMove, type Color } from "../chess/rules";

/** An optimistic move: shown at once, kept until the server's ply moves past it. */
export type PendingMove = { ply: number; fen: string; uci: string };

/**
 * The optimistic move that still matters: the one made from the current
 * server position. Once the server has applied it (or anything after it),
 * an old pending move is just history and must not block anything.
 */
export function livePendingMove(pending: PendingMove | null, serverPly: number): PendingMove | null {
  return pending && pending.ply === serverPly ? pending : null;
}

/** Whether this seat may send a move right now. */
export function canSubmitMove(args: { you: Color | null; active: boolean; fen: string; serverPly: number; pending: PendingMove | null }): boolean {
  const { you, active, fen, serverPly, pending } = args;
  return !!you && active && sideToMove(fen) === you && livePendingMove(pending, serverPly) === null;
}
