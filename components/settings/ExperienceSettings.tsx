"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useSettings } from "@/lib/client/settings";
import { playSound, unlockAudio } from "@/lib/client/sound";
import {
  AMBIENT_PRESETS,
  DEFAULT_AMBIENT,
  DEFAULT_EXPERIENCE,
  SOUND_EVENTS,
  SOUND_PACKS,
  type AmbientSettings,
  type Experience,
  type SoundEvent,
  type SoundPack,
} from "@/lib/experience/config";
import { PACK_LABELS } from "@/lib/experience/audio";
import { SwitchRow } from "@/components/ui/Switch";

const field =
  "min-h-11 w-full rounded-xl border border-line bg-surface-2 px-3 text-sm";
function Choice<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly { id: T; name: string; description?: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <fieldset className="min-w-0">
      <legend className="mb-2 text-sm font-medium">{label}</legend>
      <div className="grid gap-2 sm:grid-cols-3">
        {options.map((option) => (
          <label
            key={option.id}
            className={`relative cursor-pointer rounded-2xl border p-3 ${value === option.id ? "border-accent bg-surface-2 ring-1 ring-accent" : "border-line bg-surface"}`}
          >
            <input
              type="radio"
              name={label}
              value={option.id}
              checked={value === option.id}
              onChange={() => onChange(option.id)}
              className="absolute end-3 top-3 accent-[var(--accent)]"
            />
            <span
              className={`mb-3 flex h-12 gap-1 rounded-xl p-2 ${option.id === "dark" ? "bg-[#1e1e1c]" : option.id === "system" ? "bg-linear-to-r from-[#efede8] from-50% to-[#1e1e1c] to-50%" : "bg-surface-2"}`}
              aria-hidden="true"
            >
              <span className="w-1/3 rounded-lg bg-accent/20" />
              <span className="flex-1 rounded-lg bg-accent/10" />
            </span>
            <span className="block pe-4 text-sm font-semibold">
              {option.name}
            </span>
            {option.description && (
              <span className="mt-1 block text-xs text-muted">
                {option.description}
              </span>
            )}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
function Range({
  label,
  value,
  min = 0,
  max = 1,
  step = 0.05,
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="grid gap-1 text-sm">
      <span className="flex justify-between gap-3">
        {label}
        <output className="tabular-nums text-muted">
          {Number(value.toFixed(2))}
        </output>
      </span>
      <input
        type="range"
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="min-h-11 w-full accent-[var(--accent)]"
      />
    </label>
  );
}
function SelectValue<T extends string>({
  label,
  value,
  values,
  onChange,
}: {
  label: string;
  value: T;
  values: readonly T[];
  onChange: (value: T) => void;
}) {
  return (
    <label className="grid gap-1 text-sm">
      {label}
      <select
        className={field}
        value={value}
        onChange={(event) => {
          const selected = values.find((item) => item === event.target.value);
          if (selected) onChange(selected);
        }}
      >
        {values.map((item) => (
          <option key={item} value={item}>
            {item.replaceAll("-", " ")}
          </option>
        ))}
      </select>
    </label>
  );
}

export function AppearanceSettings() {
  const { settings, updateExperience, syncsExperience } = useSettings();
  const e = settings.experience;
  return (
    <section aria-labelledby="appearance-heading" className="grid gap-4">
      <h2 id="appearance-heading" className="text-lg font-semibold">
        Appearance
      </h2>
      <Choice
        label="Color mode"
        value={e.colorMode}
        onChange={(colorMode) => updateExperience({ colorMode })}
        options={[
          { id: "light", name: "Light" },
          { id: "dark", name: "Dark" },
          { id: "system", name: "System" },
        ]}
      />
      <p className="text-xs text-muted">
        {syncsExperience
          ? "Appearance, background and sound preferences sync with your account."
          : "Saved on this device."}{" "}
        Changing it keeps your game and clocks intact.
      </p>
    </section>
  );
}

export function BackgroundSettings() {
  const { settings, updateExperience } = useSettings();
  const a = settings.experience.ambient;
  const change = (patch: Partial<AmbientSettings>) =>
    updateExperience({ ambient: { ...a, ...patch, preset: "custom" } });
  return (
    <section aria-labelledby="background-heading" className="grid gap-4">
      <h2 id="background-heading" className="text-lg font-semibold">
        Gameplay background
      </h2>
      <Choice
        label="Board scene"
        value={a.mode}
        onChange={(mode) => change({ mode })}
        options={[
          {
            id: "minimal",
            name: "Minimal",
            description: "The quiet, original game background. Default.",
          },
          {
            id: "ambient",
            name: "Ambient Glyphs",
            description: "Original drifting notation behind the game scene.",
          },
          {
            id: "off",
            name: "Off",
            description: "No decorative background layer.",
          },
        ]}
      />
      {a.mode === "ambient" && (
        <div className="grid gap-4 rounded-2xl bg-surface p-4">
          <div
            className="overflow-hidden rounded-xl bg-surface-2 p-5 font-mono text-sm tracking-widest text-muted"
            aria-label="Static Ambient Glyphs preview"
          >
            e4 · Nf3 · O-O · ♞<br />
            <span className="opacity-60"> ♜ c6 · g3 · ♙</span>
            <br />
            ... d5 · Bb5 · ↗
          </div>
          <SelectValue
            label="Preset"
            value={a.preset}
            values={["calm", "competitive", "terminal", "expressive", "custom"]}
            onChange={(preset) =>
              updateExperience({
                ambient:
                  preset === "custom"
                    ? { ...a, preset }
                    : { ...a, ...AMBIENT_PRESETS[preset], preset },
              })
            }
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <SelectValue
              label="Intensity"
              value={a.intensity}
              values={["low", "medium", "high"]}
              onChange={(intensity) => change({ intensity })}
            />
            <SelectValue
              label="Background motion"
              value={a.motion}
              values={["subtle", "normal", "dynamic"]}
              onChange={(motion) => change({ motion })}
            />
          </div>
          <SwitchRow
            label="Pointer response"
            hint="Only empty game-scene space responds. Board input is untouched."
            checked={a.interactive}
            onChange={(interactive) => change({ interactive })}
          />
          <SwitchRow
            label="Adaptive battery limits"
            hint="Caps rendering at 15fps on low-memory/core or data-saving devices. Turn off to use the chosen cap."
            checked={a.adaptive}
            onChange={(adaptive) => change({ adaptive })}
          />
          <details>
            <summary className="cursor-pointer py-2 text-sm font-medium">
              Advanced background controls
            </summary>
            <div className="mt-3 grid gap-3">
              <Range
                label="Glyph density"
                value={a.density}
                min={0.1}
                onChange={(density) => change({ density })}
              />
              <SelectValue
                label="Glyph style"
                value={a.glyphs}
                values={["notation", "chess", "mono", "mix"]}
                onChange={(glyphs) => change({ glyphs })}
              />
              <Range
                label="Glyph scale"
                value={a.scale}
                min={0.7}
                max={1.8}
                onChange={(scale) => change({ scale })}
              />
              <Range
                label="Drift speed"
                value={a.speed}
                min={0.1}
                max={1.5}
                onChange={(speed) => change({ speed })}
              />
              <Range
                label="Background opacity"
                value={a.opacity}
                min={0.02}
                max={0.2}
                step={0.01}
                onChange={(opacity) => change({ opacity })}
              />
              <Range
                label="Glyph softness"
                value={a.blur}
                max={2}
                step={0.1}
                onChange={(blur) => change({ blur })}
              />
              <SwitchRow
                label="Sync background tint to board"
                checked={a.syncBoard}
                onChange={(syncBoard) => change({ syncBoard })}
              />
              {!a.syncBoard && (
                <label className="flex min-h-11 items-center justify-between text-sm">
                  Glyph tint
                  <input
                    aria-label="Glyph tint"
                    type="color"
                    value={a.tint}
                    onChange={(event) => change({ tint: event.target.value })}
                    className="h-11 w-16"
                  />
                </label>
              )}
              <label className="grid gap-1 text-sm">
                Animation FPS cap
                <select
                  aria-label="Animation FPS cap"
                  value={a.fps}
                  className={field}
                  onChange={(event) => {
                    const fps = [0, 15, 30, 60].find(
                      (value) => value === Number(event.target.value),
                    );
                    if (fps === 0 || fps === 15 || fps === 30 || fps === 60)
                      change({ fps });
                  }}
                >
                  <option value={0}>Static / no animation</option>
                  {[15, 30, 60].map((fps) => (
                    <option key={fps} value={fps}>
                      {fps} fps
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </details>
          <p className="text-xs text-muted">
            The Canvas renderer loads only inside a game scene, pauses
            offscreen/hidden and becomes static for reduced motion or
            transparency. It is not mounted on other pages.
          </p>
          <Link
            href="/"
            className="grid min-h-11 place-items-center rounded-full bg-accent px-4 text-sm font-medium text-accent-text"
          >
            Preview on the board
          </Link>
        </div>
      )}
      <button
        onClick={() => updateExperience({ ambient: { ...DEFAULT_AMBIENT } })}
        className="min-h-11 justify-self-start rounded-full bg-surface-2 px-4 text-sm"
      >
        Reset background defaults
      </button>
    </section>
  );
}

function PackSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: SoundPack;
  onChange: (value: SoundPack) => void;
}) {
  return (
    <label className="grid gap-1 text-sm">
      {label}
      <select
        aria-label={label}
        className={field}
        value={value}
        onChange={(event) => {
          const pack = SOUND_PACKS.find((id) => id === event.target.value);
          if (pack) onChange(pack);
        }}
      >
        {SOUND_PACKS.map((pack) => (
          <option key={pack} value={pack}>
            {PACK_LABELS[pack]}
          </option>
        ))}
      </select>
    </label>
  );
}
export function SoundSettings() {
  const { settings, updateExperience } = useSettings();
  const a = settings.experience.audio;
  const change = (patch: Partial<Experience["audio"]>) =>
    updateExperience({ audio: { ...a, ...patch } });
  const [compare, setCompare] = useState<SoundPack>("piano");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  const preview = (pack: SoundPack, event: SoundEvent) => {
    unlockAudio();
    playSound(event, settings.volume, { pack, preview: true });
  };
  return (
    <section aria-labelledby="sound-packs-heading" className="grid gap-4">
      <h2 id="sound-packs-heading" className="text-lg font-semibold">
        Gameplay sound packs
      </h2>
      <PackSelect
        label="Sound pack"
        value={a.pack}
        onChange={(pack) => change({ pack })}
      />
      <p className="text-xs text-muted">
        Original short, instrument-inspired event cues, synthesized and cached
        on your device. These are not recordings, background music or loops.
        Classic Chess is the default.
      </p>
      {!settings.sound && (
        <p role="status" className="text-sm text-muted">
          Master sound is muted. Turn on Chess sounds below to hear previews.
        </p>
      )}
      <div className="grid grid-cols-2 gap-2">
        {(["move", "capture", "check", "checkmate"] as const).map((event) => (
          <button
            key={event}
            onClick={() => preview(a.pack, event)}
            className="min-h-11 rounded-xl bg-surface-2 px-3 text-sm"
            aria-label={`Preview ${event}`}
          >
            {event[0].toUpperCase() + event.slice(1)}
          </button>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Range
          label="Gameplay effects volume"
          value={a.gameplay}
          onChange={(gameplay) => change({ gameplay })}
        />
        <Range
          label="UI and notifications volume"
          value={a.ui}
          onChange={(ui) => change({ ui })}
        />
        <Range
          label="Sherine banter volume"
          value={a.banter}
          onChange={(banter) => change({ banter })}
        />
      </div>
      <details>
        <summary className="cursor-pointer py-2 text-sm font-medium">
          Event toggles and A/B comparison
        </summary>
        <div className="grid gap-2 pt-2">
          {(
            [
              ["moves", "Moves, castling and promotions"],
              ["captures", "Captures"],
              ["checks", "Checks"],
              ["endings", "Game results"],
              ["clocks", "Clock alerts"],
              ["notifications", "UI and invitations"],
            ] as const
          ).map(([key, label]) => (
            <SwitchRow
              key={key}
              label={label}
              checked={a[key]}
              onChange={(checked) => change({ [key]: checked })}
            />
          ))}
          <PackSelect
            label="Compare with"
            value={compare}
            onChange={setCompare}
          />
          <button
            onClick={() => {
              if (timer.current) clearTimeout(timer.current);
              preview(a.pack, "move");
              timer.current = setTimeout(() => preview(compare, "move"), 450);
            }}
            className="min-h-11 rounded-full bg-surface-2 px-4 text-sm"
          >
            A/B move: {PACK_LABELS[a.pack]} then {PACK_LABELS[compare]}
          </button>
        </div>
      </details>
      <details>
        <summary className="cursor-pointer py-2 text-sm font-medium">
          Test and customize each event
        </summary>
        <div className="grid gap-3 pt-3">
          {SOUND_EVENTS.map((event) => (
            <div
              key={event}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2"
            >
              <label className="grid gap-1 text-sm">
                {event.replaceAll("_", " ")}
                <select
                  aria-label={`Override ${event}`}
                  className={field}
                  value={a.overrides[event] ?? "pack"}
                  onChange={(changeEvent) => {
                    const overrides = { ...a.overrides };
                    const pack = SOUND_PACKS.find(
                      (id) => id === changeEvent.target.value,
                    );
                    if (pack) overrides[event] = pack;
                    else delete overrides[event];
                    change({ overrides });
                  }}
                >
                  <option value="pack">Follow pack defaults</option>
                  {SOUND_PACKS.map((pack) => (
                    <option key={pack} value={pack}>
                      {PACK_LABELS[pack]}
                    </option>
                  ))}
                </select>
              </label>
              <button
                className="min-h-11 rounded-xl bg-surface-2 px-3 text-sm"
                aria-label={`Test ${event}`}
                onClick={() => preview(a.overrides[event] ?? a.pack, event)}
              >
                Test
              </button>
            </div>
          ))}
        </div>
      </details>
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => change({ overrides: {} })}
          className="min-h-11 rounded-full bg-surface-2 px-4 text-sm"
        >
          Restore pack defaults
        </button>
        <button
          onClick={() =>
            updateExperience({ audio: { ...DEFAULT_EXPERIENCE.audio } })
          }
          className="min-h-11 rounded-full bg-surface-2 px-4 text-sm"
        >
          Reset sound settings
        </button>
      </div>
    </section>
  );
}
