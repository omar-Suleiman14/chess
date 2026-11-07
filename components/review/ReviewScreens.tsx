"use client";

import { useEffect, useState } from "react";
import { FatmaSprite } from "@/components/fatma/FatmaSprite";
import { MiniBoard } from "@/components/chess/MiniBoard";
import { Avatar } from "@/components/profile/ChessCard";
import { StickyAction } from "@/components/ui/PathMap";
import type { WhiteScore } from "@/lib/chess/engine/uci";
import { MOVE_QUALITY, type MoveQuality, type ReviewedMove } from "@/lib/chess/review";
import { estimateGameRating, verdictFor, type Phase, type Verdict } from "@/lib/chess/reviewStats";
import type { Color } from "@/lib/chess/rules";
import { EvalGraph } from "./EvalGraph";
import { QualityIcon } from "./QualityIcon";

const TIPS = [
  "Develop your pieces from their starting squares to control the board.",
  "Castle early to keep your king safe and connect your rooks.",
  "Every move, ask: what does my opponent threaten?",
  "Knights on the rim are dim: centralise them.",
  "In the endgame, your king becomes a fighting piece.",
  "Trade pieces when you're ahead; avoid trades when you're behind.",
  "Before you move, check every check and capture.",
];

/** While Stockfish reviews the game: the start position, a coach tip and a big progress bar. */
export function ReviewLoading({ percent, fen, reducedMotion, onClose }: { percent: number; fen: string; reducedMotion: boolean; onClose: () => void }) {
  const [tip, setTip] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTip((t) => (t + 1) % TIPS.length), 3200);
    return () => clearInterval(id);
  }, []);
  return (
    <main data-review-loading className="mx-auto grid min-h-dvh max-w-xl content-start gap-5 px-4 pb-10">
      <ReviewHeader onClose={onClose} />
      <div className="flex items-end gap-2">
        <span className="block h-16 w-16 shrink-0 overflow-hidden"><FatmaSprite expression="thinking" size={64} reducedMotion={reducedMotion} /></span>
        <p key={tip} className="coach-bubble mb-3 flex-1 rounded-2xl rounded-bl-sm bg-surface px-4 py-3 text-[15px] font-medium leading-snug shadow-[var(--shadow)]">{TIPS[tip]}</p>
      </div>
      <div className="mx-auto w-full max-w-[min(100%,calc(100dvh-380px))]"><MiniBoard fen={fen} size={360} className="!h-auto !w-full aspect-square" /></div>
      <div className="relative h-14 overflow-hidden rounded-2xl bg-surface-2" role="progressbar" aria-label="Reviewing your game" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
        <div className="absolute inset-y-0 left-0 bg-[#81b64c] transition-[width] duration-300" style={{ width: `${percent}%` }} />
        <span className="relative grid h-full place-items-center text-2xl font-black tabular-nums">{percent}%</span>
      </div>
      <p className="text-center text-sm text-muted">Stockfish is grading every move on this device.</p>
    </main>
  );
}

function ReviewHeader({ onClose, right }: { onClose: () => void; right?: React.ReactNode }) {
  return (
    <header className="safe-top sticky top-0 z-20 grid grid-cols-[44px_1fr_44px] items-center bg-bg/95 py-2 backdrop-blur">
      <button onClick={onClose} aria-label="Close Game Review" className="grid h-11 w-11 place-items-center rounded-full text-2xl text-muted">✕</button>
      <h1 className="text-center text-2xl font-black">Game Review</h1>
      <span className="justify-self-end">{right}</span>
    </header>
  );
}

const ORDER: MoveQuality[] = ["brilliant", "great", "best", "excellent", "good", "book", "inaccuracy", "mistake", "miss", "blunder"];
const PHASES: Array<[Phase, string]> = [["opening", "Opening"], ["middlegame", "Middlegame"], ["endgame", "Endgame"]];
const THUMB = <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" aria-hidden="true"><path d="M7 21H4V10h3zm2 0h8.2a2 2 0 0 0 2-1.6l1.3-6.4A2 2 0 0 0 18.5 10H14l.8-4.1A1.9 1.9 0 0 0 13 3.6L9 9.6z" fill="currentColor" /></svg>;
const VERDICT: Record<Verdict, { color: string; symbol: React.ReactNode; label: string }> = {
  excellent: { color: "#81b64c", symbol: THUMB, label: "Excellent" },
  good: { color: "#9ab86b", symbol: "✓", label: "Good" },
  inaccurate: { color: "#f0b43c", symbol: "?!", label: "Inaccurate" },
  poor: { color: "#e05f4e", symbol: "?", label: "Poor" },
};

export type ReviewPlayer = { name: string; you: boolean; bot: boolean; seed?: string; hue?: number };

/** The Game Review summary: coach line, graph, accuracy, move labels, game rating and phases. */
export function ReviewSummary({ coach, scores, reviewed, accuracy, phases, players, onStart, onClose, onSelect, reducedMotion }: {
  coach: string;
  scores: Array<WhiteScore | undefined>;
  reviewed: ReviewedMove[];
  accuracy: Record<Color, number | null>;
  phases: Record<Color, Record<Phase, number | null>>;
  players: Record<Color, ReviewPlayer>;
  onStart: () => void;
  onClose: () => void;
  onSelect: (index: number) => void;
  reducedMotion: boolean;
}) {
  const count = (c: Color, q: MoveQuality) => reviewed.filter((m) => m.color === c && m.quality === q).length;
  const box = (c: Color) => (c === "w" ? "bg-white text-[#262522] ring-1 ring-line" : "bg-[#3a3835] text-white");
  return (
    <main data-review-summary className="mx-auto grid min-h-dvh max-w-xl content-start gap-4 px-4 pb-36">
      <ReviewHeader onClose={onClose} />
      <div className="flex items-end gap-2">
        <span className="block h-16 w-16 shrink-0 overflow-hidden"><FatmaSprite expression="impressed" size={64} reducedMotion={reducedMotion} /></span>
        <p data-coach-line className="coach-bubble mb-3 flex-1 rounded-2xl rounded-bl-sm bg-surface px-4 py-3 text-[15px] font-medium leading-snug shadow-[var(--shadow)]">{coach}</p>
      </div>
      <EvalGraph scores={scores} reviewed={reviewed} onSelect={onSelect} height={120} />

      <div className="grid grid-cols-[1fr_96px_96px] items-center gap-x-3 gap-y-3 sm:grid-cols-[1fr_120px_120px]">
        <span className="font-bold">Players</span>
        {(["w", "b"] as const).map((c) => (
          <span key={c} className="grid justify-items-center gap-1 text-center">
            <span className="block break-words text-xs font-bold leading-tight">{players[c].name}{players[c].you ? " (you)" : ""}</span>
            <span className={`grid h-16 w-16 place-items-center overflow-hidden rounded-xl ${c === "w" ? "ring-2 ring-white" : "ring-2 ring-[#3a3835]"}`}>
              {players[c].bot ? <FatmaSprite expression="idle" size={60} reducedMotion /> : <Avatar seed={players[c].seed ?? players[c].name} hue={players[c].hue ?? (c === "w" ? 200 : 20)} size={64} />}
            </span>
          </span>
        ))}

        <span className="font-bold">Accuracy</span>
        {(["w", "b"] as const).map((c) => (
          <span key={c} data-accuracy={c} className={`grid h-14 place-items-center rounded-xl text-2xl font-black tabular-nums ${box(c)}`}>{accuracy[c] === null ? "–" : accuracy[c]!.toFixed(1)}</span>
        ))}
      </div>

      <div className="h-px bg-line" />
      <ul aria-label="Move labels" className="grid gap-2.5">
        {ORDER.map((q) => {
          const style = MOVE_QUALITY[q];
          return (
            <li key={q} className="grid grid-cols-[1fr_48px_40px_48px] items-center sm:grid-cols-[1fr_64px_40px_64px]">
              <span className="font-bold">{style.label}</span>
              <span className="text-center text-2xl font-black tabular-nums" style={{ color: style.color }}>{count("w", q)}</span>
              <span className="grid place-items-center"><QualityIcon quality={q} size={30} /></span>
              <span className="text-center text-2xl font-black tabular-nums" style={{ color: style.color }}>{count("b", q)}</span>
            </li>
          );
        })}
      </ul>

      <div className="h-px bg-line" />
      <div className="grid grid-cols-[1fr_96px_96px] items-center gap-3 sm:grid-cols-[1fr_120px_120px]">
        <span className="font-bold leading-tight">Game rating<span className="block text-xs font-normal text-muted">Estimate from accuracy</span></span>
        {(["w", "b"] as const).map((c) => (
          <span key={c} data-game-rating={c} className={`grid h-14 place-items-center rounded-xl text-2xl font-black tabular-nums ${box(c)}`}>{estimateGameRating(accuracy[c]) ?? "–"}</span>
        ))}
      </div>

      <div className="h-px bg-line" />
      <h2 className="text-center text-lg font-black">By phase</h2>
      <ul className="grid gap-3">
        {PHASES.map(([phase, label]) => (
          <li key={phase} className="grid grid-cols-[1fr_96px_96px] items-center gap-3 sm:grid-cols-[1fr_120px_120px]">
            <span className="font-bold">{label}</span>
            {(["w", "b"] as const).map((c) => {
              const v = verdictFor(phases[c][phase]);
              return (
                <span key={c} className="grid justify-items-center" title={v ? `${VERDICT[v].label} · ${phases[c][phase]}%` : "Not reached"}>
                  {v ? <span role="img" aria-label={`${VERDICT[v].label}, ${phases[c][phase]}% accuracy`} className="grid h-9 w-9 place-items-center rounded-full text-sm font-black text-white" style={{ backgroundColor: VERDICT[v].color }}>{VERDICT[v].symbol}</span> : <span className="text-muted">–</span>}
                </span>
              );
            })}
          </li>
        ))}
      </ul>
      <StickyAction label="Start Review" onClick={onStart} />
    </main>
  );
}
