import { z } from "zod";

z.config({ jitless: true });
export const SOUND_PACKS = [
  "classic",
  "piano",
  "electric-piano",
  "marimba",
  "xylophone",
  "celesta",
  "kalimba",
  "harp",
  "acoustic-guitar",
  "plucked-strings",
  "bells",
  "soft-percussion",
  "analog-synth",
  "wooden-board",
  "soft-mechanical",
  "ceramic",
  "clockwork",
  "minimal-click",
  "modern-digital",
  "arcade",
  "traditional-digital",
  "silent",
] as const;
export const SOUND_EVENTS = [
  "move",
  "opponent_move",
  "capture",
  "check",
  "checkmate",
  "stalemate",
  "repetition",
  "insufficient",
  "draw",
  "castle",
  "promote",
  "premove_set",
  "premove_execute",
  "illegal",
  "start",
  "victory",
  "defeat",
  "end",
  "lowtime",
  "notification",
  "draw_offer",
  "challenge",
  "select",
  "correct",
  "wrong",
  "sheet",
] as const;
export type SoundPack = (typeof SOUND_PACKS)[number];
export type SoundEvent = (typeof SOUND_EVENTS)[number];
export const soundPackSchema = z.enum(SOUND_PACKS);
const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const unit = z.number().min(0).max(1);
export const ambientSchema = z.object({
  mode: z.enum(["minimal", "ambient", "off"]),
  preset: z.enum(["calm", "competitive", "terminal", "expressive", "custom"]),
  intensity: z.enum(["low", "medium", "high"]),
  motion: z.enum(["subtle", "normal", "dynamic"]),
  interactive: z.boolean(),
  density: z.number().min(0.1).max(1),
  glyphs: z.enum(["notation", "chess", "mono", "mix"]),
  scale: z.number().min(0.7).max(1.8),
  speed: z.number().min(0.1).max(1.5),
  opacity: z.number().min(0.02).max(0.2),
  blur: z.number().min(0).max(2),
  tint: hex,
  syncBoard: z.boolean(),
  fps: z.union([z.literal(0), z.literal(15), z.literal(30), z.literal(60)]),
  adaptive: z.boolean(),
});
export const audioSchema = z.object({
  pack: soundPackSchema,
  gameplay: unit,
  ui: unit,
  banter: unit,
  moves: z.boolean(),
  captures: z.boolean(),
  checks: z.boolean(),
  endings: z.boolean(),
  clocks: z.boolean(),
  notifications: z.boolean(),
  overrides: z.partialRecord(z.enum(SOUND_EVENTS), z.enum(SOUND_PACKS)),
});
export const experienceSchema = z.object({
  version: z.literal(1),
  /**
   * Classic is the only design. The retired values stay in the stored schema so
   * older account rows remain valid; parseExperience always resolves to Classic.
   */
  appearance: z.enum(["classic", "expressive", "glass"]),
  colorMode: z.enum(["light", "dark", "system"]),
  /** Retired with Material / Liquid Glass; kept for stored-row compatibility. */
  colorSource: z.enum(["board", "custom"]),
  customColor: hex,
  glassQuality: z.enum(["full", "balanced", "minimal"]),
  ambient: ambientSchema,
  audio: audioSchema,
});
export type Experience = z.infer<typeof experienceSchema>;
export type AmbientSettings = Experience["ambient"];
export const DEFAULT_AMBIENT: AmbientSettings = {
  mode: "minimal",
  preset: "calm",
  intensity: "low",
  motion: "subtle",
  interactive: true,
  density: 0.3,
  glyphs: "mix",
  scale: 1,
  speed: 0.4,
  opacity: 0.07,
  blur: 0,
  tint: "#6b7068",
  syncBoard: true,
  fps: 30,
  adaptive: true,
};
export const DEFAULT_EXPERIENCE: Experience = {
  version: 1,
  appearance: "classic",
  colorMode: "light",
  colorSource: "board",
  customColor: "#6750a4",
  glassQuality: "balanced",
  ambient: DEFAULT_AMBIENT,
  audio: {
    pack: "classic",
    gameplay: 0.8,
    ui: 0.45,
    banter: 0.25,
    moves: true,
    captures: true,
    checks: true,
    endings: true,
    clocks: true,
    notifications: true,
    overrides: {},
  },
};

/** Fill old/partial saves, then validate each dimension independently. */
export function parseExperience(
  value: unknown,
  legacy: { livingBackground?: unknown } = {},
): Experience {
  const data: Record<string, unknown> =
    value && typeof value === "object"
      ? Object.fromEntries(Object.entries(value))
      : {};
  const primitive = experienceSchema
    .omit({ ambient: true, audio: true })
    .safeParse({ ...DEFAULT_EXPERIENCE, ...data });
  const ambient = ambientSchema.safeParse({
    ...DEFAULT_AMBIENT,
    ...(legacy.livingBackground === true ? { mode: "ambient" } : {}),
    ...(data.ambient && typeof data.ambient === "object" ? data.ambient : {}),
  });
  const audio = audioSchema.safeParse({
    ...DEFAULT_EXPERIENCE.audio,
    ...(data.audio && typeof data.audio === "object" ? data.audio : {}),
  });
  return {
    ...(primitive.success ? primitive.data : DEFAULT_EXPERIENCE),
    // Old Material / Liquid Glass selections resolve to Classic.
    appearance: "classic",
    colorSource: "board",
    glassQuality: "balanced",
    ambient: ambient.success ? ambient.data : DEFAULT_AMBIENT,
    audio: audio.success ? audio.data : DEFAULT_EXPERIENCE.audio,
  };
}

export const AMBIENT_PRESETS: Record<
  Exclude<AmbientSettings["preset"], "custom">,
  Partial<AmbientSettings>
> = {
  calm: {
    intensity: "low",
    motion: "subtle",
    density: 0.3,
    speed: 0.4,
    opacity: 0.07,
    glyphs: "mix",
    fps: 30,
  },
  competitive: {
    intensity: "low",
    motion: "subtle",
    density: 0.15,
    speed: 0.2,
    opacity: 0.04,
    glyphs: "notation",
    fps: 15,
  },
  terminal: {
    intensity: "medium",
    motion: "normal",
    density: 0.45,
    speed: 0.6,
    opacity: 0.1,
    glyphs: "mono",
    tint: "#3b8c62",
    syncBoard: false,
    fps: 30,
  },
  expressive: {
    intensity: "medium",
    motion: "dynamic",
    density: 0.5,
    speed: 0.8,
    opacity: 0.1,
    glyphs: "mix",
    fps: 30,
  },
};
