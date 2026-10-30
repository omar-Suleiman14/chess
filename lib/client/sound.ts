import type { Color } from "../chess/rules";
import { DEFAULT_EXPERIENCE, SOUND_EVENTS, type Experience, type SoundEvent, type SoundPack } from "../experience/config";
import { soundCategory, soundChannel, synthesize, type SoundChannel } from "../experience/audio";

export type SoundName = SoundEvent;
let preferences = { enabled: true, master: 0.7, audio: DEFAULT_EXPERIENCE.audio };
let ctx: AudioContext | null = null;
const buffers = new Map<string, AudioBuffer>();
const voices = new Set<AudioBufferSourceNode>();
const seen = new Map<string, number>();
let users = 0;
let disposeListeners: (() => void) | null = null;
let warmTimer: ReturnType<typeof setTimeout> | null = null;

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor = window.AudioContext;
    if (!Ctor) return null;
    ctx = new Ctor({ latencyHint: "interactive" });
  }
  return ctx;
}
function buffer(pack: SoundPack, event: SoundEvent): AudioBuffer | null {
  const context = audio();
  if (!context) return null;
  const key = `${pack}:${event}`;
  const existing = buffers.get(key);
  if (existing) return existing;
  const pcm = synthesize(pack, event);
  const next = context.createBuffer(1, pcm.length, 22050);
  next.getChannelData(0).set(pcm);
  buffers.set(key, next);
  if (buffers.size > 128) buffers.delete(buffers.keys().next().value!);
  return next;
}
/*
 * Optional "Chess.com" sounds for a personal setup. The browser loads them
 * straight from chess.com's own sound server when the player turns them on;
 * the files are never copied into this app, its repository or its builds.
 * Until they arrive (or if they can't load) the built-in cues play instead.
 */
const CHESSCOM_BASE = "https://images.chesscomfiles.com/chess-themes/sounds/_MP3_/default/";
const CHESSCOM_FILES: Partial<Record<SoundEvent, string>> = {
  move: "move-self", opponent_move: "move-opponent", capture: "capture", check: "move-check",
  castle: "castle", promote: "promote", premove_set: "premove", premove_execute: "premove",
  illegal: "illegal", start: "game-start", end: "game-end", victory: "game-end", defeat: "game-end",
  draw: "game-end", checkmate: "game-end", stalemate: "game-end", repetition: "game-end",
  insufficient: "game-end", lowtime: "tenseconds", notification: "notify", challenge: "notify", draw_offer: "notify",
};
let chesscom = false;
const chesscomBuffers = new Map<string, AudioBuffer>();
const chesscomElements = new Map<string, HTMLAudioElement>();
let chesscomLoading = false;
const chesscomClips = new Set<HTMLAudioElement>();

function loadChesscom(): void {
  if (chesscomLoading || typeof window === "undefined") return;
  chesscomLoading = true;
  const context = audio();
  for (const file of new Set(Object.values(CHESSCOM_FILES))) {
    const url = `${CHESSCOM_BASE}${file}.mp3`;
    // Decoded buffers play with no latency; if the server refuses CORS, fall back to an <audio> element.
    void fetch(url, { mode: "cors", credentials: "omit" })
      .then((response) => { if (!response.ok) throw new Error(String(response.status)); return response.arrayBuffer(); })
      .then((data) => { if (!context) throw new Error("no audio"); return context.decodeAudioData(data); })
      .then((decoded) => { chesscomBuffers.set(file, decoded); })
      .catch(() => {
        try {
          const element = new Audio(url);
          element.preload = "auto";
          chesscomElements.set(file, element);
        } catch { /* No audio elements: the built-in cue plays. */ }
      });
  }
}

/** Turn the streamed Chess.com sounds on or off for this device. */
export function configureChesscomSounds(on: boolean): void {
  chesscom = on;
  if (on) loadChesscom();
}

function playChesscom(name: SoundEvent, gain: number): boolean {
  const file = CHESSCOM_FILES[name];
  if (!chesscom || !file) return false;
  if (document.hidden) return true;
  const decoded = chesscomBuffers.get(file);
  const context = audio();
  // Same cap as the built-in sounds: fast scrubbing never piles up voices.
  if (voices.size + chesscomClips.size >= 6) {
    const oldest = voices.values().next().value;
    if (oldest) { try { oldest.stop(); } catch { /* Finished. */ } voices.delete(oldest); }
    else { const clip = chesscomClips.values().next().value; clip?.pause(); if (clip) chesscomClips.delete(clip); }
  }
  if (decoded && context && context.state === "running") {
    const source = context.createBufferSource();
    const node = context.createGain();
    source.buffer = decoded;
    node.gain.value = gain;
    source.connect(node).connect(context.destination);
    voices.add(source);
    source.onended = () => { voices.delete(source); source.disconnect(); node.disconnect(); };
    source.start();
    return true;
  }
  const element = chesscomElements.get(file);
  if (element) {
    const clip = element.cloneNode(true) as HTMLAudioElement;
    clip.volume = Math.max(0, Math.min(1, gain));
    chesscomClips.add(clip);
    clip.onended = () => chesscomClips.delete(clip);
    void clip.play().catch(() => chesscomClips.delete(clip));
    return true;
  }
  return false;
}

function warm(pack: SoundPack) {
  if (warmTimer) clearTimeout(warmTimer);
  let index = 0;
  const step = () => {
    if (!preferences.enabled || typeof document === "undefined" || document.hidden) return;
    buffer(pack, SOUND_EVENTS[index++]);
    if (index < SOUND_EVENTS.length) warmTimer = setTimeout(step, 12);
  };
  warmTimer = setTimeout(step, 100);
}
export function configureAudio(enabled: boolean, master: number, settings: Experience["audio"]): void {
  const changedPack = preferences.audio.pack !== settings.pack;
  preferences = { enabled, master, audio: settings };
  if (!enabled || settings.pack === "silent") {
    for (const voice of voices) { try { voice.stop(); } catch { /* Already stopped. */ } }
    voices.clear();
    if (warmTimer) clearTimeout(warmTimer);
  } else if (changedPack || buffers.size === 0) warm(settings.pack);
}
export function unlockAudio(): void {
  if (!preferences.enabled) return;
  const context = audio();
  if (!context) return;
  if (context.state !== "running") {
    void context.resume().catch(() => {});
    try {
      const source = context.createBufferSource();
      source.buffer = context.createBuffer(1, 1, 22050);
      source.connect(context.destination); source.start();
      source.onended = () => source.disconnect();
    } catch { /* Unsupported context never blocks a chess action. */ }
  }
}
/** Shared listeners are installed once and removed when the last gameplay consumer unmounts. */
export function installAudioUnlock(): () => void {
  users++;
  if (!disposeListeners && typeof document !== "undefined") {
    const events = ["pointerdown", "touchend", "keydown"] as const;
    const onGesture = () => unlockAudio();
    const onVisibility = () => {
      if (document.hidden) {
        for (const voice of voices) { try { voice.stop(); } catch { /* Finished. */ } }
        for (const clip of chesscomClips) clip.pause();
        chesscomClips.clear();
      }
    };
    events.forEach((event) => document.addEventListener(event, onGesture, { capture: true, passive: true }));
    document.addEventListener("visibilitychange", onVisibility);
    disposeListeners = () => { events.forEach((event) => document.removeEventListener(event, onGesture, true)); document.removeEventListener("visibilitychange", onVisibility); };
  }
  return () => {
    users = Math.max(0, users - 1);
    if (!users) { disposeListeners?.(); disposeListeners = null; }
  };
}
export function resultSound(result: string | null | undefined, player: Color | null, reason?: string | null): SoundName {
  if (reason === "checkmate") return "checkmate";
  if (reason === "stalemate") return "stalemate";
  if (reason === "threefold" || reason === "repetition") return "repetition";
  if (reason === "insufficient") return "insufficient";
  if (result === "1/2-1/2") return "draw";
  if (!player || (result !== "1-0" && result !== "0-1")) return "end";
  return (result === "1-0") === (player === "w") ? "victory" : "defeat";
}
/** No fetch/decode on the move path; cached original PCM cues last at most 320ms. */
export function playSound(name: SoundName, volume = preferences.master, options: { pack?: SoundPack; channel?: SoundChannel; key?: string; preview?: boolean } = {}): void {
  if (!preferences.enabled || volume <= 0 || typeof document === "undefined" || document.hidden) return;
  if (!options.preview && (preferences.audio.pack === "silent" || !preferences.audio[soundCategory(name)])) return;
  const pack = options.pack ?? preferences.audio.overrides[name] ?? preferences.audio.pack;
  if (pack === "silent") return;
  if (options.key) {
    if (seen.has(options.key)) return;
    seen.set(options.key, Date.now());
    if (seen.size > 256) seen.delete(seen.keys().next().value!);
  }
  if (!options.pack && !options.preview && playChesscom(name, Math.max(0, Math.min(1, volume)) * preferences.audio[options.channel ?? soundChannel(name)])) return;
  const context = audio();
  if (!context) return;
  const requested = performance.now();
  const play = () => {
    if (context.state !== "running" || performance.now() - requested > 120 || !preferences.enabled || document.hidden) return;
    const clip = buffer(pack, name);
    if (!clip) return;
    if (voices.size >= 6) { const oldest = voices.values().next().value; try { oldest?.stop(); } catch { /* Finished. */ } if (oldest) voices.delete(oldest); }
    const source = context.createBufferSource();
    const gain = context.createGain();
    source.buffer = clip;
    gain.gain.value = Math.max(0, Math.min(1, volume)) * preferences.audio[options.channel ?? soundChannel(name)];
    source.connect(gain).connect(context.destination);
    voices.add(source);
    source.onended = () => { voices.delete(source); source.disconnect(); gain.disconnect(); };
    source.start();
  };
  if (context.state === "running") play();
  else void context.resume().then(play).catch(() => {});
}
