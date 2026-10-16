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
  /** Experimental Liquid Glass controls. "auto" follows the device default (see glassDefault). */
  glass: "auto" | "on" | "off";
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
  glass: "auto",
};

const KEY = "cbc.settings.v1";

type Ctx = {
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
  reducedMotion: boolean;
  /** Whether Liquid Glass is on right now (the setting, or the device default for "auto"). */
  glassOn: boolean;
  /** Why "auto" means off on this device, or null when it means on. */
  glassOffReason: GlassOffReason;
};
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

/**
 * Few cores, little memory or Data Saver: the per-frame backdrop filters cost
 * more than they are worth, so glass starts off. Unknown values count as capable.
 */
export function isWeakDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  return (nav.hardwareConcurrency > 0 && nav.hardwareConcurrency < 4) || (nav.deviceMemory !== undefined && nav.deviceMemory < 4) || nav.connection?.saveData === true;
}

/**
 * WebKit: Safari, and every browser on iPhone/iPad (Apple requires WebKit there,
 * so Chrome/Edge/Firefox on iOS count too). WebKit cannot render the refraction,
 * so glass would only ever be the fallback there.
 */
export function isWebKit(ua: string, maxTouchPoints = 0): boolean {
  const iOS = /iP(hone|ad|od)/.test(ua) || (/Macintosh/.test(ua) && maxTouchPoints > 1);
  if (iOS) return true;
  return /AppleWebKit/.test(ua) && !/Chrome|Chromium|Edg|OPR|Android/.test(ua);
}

export type GlassOffReason = "webkit" | "weak" | null;

export function glassOffReason(): GlassOffReason {
  if (typeof navigator === "undefined") return null;
  if (isWebKit(navigator.userAgent, navigator.maxTouchPoints)) return "webkit";
  return isWeakDevice() ? "weak" : null;
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [systemReduced, setSystemReduced] = useState(false);
  // Until the device is known, render the plain controls: upgrading to glass
  // after mount is less jarring than flashing glass on a device that turns it off.
  const [offReason, setOffReason] = useState<GlassOffReason | "unknown">("unknown");

  useEffect(() => {
    // Hydrate after mount so server and first client render match.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSettings(load());
    setOffReason(glassOffReason());
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
  const glassOn = offReason !== "unknown" && (settings.glass === "on" || (settings.glass === "auto" && offReason === null));
  const glassOffReasonValue = offReason === "unknown" ? null : offReason;

  useEffect(() => {
    document.documentElement.dataset.palette = settings.palette;
    document.documentElement.dataset.contrast = settings.highContrast ? "high" : "normal";
    document.documentElement.dataset.motion = reducedMotion ? "reduced" : "full";
    document.documentElement.dataset.glass = glassOn ? "on" : "off";
  }, [settings.palette, settings.highContrast, reducedMotion, glassOn]);


  const value = useMemo(() => ({ settings, update, reducedMotion, glassOn, glassOffReason: glassOffReasonValue }), [settings, update, reducedMotion, glassOn, glassOffReasonValue]);
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

/** Glass on/off without requiring a provider (defaults to off: the plain controls). */
export function useGlassOn(): boolean {
  return useContext(SettingsContext)?.glassOn ?? false;
}

export function useSettings(): Ctx {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings outside SettingsProvider");
  return ctx;
}
