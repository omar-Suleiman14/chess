"use client";

import { winPercent } from "@/lib/chess/accuracy";
import type { WhiteScore } from "@/lib/chess/engine/uci";
import { MOVE_QUALITY, type ReviewedMove } from "@/lib/chess/review";

const W = 300;

/** White's winning chances over the game (white area = White better). Click to jump. */
export function EvalGraph({ scores, reviewed, cursor, onSelect, height = 110, progress = null }: {
  scores: Array<WhiteScore | undefined>;
  reviewed: ReviewedMove[];
  cursor?: number;
  onSelect?: (index: number) => void;
  height?: number;
  /** 0-1 while analysing: the rest of the graph is dimmed. */
  progress?: number | null;
}) {
  const H = height;
  const n = Math.max(1, scores.length - 1);
  const x = (i: number) => (i / n) * W;
  const y = (s: WhiteScore) => H - (winPercent(s) / 100) * H;
  const known = scores.map((s, i) => (s ? { x: x(i), y: y(s) } : null)).filter((p): p is { x: number; y: number } => p !== null);
  const area = known.length > 1 ? `M0,${H} ${known.map((p) => `L${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")} L${known[known.length - 1].x.toFixed(1)},${H} Z` : "";
  const marks = reviewed.filter((m) => ["blunder", "mistake", "miss", "brilliant", "great", "inaccuracy"].includes(m.quality));
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className={`block w-full rounded-xl bg-[#403d39] ${onSelect ? "cursor-pointer" : ""}`}
      style={{ height: H }}
      role="img"
      aria-label="Evaluation graph"
      data-eval-graph
      onClick={onSelect ? (event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        onSelect(Math.max(0, Math.min(n, Math.round(((event.clientX - rect.left) / rect.width) * n))));
      } : undefined}
    >
      {area && <path d={area} fill="#f4f4f2" />}
      <line x1="0" x2={W} y1={H / 2} y2={H / 2} stroke="#8b8987" strokeWidth="0.8" />
      {marks.map((m) => {
        const s = scores[m.ply];
        return s ? <circle key={m.ply} cx={x(m.ply)} cy={y(s)} r="3.6" fill={MOVE_QUALITY[m.quality].color} stroke="#fff" strokeWidth="1" vectorEffect="non-scaling-stroke" /> : null;
      })}
      {cursor !== undefined && cursor > 0 && <line x1={x(cursor)} x2={x(cursor)} y1="0" y2={H} stroke="#81b64c" strokeWidth="2" vectorEffect="non-scaling-stroke" />}
      {progress !== null && progress < 1 && <rect x={progress * W} y="0" width={W - progress * W} height={H} fill="#2b2926" opacity="0.6" />}
    </svg>
  );
}
