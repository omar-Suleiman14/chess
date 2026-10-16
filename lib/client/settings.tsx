"use client";

import { useConvex, useConvexAuth, useMutation } from "convex/react";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { api } from "@/convex/_generated/api";
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
  /** Experimental Liquid Glass controls. Legacy "auto" now means off everywhere. */
  glass: "auto" | "on" | "off";
  /** Faint drifting characters behind the app that ripple when you tap empty space. */
  livingBackground: boolean;
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
  glass: "off",
  livingBackground: false,
};

const KEY = "cbc.settings.v1";

type Ctx = {
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
  reducedMotion: boolean;
  /** Liquid Glass is enabled only by an explicit opt-in. */
  glassOn: boolean;
  /** Device limitations relevant when explicitly opting into glass. */
  glassOffReason: GlassOffReason;
};
const SettingsContext = createContext<Ctx | null>(null);

const CHANGED_KEY = "cbc.settings.changedAt";
/** How long to wait after the last change before saving to the account. */
const SAVE_DELAY_MS = 400;

/** Known keys only, defaults for the rest: old or tampered storage can't break the app. */
export function fromSaved(saved: unknown): Settings {
  const next = { ...DEFAULT_SETTINGS };
  if (!saved || typeof saved !== "object") return next;
  for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[]) {
    const value = (saved as Partial<Settings>)[key];
    if (Object.hasOwn(saved, key) && value !== undefined && value !== null) Object.assign(next, { [key]: value });
  }
  if (next.glass === "auto") next.glass = "off";
  return next;
}

function load(): { settings: Settings; changedAt: number } {
  try {
    const raw = localStorage.getItem(KEY);
    const changedAt = Number(localStorage.getItem(CHANGED_KEY)) || 0;
    if (!raw) return { settings: DEFAULT_SETTINGS, changedAt };
    const next = fromSaved(JSON.parse(raw));
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* Keep readable preferences when writes are blocked. */ }
    return { settings: next, changedAt };
  } catch {
    return { settings: DEFAULT_SETTINGS, changedAt: 0 };
  }
}

function store(settings: Settings, changedAt: number): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
    localStorage.setItem(CHANGED_KEY, String(changedAt));
  } catch {
    // Storage can be unavailable (private mode); settings still apply for this visit.
  }
}

export type SyncDecision = { action: "none" } | { action: "pull"; settings: Settings; changedAt: number } | { action: "push" };

/**
 * Which copy wins when a signed-in device sees its account's settings: the one
 * changed most recently. A device that never changed anything adopts the
 * account's settings; an account with none gets this device's, if any were set.
 */
export function resolveSettingsSync(localChangedAt: number, remote: { settings: unknown; changedAt: number } | null): SyncDecision {
  if (!remote) return localChangedAt > 0 ? { action: "push" } : { action: "none" };
  if (remote.changedAt > localChangedAt) return { action: "pull", settings: fromSaved(remote.settings), changedAt: remote.changedAt };
  if (localChangedAt > remote.changedAt) return { action: "push" };
  return { action: "none" };
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

  const [hydrated, setHydrated] = useState(false);
  const changedAt = useRef(0);
  // The newest settings, for the debounced save (kept in step with every setSettings).
  const latest = useRef(DEFAULT_SETTINGS);

  useEffect(() => {
    // Hydrate after mount so server and first client render match.
    const saved = load();
    changedAt.current = saved.changedAt;
    latest.current = saved.settings;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSettings(saved.settings);
    setHydrated(true);
    setOffReason(glassOffReason());
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    setSystemReduced(media.matches);
    const onChange = () => setSystemReduced(media.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  // Signed in: settings follow the account across devices (newest change wins).
  const { isAuthenticated } = useConvexAuth();
  const convex = useConvex();
  // A one-off read (not a live query) that fails quietly: if the backend
  // predates settings sync, the app still works with this device's settings.
  const [remote, setRemote] = useState<{ settings: unknown; changedAt: number } | null | undefined>(undefined);
  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    convex
      .query(api.settings.mine, {})
      .then((r) => !cancelled && setRemote(r))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [convex, isAuthenticated]);
  const saveRemote = useMutation(api.settings.save);
  const pushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const push = useCallback(() => {
    if (pushTimer.current) clearTimeout(pushTimer.current);
    pushTimer.current = setTimeout(() => {
      // Failures (offline) are fine: the next load sees the newer local copy and pushes again.
      void saveRemote({ settings: latest.current, changedAt: changedAt.current }).catch(() => {});
    }, SAVE_DELAY_MS);
  }, [saveRemote]);
  useEffect(() => () => {
    if (pushTimer.current) clearTimeout(pushTimer.current);
  }, []);

  useEffect(() => {
    if (!hydrated || !isAuthenticated || remote === undefined) return;
    const decision = resolveSettingsSync(changedAt.current, remote);
    if (decision.action === "pull") {
      changedAt.current = decision.changedAt;
      latest.current = decision.settings;
      store(decision.settings, decision.changedAt);
      // Adopting the account's settings: syncing with an external store.
      setSettings(decision.settings);
    } else if (decision.action === "push") {
      push();
    }
  }, [hydrated, isAuthenticated, remote, push]);

  const update = useCallback(
    (patch: Partial<Settings>) => {
      const next = { ...latest.current, ...patch };
      latest.current = next;
      changedAt.current = Date.now();
      store(next, changedAt.current);
      setSettings(next);
      if (isAuthenticated) push();
    },
    [isAuthenticated, push],
  );

  const reducedMotion = settings.motion === "reduced" || (settings.motion === "system" && systemReduced);
  const glassOn = offReason !== "unknown" && settings.glass === "on";
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
