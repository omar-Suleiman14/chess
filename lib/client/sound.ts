// Synthesised chess sounds (Web Audio). No sample files, so no asset licences.
// Moves are short filtered "wood" knocks rather than UI pops.

export type SoundName = "move" | "capture" | "check" | "castle" | "promote" | "mate" | "select" | "correct" | "wrong" | "sheet";

let ctx: AudioContext | null = null;
let noise: AudioBuffer | null = null;

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  return ctx;
}

/** Must be called from a user gesture once (iOS/Chrome autoplay policy). */
export function unlockAudio(): void {
  const c = audio();
  if (c && c.state === "suspended") void c.resume();
}

function noiseBuffer(c: AudioContext): AudioBuffer {
  if (noise) return noise;
  noise = c.createBuffer(1, Math.floor(c.sampleRate * 0.25), c.sampleRate);
  const data = noise.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 3);
  return noise;
}

function knock(c: AudioContext, at: number, volume: number, pitch: number, length = 0.09): void {
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c);
  const band = c.createBiquadFilter();
  band.type = "bandpass";
  band.frequency.value = pitch;
  band.Q.value = 2.2;
  const gain = c.createGain();
  gain.gain.setValueAtTime(0, at);
  gain.gain.linearRampToValueAtTime(volume, at + 0.003);
  gain.gain.exponentialRampToValueAtTime(0.0008, at + length);
  src.connect(band).connect(gain).connect(c.destination);
  src.start(at);
  src.stop(at + length + 0.02);
  // Low body thump.
  const osc = c.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(pitch / 7, at);
  osc.frequency.exponentialRampToValueAtTime(pitch / 12, at + length);
  const og = c.createGain();
  og.gain.setValueAtTime(volume * 0.5, at);
  og.gain.exponentialRampToValueAtTime(0.0008, at + length);
  osc.connect(og).connect(c.destination);
  osc.start(at);
  osc.stop(at + length + 0.02);
}

function tone(c: AudioContext, at: number, freq: number, volume: number, length: number, type: OscillatorType = "sine"): void {
  const osc = c.createOscillator();
  osc.type = type;
  osc.frequency.value = freq;
  const gain = c.createGain();
  gain.gain.setValueAtTime(0, at);
  gain.gain.linearRampToValueAtTime(volume, at + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0008, at + length);
  osc.connect(gain).connect(c.destination);
  osc.start(at);
  osc.stop(at + length + 0.05);
}

export function playSound(name: SoundName, volume = 0.7): void {
  const c = audio();
  if (!c || c.state !== "running" || volume <= 0) return;
  const t = c.currentTime + 0.005;
  const v = Math.min(1, volume);
  switch (name) {
    case "move":
      knock(c, t, 0.55 * v, 1500);
      break;
    case "capture":
      knock(c, t, 0.6 * v, 1300, 0.07);
      knock(c, t + 0.045, 0.45 * v, 900, 0.11);
      break;
    case "castle":
      knock(c, t, 0.5 * v, 1500);
      knock(c, t + 0.09, 0.45 * v, 1250);
      break;
    case "check":
      knock(c, t, 0.55 * v, 1500);
      tone(c, t + 0.02, 880, 0.08 * v, 0.25, "triangle");
      break;
    case "promote":
      knock(c, t, 0.5 * v, 1500);
      tone(c, t + 0.03, 660, 0.07 * v, 0.18);
      tone(c, t + 0.1, 990, 0.07 * v, 0.25);
      break;
    case "mate":
      knock(c, t, 0.6 * v, 1200, 0.12);
      tone(c, t + 0.05, 220, 0.1 * v, 0.9);
      tone(c, t + 0.05, 330, 0.07 * v, 0.9);
      break;
    case "select":
      knock(c, t, 0.12 * v, 2600, 0.03);
      break;
    case "correct":
      tone(c, t, 660, 0.08 * v, 0.15);
      tone(c, t + 0.09, 880, 0.08 * v, 0.3);
      break;
    case "wrong":
      tone(c, t, 220, 0.07 * v, 0.25, "triangle");
      break;
    case "sheet":
      knock(c, t, 0.08 * v, 3200, 0.025);
      break;
  }
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
