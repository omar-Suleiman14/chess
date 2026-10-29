import type { WhiteScore } from "./engine/uci";
import { type AnalysedMove, MIN_ANALYSIS_DEPTH } from "./lessons/adaptive";
import { applyUci, legalUcis, positionStatus, sideToMove, type Color } from "./rules";
import { isBookMove } from "./openingBook";

export const MOVE_QUALITY = {
  brilliant: { label: "Brilliant", symbol: "!!", color: "#168c92" },
  great: { label: "Great", symbol: "!", color: "#527cbb" },
  book: { label: "Book", symbol: "B", color: "#98734c" },
  best: { label: "Best", symbol: "★", color: "#81a64c" },
  excellent: { label: "Excellent", symbol: "!", color: "#6f9f70" },
  good: { label: "Good", symbol: "✓", color: "#77995a" },
  inaccuracy: { label: "Inaccuracy", symbol: "?!", color: "#c49a24" },
  mistake: { label: "Mistake", symbol: "?", color: "#d47b32" },
  miss: { label: "Missed Win", symbol: "×", color: "#ce675d" },
  blunder: { label: "Blunder", symbol: "??", color: "#cb4d4d" },
} as const;
export type MoveQuality = keyof typeof MOVE_QUALITY;
export type ReviewedMove = { ply: number; color: Color; quality: MoveQuality; lossCp: number; bestmove: string; bestSan: string };
const PIECE_VALUE = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

function value(score: WhiteScore, color: Color): number {
  const cp = score.mate !== undefined ? Math.sign(score.mate || 1) * (10000 - Math.min(999, Math.abs(score.mate)) * 10) : score.cp ?? 0;
  return color === "w" ? cp : -cp;
}

/** Compare consecutive White-POV evaluations; never label shallow/missing analysis. */
export function reviewMove(move: AnalysedMove): ReviewedMove | null {
  const before = move.before;
  if (!before?.bestmove || (before.depth ?? 0) < MIN_ANALYSIS_DEPTH) return null;
  if (!Number.isFinite(before.score.cp) && !Number.isFinite(before.score.mate)) return null;
  const best = applyUci(move.fenBefore, before.bestmove);
  const played = applyUci(move.fenBefore, move.uci);
  if (!best || !played) return null;
  const color = sideToMove(move.fenBefore);
  const terminal = positionStatus(played.fen);
  const after: WhiteScore | undefined = terminal.over
    ? terminal.reason === "checkmate" ? { mate: color === "w" ? 1 : -1 } : { cp: 0 }
    : move.after && (move.after.depth ?? 0) >= MIN_ANALYSIS_DEPTH ? move.after.score : undefined;
  if (!after) return null;
  if (!Number.isFinite(after.cp) && !Number.isFinite(after.mate)) return null;
  const lossCp = Math.max(0, value(before.score, color) - value(after, color));
  const missedMate = before.score.mate !== undefined && value(before.score, color) > 0 && !(after.mate !== undefined && value(after, color) > 0);
  let quality: MoveQuality = missedMate ? "miss" : lossCp >= 300 ? "blunder" : lossCp >= 150 ? "mistake" : lossCp > 50 ? "inaccuracy" : before.bestmove === move.uci ? "best" : lossCp > 20 ? "good" : "excellent";
  if (lossCp <= 50 && isBookMove(move.fenBefore, move.uci)) quality = "book";
  const alternatives = before.candidates?.filter((candidate) => candidate.uci !== move.uci && candidate.depth >= 16 && candidate.depth === before.depth && (Number.isFinite(candidate.score.cp) || Number.isFinite(candidate.score.mate)));
  const runnerUp = alternatives?.toSorted((a, b) => value(b.score, color) - value(a.score, color))[0];
  const uniqueBest = quality === "best" && (before.depth ?? 0) >= 16 && (move.after?.depth ?? 0) >= 16 && runnerUp && legalUcis(move.fenBefore).length > 1 && lossCp <= 20 && value(before.score, color) - value(runnerUp.score, color) >= 150;
  if (uniqueBest) {
    quality = "great";
    const reply = move.after?.bestmove ? applyUci(played.fen, move.after.bestmove) : null;
    // An engine-preferred non-losing sacrifice, with a clearly inferior alternative.
    // A sacrifice alone, a forced move or shallow search never earns this label.
    if (reply?.captured && ["n", "b", "r", "q"].includes(reply.captured) && reply.to === played.to && PIECE_VALUE[reply.captured] > (played.captured ? PIECE_VALUE[played.captured] : 0) && value(after, color) >= 0 && value(runnerUp.score, color) < -100) quality = "brilliant";
  }
  return { ply: move.ply, color, quality, lossCp, bestmove: before.bestmove, bestSan: best.san };
}
