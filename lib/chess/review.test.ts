import { describe, expect, it } from "vitest";
import { reviewMove } from "./review";
import type { AnalysedMove } from "./lessons/adaptive";

const start = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const move: AnalysedMove = { fenBefore: start, uci: "b2b3", san: "b3", ply: 1, before: { score: { cp: 50 }, bestmove: "e2e4", depth: 12 }, after: { score: { cp: 0 }, depth: 12 } };

describe("move review", () => {
  it("never treats an empty engine score as an equal position", () => {
    expect(reviewMove({ ...move, before: { ...move.before!, score: {} } })).toBeNull();
    expect(reviewMove({ ...move, after: { score: {}, depth: 12 } })).toBeNull();
  });
  it("recognizes verified book moves and does not invent a book label elsewhere", () => {
    expect(reviewMove({ ...move, uci: "e2e4" })?.quality).toBe("book");
    expect(reviewMove(move)?.quality).toBe("good");
  });
  it("requires deep alternative lines for a Great label", () => {
    const before = { score: { cp: 50 }, bestmove: "b2b3", depth: 16, candidates: [{ uci: "e2e4", score: { cp: -200 }, depth: 16 }] };
    expect(reviewMove({ ...move, before, after: { score: { cp: 50 }, depth: 16 } })?.quality).toBe("great");
    expect(reviewMove({ ...move, before: { ...before, candidates: undefined }, after: { score: { cp: 50 }, depth: 16 } })?.quality).toBe("best");
    expect(reviewMove({ ...move, before: { ...before, depth: 12 }, after: { score: { cp: 50 }, depth: 16 } })?.quality).toBe("best");
  });
  it("does not grade missing or shallow analysis", () => {
    expect(reviewMove({ ...move, before: undefined })).toBeNull();
    expect(reviewMove({ ...move, after: undefined })).toBeNull();
    expect(reviewMove({ ...move, after: { score: { cp: 0 }, depth: 9 } })).toBeNull();
    expect(reviewMove({ ...move, before: { ...move.before!, depth: 9 } })).toBeNull();
  });
  it.each([[0, "excellent"], [20, "excellent"], [21, "good"], [50, "good"], [51, "inaccuracy"], [149, "inaccuracy"], [150, "mistake"], [299, "mistake"], [300, "blunder"]] as const)("grades a %i cp loss as %s", (loss, quality) => {
    expect(reviewMove({ ...move, after: { score: { cp: 50 - loss }, depth: 12 } })?.quality).toBe(quality);
  });
  it("uses Black's perspective for Black moves", () => {
    expect(reviewMove({ ...move, fenBefore: start.replace(" w ", " b "), ply: 2, uci: "d7d5", before: { score: { cp: 0 }, bestmove: "e7e5", depth: 12 }, after: { score: { cp: 300 }, depth: 12 } })).toMatchObject({ color: "b", quality: "blunder", lossCp: 300 });
  });
  it("recognizes the engine's best move", () => {
    expect(reviewMove({ ...move, before: { ...move.before!, bestmove: "b2b3" } })).toMatchObject({ quality: "best", bestSan: "b3" });
  });
  it("marks a missed winning mate separately", () => {
    expect(reviewMove({ ...move, before: { ...move.before!, score: { mate: 3 } } })?.quality).toBe("miss");
  });
  it("does not call an already losing mate a missed winning mate", () => {
    expect(reviewMove({ ...move, before: { ...move.before!, score: { mate: -3 } }, after: { score: { mate: -2 }, depth: 12 } })?.quality).toBe("excellent");
  });
  it("grades terminal checkmate without a missing postgame engine score", () => {
    const mate = reviewMove({ fenBefore: "rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq g3 0 2", uci: "d8h4", san: "Qh4#", ply: 4, before: { score: { mate: -1 }, bestmove: "d8h4", depth: 12 } });
    expect(mate).toMatchObject({ quality: "best", color: "b" });
  });
  it("uses the exact draw result for a terminal stalemate", () => {
    expect(reviewMove({ fenBefore: "7k/5K2/8/5Q2/8/8/8/8 w - - 0 1", uci: "f5g6", san: "Qg6", ply: 1, before: { score: { cp: 900 }, bestmove: "f5f6", depth: 12 } })).toMatchObject({ quality: "blunder", lossCp: 900 });
  });
  it("rejects an invalid engine recommendation", () => {
    expect(reviewMove({ ...move, before: { ...move.before!, bestmove: "e2e5" } })).toBeNull();
  });
  it("does not penalize an evaluation improvement", () => {
    expect(reviewMove({ ...move, after: { score: { cp: 300 }, depth: 12 } })).toMatchObject({ quality: "excellent", lossCp: 0 });
  });

});
