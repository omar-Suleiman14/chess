// chess.js is the single source of truth for legality, FEN, SAN and PGN.
// Everything here is pure so it runs identically in the browser and in Convex.
import { Chess, DEFAULT_POSITION, validateFen, type Move, type Square } from "chess.js";

export { DEFAULT_POSITION };
export type { Move, Square };
export type Color = "w" | "b";
export type PromotionPiece = "q" | "r" | "b" | "n";

export const MAX_FEN_LENGTH = 100;
export const UCI_PATTERN = /^[a-h][1-8][a-h][1-8][qrbn]?$/;

export type FenCheck = { ok: true; fen: string } | { ok: false; error: string };

/** Validates a FEN string, including king legality, and normalises it. */
export function checkFen(fen: string): FenCheck {
  const trimmed = fen.trim().replace(/\s+/g, " ");
  if (trimmed.length === 0 || trimmed.length > MAX_FEN_LENGTH) {
    return { ok: false, error: "FEN is empty or too long." };
  }
  const result = validateFen(trimmed);
  if (!result.ok) return { ok: false, error: result.error ?? "Invalid FEN." };
  try {
    const chess = new Chess(trimmed);
    // The side not to move must not be in check (an impossible position).
    const turn = chess.turn();
    const other: Color = turn === "w" ? "b" : "w";
    const [king] = chess.findPiece({ type: "k", color: other });
    if (king && chess.isAttacked(king, turn)) {
      return { ok: false, error: "The side not to move is in check." };
    }
    return { ok: true, fen: chess.fen() };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Invalid FEN." };
  }
}

export function sideToMove(fen: string): Color {
  return fen.split(" ")[1] === "b" ? "b" : "w";
}

export function moveToUci(move: Pick<Move, "from" | "to" | "promotion">): string {
  return `${move.from}${move.to}${move.promotion ?? ""}`;
}

export type AppliedMove = {
  uci: string;
  san: string;
  fen: string;
  from: Square;
  to: Square;
  piece: Move["piece"];
  captured?: Move["captured"];
  promotion?: Move["promotion"];
  flags: string;
  check: boolean;
  checkmate: boolean;
};

/** Applies a UCI move to a FEN. Returns null for anything illegal. */
export function applyUci(fen: string, uci: string): AppliedMove | null {
  if (!UCI_PATTERN.test(uci)) return null;
  let chess: Chess;
  try {
    chess = new Chess(fen);
  } catch {
    return null;
  }
  let move: Move;
  try {
    move = chess.move({
      from: uci.slice(0, 2),
      to: uci.slice(2, 4),
      promotion: uci.length === 5 ? uci[4] : undefined,
    });
  } catch {
    return null;
  }
  // chess.js silently ignores a promotion letter on a non-promoting move;
  // reject so one position never has two spellings of the same move.
  if (uci.length === 5 && !move.promotion) return null;
  return {
    uci: moveToUci(move),
    san: move.san,
    fen: chess.fen(),
    from: move.from,
    to: move.to,
    piece: move.piece,
    captured: move.captured,
    promotion: move.promotion,
    flags: move.flags,
    check: chess.inCheck(),
    checkmate: chess.isCheckmate(),
  };
}

export function legalMoves(fen: string): Move[] {
  try {
    return new Chess(fen).moves({ verbose: true });
  } catch {
    return [];
  }
}

export function legalUcis(fen: string): string[] {
  return legalMoves(fen).map(moveToUci);
}

export function isLegalUci(fen: string, uci: string): boolean {
  return applyUci(fen, uci) !== null;
}

export function sanToUci(fen: string, san: string): string | null {
  try {
    const chess = new Chess(fen);
    return moveToUci(chess.move(san));
  } catch {
    return null;
  }
}

export type TerminalReason =
  | "checkmate"
  | "stalemate"
  | "insufficient"
  | "fifty_move"
  | "threefold";

export type Outcome = "1-0" | "0-1" | "1/2-1/2";

export type PositionStatus =
  | { over: false; check: boolean }
  | { over: true; reason: TerminalReason; outcome: Outcome; check: boolean };

/**
 * Status that can be decided from a single FEN. Threefold repetition needs the
 * path of positions, see `statusFromPath`.
 */
export function positionStatus(fen: string): PositionStatus {
  const chess = new Chess(fen);
  const check = chess.inCheck();
  if (chess.isCheckmate()) {
    return { over: true, reason: "checkmate", outcome: chess.turn() === "w" ? "0-1" : "1-0", check };
  }
  if (chess.isStalemate()) return { over: true, reason: "stalemate", outcome: "1/2-1/2", check };
  if (chess.isInsufficientMaterial()) {
    return { over: true, reason: "insufficient", outcome: "1/2-1/2", check };
  }
  if (chess.isDrawByFiftyMoves()) {
    return { over: true, reason: "fifty_move", outcome: "1/2-1/2", check };
  }
  return { over: false, check };
}

/** Replays UCI moves from an origin FEN and reports the final status. */
export function statusFromPath(originFen: string, ucis: string[]): PositionStatus | null {
  const chess = new Chess(originFen);
  for (const uci of ucis) {
    try {
      chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
    } catch {
      return null;
    }
  }
  const single = positionStatus(chess.fen());
  if (single.over) return single;
  if (chess.isThreefoldRepetition()) {
    return { over: true, reason: "threefold", outcome: "1/2-1/2", check: single.check };
  }
  return single;
}

/**
 * FIDE 6.9: a player whose flag falls loses, unless the opponent cannot
 * checkmate by any series of legal moves. We approximate "cannot mate" with the
 * standard material test for the opponent's pieces only.
 */
export function timeoutOutcome(fen: string, flagged: Color): Outcome {
  const winner: Color = flagged === "w" ? "b" : "w";
  if (!hasMatingMaterial(fen, winner)) return "1/2-1/2";
  return winner === "w" ? "1-0" : "0-1";
}

export function hasMatingMaterial(fen: string, color: Color): boolean {
  const chess = new Chess(fen);
  let minors = 0;
  for (const row of chess.board()) {
    for (const piece of row) {
      if (!piece || piece.color !== color) continue;
      if (piece.type === "p" || piece.type === "q" || piece.type === "r") return true;
      if (piece.type === "b" || piece.type === "n") minors += 1;
    }
  }
  return minors >= 2;
}

export type BoardPiece = { square: Square; type: Move["piece"]; color: Color };

export function piecesOf(fen: string): BoardPiece[] {
  const out: BoardPiece[] = [];
  const chess = new Chess(fen);
  for (const row of chess.board()) {
    for (const piece of row) {
      if (piece) out.push({ square: piece.square, type: piece.type, color: piece.color });
    }
  }
  return out;
}

export function kingSquare(fen: string, color: Color): Square | undefined {
  return new Chess(fen).findPiece({ type: "k", color })[0];
}

export function isPromotionMove(fen: string, from: Square, to: Square): boolean {
  return legalMoves(fen).some((m) => m.from === from && m.to === to && Boolean(m.promotion));
}

export const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"] as const;
export const RANKS = ["1", "2", "3", "4", "5", "6", "7", "8"] as const;

const PIECE_NAMES: Record<Move["piece"], string> = {
  p: "pawn",
  n: "knight",
  b: "bishop",
  r: "rook",
  q: "queen",
  k: "king",
};

export function pieceName(type: Move["piece"]): string {
  return PIECE_NAMES[type];
}

/** Human description used for screen readers, e.g. "White knight to f3, check". */
export function describeMove(move: Pick<AppliedMove, "piece" | "to" | "captured" | "promotion" | "check" | "checkmate" | "flags">, color: Color): string {
  const side = color === "w" ? "White" : "Black";
  if (move.flags.includes("k")) return `${side} castles kingside${suffix(move)}`;
  if (move.flags.includes("q")) return `${side} castles queenside${suffix(move)}`;
  const capture = move.captured ? ` takes ${pieceName(move.captured)} on` : " to";
  const promo = move.promotion ? `, promotes to ${pieceName(move.promotion)}` : "";
  return `${side} ${pieceName(move.piece)}${capture} ${move.to}${promo}${suffix(move)}`;
}

function suffix(move: { check: boolean; checkmate: boolean }): string {
  if (move.checkmate) return ", checkmate";
  if (move.check) return ", check";
  return "";
}
