import { describe, expect, it } from "vitest";
import { PIECE_SETS, pieceUrl } from "./Pieces";

describe("Neo piece set", () => {
  it("is named Neo and has no retired Studio option", () => {
    expect(PIECE_SETS.find((set) => set.id === "chesscom")?.name).toBe("Neo");
    expect(PIECE_SETS.some((set) => String(set.id) === "studio")).toBe(false);
  });

  it("uses the twelve original Neo PNG paths", () => {
    for (const color of ["w", "b"] as const) {
      for (const type of ["p", "n", "b", "r", "q", "k"]) {
        expect(pieceUrl("chesscom", color, type)).toBe(`/pieces/chesscom/${color}${type}.png`);
      }
    }
  });
});
