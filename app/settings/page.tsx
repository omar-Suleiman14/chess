"use client";

import { Segmented } from "@/components/chess/GameScreen";
import { Piece, PIECE_SETS } from "@/components/chess/Pieces";
import { PageHeader } from "@/components/shell/AppShell";
import { ScrollRow } from "@/components/ui/ScrollRow";
import { SwitchRow } from "@/components/ui/Switch";
import { Slider } from "@/components/ui/Slider";
import { AppearanceSettings, BackgroundSettings, SoundSettings } from "@/components/settings/ExperienceSettings";
import { FATMA_LANGUAGES } from "@/lib/chess/personality/lines";
import { useSettings, type Palette } from "@/lib/client/settings";
import { playSound, unlockAudio } from "@/lib/client/sound";
import { haptic, hapticSupport, hapticSupportText, type HapticLevel, type HapticSupport } from "@/lib/client/haptics";
import { useEffect, useState } from "react";
import Link from "@/components/navigation/PrefetchLink";
import { BOARD_THEMES, findBoardTheme } from "@/lib/experience/boardThemes";
import { useCoachingPreferences } from "@/lib/client/useCoachingPreferences";

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
  const { settings, update, hapticLevel, setHapticLevel, chesscomSounds, setChesscomSounds, boardTheme } = useSettings();
  // Known only in the browser: render the neutral text first, then the truth.
  const [support, setSupport] = useState<HapticSupport | null>(null);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setSupport(hapticSupport()), []);
  const { coaching, updateCoaching } = useCoachingPreferences();
  const palette = PALETTES.find((p) => p[0] === settings.palette) ?? PALETTES[0];
  return (
    <main className="mx-auto min-h-dvh max-w-xl pb-16">
      <PageHeader title="Settings" />
      <div className="grid grid-cols-1 gap-7 px-4">
        <AppearanceSettings />
        <BackgroundSettings />
        <SoundSettings />
        <Group title="Board">
          <Link href="/settings/theme" className="press-overlay flex min-h-[72px] items-center gap-4 overflow-hidden rounded-2xl px-4 text-white" style={{ background: (findBoardTheme(boardTheme || settings.palette) ?? BOARD_THEMES[0]).art }}>
            <span className="grid h-12 w-12 shrink-0 grid-cols-2 overflow-hidden rounded-[3px] shadow-md" aria-hidden="true">
              {(() => { const t = findBoardTheme(boardTheme || settings.palette) ?? BOARD_THEMES[0]; return [t.light, t.dark, t.dark, t.light].map((c, i) => <span key={i} style={{ background: c }} />); })()}
            </span>
            <span className="min-w-0 flex-1 [text-shadow:0_1px_3px_rgb(0_0_0/0.45)]">
              <span className="block text-xs font-medium uppercase tracking-wide opacity-90">Theme</span>
              <span className="block text-lg font-semibold">{(findBoardTheme(boardTheme || settings.palette) ?? BOARD_THEMES[0]).name}</span>
            </span>
            <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 rtl:rotate-180" aria-hidden="true"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </Link>
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
            <SwitchRow label="Move classifications" hint="Only with depth 10+ analysis on both positions." checked={coaching.moveFeedback} onChange={(moveFeedback) => updateCoaching({ moveFeedback })} />
            <SwitchRow label="Coach explanations" checked={coaching.explanations} onChange={(explanations) => updateCoaching({ explanations })} />
            <SwitchRow label="Show hint button" hint="Ask for a clue, a highlight, then a move. Using help makes rated bot games unrated." checked={coaching.hints} onChange={(hints) => updateCoaching({ hints })} />
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
            <SwitchRow
              label="Chess.com sounds"
              hint="Personal use: your browser loads them from chess.com. Built-in sounds play if they can't load."
              checked={chesscomSounds}
              onChange={(on) => {
                unlockAudio();
                setChesscomSounds(on);
                if (on) setTimeout(() => playSound("move", settings.volume), 700);
              }}
            />
            <div className="flex min-h-14 items-center gap-3 border-b border-line px-4">
              <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-muted" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor" /></svg>
              <Slider
                min={0}
                max={1}
                step={0.05}
                value={settings.volume}
                onValueChange={(v) => update({ volume: v })}
                onPointerUp={() => {
                  unlockAudio();
                  playSound("capture", settings.volume);
                }}
                className="flex-1"
                fill="var(--switch-on)"
                aria-label="Volume"
              />
              <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-muted" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4zm12.5 3a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4zM14 3.2v2.1a7 7 0 0 1 0 13.4v2.1a9 9 0 0 0 0-17.6z" fill="currentColor" /></svg>
            </div>
          </div>
          <div className="mt-3 grid gap-2">
            <Segmented<HapticLevel>
              label="Haptics"
              value={hapticLevel}
              onChange={(level) => {
                setHapticLevel(level);
                // Feel the new strength right away (Off stays silent).
                if (level !== "off") haptic("capture");
              }}
              options={[["off", "Off"], ["subtle", "Subtle"], ["standard", "Standard"]]}
            />
            <div className="flex items-center justify-between gap-3 px-1">
              <p className="text-xs text-muted" aria-live="polite">{support ? hapticSupportText(support) : "Checking this device…"}</p>
              <button
                type="button"
                disabled={hapticLevel === "off" || support === "none"}
                onClick={() => { haptic("select"); setTimeout(() => haptic("move"), 260); setTimeout(() => haptic("capture"), 560); }}
                className="min-h-11 shrink-0 rounded-full bg-surface px-4 text-sm font-medium shadow-[var(--shadow)] ring-1 ring-inset ring-line disabled:opacity-40"
              >
                Test
              </button>
            </div>
          </div>
          <div className="mt-3">
            <Segmented label="Motion" value={settings.motion} onChange={(motion) => update({ motion })} options={[["system", "System"], ["full", "Full"], ["reduced", "Reduced"]]} />
          </div>
        </Group>


        <Group title="Sherine">
          <SwitchRow label="Dialogue sounds" hint="A quiet chime when Sherine speaks. No voice." checked={settings.fatmaSound} onChange={(fatmaSound) => { unlockAudio(); update({ fatmaSound }); }} />
          <SwitchRow label="Auto language" hint="Browser language initially; follows Arabic, English or Arabizi when you say hi." checked={coaching.autoLanguage} onChange={(autoLanguage) => updateCoaching({ autoLanguage })} />
          <Segmented label="Sherine speaks" value={settings.fatmaLanguage} onChange={(fatmaLanguage) => update({ fatmaLanguage })} options={FATMA_LANGUAGES} />
          <div className="mt-3 grid gap-3">
            <Segmented label="Banter frequency" value={coaching.frequency} onChange={(frequency) => updateCoaching({ frequency })} options={[["quiet", "Quiet"], ["balanced", "Balanced"], ["chatty", "Chatty"]]} />
            <Segmented label="Personality" value={coaching.intensity} onChange={(intensity) => updateCoaching({ intensity })} options={[["gentle", "Gentle"], ["playful", "Playful"], ["spicy", "Spicy"]]} />
          </div>
          <p className="mt-2 text-xs text-muted">Coaching and banter preferences are saved on this device. Turn Sherine off in Profile to mute all her commentary.</p>
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
