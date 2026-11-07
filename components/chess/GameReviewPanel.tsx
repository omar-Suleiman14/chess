"use client";

import { motion } from "motion/react";
import { FatmaSprite } from "@/components/fatma/FatmaSprite";
import { gameAccuracy, winPercent } from "@/lib/chess/accuracy";
import type { WhiteScore } from "@/lib/chess/engine/uci";
import { MOVE_QUALITY, type ReviewedMove } from "@/lib/chess/review";
import type { Color } from "@/lib/chess/rules";
import { MoveReview } from "./MoveReview";

type Props = {
  /** Evaluation after each ply along the shown line; index 0 is the start. */
  scores: Array<WhiteScore | undefined>;
  reviewed: ReviewedMove[];
  sans: string[];
  cursor: number;
  onSelect: (index: number) => void;
  analysing: { done: number; total: number } | null;
  canAnalyse: boolean;
  onStart: () => void;
  onStop: () => void;
  names: Record<Color, string>;
  human: Color;
  reducedMotion: boolean;
};

const W = 300;
const H = 72;

/** chess.com-style Game Review: coach line, live evaluation graph, accuracy and move labels. */
export function GameReviewPanel({ scores, reviewed, sans, cursor, onSelect, analysing, canAnalyse, onStart, onStop, names, human, reducedMotion }: Props) {
  const plies = sans.length;
  const analysed = scores.filter(Boolean).length;
  const started = analysed > 1 || !!analysing;
  const complete = !analysing && plies > 0 && reviewed.length >= plies;
  const accuracy = gameAccuracy(scores);
  const byPly = new Map(reviewed.map((m) => [m.ply, m]));
  const current = cursor > 0 ? byPly.get(cursor) : undefined;
  const pct = analysing && analysing.total ? Math.round((analysing.done / analysing.total) * 100) : 100;

  // The coach's line for this moment.
  let line: string;
  let mood: "idle" | "thinking" | "impressed" | "amused" = "idle";
  if (analysing) { line = `Reviewing your game… ${pct}%`; mood = "thinking"; }
  else if (!started) line = canAnalyse ? "Let's review this game together. I'll grade every move and find the key moments." : "Make some moves first, then we can review them.";
  else if (cursor === 0) line = complete ? `White played with ${accuracy.w ?? "–"}% accuracy, Black with ${accuracy.b ?? "–"}%. Step through the moves, or jump to a key moment.` : "Some positions aren't analysed yet. Tap Continue review.";
  else if (current) {
    const style = MOVE_QUALITY[current.quality];
    const san = sans[cursor - 1];
    const good = ["brilliant", "great", "best", "excellent", "good", "book"].includes(current.quality);
    line = good
      ? `${san} is ${current.quality === "excellent" ? "an" : "a"} ${style.label.toLowerCase()} move.${current.quality === "best" || current.quality === "book" ? "" : ` ${current.bestSan} was best.`}`
      : `${san} is ${current.quality === "inaccuracy" ? "an" : "a"} ${style.label.toLowerCase()}. ${current.bestSan} was best.`;
    mood = current.quality === "brilliant" || current.quality === "great" ? "impressed" : good ? "idle" : "amused";
  } else line = `${sans[cursor - 1] ?? "This move"} isn't analysed yet.`;

  // Graph: White's winning chances along the game.
  const n = Math.max(1, scores.length - 1);
  const x = (i: number) => (i / n) * W;
  const y = (s: WhiteScore) => H - (winPercent(s) / 100) * H;
  const known = scores.map((s, i) => (s ? { i, x: x(i), y: y(s) } : null)).filter((p): p is { i: number; x: number; y: number } => p !== null);
  const area = known.length > 1 ? `M0,${H} ${known.map((p) => `L${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")} L${known[known.length - 1].x.toFixed(1)},${H} Z` : "";
  const scanX = analysing && analysing.total ? (analysing.done / analysing.total) * W : null;
  const marks = reviewed.filter((m) => ["blunder", "mistake", "miss", "brilliant", "great"].includes(m.quality));

  return (
    <section className="grid gap-3 rounded-2xl bg-surface p-4 shadow-[var(--shadow)]" aria-labelledby="review-title">
      <div className="flex items-center justify-between">
        <h2 id="review-title" className="text-lg font-bold">Game Review</h2>
        {complete && <span className="rounded-full bg-[#81b64c]/15 px-2.5 py-0.5 text-xs font-semibold text-[#5d8a33]">Complete</span>}
      </div>

      <div className="flex items-start gap-3" aria-live="polite">
        <FatmaSprite expression={mood} size={52} reducedMotion={reducedMotion} />
        <motion.p
          key={line}
          initial={reducedMotion ? false : { opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18 }}
          data-coach-line
          className="relative min-w-0 flex-1 rounded-2xl rounded-tl-sm bg-surface-2 px-3 py-2 text-sm leading-snug"
        >
          {current && <span className="me-1.5 inline-grid h-5 min-w-5 place-items-center rounded-full px-1 align-[-3px] text-[11px] font-bold text-white" style={{ backgroundColor: MOVE_QUALITY[current.quality].color }}>{MOVE_QUALITY[current.quality].symbol}</span>}
          {line}
        </motion.p>
      </div>

      {started && (
        <div className="relative overflow-hidden rounded-lg bg-[#403d39]">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="none"
            className="block h-[72px] w-full cursor-pointer"
            role="img"
            aria-label="Evaluation graph. Click to jump to a move."
            onClick={(event) => {
              const rect = event.currentTarget.getBoundingClientRect();
              onSelect(Math.max(0, Math.min(plies, Math.round(((event.clientX - rect.left) / rect.width) * n))));
            }}
          >
            {area && <motion.path data-eval-graph d={area} fill="#f4f4f2" initial={false} animate={{ d: area }} transition={{ duration: reducedMotion ? 0 : 0.25 }} />}
            <line x1="0" x2={W} y1={H / 2} y2={H / 2} stroke="#8b8987" strokeWidth="0.6" strokeDasharray="3 3" />
            {marks.map((m) => {
              const s = scores[m.ply];
              return s ? <circle key={m.ply} cx={x(m.ply)} cy={y(s)} r="3.2" fill={MOVE_QUALITY[m.quality].color} stroke="#fff" strokeWidth="0.8" /> : null;
            })}
            {cursor > 0 && <line x1={x(cursor)} x2={x(cursor)} y1="0" y2={H} stroke="#81b64c" strokeWidth="1.6" />}
            {scanX !== null && <rect x={scanX} y="0" width={W - scanX} height={H} fill="#2b2926" opacity="0.55" />}
          </svg>
          {scanX !== null && !reducedMotion && (
            <motion.div aria-hidden="true" className="pointer-events-none absolute inset-y-0 w-10 bg-gradient-to-r from-transparent via-white/25 to-transparent" animate={{ left: ["-10%", "105%"] }} transition={{ repeat: Infinity, duration: 1.4, ease: "linear" }} />
          )}
        </div>
      )}

      {analysing ? (
        <div className="grid gap-2">
          <div className="h-2 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="Review progress">
            <motion.div className="h-full rounded-full bg-[#81b64c]" initial={false} animate={{ width: `${pct}%` }} transition={{ duration: reducedMotion ? 0 : 0.3 }} />
          </div>
          <button onClick={onStop} className="min-h-11 rounded-xl bg-surface-2 font-semibold">Stop · {analysing.done}/{analysing.total}</button>
        </div>
      ) : (
        !complete && (
          <button data-start-review disabled={!canAnalyse} onClick={onStart} className="min-h-12 rounded-xl bg-[#81b64c] text-lg font-bold text-white shadow-[0_4px_0_#5d8a33] transition-transform active:translate-y-[2px] active:shadow-[0_2px_0_#5d8a33] disabled:opacity-40">
            {started ? "Continue review" : "Start Review"}
          </button>
        )
      )}

      {started && (
        <div className="grid grid-cols-2 gap-2 text-center">
          {(["w", "b"] as const).map((c) => (
            <div key={c} className={`rounded-xl p-2.5 ${c === "w" ? "bg-white text-[#262522] ring-1 ring-line" : "bg-[#262522] text-white"}`}>
              <p className="break-words text-xs opacity-70">{names[c]}{c === human ? " · you" : ""}</p>
              <p data-accuracy={c} className="text-2xl font-black tabular-nums">{accuracy[c] === null ? "–" : accuracy[c]!.toFixed(1)}</p>
              <p className="text-[11px] opacity-70">Accuracy</p>
            </div>
          ))}
        </div>
      )}

      {started && <MoveReview moves={reviewed} total={plies} human={human} cursor={cursor} onSelect={onSelect} />}
    </section>
  );
}
