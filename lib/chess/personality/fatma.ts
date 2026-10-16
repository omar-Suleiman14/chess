// Sherine: a deterministic, rate-limited event -> dialogue state machine.
// She is presentation only and never chooses chess moves.
import { linesFor } from "./lines";

export type FatmaEvent =
  | "game_start"
  | "human_blunder"
  | "human_good_move"
  | "fatma_capture"
  | "human_capture"
  | "check_given"
  | "check_received"
  | "human_win"
  | "human_loss"
  | "draw"
  | "undo"
  | "idle"
  | "disable_plea"
  | "kept_on"
  | "reenabled"
  | "upgrade_installed"
  | "lesson_complete"
  | "achievement"
  | "opening"
  | "human_castle"
  | "human_promote"
  | "poke";

export type Expression = "idle" | "thinking" | "smug" | "amused" | "annoyed" | "impressed" | "plea" | "angry" | "victory" | "defeat" | "grateful";

export type Mood = "smug" | "neutral" | "grudging" | "soft" | "sulking";

export type DialogueLine = {
  id: string;
  event: FatmaEvent;
  text: string;
  expression: Expression;
  /** Optional mood gate. */
  mood?: Mood;
  /** Minimum number of re-enables before this line can show (for grudges). */
  minReenables?: number;
  /** Requires this unlock id. */
  unlock?: string;
  /** Follow-up bubble shown right after, so she can hold a short conversation. */
  then?: string;
};

export const BASE_PACK_ID = "fatma-base";
export const BASE_PACK_VERSION = 1;

export const BASE_LINES: DialogueLine[] = linesFor("en");

export type FatmaMemory = {
  enabled: boolean;
  mood: Mood;
  disableCount: number;
  reenableCount: number;
  /** Line id -> last shown timestamp. */
  seen: Record<string, number>;
  lastSpokeAt: number;
  /** Until this time she is softened after being kept on. */
  softUntil: number;
  unlocks: string[];
};

export function initialMemory(): FatmaMemory {
  return { enabled: true, mood: "smug", disableCount: 0, reenableCount: 0, seen: {}, lastSpokeAt: 0, softUntil: 0, unlocks: [] };
}

export const GLOBAL_COOLDOWN_MS = 6_000;
export const LINE_COOLDOWN_MS = 3 * 60_000;

/** Events allowed even if the global cooldown has not elapsed. */
const PRIORITY_EVENTS = new Set<FatmaEvent>(["disable_plea", "kept_on", "reenabled", "human_win", "human_loss", "draw", "upgrade_installed"]);

export function currentMood(memory: FatmaMemory, now: number): Mood {
  if (now < memory.softUntil) return "soft";
  if (memory.reenableCount >= 3) return "sulking";
  if (memory.reenableCount >= 1 && now - memory.lastSpokeAt < 10 * 60_000) return "grudging";
  return memory.mood;
}

/**
 * Picks the line for an event or returns null (silenced, cooldown, nothing
 * eligible). Deterministic for a given `seed`.
 */
export function pickLine(
  memory: FatmaMemory,
  event: FatmaEvent,
  lines: DialogueLine[],
  now: number,
  seed: number,
): DialogueLine | null {
  if (!memory.enabled && event !== "disable_plea" && event !== "reenabled") return null;
  // A poke is the player talking to her: she always answers, without repeating herself if she can help it.
  const chatty = event === "poke";
  if (!PRIORITY_EVENTS.has(event) && !chatty && now - memory.lastSpokeAt < GLOBAL_COOLDOWN_MS) return null;
  const mood = currentMood(memory, now);
  const eligible = lines.filter(
    (l) =>
      l.event === event &&
      (!l.mood || l.mood === mood) &&
      (!l.minReenables || memory.reenableCount >= l.minReenables) &&
      (!l.unlock || memory.unlocks.includes(l.unlock)) &&
      (PRIORITY_EVENTS.has(event) || memory.seen[l.id] === undefined || now - memory.seen[l.id] >= LINE_COOLDOWN_MS),
  );
  if (eligible.length === 0) {
    if (!chatty) return null;
    const any = lines.filter((l) => l.event === event);
    return any.length ? any[Math.abs(seed) % any.length] : null;
  }
  // Prefer mood-specific and grudge lines, then rotate by seed.
  const specific = eligible.filter((l) => l.mood === mood || l.minReenables);
  const pool = specific.length > 0 ? specific.sort((a, b) => (b.minReenables ?? 0) - (a.minReenables ?? 0)) : eligible;
  if (specific.length > 0 && pool[0].minReenables) return pool[0];
  return pool[Math.abs(seed) % pool.length];
}

export function rememberLine(memory: FatmaMemory, line: DialogueLine, now: number): FatmaMemory {
  return { ...memory, lastSpokeAt: now, seen: { ...memory.seen, [line.id]: now } };
}

export function disable(memory: FatmaMemory): FatmaMemory {
  return { ...memory, enabled: false, disableCount: memory.disableCount + 1 };
}

export function keepOn(memory: FatmaMemory, now: number): FatmaMemory {
  return { ...memory, softUntil: now + 4 * 60_000 };
}

export function reenable(memory: FatmaMemory): FatmaMemory {
  return { ...memory, enabled: true, reenableCount: memory.reenableCount + 1, mood: "grudging" };
}

/** Sprite animation used for each expression (frame names from public/fatma/atlas.json). */
export const EXPRESSION_ANIMATION: Record<Expression, { animation: string; fps: number; loop: boolean }> = {
  idle: { animation: "idle", fps: 4, loop: true },
  thinking: { animation: "writing", fps: 5, loop: true },
  smug: { animation: "kissing", fps: 2, loop: false },
  amused: { animation: "jumpUp", fps: 6, loop: false },
  annoyed: { animation: "hurt", fps: 3, loop: false },
  impressed: { animation: "landing", fps: 3, loop: false },
  plea: { animation: "duck", fps: 3, loop: false },
  angry: { animation: "hurt", fps: 4, loop: false },
  victory: { animation: "run", fps: 10, loop: true },
  defeat: { animation: "dead", fps: 3, loop: false },
  grateful: { animation: "kissing", fps: 2, loop: false },
};
