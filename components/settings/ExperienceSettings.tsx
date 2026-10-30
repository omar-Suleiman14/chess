"use client";

import { useEffect, useRef, useState } from "react";
import { useSettings } from "@/lib/client/settings";
import { playSound, unlockAudio } from "@/lib/client/sound";
import {
  DEFAULT_EXPERIENCE,
  SOUND_EVENTS,
  SOUND_PACKS,
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
  return (
    <section aria-labelledby="background-heading" className="grid gap-2">
      <h2 id="background-heading" className="text-lg font-semibold">
        Background
      </h2>
      <div className="overflow-hidden rounded-2xl bg-surface shadow-[var(--shadow)]">
        <SwitchRow
          label="Live background"
          hint="Drifting characters behind your games. Move the mouse to stir them; tap empty space for a ripple."
          checked={a.mode === "ambient"}
          onChange={(on) => updateExperience({ ambient: { ...a, mode: on ? "ambient" : "minimal" } })}
        />
      </div>
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
