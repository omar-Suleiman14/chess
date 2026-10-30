/**
 * One haptic service for the whole app. UI and board code emit semantic
 * events ("capture", "check"…) and never touch platform APIs directly.
 *
 * Runtimes, best first:
 * 1. Native shell bridge (window.webkit.messageHandlers.cbcHaptics), if Chess
 *    by Chaos is ever wrapped in an iOS app: real UIFeedbackGenerator taps.
 * 2. Vibration API (Android Chromium, some desktop touch devices). Patterns
 *    differ per event so a capture feels different from a quiet move.
 * 3. iPhone Safari 18+: toggling a hidden `<input switch>` makes WebKit play
 *    its own light selection tap. It is undocumented, fires only close to a
 *    tap, and has one strength, so it is best effort and fails silently.
 * Anything else does nothing; sound and visuals still carry the feedback.
 */

export type HapticEvent =
  | "select" // picking up a piece, tab switch, toggles
  | "move" // your quiet move lands
  | "opponent" // the other side's quiet move
  | "capture"
  | "check"
  | "castle"
  | "promote"
  | "premove" // a premove is queued
  | "illegal"
  | "warning" // low time, draw offer
  | "success" // you win, a challenge is sent
  | "defeat"
  | "draw";

export type HapticLevel = "off" | "subtle" | "standard";
export type HapticSupport = "native" | "vibrate" | "ios-tick" | "none";

/** Vibration patterns (ms) at Standard. Subtle scales them down. */
const PATTERNS: Record<HapticEvent, number | number[]> = {
  select: 6,
  move: 10,
  opponent: 7,
  capture: [14, 28, 10],
  check: [18, 40, 18],
  castle: [9, 36, 9],
  promote: [10, 30, 10, 30, 16],
  premove: 5,
  illegal: [22, 45, 22],
  warning: [30, 60, 30],
  success: [12, 50, 12, 50, 26],
  defeat: [40, 70, 20],
  draw: [14, 60, 14],
};

/** iOS ticks: how many light taps (spaced) express each event. */
const TICKS: Record<HapticEvent, number> = {
  select: 1,
  move: 1,
  opponent: 1,
  capture: 2,
  check: 2,
  castle: 2,
  promote: 3,
  premove: 1,
  illegal: 3,
  warning: 2,
  success: 3,
  defeat: 2,
  draw: 2,
};

/** Native bridge names, for a future iOS shell. */
const NATIVE: Record<HapticEvent, string> = {
  select: "selection",
  move: "impact-light",
  opponent: "impact-soft",
  capture: "impact-medium",
  check: "impact-rigid",
  castle: "impact-medium",
  promote: "notification-success",
  premove: "selection",
  illegal: "notification-error",
  warning: "notification-warning",
  success: "notification-success",
  defeat: "notification-error",
  draw: "notification-warning",
};

/** Events dropped at Subtle, so it really is quieter. */
const SUBTLE_SKIPS = new Set<HapticEvent>(["opponent", "premove"]);
const MIN_GAP_MS = 45;
const TICK_GAP_MS = 90;

let level: HapticLevel = "standard";
let lastAt = 0;
let lastKeys = new Map<string, number>();
let support: HapticSupport | null = null;

type NativeBridge = { postMessage: (message: unknown) => void };
type WindowWithBridge = Window & { webkit?: { messageHandlers?: { cbcHaptics?: NativeBridge } } };

function nativeBridge(): NativeBridge | null {
  if (typeof window === "undefined") return null;
  return (window as WindowWithBridge).webkit?.messageHandlers?.cbcHaptics ?? null;
}

function isAppleTouch(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /iP(hone|ad|od)/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

/** What this device can actually do. Cached: hardware does not change mid-visit. */
export function hapticSupport(): HapticSupport {
  if (support) return support;
  if (typeof window === "undefined") return "none";
  if (nativeBridge()) support = "native";
  else if (typeof navigator.vibrate === "function" && !isAppleTouch()) support = "vibrate";
  else if (isAppleTouch() && typeof HTMLInputElement !== "undefined" && "switch" in HTMLInputElement.prototype) support = "ios-tick";
  else support = "none";
  return support;
}

/** Test hook: forget the cached capability and throttling. */
export function resetHapticsForTests(): void {
  support = null;
  lastAt = 0;
  lastKeys = new Map();
  level = "standard";
}

export function configureHaptics(next: HapticLevel): void {
  level = next;
  if (next === "off" && typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
    // Off takes effect immediately, even mid-pattern.
    try { navigator.vibrate(0); } catch { /* Unsupported. */ }
  }
}

export function scalePattern(pattern: number | number[], factor: number): number | number[] {
  if (factor === 1) return pattern;
  // Only pulses shrink; pauses keep their rhythm.
  if (typeof pattern === "number") return Math.max(4, Math.round(pattern * factor));
  return pattern.map((ms, i) => (i % 2 === 0 ? Math.max(4, Math.round(ms * factor)) : ms));
}

function iosTick(): void {
  try {
    const label = document.createElement("label");
    label.ariaHidden = "true";
    label.style.display = "none";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.setAttribute("switch", "");
    input.tabIndex = -1;
    label.appendChild(input);
    document.head.appendChild(label);
    label.click();
    label.remove();
  } catch {
    // Never let feedback break a move.
  }
}

/**
 * Play one semantic haptic. `key` makes an event fire once even if a
 * component re-renders or an effect re-runs (e.g. `move:<nodeKey>`).
 */
export function haptic(event: HapticEvent, options: { key?: string; force?: boolean } = {}): void {
  if (level === "off" && !options.force) return;
  if (level === "subtle" && SUBTLE_SKIPS.has(event) && !options.force) return;
  if (typeof window === "undefined") return;
  if (options.key) {
    if (lastKeys.has(options.key)) return;
    lastKeys.set(options.key, Date.now());
    if (lastKeys.size > 128) lastKeys.delete(lastKeys.keys().next().value!);
  }
  const now = performance.now();
  // Rapid repeats (scrubbing, double taps) collapse into one tap.
  if (now - lastAt < MIN_GAP_MS && event === "select") return;
  lastAt = now;
  const kind = hapticSupport();
  if (kind === "native") {
    try { nativeBridge()?.postMessage({ type: NATIVE[event], intensity: level === "subtle" ? 0.6 : 1 }); } catch { /* Bridge gone. */ }
  } else if (kind === "vibrate") {
    try { navigator.vibrate(scalePattern(PATTERNS[event], level === "subtle" ? 0.6 : 1)); } catch { /* Blocked before a gesture. */ }
  } else if (kind === "ios-tick") {
    const ticks = level === "subtle" ? 1 : TICKS[event];
    iosTick();
    for (let i = 1; i < ticks; i++) setTimeout(iosTick, i * TICK_GAP_MS);
  }
}

/** Plain-language status for Settings. Never claims more than the device does. */
export function hapticSupportText(kind: HapticSupport): string {
  switch (kind) {
    case "native": return "Using this device's Taptic Engine.";
    case "vibrate": return "Supported on this device.";
    case "ios-tick": return "iPhone: light taps on your own moves and taps (Safari limits web haptics).";
    default: return "This browser doesn't allow haptics. Sound and visuals still give feedback.";
  }
}
