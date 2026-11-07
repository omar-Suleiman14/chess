// Game Review summary numbers: accuracy per phase and a rough "game rating".
import { moveAccuracy, winPercent } from "./accuracy";
import type { WhiteScore } from "./engine/uci";
import { piecesOf, type Color } from "./rules";

export type Phase = "opening" | "middlegame" | "endgame";
export type Verdict = "excellent" | "good" | "inaccurate" | "poor";

/** Endgame once few pieces remain; opening for the first ten moves; middlegame between. */
export function phaseOf(fen: string, ply: number): Phase {
  const officers = piecesOf(fen).filter((p) => p.type !== "k" && p.type !== "p").length;
  if (officers <= 6) return "endgame";
  if (ply <= 20) return "opening";
  return "middlegame";
}

/**
 * Accuracy per side and phase. `scores[i]` is the White-POV evaluation after
 * i plies and `fens[i]` the position after i plies (index 0 = start).
 */
export function phaseAccuracy(scores: Array<WhiteScore | undefined>, fens: string[], firstMover: Color = "w"): Record<Color, Record<Phase, number | null>> {
  const sums: Record<Color, Record<Phase, { t: number; n: number }>> = {
    w: { opening: { t: 0, n: 0 }, middlegame: { t: 0, n: 0 }, endgame: { t: 0, n: 0 } },
    b: { opening: { t: 0, n: 0 }, middlegame: { t: 0, n: 0 }, endgame: { t: 0, n: 0 } },
  };
  for (let i = 1; i < scores.length; i++) {
    const before = scores[i - 1], after = scores[i];
    if (!before || !after || !fens[i - 1]) continue;
    const mover: Color = (i - 1) % 2 === 0 ? firstMover : firstMover === "w" ? "b" : "w";
    const b = mover === "w" ? winPercent(before) : 100 - winPercent(before);
    const a = mover === "w" ? winPercent(after) : 100 - winPercent(after);
    const bucket = sums[mover][phaseOf(fens[i - 1], i)];
    bucket.t += moveAccuracy(b, a);
    bucket.n += 1;
  }
  const out = (c: Color) => Object.fromEntries((["opening", "middlegame", "endgame"] as Phase[]).map((p) => [p, sums[c][p].n ? Math.round(sums[c][p].t / sums[c][p].n) : null])) as Record<Phase, number | null>;
  return { w: out("w"), b: out("b") };
}

export function verdictFor(accuracy: number | null): Verdict | null {
  if (accuracy === null) return null;
  return accuracy >= 85 ? "excellent" : accuracy >= 70 ? "good" : accuracy >= 55 ? "inaccurate" : "poor";
}

/**
 * A rough performance estimate from accuracy alone (curve fitted to typical
 * accuracy-by-rating figures). It's a guide, not a rating change.
 */
export function estimateGameRating(accuracy: number | null): number | null {
  if (accuracy === null) return null;
  const raw = 3000 * Math.pow(Math.max(0, Math.min(100, accuracy)) / 100, 4.5);
  return Math.round(Math.max(100, Math.min(3000, raw)) / 50) * 50;
}
