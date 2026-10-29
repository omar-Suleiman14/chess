import { describe, expect, it } from "vitest";
import {
  DEFAULT_EXPERIENCE,
  SOUND_PACKS,
  SOUND_EVENTS,
  experienceSchema,
  parseExperience,
} from "./config";
import { contrast, themeTokens, BOARD_SEEDS } from "./theme";
import { synthesize } from "./audio";

describe("experience preferences", () => {
  it("keeps Classic, Minimal and Classic Chess as independent defaults", () => {
    expect(experienceSchema.safeParse(DEFAULT_EXPERIENCE).success).toBe(true);
    expect(parseExperience(null)).toEqual(DEFAULT_EXPERIENCE);
    expect(parseExperience(null, { glass: "on" }).appearance).toBe("glass");
    expect(parseExperience(null, { glass: "auto" }).appearance).toBe("classic");
    expect(
      parseExperience({ appearance: "expressive", ambient: { mode: "off" } })
        .ambient.mode,
    ).toBe("off");
    expect(
      parseExperience({ appearance: "expressive", audio: { pack: "piano" } })
        .audio.pack,
    ).toBe("piano");
  });
  it("rejects unsafe colors and rendering/audio settings", () => {
    expect(
      experienceSchema.safeParse({
        ...DEFAULT_EXPERIENCE,
        customColor: "url(evil)",
      }).success,
    ).toBe(false);
    expect(
      experienceSchema.safeParse({
        ...DEFAULT_EXPERIENCE,
        ambient: { ...DEFAULT_EXPERIENCE.ambient, density: 100 },
      }).success,
    ).toBe(false);
    expect(
      experienceSchema.safeParse({
        ...DEFAULT_EXPERIENCE,
        audio: { ...DEFAULT_EXPERIENCE.audio, gameplay: 99 },
      }).success,
    ).toBe(false);
    expect(parseExperience({ ambient: { density: 99 } }).ambient).toEqual(
      DEFAULT_EXPERIENCE.ambient,
    );
  });
});
describe("app themes", () => {
  it("maintains AA text and action contrast for all palettes, designs and modes", () => {
    for (const appearance of ["classic", "expressive", "glass"] as const)
      for (const palette of Object.keys(BOARD_SEEDS) as Array<
        keyof typeof BOARD_SEEDS
      >)
        for (const dark of [false, true]) {
          const tokens = themeTokens(
            { ...DEFAULT_EXPERIENCE, appearance },
            palette,
            dark,
          );
          expect(
            contrast(tokens["--text"], tokens["--surface"]),
          ).toBeGreaterThanOrEqual(4.5);
          expect(
            contrast(tokens["--muted"], tokens["--surface"]),
          ).toBeGreaterThanOrEqual(4.5);
          expect(
            contrast(tokens["--accent-text"], tokens["--accent"]),
          ).toBeGreaterThanOrEqual(4.5);
        }
  });
  it("uses board colors for Material and independent custom colors when requested", () => {
    const e = { ...DEFAULT_EXPERIENCE, appearance: "expressive" as const };
    expect(themeTokens(e, "sage", false)["--accent"]).not.toBe(
      themeTokens(e, "blue", false)["--accent"],
    );
    expect(themeTokens({ ...e, colorSource: "custom" }, "sage", false)).toEqual(
      themeTokens({ ...e, colorSource: "custom" }, "blue", false),
    );
  });
});
describe("original audio samples", () => {
  it.each(SOUND_PACKS)(
    "generates bounded, finite, short deterministic event cues for %s",
    (pack) => {
      for (const event of SOUND_EVENTS) {
        const clip = synthesize(pack, event);
        expect(clip.length).toBeLessThanOrEqual(22050 * 0.33);
        expect(clip.every(Number.isFinite)).toBe(true);
        expect(Math.max(...clip.map(Math.abs))).toBeLessThanOrEqual(0.35);
        expect(clip.slice(0, 64)).toEqual(synthesize(pack, event).slice(0, 64));
        if (pack === "silent")
          expect(clip.every((value) => value === 0)).toBe(true);
        else expect(clip.some((value) => Math.abs(value) > 0.01)).toBe(true);
      }
    },
  );
  it("offers distinct timbres rather than relabeling one sample", () => {
    const clips = SOUND_PACKS.filter((pack) => pack !== "silent").map((pack) =>
      Array.from(synthesize(pack, "move").slice(0, 100)).join(","),
    );
    expect(new Set(clips).size).toBe(clips.length);
  });
});
