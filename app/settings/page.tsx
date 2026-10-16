"use client";

import { Segmented } from "@/components/chess/GameScreen";
import { Piece, PIECE_SETS } from "@/components/chess/Pieces";
import { PageHeader } from "@/components/shell/AppShell";
import { ScrollRow } from "@/components/ui/ScrollRow";
import { SwitchRow } from "@/components/ui/Switch";
import { FATMA_LANGUAGES } from "@/lib/chess/personality/lines";
import { useSettings, type Palette } from "@/lib/client/settings";
import { haptic, playSound, unlockAudio } from "@/lib/client/sound";

const PALETTES: Array<[Palette, string, string, string]> = [
  ["ivory", "Ivory", "#efe6d5", "#c3a982"],
  ["sage", "Sage", "#e8ecdf", "#93a57f"],
  ["slate", "Slate", "#e3e6ea", "#8a96a3"],
  ["blue", "Blue", "#e4ebf3", "#7d9bbd"],
];

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section aria-label={title} className="min-w-0">
      <h2 className="mb-2 px-4 text-[13px] uppercase tracking-wide text-muted">{title}</h2>
      {children}
    </section>
  );
}

export default function SettingsPage() {
  const { settings, update } = useSettings();
  const palette = PALETTES.find((p) => p[0] === settings.palette) ?? PALETTES[0];
  return (
    <main className="mx-auto min-h-dvh max-w-xl pb-16">
      <PageHeader title="Settings" />
      <div className="grid grid-cols-1 gap-7 px-4">
        <Group title="Board">
          <div className="grid grid-cols-4 gap-2 p-1" role="radiogroup" aria-label="Board colours">
            {PALETTES.map(([id, name, light, dark]) => (
              <button
                key={id}
                role="radio"
                aria-checked={settings.palette === id}
                onClick={() => update({ palette: id })}
                className={`rounded-2xl bg-surface p-2 shadow-[var(--shadow)] transition-transform active:scale-95 ${settings.palette === id ? "ring-2 ring-[var(--accent)]" : ""}`}
              >
                <span className="grid aspect-square grid-cols-2 overflow-hidden rounded-lg" aria-hidden="true">
                  <span style={{ background: light }} />
                  <span style={{ background: dark }} />
                  <span style={{ background: dark }} />
                  <span style={{ background: light }} />
                </span>
                <span className="mt-1 block text-xs">{name}</span>
              </button>
            ))}
          </div>
        </Group>

        <Group title="Pieces">
          <ScrollRow role="radiogroup" label="Piece style" selectedIndex={PIECE_SETS.findIndex((p) => p.id === settings.pieceSet)}>
            {PIECE_SETS.map((set) => (
              <button
                key={set.id}
                role="radio"
                aria-checked={settings.pieceSet === set.id}
                onClick={() => update({ pieceSet: set.id })}
                data-scroll-item
                className={`shrink-0 snap-start rounded-2xl bg-surface p-2 shadow-[var(--shadow)] transition-transform active:scale-95 ${settings.pieceSet === set.id ? "ring-2 ring-[var(--accent)]" : ""}`}
              >
                <span className="grid w-36 grid-cols-3 overflow-hidden rounded-lg" aria-hidden="true">
                  {(["k", "q", "n"] as const).map((t, i) => (
                    <span key={t} className="aspect-square" style={{ background: i % 2 ? palette[3] : palette[2] }}>
                      <Piece type={t} color="w" set={set.id} className="h-full w-full" />
                    </span>
                  ))}
                  {(["n", "q", "k"] as const).map((t, i) => (
                    <span key={`b${t}`} className="aspect-square" style={{ background: i % 2 ? palette[2] : palette[3] }}>
                      <Piece type={t} color="b" set={set.id} className="h-full w-full" />
                    </span>
                  ))}
                </span>
                <span className="mt-1 block text-xs">{set.name}</span>
              </button>
            ))}
          </ScrollRow>
        </Group>

        <Group title="Display">
          <div className="overflow-hidden rounded-2xl bg-surface shadow-[var(--shadow)]">
            <SwitchRow label="Legal move dots" checked={settings.legalDots} onChange={(v) => update({ legalDots: v })} />
            <SwitchRow label="Coordinates" checked={settings.coordinates} onChange={(v) => update({ coordinates: v })} />
            <SwitchRow label="Evaluation bar" hint="Hide it to test yourself. Never live in rated games." checked={settings.evalBar} onChange={(v) => update({ evalBar: v })} />
            <SwitchRow label="High contrast" checked={settings.highContrast} onChange={(v) => update({ highContrast: v })} />
          </div>
        </Group>

        <Group title="Sound & feel">
          <div className="overflow-hidden rounded-2xl bg-surface shadow-[var(--shadow)]">
            <SwitchRow
              label="Chess sounds"
              checked={settings.sound}
              onChange={(v) => {
                unlockAudio();
                update({ sound: v });
                if (v) setTimeout(() => playSound("move", settings.volume), 120);
              }}
            />
            <div className="flex min-h-14 items-center gap-3 border-b border-line px-4">
              <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-muted" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor" /></svg>
              <input type="range"
                min={0}
                max={1}
                step={0.05}
                value={settings.volume}
                onChange={(e) => update({ volume: Number(e.target.value) })}
                onPointerUp={() => {
                  unlockAudio();
                  playSound("capture", settings.volume);
                }}
                className="ios-range flex-1"
                style={{ ["--pct" as string]: `${settings.volume * 100}%` }}
                aria-label="Volume"
              />
              <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-muted" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4zm12.5 3a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4zM14 3.2v2.1a7 7 0 0 1 0 13.4v2.1a9 9 0 0 0 0-17.6z" fill="currentColor" /></svg>
            </div>
            <SwitchRow
              label="Haptics"
              hint="Android only; iPhone browsers don't allow vibration."
              checked={settings.haptics}
              onChange={(v) => {
                update({ haptics: v });
                if (v) haptic(10);
              }}
            />
          </div>
          <div className="mt-3">
            <Segmented label="Motion" value={settings.motion} onChange={(motion) => update({ motion })} options={[["system", "System"], ["full", "Full"], ["reduced", "Reduced"]]} />
          </div>
        </Group>


        <Group title="Sherine">
          <Segmented label="Sherine speaks" value={settings.fatmaLanguage} onChange={(fatmaLanguage) => update({ fatmaLanguage })} options={FATMA_LANGUAGES} />
          <p className="mt-2 px-1 text-xs text-muted">Franco is Egyptian Arabic in Latin letters (3 = ع, 7 = ح, 2 = ء). Tap Sherine during a game to talk to her.</p>
        </Group>

        <Group title="Sherine (Full Power)">
          <Segmented label="Thinking time" value={settings.think} onChange={(think) => update({ think })} options={[["fast", "Fast · 0.4s"], ["standard", "Standard · 1.2s"], ["deep", "Deep · 3.5s"]]} />
          <p className="mt-2 px-1 text-xs text-muted">Stockfish 19 Lite runs on this device. Strength is never artificially limited in Full Power.</p>
        </Group>
      </div>
    </main>
  );
}
