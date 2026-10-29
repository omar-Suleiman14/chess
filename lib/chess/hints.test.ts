import { describe, expect, it } from "vitest";
import { buildHint } from "./hints";
import { DEFAULT_POSITION } from "./rules";

describe("three-stage hint evidence", () => {
  it("requires sufficient current-position legal evidence", () => {
    expect(buildHint(DEFAULT_POSITION, "e2e4", 9, "en")).toBeNull();
    expect(buildHint(DEFAULT_POSITION, "e2e5", 20, "en")).toBeNull();
    expect(buildHint(DEFAULT_POSITION, null, 20, "en")).toBeNull();
    expect(buildHint(DEFAULT_POSITION, "e2e4", 12, "en")?.highlight).toContain("e2");
    expect(buildHint(DEFAULT_POSITION, "e2e4", 12, "en")?.clue).not.toContain("e4");
  });
  it.each(["en", "egy", "franco"] as const)("handles special moves with brief factual wording in %s", (language) => {
    const ep = buildHint("7k/8/8/3pP3/8/8/8/7K w - d6 0 1", "e5d6", 15, language);
    expect(ep?.move.captured).toBe("p");
    const promotion = buildHint("7k/P7/8/8/8/8/8/7K w - - 0 1", "a7a8q", 15, language);
    expect(promotion?.move.promotion).toBe("q");
    const castle = buildHint("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1", "e1g1", 15, language);
    expect(castle?.move.san).toBe("O-O");
    for (const hint of [ep, promotion, castle]) {
      expect(hint).not.toBeNull();
      expect(hint!.clue.length).toBeLessThan(85);
      expect(hint!.why.length).toBeLessThan(85);
    }
  });
});
