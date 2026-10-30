import { describe, expect, it } from "vitest";
import {
  DEFAULT_EXPERIENCE,
  SOUND_PACKS,
  SOUND_EVENTS,
  experienceSchema,
  parseExperience,
} from "./config";
import { contrast, themeTokens } from "./theme";
import { synthesize } from "./audio";

describe("experience preferences", () => {
  it("keeps Classic, Minimal and Classic Chess as independent defaults", () => {
    expect(experienceSchema.safeParse(DEFAULT_EXPERIENCE).success).toBe(true);
    expect(parseExperience(null)).toEqual(DEFAULT_EXPERIENCE);
    expect(parseExperience({ appearance: "glass" }).appearance).toBe("classic");
    expect(parseExperience({ appearance: "expressive", colorMode: "dark" })).toMatchObject({ appearance: "classic", colorMode: "dark" });
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
describe("Classic theme", () => {
  it("maintains AA text and action contrast in light and dark", () => {
    for (const dark of [false, true]) {
      const tokens = themeTokens(dark);
      expect(contrast(tokens["--text"], tokens["--surface"])).toBeGreaterThanOrEqual(4.5);
      expect(contrast(tokens["--text"], tokens["--bg"])).toBeGreaterThanOrEqual(4.5);
      expect(contrast(tokens["--muted"], tokens["--surface"])).toBeGreaterThanOrEqual(4.5);
      expect(contrast(tokens["--muted"], tokens["--bg"])).toBeGreaterThanOrEqual(4.5);
      expect(contrast(tokens["--accent-text"], tokens["--accent"])).toBeGreaterThanOrEqual(4.5);
      // The brass accent marks "on" and "here"; it must read against surfaces.
      expect(contrast(tokens["--brand"], tokens["--surface"])).toBeGreaterThanOrEqual(3);
      expect(contrast(tokens["--switch-on"], tokens["--surface"])).toBeGreaterThanOrEqual(3);
    }
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
