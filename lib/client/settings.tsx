"use client";

import { useConvex, useConvexAuth, useMutation } from "convex/react";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { api } from "@/convex/_generated/api";
import type { ThinkPreset } from "../chess/engine/opponents";
import type { PieceSet } from "@/components/chess/Pieces";
import type { FatmaLanguage } from "../chess/personality/lines";
import { DEFAULT_EXPERIENCE, parseExperience, type Experience } from "../experience/config";
import { themeTokens } from "../experience/theme";
import { BOARD_THEME_KEY, boardThemeVars, findBoardTheme } from "../experience/boardThemes";
import { configureAudio, configureChesscomSounds, installAudioUnlock } from "./sound";
import { configureHaptics, type HapticLevel } from "./haptics";

export type Palette = "ivory" | "sage" | "slate" | "blue";

export type Settings = {
  experience: Experience;
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
  /** Retired Liquid Glass flag. Kept only so older saves and account rows stay valid; always "off". */
  glass: "auto" | "on" | "off";
  /** Faint drifting characters behind the app that ripple when you tap empty space. */
  livingBackground: boolean;
  /** Board theme id (colours + pieces), or "" to use the board palette. Synced with the account. */
  boardTheme: string;
};

export const DEFAULT_SETTINGS: Settings = {
  experience: DEFAULT_EXPERIENCE,
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
  boardTheme: "",
};

const KEY = "cbc.settings.v1";

type Ctx = {
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
  updateExperience: (patch: Partial<Experience>) => void;
  syncsExperience: boolean;
  reducedTransparency: boolean;
  reducedMotion: boolean;
  /** Effective haptics: "off" when Haptics is switched off, else this device's strength. */
  hapticLevel: HapticLevel;
  /** Off / Subtle / Standard. The strength is per device, since hardware differs. */
  setHapticLevel: (level: HapticLevel) => void;
  /** Personal option: play Chess.com's own sounds, loaded from chess.com on this device. */
  chesscomSounds: boolean;
  setChesscomSounds: (on: boolean) => void;
  /** Board theme id (colours + pieces), saved on this device. "" = the board palette. */
  boardTheme: string;
  setBoardTheme: (id: string) => void;
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
  // Classic is the only design: retired Liquid Glass / Material choices resolve to it.
  next.glass = "off";
  next.experience = parseExperience("experience" in saved ? saved.experience : undefined, saved);
  if (!["ivory", "sage", "slate", "blue"].includes(next.palette)) next.palette = "ivory";
  if (!["system", "full", "reduced"].includes(next.motion)) next.motion = "system";
  if (!["en", "egy", "franco"].includes(next.fatmaLanguage)) next.fatmaLanguage = "en";
  if (typeof next.boardTheme !== "string" || (next.boardTheme !== "" && !findBoardTheme(next.boardTheme))) next.boardTheme = "";
  if (!Number.isFinite(next.volume)) next.volume = DEFAULT_SETTINGS.volume;
  next.volume = Math.min(1, Math.max(0, next.volume));
  return next;
}

function load(): { settings: Settings; changedAt: number } {
  try {
    const raw = localStorage.getItem(KEY);
    const changedAt = Number(localStorage.getItem(CHANGED_KEY)) || 0;
    if (!raw) return { settings: DEFAULT_SETTINGS, changedAt };
    const parsed: unknown = JSON.parse(raw);
    const next = fromSaved(parsed);
    // Themes used to be saved per device; carry that choice into synced settings.
    if (!(parsed && typeof parsed === "object" && "boardTheme" in parsed)) next.boardTheme = findBoardTheme(localStorage.getItem(BOARD_THEME_KEY))?.id ?? "";
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
 * more than they are worth, so the live background runs slower. Unknown values count as capable.
 */
export function isWeakDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  return (nav.hardwareConcurrency > 0 && nav.hardwareConcurrency < 4) || (nav.deviceMemory !== undefined && nav.deviceMemory < 4) || nav.connection?.saveData === true;
}

const HAPTIC_KEY = "cbc.haptics.level";
const CHESSCOM_KEY = "cbc.sound.chesscom";

function loadHapticStrength(): Exclude<HapticLevel, "off"> {
  try {
    return localStorage.getItem(HAPTIC_KEY) === "subtle" ? "subtle" : "standard";
  } catch {
    return "standard";
  }
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  useEffect(() => installAudioUnlock(), []);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [systemReduced, setSystemReduced] = useState(false);
  const [systemDark, setSystemDark] = useState(false);
  const [reducedTransparency, setReducedTransparency] = useState(false);
  const [syncsExperience, setSyncsExperience] = useState(false);
  const experienceSupported = useRef(false);
  const [hapticStrength, setHapticStrength] = useState<Exclude<HapticLevel, "off">>("standard");
  const [chesscomSounds, setChesscomState] = useState(false);
  // Newer backends also store the board theme; older ones would reject the field.
  const boardThemeSupported = useRef(false);

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
    setHapticStrength(loadHapticStrength());
    try { setChesscomState(localStorage.getItem(CHESSCOM_KEY) === "on"); } catch { /* Off. */ }
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    setSystemReduced(media.matches);
    const onChange = () => setSystemReduced(media.matches);
    media.addEventListener("change", onChange);
    const scheme = matchMedia("(prefers-color-scheme: dark)");
    const transparency = matchMedia("(prefers-reduced-transparency: reduce)");
    const onScheme = () => setSystemDark(scheme.matches);
    const onTransparency = () => setReducedTransparency(transparency.matches);
    onScheme(); onTransparency();
    scheme.addEventListener("change", onScheme);
    transparency.addEventListener("change", onTransparency);
    return () => { media.removeEventListener("change", onChange); scheme.removeEventListener("change", onScheme); transparency.removeEventListener("change", onTransparency); };
  }, []);

  // Signed in: settings follow the account across devices (newest change wins).
  const { isAuthenticated } = useConvexAuth();
  const convex = useConvex();
  useEffect(() => {
    if (!isAuthenticated) { experienceSupported.current = false; boardThemeSupported.current = false; return; }
    let cancelled = false;
    void convex.query(api.settings.capabilities, {}).then((capabilities) => {
      if (!cancelled) { experienceSupported.current = true; boardThemeSupported.current = capabilities.boardTheme === true; setSyncsExperience(true); }
    }).catch(() => { /* Older deployments retain device-only experience preferences. */ });
    return () => { cancelled = true; };
  }, [convex, isAuthenticated]);
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
      const { experience, boardTheme, ...legacy } = latest.current;
      void saveRemote({ settings: { ...legacy, ...(experienceSupported.current ? { experience } : {}), ...(boardThemeSupported.current ? { boardTheme } : {}) }, changedAt: changedAt.current }).catch(() => {});
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
      const accountHasExperience = remote?.settings && typeof remote.settings === "object" && "experience" in remote.settings;
      const accountHasTheme = remote?.settings && typeof remote.settings === "object" && "boardTheme" in remote.settings;
      const adopted = { ...decision.settings, experience: accountHasExperience ? decision.settings.experience : latest.current.experience, boardTheme: accountHasTheme ? decision.settings.boardTheme : latest.current.boardTheme };
      latest.current = adopted;
      store(adopted, decision.changedAt);
      // Adopting the account's settings: syncing with an external store.
      setSettings(adopted);
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
  const updateExperience = useCallback((patch: Partial<Experience>) => {
    const experience = parseExperience({ ...latest.current.experience, ...patch });
    update({ experience, glass: "off", livingBackground: experience.ambient.mode === "ambient" });
  }, [update]);

  const reducedMotion = settings.motion === "reduced" || (settings.motion === "system" && systemReduced);
  useEffect(() => configureChesscomSounds(chesscomSounds), [chesscomSounds]);
  const setChesscomSounds = useCallback((on: boolean) => {
    setChesscomState(on);
    configureChesscomSounds(on);
    try { localStorage.setItem(CHESSCOM_KEY, on ? "on" : "off"); } catch { /* This visit only. */ }
  }, []);
  const boardTheme = settings.boardTheme;
  const setBoardTheme = useCallback((id: string) => {
    const theme = findBoardTheme(id);
    // A theme brings its pieces; palette themes also set the palette for older devices.
    update({ boardTheme: theme?.id ?? "", ...(theme ? { pieceSet: theme.pieces } : {}), ...(theme && ["ivory", "sage", "slate", "blue"].includes(theme.id) ? { palette: theme.id as Palette } : {}) });
  }, [update]);
  useEffect(() => {
    const root = document.documentElement;
    const theme = findBoardTheme(boardTheme);
    for (const key of ["--sq-light", "--sq-dark", "--sq-coord-light", "--sq-coord-dark"]) root.style.removeProperty(key);
    // High contrast keeps its own accessible board.
    if (theme && !settings.highContrast) for (const [key, value] of Object.entries(boardThemeVars(theme))) root.style.setProperty(key, value);
  }, [boardTheme, settings.highContrast]);
  const hapticLevel: HapticLevel = settings.haptics ? hapticStrength : "off";
  useEffect(() => configureHaptics(hapticLevel), [hapticLevel]);
  const setHapticLevel = useCallback((level: HapticLevel) => {
    if (level !== "off") {
      setHapticStrength(level);
      try { localStorage.setItem(HAPTIC_KEY, level); } catch { /* This visit only. */ }
    }
    // Apply before the next tap so a preview plays at the new strength.
    configureHaptics(level);
    if ((level !== "off") !== latest.current.haptics) update({ haptics: level !== "off" });
  }, [update]);
  useEffect(() => configureAudio(settings.sound, settings.volume, settings.experience.audio), [settings.sound, settings.volume, settings.experience.audio]);

  useEffect(() => {
    document.documentElement.dataset.palette = settings.palette;
    document.documentElement.dataset.contrast = settings.highContrast ? "high" : "normal";
    document.documentElement.dataset.motion = reducedMotion ? "reduced" : "full";
    const experience = settings.experience;
    const dark = experience.colorMode === "dark" || (experience.colorMode === "system" && systemDark);
    const root = document.documentElement;
    root.dataset.appearance = "classic";
    root.dataset.colorMode = experience.colorMode;
    root.dataset.tone = dark ? "dark" : "light";
    root.style.colorScheme = dark ? "dark" : "light";
    for (const [key, value] of Object.entries(themeTokens(dark))) root.style.setProperty(key, value);
    try { localStorage.setItem("cbc.theme.v1", JSON.stringify({ fingerprint: JSON.stringify(["classic", settings.palette]), light: themeTokens(false), dark: themeTokens(true) })); } catch { /* Optional first-paint cache. */ }
    if (settings.highContrast) { root.style.setProperty("--muted", dark ? "#eeeeee" : "#333333"); root.style.setProperty("--line", dark ? "#aaaaaa" : "#666666"); }
  }, [settings.palette, settings.highContrast, settings.experience, systemDark, reducedMotion]);


  const value = useMemo(() => ({ settings, update, updateExperience, syncsExperience: isAuthenticated && syncsExperience, reducedTransparency, reducedMotion, hapticLevel, setHapticLevel, chesscomSounds, setChesscomSounds, boardTheme, setBoardTheme }), [settings, update, updateExperience, isAuthenticated, syncsExperience, reducedTransparency, reducedMotion, hapticLevel, setHapticLevel, chesscomSounds, setChesscomSounds, boardTheme, setBoardTheme]);
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): Ctx {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings outside SettingsProvider");
  return ctx;
}
