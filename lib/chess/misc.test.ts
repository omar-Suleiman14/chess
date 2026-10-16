import { describe, expect, it } from "vitest";
import { checkFlag, initialClock, pressClock, remaining, startTurn, TIME_CONTROLS } from "./clock";
import { findMistakes, initialReview, scheduleReview } from "./lessons/adaptive";
import { ALL_STATIC_LESSONS, searchTopics } from "./lessons/curriculum";
import { gradeMove, hintFor, validateLesson, type Lesson } from "./lessons/schema";
import { disable, initialMemory, keepOn, pickLine, reenable, BASE_LINES, GLOBAL_COOLDOWN_MS } from "./personality/fatma";
import { validatePack } from "./personality/packs";
import { expectedScore, INITIAL_RATING, isProvisional, updateRating } from "./ratings/glicko2";

describe("Glicko-2", () => {
  it("matches Glickman's worked example", () => {
    const updated = updateRating({ rating: 1500, rd: 200, volatility: 0.06 }, [
      { opponent: { rating: 1400, rd: 30 }, score: 1 },
      { opponent: { rating: 1550, rd: 100 }, score: 0 },
      { opponent: { rating: 1700, rd: 300 }, score: 0 },
    ]);
    expect(updated.rating).toBeCloseTo(1464.06, 1);
    expect(updated.rd).toBeCloseTo(151.52, 1);
    expect(updated.volatility).toBeCloseTo(0.05999, 4);
  });

  it("starts provisional and grows RD when idle", () => {
    expect(isProvisional(INITIAL_RATING)).toBe(true);
    expect(updateRating({ rating: 1500, rd: 100, volatility: 0.06 }, []).rd).toBeGreaterThan(100);
    expect(expectedScore({ rating: 1500 }, { rating: 1500, rd: 50 })).toBeCloseTo(0.5);
  });
});

describe("clock", () => {
  it("applies increments, detects flags and survives pauses", () => {
    const tc = TIME_CONTROLS[0];
    let clock = startTurn(initialClock(tc), "w", 0);
    clock = pressClock(clock, "w", tc, 10_000);
    expect(clock.remainingMs.w).toBe(tc.initialMs - 10_000 + tc.incrementMs);
    expect(remaining(clock, "b", 15_000)).toBe(tc.initialMs - 5_000);
    clock = checkFlag(clock, 10_000 + tc.initialMs + 1);
    expect(clock.flagged).toBe("b");
  });
});

describe("lessons", () => {
  it("every built-in lesson validates and every line is legal", () => {
    for (const lesson of ALL_STATIC_LESSONS) {
      expect({ id: lesson.id, issues: validateLesson(lesson) }).toEqual({ id: lesson.id, issues: [] });
    }
  });

  it("grades multi-move lines with scripted replies", () => {
    const fork = ALL_STATIC_LESSONS.find((l) => l.id === "tactics-basics")!.steps[1];
    const first = gradeMove(fork, [], "b5c7");
    expect(first).toMatchObject({ kind: "continue", reply: "e8e7" });
    expect(gradeMove(fork, ["b5c7", "e8e7"], "c7a8").kind).toBe("complete");
    expect(gradeMove(fork, [], "b5d6").kind).toBe("wrong");
    expect(gradeMove(fork, [], "a1a2").kind).toBe("illegal");
  });

  it("accepts any mate for mate goals and explains stalemate", () => {
    const step = ALL_STATIC_LESSONS.find((l) => l.id === "mate-basics")!.steps[2];
    expect(gradeMove(step, [], "g1g7").kind).toBe("complete");
    const stalemate = gradeMove(step, [], "g1g6");
    expect(stalemate.kind === "wrong" && stalemate.explanation).toContain("stalemate");
  });

  it("gives progressively stronger hints", () => {
    const step = ALL_STATIC_LESSONS[0].steps[0];
    expect(hintFor(step, [], 0)).toContain("ranks");
    expect(hintFor(step, [], 1)).toContain("a4");
    expect(hintFor(step, [], 2)).toContain("h4");
  });

  it("rejects unsafe or illegal authored lessons", () => {
    const bad: Lesson = {
      id: "x", version: 1, title: "<script>", topic: "Bad Topic", summary: "see https://evil", source: "mcp",
      steps: [{ id: "1", fen: "8/8/8/8/8/8/8/8 w - - 0 1", prompt: "go", lines: [["e2e4"]], hints: [] }],
    };
    const issues = validateLesson(bad).map((i) => i.path);
    expect(issues).toEqual(expect.arrayContaining(["title", "topic", "summary", "steps[0].fen"]));
  });

  it("finds topics by name", () => {
    expect(searchTopics("Sicilian")[0].topic).toBe("sicilian-defense");
    expect(searchTopics("queen's gambit")[0].topic).toBe("queens-gambit");
  });

  it("turns analysed blunders into practice and ignores shallow analysis", () => {
    const fenBefore = "4k3/8/8/3q4/8/2N5/8/4K3 w - - 0 1";
    const base = { fenBefore, uci: "e1e2", san: "Ke2", ply: 1 };
    const deep = findMistakes([{ ...base, before: { score: { cp: 900 }, bestmove: "c3d5", depth: 14 }, after: { score: { cp: -600 }, depth: 14 } }], "w");
    expect(deep).toHaveLength(1);
    expect(deep[0]).toMatchObject({ best: "c3d5", kind: "blunder", theme: "material" });
    const shallow = findMistakes([{ ...base, before: { score: { cp: 900 }, bestmove: "c3d5", depth: 4 }, after: { score: { cp: -600 }, depth: 4 } }], "w");
    expect(shallow).toHaveLength(0);
  });

  it("schedules spaced repetition", () => {
    let r = initialReview(0);
    r = scheduleReview(r, "clean", 0);
    expect(r.box).toBe(1);
    r = scheduleReview(r, "clean", 0);
    expect(r.box).toBe(2);
    r = scheduleReview(r, "failed", 0);
    expect(r).toMatchObject({ box: 1, lapses: 1 });
  });
});

describe("Sherine", () => {
  it("is silent when disabled and rate-limited when enabled", () => {
    const off = disable(initialMemory());
    expect(pickLine(off, "human_blunder", BASE_LINES, 100_000, 1)).toBeNull();
    const on = { ...initialMemory(), lastSpokeAt: 100_000 };
    expect(pickLine(on, "human_blunder", BASE_LINES, 100_000 + GLOBAL_COOLDOWN_MS - 1, 1)).toBeNull();
    expect(pickLine(on, "human_blunder", BASE_LINES, 100_000 + GLOBAL_COOLDOWN_MS, 1)).not.toBeNull();
  });

  it("softens when kept on and holds a grudge when re-enabled", () => {
    const kept = keepOn(initialMemory(), 0);
    expect(pickLine(kept, "game_start", BASE_LINES, 60_000, 0)?.id).toBe("start-soft");
    const back = reenable(reenable(disable(disable(initialMemory()))));
    expect(pickLine(back, "reenabled", BASE_LINES, 1_000_000, 0)?.id).toBe("reenable-2");
  });

  it("validates upgrade packs and blocks code, links and slurs", () => {
    const good = {
      schemaVersion: 1, packId: "spicy-pack", version: 1, name: "Spicy", description: "More sass.",
      lines: [{ id: "a", event: "human_blunder", text: "Bold choice.", expression: "smug" }],
    };
    expect(validatePack(good).ok).toBe(true);
    expect(validatePack({ ...good, lines: [{ ...good.lines[0], text: "<img src=x onerror=alert(1)>" }] }).ok).toBe(false);
    expect(validatePack({ ...good, lines: [{ ...good.lines[0], text: "visit https://x.y" }] }).ok).toBe(false);
    expect(validatePack({ ...good, lines: [{ ...good.lines[0], text: "you shit" }] }).ok).toBe(false);
    expect(validatePack({ ...good, script: "alert(1)" }).ok).toBe(false);
    expect(validatePack({ ...good, packId: "fatma-base" }).ok).toBe(false);
  });
});
