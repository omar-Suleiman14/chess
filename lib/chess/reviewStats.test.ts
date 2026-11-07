import { describe, expect, it } from "vitest";
import { DEFAULT_POSITION } from "./rules";
import { estimateGameRating, phaseAccuracy, phaseOf, verdictFor } from "./reviewStats";

describe("review stats", () => {
  it("splits the game into phases", () => {
    expect(phaseOf(DEFAULT_POSITION, 1)).toBe("opening");
    expect(phaseOf(DEFAULT_POSITION, 30)).toBe("middlegame");
    expect(phaseOf("8/5k2/8/8/8/8/2K1P3/8 w - - 0 60", 100)).toBe("endgame");
  });

  it("scores each side's phases from the evaluation swings", () => {
    const fens = [DEFAULT_POSITION, DEFAULT_POSITION, DEFAULT_POSITION];
    const acc = phaseAccuracy([{ cp: 20 }, { cp: 25 }, { cp: 700 }], fens);
    expect(acc.w.opening).toBeGreaterThan(95);
    expect(acc.b.opening).toBeLessThan(30);
    expect(acc.w.endgame).toBeNull();
  });

  it("turns accuracy into verdicts and a rough game rating", () => {
    expect(verdictFor(90)).toBe("excellent");
    expect(verdictFor(60)).toBe("inaccurate");
    expect(verdictFor(null)).toBeNull();
    expect(estimateGameRating(78.5)).toBeGreaterThan(900);
    expect(estimateGameRating(78.5)).toBeLessThan(1200);
    expect(estimateGameRating(95)!).toBeGreaterThan(estimateGameRating(70)!);
    expect(estimateGameRating(10)).toBe(100);
  });
});
