"use client";

import { useEngineMode, type EngineMode } from "@/lib/client/engineMode";
import { hasCloudEngine } from "@/lib/client/engine";
import { haptic } from "@/lib/client/haptics";

const MODES: Array<{ id: EngineMode; label: string; detail: string }> = [
  { id: "auto", label: "Auto", detail: "Cloud when you're online, this device when you're not. Recommended." },
  { id: "cloud", label: "Cloud only", detail: "Keeps your phone coolest. The eval bar, hints, move feedback and reviews need internet; bots still play offline." },
  { id: "device", label: "This device", detail: "Everything works offline, but your phone does the thinking and uses more battery." },
];

/** Where Stockfish runs: the cloud keeps phones cool, this device works offline. */
export function EngineSettings() {
  const [mode, setMode] = useEngineMode();
  const cloud = hasCloudEngine();
  return (
    <section aria-labelledby="engine-heading" className="grid gap-2">
      <h2 id="engine-heading" className="text-lg font-semibold">Engine</h2>
      <div className="rounded-2xl bg-surface p-2 shadow-[var(--shadow)]">
        {cloud ? (
          <div role="radiogroup" aria-labelledby="engine-heading" className="grid gap-1">
            {MODES.map((option) => (
              <label key={option.id} className="press-overlay flex min-h-12 cursor-pointer items-start gap-3 rounded-xl px-3 py-2.5">
                <input
                  type="radio"
                  name="engine-mode"
                  value={option.id}
                  checked={mode === option.id}
                  onChange={() => { haptic("select"); setMode(option.id); }}
                  className="mt-1 h-4 w-4 shrink-0 accent-[var(--switch-on)]"
                />
                <span className="min-w-0">
                  <span className="block font-semibold">{option.label}</span>
                  <span className="block text-sm text-muted">{option.detail}</span>
                </span>
              </label>
            ))}
          </div>
        ) : (
          <p className="px-2 py-2 text-sm text-muted">Stockfish runs on this device. No cloud engine is set up for this site yet.</p>
        )}
      </div>
    </section>
  );
}
