"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { ThinkPreset } from "../chess/engine/opponents";

export type Palette = "ivory" | "sage" | "slate" | "blue";

export type Settings = {
  palette: Palette;
  sound: boolean;
  volume: number;
  haptics: boolean;
  /** "system" follows prefers-reduced-motion. */
  motion: "system" | "full" | "reduced";
  evalBar: boolean;
  legalDots: boolean;
  coordinates: boolean;
  think: ThinkPreset;
  fatmaSound: boolean;
  highContrast: boolean;
};

export const DEFAULT_SETTINGS: Settings = {
  palette: "ivory",
  sound: true,
  volume: 0.7,
  haptics: true,
  motion: "system",
  evalBar: true,
  legalDots: true,
  coordinates: true,
  think: "standard",
  fatmaSound: false,
  highContrast: false,
};

const KEY = "cbc.settings.v1";

type Ctx = { settings: Settings; update: (patch: Partial<Settings>) => void; reducedMotion: boolean };
const SettingsContext = createContext<Ctx | null>(null);

function load(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<Settings>) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [systemReduced, setSystemReduced] = useState(false);

  useEffect(() => {
    // Hydrate after mount so server and first client render match.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSettings(load());
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    setSystemReduced(media.matches);
    const onChange = () => setSystemReduced(media.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        // Storage can be unavailable (private mode); settings still apply for this visit.
      }
      return next;
    });
  }, []);

  const reducedMotion = settings.motion === "reduced" || (settings.motion === "system" && systemReduced);

  useEffect(() => {
    document.documentElement.dataset.palette = settings.palette;
    document.documentElement.dataset.contrast = settings.highContrast ? "high" : "normal";
    document.documentElement.dataset.motion = reducedMotion ? "reduced" : "full";
  }, [settings.palette, settings.highContrast, reducedMotion]);

  const value = useMemo(() => ({ settings, update, reducedMotion }), [settings, update, reducedMotion]);
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): Ctx {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings outside SettingsProvider");
  return ctx;
}
