"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { ThinkPreset } from "../chess/engine/opponents";
import type { PieceSet } from "@/components/chess/Pieces";
import type { FatmaLanguage } from "../chess/personality/lines";

export type Palette = "ivory" | "sage" | "slate" | "blue";

export type Settings = {
  palette: Palette;
  pieceSet: PieceSet;
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
  /** English, Franco (Egyptian Arabic in Latin letters) or Egyptian Arabic. */
  fatmaLanguage: FatmaLanguage;
  highContrast: boolean;
};

export const DEFAULT_SETTINGS: Settings = {
  palette: "ivory",
  pieceSet: "cburnett",
  sound: true,
  volume: 0.7,
  haptics: true,
  motion: "system",
  evalBar: true,
  legalDots: true,
  coordinates: true,
  think: "standard",
  fatmaSound: false,
  fatmaLanguage: "en",
  highContrast: false,
};

const KEY = "cbc.settings.v1";

type Ctx = { settings: Settings; update: (patch: Partial<Settings>) => void; reducedMotion: boolean };
const SettingsContext = createContext<Ctx | null>(null);

function load(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const saved = JSON.parse(raw) as Partial<Settings>;
    if (!saved || typeof saved !== "object") return DEFAULT_SETTINGS;
    const next = { ...DEFAULT_SETTINGS };
    for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[]) {
      if (Object.hasOwn(saved, key)) Object.assign(next, { [key]: saved[key] });
    }
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* Keep readable preferences when writes are blocked. */ }
    return next;
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
