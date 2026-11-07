"use client";

import { useConvexAuth, useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { TAB_RESELECT_EVENT } from "@/lib/client/navIntent";
import { api } from "@/convex/_generated/api";
import { GameScreen } from "@/components/chess/GameScreen";
import { PageHeader } from "@/components/shell/AppShell";
import { FatmaSprite } from "@/components/fatma/FatmaSprite";
import { StickyAction } from "@/components/ui/PathMap";
import { LegalNote } from "@/components/ui/LegalNote";
import { CLIMB_OPPONENTS, ratingLabel } from "@/lib/chess/engine/opponents";
import type { Expression } from "@/lib/chess/personality/fatma";
import { useSettings } from "@/lib/client/settings";

/** Each level's mood: how Sherine looks and what she says before the game. */
const MOODS: Array<{ expression: Expression; line: string; tint: string }> = [
  { expression: "idle", line: "I'm still learning how the pieces move. Go easy on me!", tint: "#9ad0f5" },
  { expression: "smug", line: "I grab anything you leave hanging. Anything.", tint: "#f7b267" },
  { expression: "plea", line: "Is that a trap? It's probably a trap…", tint: "#c8b6ff" },
  { expression: "thinking", line: "I check my moves twice now. Mostly.", tint: "#9ee493" },
  { expression: "idle", line: "Yawn. I'll see your tactics… eventually.", tint: "#a3c4f3" },
  { expression: "amused", line: "Sorry, what? Oh, it's my move. Again.", tint: "#ffd166" },
  { expression: "impressed", line: "Okay, now I'm awake. Let's play properly.", tint: "#ff9f7a" },
  { expression: "thinking", line: "Every move counts. I'm watching all of them.", tint: "#6ec6ca" },
  { expression: "annoyed", line: "No more gifts. Earn every point.", tint: "#e5989b" },
  { expression: "angry", line: "I don't forgive mistakes. Neither should you.", tint: "#ef6f6c" },
  { expression: "victory", line: "Full power. Stockfish at its strongest. Good luck.", tint: "#b8a1ff" },
];

function moodOf(index: number) {
  return MOODS[Math.min(index, MOODS.length - 1)];
}

/** chess.com-style bot picker: a featured opponent, a grid of levels, one big Play button. */
export default function BotsPage() {
  const { isAuthenticated } = useConvexAuth();
  const { reducedMotion } = useSettings();
  const climb = useQuery(api.progress.climb, isAuthenticated ? {} : "skip");
  const [level, setLevel] = useState<string | null>(null);
  const unlocked = climb?.unlockedLevel ?? 0;
  const [picked, setPicked] = useState<number | null>(null);
  const selectedIndex = Math.min(picked ?? unlocked, CLIMB_OPPONENTS.length - 1);
  const selected = CLIMB_OPPONENTS[selectedIndex];
  const mood = moodOf(selectedIndex);
  const selectedLocked = selectedIndex > unlocked;

  // Tapping the Bots tab again returns to the picker.
  useEffect(() => {
    const back = (event: Event) => { if ((event as CustomEvent<string>).detail === "/climb") setLevel(null); };
    window.addEventListener(TAB_RESELECT_EVENT, back);
    return () => window.removeEventListener(TAB_RESELECT_EVENT, back);
  }, []);

  if (level) {
    return <GameScreen key={level} startFresh defaults={{ mode: "climb", opponentId: level, humanColor: "w" }} />;
  }

  return (
    <main className="mx-auto min-h-dvh max-w-2xl pb-36">
      <PageHeader title="Bots" back={false} />
      <div className="grid gap-4 px-4">
        <section aria-live="polite" aria-label={`Selected bot: ${selected.name}`} className="relative overflow-hidden rounded-3xl p-4 shadow-[var(--shadow)]" style={{ background: `linear-gradient(140deg, color-mix(in srgb, ${mood.tint} 38%, var(--surface)) 0%, var(--surface) 70%)` }}>
          <div className="flex items-end gap-3">
            <span className="grid h-[112px] w-[112px] shrink-0 place-items-end justify-center overflow-hidden rounded-2xl" style={{ background: `color-mix(in srgb, ${mood.tint} 45%, transparent)` }}>
              <FatmaSprite key={selected.id} expression={mood.expression} size={104} reducedMotion={reducedMotion} />
            </span>
            <div className="min-w-0 flex-1 pb-1">
              <p className="text-xs font-bold uppercase tracking-wide text-muted">Level {selectedIndex + 1} of {CLIMB_OPPONENTS.length}</p>
              <h2 data-selected-bot className="text-2xl font-black leading-tight">{selected.name}</h2>
              <p className="mt-1 inline-flex items-center gap-2 text-sm font-semibold">
                <span className="rounded-full bg-[#262522] px-2 py-0.5 tabular-nums text-white">{ratingLabel(selected)}</span>
                {climb?.beaten.includes(selected.id) && <span className="rounded-full bg-[#81b64c] px-2 py-0.5 text-white">✓ Beaten</span>}
                {selectedLocked && <span className="rounded-full bg-surface-2 px-2 py-0.5 text-muted">Locked</span>}
              </p>
            </div>
          </div>
          <p className="coach-bubble mt-3 rounded-2xl rounded-tl-sm bg-surface px-3.5 py-2.5 text-[15px] font-medium leading-snug">{selectedLocked ? `Beat level ${selectedIndex} to unlock me.` : mood.line}</p>
        </section>

        <ol aria-label="Bot levels" className="grid grid-cols-3 gap-2.5 sm:grid-cols-4">
          {CLIMB_OPPONENTS.map((o, i) => {
            const locked = i > unlocked;
            const beaten = climb?.beaten.includes(o.id);
            const current = i === selectedIndex;
            const m = moodOf(i);
            return (
              <li key={o.id}>
                <button
                  onClick={() => setPicked(i)}
                  aria-pressed={current}
                  aria-label={`${o.name}, rating ${ratingLabel(o)}${locked ? ", locked" : ""}${beaten ? ", beaten" : ""}`}
                  className={`relative grid w-full justify-items-center gap-1 rounded-2xl bg-surface p-2 pb-2.5 shadow-[var(--shadow)] transition-transform active:scale-95 ${current ? "ring-[3px] ring-[#81b64c]" : ""} ${locked ? "opacity-55" : ""}`}
                >
                  <span className="grid h-16 w-16 place-items-end justify-center overflow-hidden rounded-xl" style={{ background: `color-mix(in srgb, ${m.tint} 45%, transparent)`, filter: locked ? "grayscale(1)" : undefined }}>
                    <FatmaSprite expression={m.expression} size={58} reducedMotion />
                  </span>
                  <span className="text-[13px] font-bold leading-tight">{o.name.replace(/^Sherine \((.*)\)$/, "$1")}</span>
                  <span className="text-xs tabular-nums text-muted">{ratingLabel(o)}</span>
                  {beaten && <span aria-hidden="true" className="absolute right-1.5 top-1.5 grid h-5 w-5 place-items-center rounded-full bg-[#81b64c] text-[11px] font-black text-white">✓</span>}
                  {locked && <span aria-hidden="true" className="absolute right-1.5 top-1.5 grid h-5 w-5 place-items-center rounded-full bg-surface-2 text-muted"><svg viewBox="0 0 24 24" className="h-3.5 w-3.5"><rect x="5" y="10" width="14" height="11" rx="2.5" fill="none" stroke="currentColor" strokeWidth="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg></span>}
                </button>
              </li>
            );
          })}
        </ol>

        <details className="rounded-2xl bg-surface p-4 text-sm shadow-[var(--shadow)]">
          <summary className="cursor-pointer font-semibold">
            Your Climb rating: {climb?.rating ? <span className="tabular-nums">{climb.rating.rating} ± {Math.round(climb.rating.rd * 1.96)}</span> : "unrated"}
          </summary>
          <p className="mt-2 text-muted">
            {climb?.rating?.provisional !== false ? "Provisional Climb rating (Glicko-2). " : "Climb rating (Glicko-2). "}
            Opponent ratings are estimates until benchmarked. Undo, hints or the eval bar make a game unrated. Beat a level to unlock the next; levels 1-4 are scripted beginner bots below Stockfish&apos;s weakest setting.
          </p>
          {!isAuthenticated && <p className="mt-2">Sign in to keep a rating. Guest games are practice.</p>}
        </details>
        <LegalNote action="playing" />
      </div>
      <StickyAction
        label={selectedLocked ? `Beat level ${selectedIndex} to unlock` : `Play ${selected.name}`}
        disabled={selectedLocked}
        onClick={() => setLevel(selected.id)}
      />
    </main>
  );
}
