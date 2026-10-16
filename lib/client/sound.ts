// Recorded chess sounds (Lichess "standard" set, AGPL-3.0-or-later, see
// THIRD_PARTY_NOTICES.md), decoded once into Web Audio buffers so playback is
// instant and overlapping moves never cut each other off.

export type SoundName = "move" | "capture" | "check" | "castle" | "promote" | "mate" | "end" | "select" | "correct" | "wrong" | "lowtime" | "sheet";

const FILES: Record<string, string> = {
  move: "/sounds/standard/Move.mp3",
  capture: "/sounds/standard/Capture.mp3",
  notify: "/sounds/standard/GenericNotify.mp3",
  select: "/sounds/standard/Select.mp3",
  confirm: "/sounds/standard/Confirmation.mp3",
  error: "/sounds/standard/Error.mp3",
  lowtime: "/sounds/standard/LowTime.mp3",
};

// Which recording each game event uses, and its relative loudness.
const MAP: Record<SoundName, [keyof typeof FILES, number] | null> = {
  move: ["move", 1],
  castle: ["move", 1],
  promote: ["move", 1],
  check: ["move", 1],
  capture: ["capture", 1],
  mate: ["notify", 0.8],
  end: ["notify", 0.8],
  select: null, // silent: picking a piece up shouldn't click
  correct: ["confirm", 0.7],
  wrong: ["error", 0.5],
  lowtime: ["lowtime", 0.8],
  sheet: null,
};

let ctx: AudioContext | null = null;
const buffers = new Map<string, AudioBuffer>();
let loading: Promise<void> | null = null;

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  return ctx;
}

function load(): Promise<void> {
  const c = audio();
  if (!c) return Promise.resolve();
  if (!loading) {
    loading = Promise.all(
      Object.entries(FILES).map(async ([name, url]) => {
        try {
          const data = await (await fetch(url)).arrayBuffer();
          buffers.set(name, await c.decodeAudioData(data));
        } catch {
          // A missing sound must never break play.
        }
      }),
    ).then(() => undefined);
  }
  return loading;
}

/** Call from a user gesture (iOS/Chrome autoplay policy). Also starts decoding. */
export function unlockAudio(): void {
  const c = audio();
  if (!c) return;
  if (c.state !== "running") {
    void c.resume().catch(() => {});
    // iOS only truly unlocks once something plays inside the gesture itself.
    try {
      const source = c.createBufferSource();
      source.buffer = c.createBuffer(1, 1, 22050);
      source.connect(c.destination);
      source.start(0);
    } catch {
      // ignore
    }
  }
  void load();
}

let unlockInstalled = false;

/**
 * Unlock audio on the very first touch/click/key anywhere on the page, so the
 * opening move sounds even when it is made by dragging (pointerup alone does
 * not count as a gesture on iOS) or when Fatma moves first.
 */
export function installAudioUnlock(): void {
  if (unlockInstalled || typeof document === "undefined") return;
  unlockInstalled = true;
  const events = ["pointerdown", "touchend", "click", "keydown"] as const;
  const onGesture = () => {
    unlockAudio();
    if (ctx?.state === "running") events.forEach((e) => document.removeEventListener(e, onGesture, true));
  };
  events.forEach((e) => document.addEventListener(e, onGesture, { capture: true, passive: true }));
}

// A sound that only becomes playable later (cold buffers, context still
// resuming) is dropped once it is this late: a stale click is worse than none.
const MAX_LATENCY_MS = 600;

export function playSound(name: SoundName, volume = 0.7): void {
  const entry = MAP[name];
  const c = audio();
  if (!entry || !c || volume <= 0) return;
  const requested = Date.now();
  const resumed = c.state === "running" ? Promise.resolve() : c.resume().catch(() => {});
  const [file, level] = entry;
  const start = () => {
    const buffer = buffers.get(file);
    if (!buffer || c.state !== "running" || Date.now() - requested > MAX_LATENCY_MS) return;
    const source = c.createBufferSource();
    source.buffer = buffer;
    const gain = c.createGain();
    gain.gain.value = Math.min(1, volume * level);
    source.connect(gain).connect(c.destination);
    source.start();
  };
  if (buffers.has(file) && c.state === "running") start();
  else void Promise.all([resumed, load()]).then(start);
}

export function haptic(pattern: number | number[]): void {
  // iOS Safari has no Vibration API; this is a no-op there.
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    try {
      navigator.vibrate(pattern);
    } catch {
      // ignore
    }
  }
}
