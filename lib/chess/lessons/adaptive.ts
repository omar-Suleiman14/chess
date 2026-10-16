// Turns saved games + saved engine analysis into personal practice positions,
// and schedules them with a simple Leitner-style spaced repetition.
import { applyUci, sideToMove, type Color } from "../rules";
import type { WhiteScore } from "../engine/uci";

export type AnalysedMove = {
  /** FEN before the move. */
  fenBefore: string;
  uci: string;
  san: string;
  ply: number;
  /** Saved evaluation of the position before the move (White POV), with the engine's best move. */
  before?: { score: WhiteScore; bestmove?: string; depth?: number };
  /** Saved evaluation after the move. */
  after?: { score: WhiteScore; depth?: number };
};

export type MistakeClass = "blunder" | "mistake" | "missed_mate";

export type Mistake = {
  ply: number;
  fen: string;
  played: string;
  playedSan: string;
  best: string;
  lossCp: number;
  kind: MistakeClass;
  theme: string;
};

/** Minimum search depth for an evaluation to be trusted for practice. */
export const MIN_ANALYSIS_DEPTH = 10;

const MATE_CP = 10_000;

function cpFor(score: WhiteScore, color: Color): number {
  const white = score.mate !== undefined ? Math.sign(score.mate || 1) * (MATE_CP - Math.abs(score.mate) * 10) : score.cp ?? 0;
  return color === "w" ? white : -white;
}

/**
 * Finds the human's clear mistakes using ONLY saved analysis. Positions without
 * trustworthy analysis are skipped, never guessed.
 */
export function findMistakes(moves: AnalysedMove[], human: Color): Mistake[] {
  const out: Mistake[] = [];
  for (const move of moves) {
    if (sideToMove(move.fenBefore) !== human) continue;
    const { before, after } = move;
    if (!before?.bestmove || !after) continue;
    if ((before.depth ?? 0) < MIN_ANALYSIS_DEPTH || (after.depth ?? 0) < MIN_ANALYSIS_DEPTH) continue;
    if (before.bestmove === move.uci) continue;
    const loss = cpFor(before.score, human) - cpFor(after.score, human);
    const missedMate = before.score.mate !== undefined && cpFor(before.score, human) > 0 && after.score.mate === undefined;
    let kind: MistakeClass | null = null;
    if (missedMate) kind = "missed_mate";
    else if (loss >= 300) kind = "blunder";
    else if (loss >= 150) kind = "mistake";
    if (!kind) continue;
    if (!applyUci(move.fenBefore, before.bestmove)) continue;
    out.push({
      ply: move.ply,
      fen: move.fenBefore,
      played: move.uci,
      playedSan: move.san,
      best: before.bestmove,
      lossCp: Math.min(loss, 2000),
      kind,
      theme: themeOf(move.fenBefore, before.bestmove, kind),
    });
  }
  return out;
}

function themeOf(fen: string, best: string, kind: MistakeClass): string {
  if (kind === "missed_mate") return "checkmate";
  const applied = applyUci(fen, best);
  if (!applied) return "tactics";
  if (applied.checkmate) return "checkmate";
  if (applied.captured) return "material";
  if (applied.check) return "checks";
  return "positional";
}

/** Counts recurring themes so the UI can say "you often miss captures". */
export function recurringThemes(mistakes: Mistake[]): Array<{ theme: string; count: number }> {
  const counts = new Map<string, number>();
  for (const m of mistakes) counts.set(m.theme, (counts.get(m.theme) ?? 0) + 1);
  return [...counts.entries()].map(([theme, count]) => ({ theme, count })).sort((a, b) => b.count - a.count);
}

export const REVIEW_INTERVALS_DAYS = [0, 1, 3, 7, 16, 35];
const DAY = 24 * 60 * 60 * 1000;

export type ReviewState = { box: number; dueAt: number; streak: number; lapses: number };

export function initialReview(now: number): ReviewState {
  return { box: 0, dueAt: now, streak: 0, lapses: 0 };
}

/** Correct without hints moves up a box; hints keep it; a miss resets to box 1. */
export function scheduleReview(state: ReviewState, outcome: "clean" | "hinted" | "failed", now: number): ReviewState {
  let box = state.box;
  if (outcome === "clean") box = Math.min(box + 1, REVIEW_INTERVALS_DAYS.length - 1);
  else if (outcome === "failed") box = 1;
  else box = Math.max(box, 1);
  return {
    box,
    dueAt: now + REVIEW_INTERVALS_DAYS[box] * DAY,
    streak: outcome === "clean" ? state.streak + 1 : 0,
    lapses: state.lapses + (outcome === "failed" ? 1 : 0),
  };
}

export function isMastered(state: ReviewState): boolean {
  return state.box >= 4;
}
