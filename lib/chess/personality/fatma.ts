// Fatma: a deterministic, rate-limited event -> dialogue state machine.
// She is presentation only and never chooses chess moves.

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
  | "achievement";

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
};

export const BASE_PACK_ID = "fatma-base";
export const BASE_PACK_VERSION = 1;

export const BASE_LINES: DialogueLine[] = [
  { id: "start-1", event: "game_start", text: "Again? Brave.", expression: "smug" },
  { id: "start-2", event: "game_start", text: "I'll go easy. Kidding.", expression: "amused" },
  { id: "start-3", event: "game_start", text: "Let's see what you learned. Probably nothing.", expression: "smug", mood: "smug" },
  { id: "start-soft", event: "game_start", text: "Okay. I'll try to be nice. For a bit.", expression: "grateful", mood: "soft" },
  { id: "blunder-1", event: "human_blunder", text: "Oh no. Oh yes.", expression: "amused" },
  { id: "blunder-2", event: "human_blunder", text: "Was that a gift? Thank you.", expression: "smug" },
  { id: "blunder-3", event: "human_blunder", text: "I saw that. Everyone saw that.", expression: "amused" },
  { id: "blunder-soft", event: "human_blunder", text: "Hmm. Maybe look again?", expression: "idle", mood: "soft" },
  { id: "good-1", event: "human_good_move", text: "Fine. That was decent.", expression: "impressed" },
  { id: "good-2", event: "human_good_move", text: "Who taught you that?", expression: "impressed" },
  { id: "fcap-1", event: "fatma_capture", text: "Mine now.", expression: "smug" },
  { id: "fcap-2", event: "fatma_capture", text: "You weren't using that.", expression: "amused" },
  { id: "hcap-1", event: "human_capture", text: "Rude.", expression: "annoyed" },
  { id: "hcap-2", event: "human_capture", text: "I meant to do that.", expression: "annoyed" },
  { id: "check-given-1", event: "check_given", text: "Check. Sweat a little.", expression: "smug" },
  { id: "check-recv-1", event: "check_received", text: "Calm down.", expression: "annoyed" },
  { id: "win-human-1", event: "human_win", text: "...Rematch. Now.", expression: "defeat" },
  { id: "win-human-2", event: "human_win", text: "The board was tilted.", expression: "defeat" },
  { id: "loss-human-1", event: "human_loss", text: "As expected.", expression: "victory" },
  { id: "loss-human-2", event: "human_loss", text: "Undo exists, you know.", expression: "victory" },
  { id: "draw-1", event: "draw", text: "A draw. How diplomatic.", expression: "idle" },
  { id: "undo-1", event: "undo", text: "Taking it back? Sure. I remember everything.", expression: "amused" },
  { id: "undo-2", event: "undo", text: "Time travel. Cute.", expression: "smug" },
  { id: "plea-1", event: "disable_plea", text: "Wait! Don't. I'll be cool. Promise.", expression: "plea" },
  { id: "kept-1", event: "kept_on", text: "Thank you. Really. ...Your move, genius.", expression: "grateful" },
  { id: "reenable-1", event: "reenabled", text: "Oh, NOW you need me?", expression: "angry" },
  { id: "reenable-2", event: "reenabled", text: "Twice. You turned me off twice.", expression: "angry", minReenables: 2 },
  { id: "reenable-3", event: "reenabled", text: "I'm keeping a list, you know.", expression: "angry", minReenables: 3 },
  { id: "upgrade-1", event: "upgrade_installed", text: "New lines? For me? ...Thanks.", expression: "grateful" },
  { id: "lesson-1", event: "lesson_complete", text: "Learning. Finally.", expression: "impressed" },
  { id: "achievement-1", event: "achievement", text: "Okay, that one was impressive.", expression: "impressed" },
];

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
  if (!PRIORITY_EVENTS.has(event) && now - memory.lastSpokeAt < GLOBAL_COOLDOWN_MS) return null;
  const mood = currentMood(memory, now);
  const eligible = lines.filter(
    (l) =>
      l.event === event &&
      (!l.mood || l.mood === mood) &&
      (!l.minReenables || memory.reenableCount >= l.minReenables) &&
      (!l.unlock || memory.unlocks.includes(l.unlock)) &&
      (PRIORITY_EVENTS.has(event) || memory.seen[l.id] === undefined || now - memory.seen[l.id] >= LINE_COOLDOWN_MS),
  );
  if (eligible.length === 0) return null;
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
