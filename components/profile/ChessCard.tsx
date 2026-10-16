"use client";

import { blobatar } from "blobatar";
import { useMemo, useRef, useState, type PointerEvent } from "react";

// Chess identity card. An independent implementation inspired by Chaos member
// cards; no AGPL Chaos source is copied (see THIRD_PARTY_NOTICES.md).

export const CARD_THEMES: Record<string, { bg: string; fg: string; sub: string }> = {
  paper: { bg: "linear-gradient(140deg,#fbf8f1,#ebe4d4)", fg: "#1d1c1a", sub: "#6d6a64" },
  ink: { bg: "linear-gradient(140deg,#24231f,#0f0f0e)", fg: "#f6f4ef", sub: "#a19d95" },
  sage: { bg: "linear-gradient(140deg,#e7eddf,#b9c9a6)", fg: "#1f2a17", sub: "#56664a" },
  dusk: { bg: "linear-gradient(140deg,#3b3557,#1d1a2e)", fg: "#f1eefc", sub: "#b4acd6" },
  ember: { bg: "linear-gradient(140deg,#f6e3d3,#e0a581)", fg: "#2c1a10", sub: "#7a4b30" },
};

export function Avatar({ seed, hue, size = 72 }: { seed: string; hue: number; size?: number }) {
  // blobatar returns static SVG markup generated from the seed (no user HTML).
  const svg = useMemo(() => blobatar(`${seed}:${hue}`), [seed, hue]);
  return <span className="block overflow-hidden rounded-full" style={{ width: size, height: size }} aria-hidden="true" dangerouslySetInnerHTML={{ __html: svg }} />;
}

export function ChessCard({
  alias,
  seed,
  hue,
  theme,
  stats,
  reducedMotion,
}: {
  alias: string;
  seed: string;
  hue: number;
  theme: string;
  stats: Array<{ label: string; value: string; note?: string }>;
  reducedMotion?: boolean;
}) {
  const t = CARD_THEMES[theme] ?? CARD_THEMES.paper;
  const ref = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [flipped, setFlipped] = useState(false);

  const onMove = (e: PointerEvent) => {
    if (reducedMotion || e.pointerType === "touch") return;
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    setTilt({ x: ((e.clientY - r.top) / r.height - 0.5) * -10, y: ((e.clientX - r.left) / r.width - 0.5) * 12 });
  };

  return (
    <div className="[perspective:900px]">
      <div
        ref={ref}
        role="button"
        tabIndex={0}
        aria-label={`Chess card for ${alias}. ${flipped ? "Showing stats" : "Showing front"}. Activate to flip.`}
        onClick={() => setFlipped((f) => !f)}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), setFlipped((f) => !f))}
        onPointerMove={onMove}
        onPointerLeave={() => setTilt({ x: 0, y: 0 })}
        className="relative aspect-[1.586] w-full cursor-pointer transition-transform duration-500 [transform-style:preserve-3d]"
        style={{ transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y + (flipped ? 180 : 0)}deg)` }}
      >
        <div className="absolute inset-0 flex flex-col justify-between rounded-3xl p-5 shadow-[var(--shadow)] [backface-visibility:hidden]" style={{ background: t.bg, color: t.fg }}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-[0.2em]" style={{ color: t.sub }}>Chess by Chaos</span>
            <span aria-hidden="true">♞</span>
          </div>
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-2xl font-semibold">@{alias}</p>
              <p className="text-sm" style={{ color: t.sub }}>{stats[0] ? `${stats[0].label} ${stats[0].value}` : "Unrated"}</p>
            </div>
            <Avatar seed={seed} hue={hue} />
          </div>
        </div>
        <div className="absolute inset-0 grid content-center gap-2 rounded-3xl p-5 shadow-[var(--shadow)] [backface-visibility:hidden] [transform:rotateY(180deg)]" style={{ background: t.bg, color: t.fg }}>
          {stats.length === 0 && <p style={{ color: t.sub }}>No stats yet.</p>}
          {stats.map((s) => (
            <p key={s.label} className="flex justify-between gap-2 text-sm">
              <span style={{ color: t.sub }}>{s.label}</span>
              <span className="font-medium tabular-nums">
                {s.value}
                {s.note && <span className="ml-1 text-xs" style={{ color: t.sub }}>{s.note}</span>}
              </span>
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}
