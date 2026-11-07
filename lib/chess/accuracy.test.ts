import { describe, expect, it } from "vitest";
import { gameAccuracy, moveAccuracy, winPercent } from "./accuracy";

describe("accuracy", () => {
  it("maps evaluations to win percent", () => {
    expect(winPercent({ cp: 0 })).toBeCloseTo(50);
    expect(winPercent({ cp: 300 })).toBeGreaterThan(75);
    expect(winPercent({ mate: 3 })).toBe(100);
    expect(winPercent({ mate: -2 })).toBe(0);
  });

  it("scores a perfect move near 100 and a blunder low", () => {
    expect(moveAccuracy(60, 60)).toBeCloseTo(100, 0);
    expect(moveAccuracy(60, 10)).toBeLessThan(15);
  });

  it("averages per side and skips unanalysed moves", () => {
    // White keeps the balance; Black blunders on its first move.
    const acc = gameAccuracy([{ cp: 20 }, { cp: 20 }, { cp: 600 }, { cp: 590 }, undefined]);
    expect(acc.w).toBeGreaterThan(95);
    expect(acc.b).toBeLessThan(30);
    expect(gameAccuracy([{ cp: 0 }])).toEqual({ w: null, b: null });
  });
});
