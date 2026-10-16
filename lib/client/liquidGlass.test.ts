import { describe, expect, it } from "vitest";
import { bezelDisplacements, displacementMap, specularMap, SURFACES } from "./liquidGlass";

describe("liquid glass optics", () => {
  it("surfaces start at the rim (0) and reach the flat top (1)", () => {
    for (const name of ["convexCircle", "convexSquircle"] as const) {
      expect(SURFACES[name](0)).toBeCloseTo(0);
      expect(SURFACES[name](1)).toBeCloseTo(1);
    }
  });

  it("a convex bezel bends rays most at the edge and not at all on the flat top", () => {
    const d = bezelDisplacements(60, 16, SURFACES.convexCircle, 1.5);
    expect(d).toHaveLength(128);
    expect(Math.abs(d[1])).toBeGreaterThan(Math.abs(d[100]));
    expect(Math.abs(d[127])).toBeLessThan(1);
  });

  it("glass with the same index as air does not refract", () => {
    const d = bezelDisplacements(60, 16, SURFACES.convexSquircle, 1);
    expect(Math.max(...d.map(Math.abs))).toBeLessThan(1e-6);
  });

  it("the map is neutral in the middle and pushes inward at the rim", () => {
    const profile = bezelDisplacements(40, 12, SURFACES.convexSquircle);
    const map = displacementMap({ width: 100, height: 40, radius: 20, bezelWidth: 12 }, profile);
    const px = (x: number, y: number) => Array.from(map.data.slice((y * map.width + x) * 4, (y * map.width + x) * 4 + 4));
    expect(px(50, 20)).toEqual([128, 128, 0, 255]);
    // Just inside the left edge, the sample moves right/inward: R differs from neutral.
    expect(px(1, 20)[0]).not.toBe(128);
    // Mirror-symmetric left/right.
    expect(Math.abs(px(1, 20)[0] - 128 + (px(98, 20)[0] - 128))).toBeLessThanOrEqual(1);
    expect(map.maxDisplacement).toBeGreaterThan(0);
  });

  it("the rim light is transparent away from the edge", () => {
    const spec = specularMap({ width: 80, height: 40, radius: 20, bezelWidth: 12 });
    expect(spec.data[(20 * 80 + 40) * 4 + 3]).toBe(0);
    expect(Math.max(...Array.from(spec.data.filter((_, i) => i % 4 === 3)))).toBeGreaterThan(0);
  });
});
