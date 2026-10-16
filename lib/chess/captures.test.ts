import { describe, expect, it } from "vitest";
import { capturesAlongLine } from "./captures";
const start = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const moves = (...uci: string[]) => uci.map((uci) => ({ uci }));

describe("captured piece rows", () => {
  it("records captures under the player who took the piece", () => {
    expect(capturesAlongLine(start, moves("e2e4", "d7d5", "e4d5", "d8d5"))).toEqual({ captured: { w: ["p"], b: ["p"] }, advantage: { w: 0, b: 0 } });
  });
  it("rewinds captures with the selected line", () => {
    expect(capturesAlongLine(start, moves("e2e4", "d7d5")).captured).toEqual({ w: [], b: [] });
    expect(capturesAlongLine(start, moves("e2e4", "d7d5", "e4d5"))).toMatchObject({ captured: { w: ["p"], b: [] }, advantage: { w: 1, b: 0 } });
  });
  it("handles en passant", () => {
    expect(capturesAlongLine(start, moves("e2e4", "a7a6", "e4e5", "d7d5", "e5d6")).captured).toEqual({ w: ["p"], b: [] });
  });
  it("records the captured rook on promotion without inventing a captured pawn", () => {
    expect(capturesAlongLine("1r5k/P7/8/8/8/8/8/7K w - - 0 1", moves("a7b8q"))).toEqual({ captured: { w: ["r"], b: [] }, advantage: { w: 9, b: 0 } });
  });
  it("does not invent captures for missing pieces in an imported starting position", () => {
    expect(capturesAlongLine("7k/8/8/8/8/8/8/K7 w - - 0 1", []).captured).toEqual({ w: [], b: [] });
  });
});
