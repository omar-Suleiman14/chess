"use client";

import { MOVE_QUALITY, type MoveQuality, type ReviewedMove } from "@/lib/chess/review";
import type { Color } from "@/lib/chess/rules";

export function MoveReview({ moves, total, human, cursor, onSelect }: { moves: ReviewedMove[]; total: number; human: Color; cursor: number; onSelect: (ply: number) => void }) {
  const selected = moves.find((move) => move.ply === cursor);
  const first = moves.find((move) => move.color === human && ["inaccuracy", "mistake", "miss", "blunder"].includes(move.quality)) ?? moves[0];
  return (
    <section className="rounded-2xl bg-surface p-4 shadow-[var(--shadow)]" aria-labelledby="move-review-title">
      <h2 id="move-review-title" className="font-semibold">Move review</h2>
      <p className="mt-1 text-xs text-muted">{moves.length} / {total} moves reviewed · depth 10+</p>
      {moves.length === 0 && <p className="mt-3 text-sm text-muted">Tap Analyse to review both sides with Stockfish.</p>}
      <table className="mt-3 w-full text-sm">
        <thead><tr className="text-xs text-muted"><th className="pb-2 text-left">Quality</th><th className="pb-2">You</th><th className="pb-2">Sherine</th></tr></thead>
        <tbody>
          {(Object.entries(MOVE_QUALITY) as [MoveQuality, typeof MOVE_QUALITY[MoveQuality]][]).map(([quality, style]) => (
            <tr key={quality}>
              <th scope="row" className="py-1 text-left font-medium"><span className="mr-2 inline-grid h-6 w-6 place-items-center rounded-full text-xs font-bold text-white" style={{ backgroundColor: style.color }} aria-hidden="true">{style.symbol}</span>{style.label}</th>
              {[human, human === "w" ? "b" : "w"].map((color) => {
                const matching = moves.filter((move) => move.color === color && move.quality === quality);
                const next = matching.find((move) => move.ply > cursor) ?? matching[0];
                return <td key={color} className="text-center"><button disabled={!next} onClick={() => next && onSelect(next.ply)} aria-label={`${color === human ? "Your" : "Sherine's"} ${style.label} moves: ${matching.length}. Jump to next.`} className="min-h-9 min-w-9 rounded-lg font-semibold disabled:opacity-40" style={{ color: style.color }}>{moves.length ? matching.length : "—"}</button></td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <details className="mt-3 text-xs text-muted"><summary className="cursor-pointer py-1">How moves are graded</summary><p className="mt-1">Based on evaluation loss: ≤20 excellent, ≤50 good, 51–149 inaccuracy, 150–299 mistake, 300+ blunder (centipawns). Best matches the engine; missed mates are marked separately.</p></details>
      {selected && <div className="mt-3 rounded-xl bg-surface-2 p-3 text-sm" aria-live="polite"><strong style={{ color: MOVE_QUALITY[selected.quality].color }}>{MOVE_QUALITY[selected.quality].symbol} {MOVE_QUALITY[selected.quality].label}</strong><p className="mt-1 text-muted">{selected.quality === "best" ? "Matches Stockfish’s best move." : `Engine recommendation: ${selected.bestSan} · evaluation loss ${(selected.lossCp / 100).toFixed(2)} pawns.`}</p></div>}
      <button disabled={!first} onClick={() => first && onSelect(first.ply)} className="mt-4 min-h-11 w-full rounded-full bg-accent px-4 font-semibold text-accent-text disabled:opacity-40">Start review</button>
    </section>
  );
}
