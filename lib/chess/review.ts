import type { WhiteScore } from "./engine/uci";
import { type AnalysedMove, MIN_ANALYSIS_DEPTH } from "./lessons/adaptive";
import { applyUci, positionStatus, sideToMove, type Color } from "./rules";

export const MOVE_QUALITY = {
  best: { label: "Best", symbol: "★", color: "#81a64c" },
  excellent: { label: "Excellent", symbol: "!", color: "#6f9f70" },
  good: { label: "Good", symbol: "✓", color: "#77995a" },
  inaccuracy: { label: "Inaccuracy", symbol: "?!", color: "#c49a24" },
  mistake: { label: "Mistake", symbol: "?", color: "#d47b32" },
  miss: { label: "Missed mate", symbol: "×", color: "#ce675d" },
  blunder: { label: "Blunder", symbol: "??", color: "#cb4d4d" },
} as const;
export type MoveQuality = keyof typeof MOVE_QUALITY;
export type ReviewedMove = { ply: number; color: Color; quality: MoveQuality; lossCp: number; bestmove: string; bestSan: string };

function value(score: WhiteScore, color: Color): number {
  const cp = score.mate !== undefined ? Math.sign(score.mate || 1) * (10000 - Math.min(999, Math.abs(score.mate)) * 10) : score.cp ?? 0;
  return color === "w" ? cp : -cp;
}

/** Compare consecutive White-POV evaluations; never label shallow/missing analysis. */
export function reviewMove(move: AnalysedMove): ReviewedMove | null {
  const before = move.before;
  if (!before?.bestmove || (before.depth ?? 0) < MIN_ANALYSIS_DEPTH) return null;
  const best = applyUci(move.fenBefore, before.bestmove);
  const played = applyUci(move.fenBefore, move.uci);
  if (!best || !played) return null;
  const color = sideToMove(move.fenBefore);
  const terminal = positionStatus(played.fen);
  const after: WhiteScore | undefined = terminal.over
    ? terminal.reason === "checkmate" ? { mate: color === "w" ? 1 : -1 } : { cp: 0 }
    : move.after && (move.after.depth ?? 0) >= MIN_ANALYSIS_DEPTH ? move.after.score : undefined;
  if (!after) return null;
  const lossCp = Math.max(0, value(before.score, color) - value(after, color));
  const missedMate = before.score.mate !== undefined && value(before.score, color) > 0 && !(after.mate !== undefined && value(after, color) > 0);
  const quality: MoveQuality = before.bestmove === move.uci ? "best" : missedMate ? "miss" : lossCp >= 300 ? "blunder" : lossCp >= 150 ? "mistake" : lossCp > 50 ? "inaccuracy" : lossCp > 20 ? "good" : "excellent";
  return { ply: move.ply, color, quality, lossCp, bestmove: before.bestmove, bestSan: best.san };
}
