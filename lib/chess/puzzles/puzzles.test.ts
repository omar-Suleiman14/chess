import { Chess } from "chess.js";
import { describe, expect, it } from "vitest";
import { dailyPuzzle, gradePuzzleMove, INITIAL_PUZZLE_RATING, pickPuzzle, PUZZLES, puzzleStart, ratePuzzle, rushTarget, solverColor, type Puzzle } from "./index";

describe("puzzle data", () => {
  it("has unique ids and legal, replayable solutions ending on the solver's move", () => {
    expect(PUZZLES.length).toBeGreaterThan(10);
    expect(new Set(PUZZLES.map((p) => p.id)).size).toBe(PUZZLES.length);
    for (const p of PUZZLES) {
      const chess = new Chess(p.fen);
      for (const m of p.moves) expect(chess.move({ from: m.slice(0, 2), to: m.slice(2, 4), promotion: m[4] }), `${p.id} ${m}`).toBeTruthy();
      expect(p.moves.length % 2, p.id).toBe(0);
      expect(p.rating).toBeGreaterThanOrEqual(400);
      expect(p.rating).toBeLessThanOrEqual(3000);
      if (p.themes.includes("mate")) expect(chess.isCheckmate(), p.id).toBe(true);
    }
  });
});

const sample: Puzzle = {
  id: "t1",
  // Black blunders with ...Qxb2?? and walks into a back-rank mate.
  fen: "6k1/5ppp/8/8/8/8/1q3PPP/3R2K1 b - - 0 1",
  moves: ["b2b1", "d1b1"],
  rating: 900,
  themes: ["hangingPiece"],
};

describe("grading", () => {
  it("shows the opponent's move first and finds the solver colour", () => {
    expect(puzzleStart(sample).from).toBe("b2");
    expect(solverColor(sample)).toBe("w");
  });

  it("accepts the solution, rejects other moves, and flags illegal input", () => {
    const { fen } = puzzleStart(sample);
    expect(gradePuzzleMove(sample, fen, 1, "d1b1").kind).toBe("solved");
    expect(gradePuzzleMove(sample, fen, 1, "g1f1")).toEqual({ kind: "wrong", best: "d1b1" });
    expect(gradePuzzleMove(sample, fen, 1, "d1d9").kind).toBe("illegal");
  });

  it("accepts any checkmate", () => {
    const mate: Puzzle = { id: "t2", fen: "6k1/p4ppp/8/8/8/8/5PPP/1R1R2K1 b - - 0 1", moves: ["a7a6", "d1d8"], rating: 600, themes: ["mate", "mateIn1"] };
    const { fen } = puzzleStart(mate);
    expect(gradePuzzleMove(mate, fen, 1, "b1b8").kind).toBe("solved");
  });
});

describe("selection and rating", () => {
  it("picks near the target and skips seen puzzles", () => {
    const first = pickPuzzle(1500, { random: () => 0 })!;
    expect(first).toBeTruthy();
    const next = pickPuzzle(1500, { random: () => 0, exclude: new Set([first.id]) })!;
    expect(next.id).not.toBe(first.id);
  });

  it("gains rating for a solve and loses it for a miss", () => {
    const puzzle = { rating: 1200 };
    expect(ratePuzzle(INITIAL_PUZZLE_RATING, puzzle, true).rating).toBeGreaterThan(1200);
    expect(ratePuzzle(INITIAL_PUZZLE_RATING, puzzle, false).rating).toBeLessThan(1200);
  });

  it("keeps the daily puzzle stable for a day and ramps rush difficulty", () => {
    expect(dailyPuzzle(new Date("2026-11-07T01:00:00Z")).id).toBe(dailyPuzzle(new Date("2026-11-07T23:00:00Z")).id);
    expect(rushTarget(10)).toBeGreaterThan(rushTarget(0));
  });
});
