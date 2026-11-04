import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Piece, PIECE_SETS, pieceUrl } from "./Pieces";

describe("Studio piece set", () => {
  it("offers an independent SVG set for all twelve chess pieces", () => {
    expect(PIECE_SETS.some((set) => set.id === "studio")).toBe(true);
    for (const type of ["p", "n", "b", "r", "q", "k"]) {
      for (const color of ["w", "b"] as const) {
        const html = renderToStaticMarkup(<Piece type={type} color={color} set="studio" className="board-piece" />);
        expect(html).toContain("<svg");
        expect(html).toContain("viewBox=\"7 3 66 70\"");
        expect(html).toContain("aria-hidden=\"true\"");
        expect(html).not.toContain("<img");
      }
    }
  });

  it("routes all twelve Chess.com Neo pieces to the exact source artwork", () => {
    expect(PIECE_SETS.some((set) => set.id === "chesscom")).toBe(true);
    for (const type of ["p", "n", "b", "r", "q", "k"]) {
      for (const color of ["w", "b"] as const) {
        expect(pieceUrl("chesscom", color, type)).toBe(`/pieces/chesscom/${color}${type}.png`);
        const html = renderToStaticMarkup(<Piece type={type} color={color} set="chesscom" />);
        expect(html).toContain(`/pieces/chesscom/${color}${type}.png`);
      }
    }
  });
});
