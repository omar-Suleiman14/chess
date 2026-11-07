import { describe, expect, it } from "vitest";
import { PUZZLES } from "@/lib/chess/puzzles";
import { applyLocalAttempt, EMPTY_STATS } from "./puzzleStats";

describe("local puzzle stats", () => {
  it("rates a puzzle once, keeps streaks and history", () => {
    const [a, b] = PUZZLES;
    const first = applyLocalAttempt(EMPTY_STATS, a.id, true);
    expect(first.rated).toBe(true);
    expect(first.stats).toMatchObject({ attempts: 1, solved: 1, streak: 1, bestStreak: 1 });
    expect(first.stats.history).toHaveLength(1);
    const repeat = applyLocalAttempt(first.stats, a.id, false);
    expect(repeat.rated).toBe(false);
    expect(repeat.stats.rating).toBe(first.stats.rating);
    const miss = applyLocalAttempt(first.stats, b.id, false);
    expect(miss.stats).toMatchObject({ streak: 0, bestStreak: 1, attempts: 2 });
    expect(miss.delta).toBeLessThan(0);
  });

  it("doesn't rate a puzzle that was only seen in Rush", () => {
    const seenOnly = { ...EMPTY_STATS, seen: [PUZZLES[0].id] };
    expect(applyLocalAttempt(seenOnly, PUZZLES[0].id, true).rated).toBe(true);
  });
});
