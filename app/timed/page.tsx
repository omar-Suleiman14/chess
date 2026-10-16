"use client";

import { useConvexAuth, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "@/convex/_generated/api";
import { GameScreen, Segmented } from "@/components/chess/GameScreen";
import { PageHeader } from "@/components/shell/AppShell";
import { TIME_CONTROLS } from "@/lib/chess/clock";
import { CLIMB_OPPONENTS, ratingLabel } from "@/lib/chess/engine/opponents";

export default function TimedPage() {
  const { isAuthenticated } = useConvexAuth();
  const climb = useQuery(api.progress.climb, isAuthenticated ? {} : "skip");
  const [tc, setTc] = useState(TIME_CONTROLS[1].id);
  const [opponent, setOpponent] = useState("climb-05");
  const [color, setColor] = useState<"w" | "b">("w");
  const [started, setStarted] = useState<string | null>(null);
  const unlocked = Math.max(climb?.unlockedLevel ?? 0, 4);

  if (started) {
    return <GameScreen key={started} startFresh defaults={{ mode: "timed", opponentId: opponent, humanColor: color, timeControlId: tc }} />;
  }

  return (
    <main className="mx-auto min-h-dvh max-w-xl pb-10">
      <PageHeader title="Timed" />
      <div className="grid gap-4 px-4">
        <p className="text-sm text-muted">Pick a clock before you start. Each time control has its own provisional rating.</p>
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Time control">
          {TIME_CONTROLS.map((t) => (
            <button
              key={t.id}
              role="radio"
              aria-checked={tc === t.id}
              onClick={() => setTc(t.id)}
              className={`min-h-16 rounded-2xl text-lg font-semibold tabular-nums ${tc === t.id ? "bg-accent text-accent-text" : "bg-surface shadow-[var(--shadow)]"}`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <Segmented label="Play as" value={color} onChange={setColor} options={[["w", "White"], ["b", "Black"]]} />
        <label className="grid gap-1 text-sm">
          <span className="text-muted">Opponent</span>
          <select value={opponent} onChange={(e) => setOpponent(e.target.value)} className="min-h-12 rounded-2xl bg-surface px-3 shadow-[var(--shadow)]">
            {CLIMB_OPPONENTS.slice(0, unlocked + 1).map((o) => (
              <option key={o.id} value={o.id}>
                {o.name} · {ratingLabel(o)}
              </option>
            ))}
          </select>
        </label>
        <button onClick={() => setStarted(`${tc}-${opponent}-${Date.now()}`)} className="min-h-14 rounded-2xl bg-accent font-semibold text-accent-text">
          Start {TIME_CONTROLS.find((t) => t.id === tc)?.label}
        </button>
        <p className="text-xs text-muted">The clock runs on this device and the server checks timeouts. Undo or the eval bar make the game unrated.</p>
      </div>
    </main>
  );
}
