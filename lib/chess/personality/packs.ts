// Fatma upgrade packs: data only. Validation rejects code, markup, URLs,
// oversized content and profanity. Packs can add lines and unlock expressions,
// never moves, engine settings, or remote assets.
import { z } from "zod";
import type { DialogueLine, Expression, FatmaEvent } from "./fatma";

// No eval-based JIT: our CSP forbids it, and zod's probe would be reported as a violation.
z.config({ jitless: true });

export const PACK_SCHEMA_VERSION = 1;
export const PACK_LIMITS = { lines: 40, text: 120, name: 40, description: 160 } as const;

const EVENTS = [
  "game_start", "human_blunder", "human_good_move", "fatma_capture", "human_capture", "check_given",
  "check_received", "human_win", "human_loss", "draw", "undo", "idle", "lesson_complete", "achievement",
] as const satisfies readonly FatmaEvent[];

const EXPRESSIONS = [
  "idle", "thinking", "smug", "amused", "annoyed", "impressed", "victory", "defeat", "grateful",
] as const satisfies readonly Expression[];

// Deliberately small; she is mean, not crude.
const BLOCKED_WORDS = ["fuck", "shit", "bitch", "cunt", "slut", "whore", "fag", "retard", "nigg", "kill yourself", "kys"];

const safeText = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(max)
    .refine((s) => !/[<>{}`\\]/.test(s), "No markup or code characters.")
    .refine((s) => !/https?:\/\/|www\.|data:|javascript:/i.test(s), "No links or URLs.")
    .refine((s) => !BLOCKED_WORDS.some((w) => s.toLowerCase().includes(w)), "Keep it sarcastic, not crude.");

export const packLineSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]{1,40}$/),
  event: z.enum(EVENTS),
  text: safeText(PACK_LIMITS.text),
  expression: z.enum(EXPRESSIONS),
});

export const packSchema = z.object({
  schemaVersion: z.literal(PACK_SCHEMA_VERSION),
  packId: z.string().regex(/^[a-z0-9-]{3,40}$/),
  version: z.number().int().min(1).max(1000),
  name: safeText(PACK_LIMITS.name),
  description: safeText(PACK_LIMITS.description),
  lines: z.array(packLineSchema).min(1).max(PACK_LIMITS.lines),
  /** Local sprite variants only (names of existing animations), no URLs. */
  unlockExpressions: z.array(z.enum(EXPRESSIONS)).max(EXPRESSIONS.length).optional(),
}).strict();

export type FatmaPack = z.infer<typeof packSchema>;

export type PackValidation = { ok: true; pack: FatmaPack } | { ok: false; errors: string[] };

export function validatePack(input: unknown): PackValidation {
  const parsed = packSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.issues.slice(0, 20).map((i) => `${i.path.join(".") || "pack"}: ${i.message}`) };
  }
  const ids = new Set<string>();
  for (const line of parsed.data.lines) {
    if (ids.has(line.id)) return { ok: false, errors: [`lines: duplicate id ${line.id}`] };
    ids.add(line.id);
  }
  if (parsed.data.packId === "fatma-base") return { ok: false, errors: ["packId: reserved"] };
  return { ok: true, pack: parsed.data };
}

/** Namespaces pack line ids so packs cannot shadow base lines. */
export function packLines(pack: Pick<FatmaPack, "packId" | "lines">): DialogueLine[] {
  return pack.lines.map((l) => ({ ...l, id: `${pack.packId}:${l.id}` }));
}
