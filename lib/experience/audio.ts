import type { SoundEvent, SoundPack } from "./config";

export const PACK_LABELS: Record<SoundPack, string> = {
  classic: "Classic Chess",
  piano: "Piano",
  "electric-piano": "Electric Piano",
  marimba: "Marimba",
  xylophone: "Xylophone",
  celesta: "Celesta",
  kalimba: "Kalimba",
  harp: "Harp",
  "acoustic-guitar": "Acoustic Guitar",
  "plucked-strings": "Plucked Strings",
  bells: "Bells & Chimes",
  "soft-percussion": "Soft Percussion",
  "analog-synth": "Analog Synth",
  "wooden-board": "Wooden Board",
  "soft-mechanical": "Soft Mechanical",
  ceramic: "Ceramic",
  clockwork: "Vintage Clockwork",
  "minimal-click": "Minimal Click",
  "modern-digital": "Modern Digital",
  arcade: "Arcade",
  "traditional-digital": "Traditional Digital Chess",
  silent: "Silent",
};
export type SoundChannel = "gameplay" | "ui" | "banter";
export function soundCategory(
  event: SoundEvent,
): "moves" | "captures" | "checks" | "endings" | "clocks" | "notifications" {
  if (
    [
      "victory",
      "defeat",
      "draw",
      "end",
      "checkmate",
      "stalemate",
      "repetition",
      "insufficient",
    ].includes(event)
  )
    return "endings";
  if (event === "capture") return "captures";
  if (event === "check") return "checks";
  if (event === "lowtime") return "clocks";
  if (
    [
      "notification",
      "draw_offer",
      "challenge",
      "select",
      "correct",
      "wrong",
      "sheet",
    ].includes(event)
  )
    return "notifications";
  return "moves";
}
export const soundChannel = (event: SoundEvent): SoundChannel =>
  soundCategory(event) === "notifications" ? "ui" : "gameplay";

const EVENT_VOICE: Record<
  SoundEvent,
  { hz: number; seconds: number; level: number; interval?: number }
> = {
  move: { hz: 330, seconds: 0.085, level: 0.55 },
  opponent_move: { hz: 294, seconds: 0.085, level: 0.52 },
  capture: { hz: 220, seconds: 0.12, level: 0.68 },
  check: { hz: 466, seconds: 0.16, level: 0.56, interval: 1.06 },
  checkmate: { hz: 392, seconds: 0.32, level: 0.66, interval: 1.5 },
  stalemate: { hz: 277, seconds: 0.27, level: 0.55, interval: 1.33 },
  repetition: { hz: 261, seconds: 0.24, level: 0.5, interval: 1.125 },
  insufficient: { hz: 247, seconds: 0.24, level: 0.5, interval: 1.25 },
  draw: { hz: 294, seconds: 0.25, level: 0.52, interval: 1.33 },
  castle: { hz: 349, seconds: 0.14, level: 0.58, interval: 1.5 },
  promote: { hz: 523, seconds: 0.22, level: 0.64, interval: 2 },
  premove_set: { hz: 440, seconds: 0.05, level: 0.28 },
  premove_execute: { hz: 370, seconds: 0.09, level: 0.55 },
  illegal: { hz: 155, seconds: 0.09, level: 0.4 },
  start: { hz: 392, seconds: 0.24, level: 0.48, interval: 1.5 },
  victory: { hz: 440, seconds: 0.3, level: 0.65, interval: 1.5 },
  defeat: { hz: 196, seconds: 0.29, level: 0.58, interval: 0.75 },
  end: { hz: 247, seconds: 0.18, level: 0.45 },
  lowtime: { hz: 587, seconds: 0.1, level: 0.55, interval: 1.06 },
  notification: { hz: 659, seconds: 0.13, level: 0.4 },
  draw_offer: { hz: 349, seconds: 0.15, level: 0.4, interval: 1.33 },
  challenge: { hz: 523, seconds: 0.18, level: 0.45, interval: 1.5 },
  select: { hz: 660, seconds: 0.045, level: 0.18 },
  correct: { hz: 523, seconds: 0.18, level: 0.5, interval: 1.25 },
  wrong: { hz: 175, seconds: 0.09, level: 0.38 },
  sheet: { hz: 392, seconds: 0.055, level: 0.16 },
};

/** Original deterministic instrument-inspired SFX. No recordings or third-party samples. */
export function synthesize(
  pack: SoundPack,
  event: SoundEvent,
  sampleRate = 22050,
): Float32Array {
  const voice = EVENT_VOICE[event];
  const out = new Float32Array(Math.ceil(voice.seconds * sampleRate));
  if (pack === "silent") return out;
  let seed = 1977 + event.length * 101 + pack.length;
  let peak = 0;
  for (let i = 0; i < out.length; i++) {
    const t = i / sampleRate;
    const u = t / voice.seconds;
    const phase = 2 * Math.PI * voice.hz * t;
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const noise = seed / 2147483648 - 1;
    const decay = Math.exp(-5 * u);
    const attack = Math.min(1, t / 0.004);
    const sine = (ratio = 1) => Math.sin(phase * ratio);
    let value;
    switch (pack) {
      case "piano":
        value =
          sine() + 0.4 * sine(2.001) * Math.exp(-8 * u) + 0.18 * sine(3.005);
        break;
      case "electric-piano":
        value = Math.sin(phase + Math.sin(phase * 2) * Math.exp(-3 * u) * 1.7);
        break;
      case "marimba":
        value = sine() + 0.4 * sine(4) * Math.exp(-12 * u);
        break;
      case "xylophone":
        value = sine() + 0.5 * sine(3) * Math.exp(-6 * u) + 0.25 * sine(6);
        break;
      case "celesta":
        value = sine(2) + 0.5 * sine(5.02) * Math.exp(-4 * u);
        break;
      case "kalimba":
        value = sine(1) + 0.6 * sine(2.76) * Math.exp(-11 * u);
        break;
      case "harp":
        value =
          sine() +
          0.3 * sine(2) +
          0.15 * sine(3) +
          noise * Math.exp(-45 * u) * 0.25;
        break;
      case "acoustic-guitar":
        value =
          sine() +
          0.55 * sine(2) * Math.exp(-3 * u) +
          0.3 * sine(3) * Math.exp(-6 * u) +
          noise * Math.exp(-30 * u) * 0.3;
        break;
      case "plucked-strings":
        value = sine() + 0.35 * sine(3) + 0.12 * sine(5);
        break;
      case "bells":
        value = sine() + 0.5 * sine(2.76) + 0.25 * sine(5.4);
        break;
      case "analog-synth":
        value = sine() + 0.25 * sine(2) + 0.12 * sine(3);
        break;
      case "ceramic":
        value = sine(2.1) + 0.3 * sine(4.9) + noise * Math.exp(-18 * u) * 0.2;
        break;
      case "clockwork":
        value =
          noise * Math.exp(-25 * u) +
          0.5 * sine(4) * Math.exp(-12 * u) +
          (u > 0.2 ? Math.exp(-70 * (u - 0.2)) * sine(3) : 0);
        break;
      case "minimal-click":
        value = (noise * 0.7 + sine(3) * 0.3) * Math.exp(-35 * u);
        break;
      case "soft-mechanical":
        value = noise * Math.exp(-18 * u) + sine(0.6) * Math.exp(-9 * u) * 0.6;
        break;
      case "soft-percussion":
        value =
          noise * Math.exp(-8 * u) * 0.7 + Math.sin(phase * (1 - 0.25 * u));
        break;
      case "modern-digital":
        value = sine(2) * (0.7 + 0.3 * sine(0.05));
        break;
      case "traditional-digital":
        value = sine() + 0.2 * sine(4) + 0.3 * noise * Math.exp(-25 * u);
        break;
      case "arcade":
        value = Math.tanh(sine() * 2) * 0.7 + 0.2 * sine(2);
        break;
      case "wooden-board":
        value = sine(0.5) * Math.exp(-12 * u) + 0.8 * noise * Math.exp(-18 * u);
        break;
      case "classic":
        value =
          sine(0.7) * 0.7 +
          noise * Math.exp(-20 * u) * 0.6 +
          sine(2.4) * Math.exp(-13 * u) * 0.2;
        break;
      default:
        value = 0;
    }
    if (voice.interval)
      value += sine(voice.interval) * 0.5 * Math.min(1, u * 8);
    value *= attack * decay * Math.min(1, (1 - u) * 30);
    out[i] = value;
    peak = Math.max(peak, Math.abs(value));
  }
  // Consistent peak ceiling and short tails prevent pack changes causing loudness spikes.
  if (peak > 0)
    for (let i = 0; i < out.length; i++)
      out[i] = (out[i] / peak) * voice.level * 0.5;
  return out;
}
