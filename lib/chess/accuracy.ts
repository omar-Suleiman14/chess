// Game accuracy from engine evaluations, using the widely published
// win-percentage method: each move's accuracy falls with the win chance it
// gave away; a side's accuracy is the mean over its moves.
import type { WhiteScore } from "./engine/uci";
import type { Color } from "./rules";

/** White's winning chances in percent (0-100) for an evaluation. */
export function winPercent(score: WhiteScore): number {
  if (score.mate !== undefined) return score.mate > 0 ? 100 : score.mate < 0 ? 0 : 50;
  const cp = Math.max(-1000, Math.min(1000, score.cp ?? 0));
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1);
}

/** Accuracy (0-100) of one move from the mover's win percent before and after. */
export function moveAccuracy(before: number, after: number): number {
  const lost = Math.max(0, before - after);
  return Math.max(0, Math.min(100, 103.1668 * Math.exp(-0.04354 * lost) - 3.1669));
}

/**
 * Per-side accuracy for a line. `scores[i]` is the White-POV evaluation of the
 * position after i plies (index 0 = start); missing entries skip that move.
 */
export function gameAccuracy(scores: Array<WhiteScore | undefined>, firstMover: Color = "w"): Record<Color, number | null> {
  const sums: Record<Color, { total: number; n: number }> = { w: { total: 0, n: 0 }, b: { total: 0, n: 0 } };
  for (let i = 1; i < scores.length; i++) {
    const before = scores[i - 1], after = scores[i];
    if (!before || !after) continue;
    const mover: Color = (i - 1) % 2 === 0 ? firstMover : firstMover === "w" ? "b" : "w";
    const sign = mover === "w" ? 1 : -1;
    const b = sign > 0 ? winPercent(before) : 100 - winPercent(before);
    const a = sign > 0 ? winPercent(after) : 100 - winPercent(after);
    sums[mover].total += moveAccuracy(b, a);
    sums[mover].n += 1;
  }
  const mean = (c: Color) => (sums[c].n ? Math.round((sums[c].total / sums[c].n) * 10) / 10 : null);
  return { w: mean("w"), b: mean("b") };
}
