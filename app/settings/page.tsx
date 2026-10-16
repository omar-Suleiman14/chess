"use client";

import { Segmented } from "@/components/chess/GameScreen";
import { PageHeader } from "@/components/shell/AppShell";
import { useSettings, type Palette } from "@/lib/client/settings";
import { haptic, playSound, unlockAudio } from "@/lib/client/sound";

const PALETTES: Array<[Palette, string, string, string]> = [
  ["ivory", "Ivory", "#efe6d5", "#c3a982"],
  ["sage", "Sage", "#e8ecdf", "#93a57f"],
  ["slate", "Slate", "#e3e6ea", "#8a96a3"],
  ["blue", "Blue", "#e4ebf3", "#7d9bbd"],
];

export default function SettingsPage() {
  const { settings, update } = useSettings();
  return (
    <main className="mx-auto min-h-dvh max-w-xl pb-12">
      <PageHeader title="Settings" />
      <div className="grid gap-5 px-4">
        <section aria-labelledby="board">
          <h2 id="board" className="mb-2 text-sm font-medium uppercase tracking-wide text-muted">Board</h2>
          <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-label="Board palette">
            {PALETTES.map(([id, name, light, dark]) => (
              <button
                key={id}
                role="radio"
                aria-checked={settings.palette === id}
                onClick={() => update({ palette: id })}
                className={`rounded-2xl p-2 ${settings.palette === id ? "bg-surface ring-2 ring-[var(--accent)]" : "bg-surface"} shadow-[var(--shadow)]`}
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
          <div className="mt-3 overflow-hidden rounded-2xl bg-surface shadow-[var(--shadow)]">
            <Toggle label="Legal move dots" checked={settings.legalDots} onChange={(v) => update({ legalDots: v })} />
            <Toggle label="Coordinates" checked={settings.coordinates} onChange={(v) => update({ coordinates: v })} />
            <Toggle label="Evaluation bar" hint="Hide it to test yourself. Never live in rated games." checked={settings.evalBar} onChange={(v) => update({ evalBar: v })} />
            <Toggle label="High contrast" checked={settings.highContrast} onChange={(v) => update({ highContrast: v })} />
          </div>
        </section>

        <section aria-labelledby="feel">
          <h2 id="feel" className="mb-2 text-sm font-medium uppercase tracking-wide text-muted">Sound &amp; feel</h2>
          <div className="overflow-hidden rounded-2xl bg-surface shadow-[var(--shadow)]">
            <Toggle
              label="Chess sounds"
              checked={settings.sound}
              onChange={(v) => {
                unlockAudio();
                update({ sound: v });
                if (v) setTimeout(() => playSound("move", settings.volume), 50);
              }}
            />
            <label className="flex min-h-14 items-center justify-between gap-4 border-b border-line px-4 py-3">
              <span>Volume</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={settings.volume}
                onChange={(e) => update({ volume: Number(e.target.value) })}
                onPointerUp={() => {
                  unlockAudio();
                  playSound("capture", settings.volume);
                }}
                className="w-40"
                aria-label="Volume"
              />
            </label>
            <Toggle
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
        </section>

        <section aria-labelledby="engine">
          <h2 id="engine" className="mb-2 text-sm font-medium uppercase tracking-wide text-muted">Fatma (Full Power)</h2>
          <Segmented label="Thinking time" value={settings.think} onChange={(think) => update({ think })} options={[["fast", "Fast · 0.4s"], ["standard", "Standard · 1.2s"], ["deep", "Deep · 3.5s"]]} />
          <p className="mt-2 text-xs text-muted">Stockfish 19 Lite runs on this device. Strength is never artificially limited in Full Power.</p>
        </section>
      </div>
    </main>
  );
}

function Toggle({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex min-h-14 cursor-pointer items-center justify-between gap-4 border-b border-line px-4 py-3 last:border-b-0">
      <span>
        <span className="block">{label}</span>
        {hint && <span className="block text-xs text-muted">{hint}</span>}
      </span>
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-6 w-11 shrink-0 accent-[var(--accent)]" />
    </label>
  );
}
