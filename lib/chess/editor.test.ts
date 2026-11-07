import { describe, expect, it } from "vitest";
import { DEFAULT_POSITION } from "./rules";
import { inferCastling, placementFromFen, placementToFen, positionProblem } from "./editor";

describe("position editor", () => {
  it("round-trips the starting position with full castling rights", () => {
    const { placement, turn } = placementFromFen(DEFAULT_POSITION);
    expect(placementToFen(placement, turn)).toBe(DEFAULT_POSITION);
    expect(positionProblem(placement, turn)).toBeNull();
  });

  it("builds any combination and drops castling when a rook moves", () => {
    const { placement } = placementFromFen("4k3/8/8/8/8/8/8/R3K3 w - - 0 1");
    expect(inferCastling(placement)).toBe("Q");
    placement.a1 = undefined;
    placement.d4 = "wq";
    placement.e5 = "bn";
    expect(placementToFen(placement, "b")).toBe("4k3/8/8/4n3/3Q4/8/8/4K3 b - - 0 1");
  });

  it("explains impossible positions", () => {
    expect(positionProblem({ e1: "wk" }, "w")).toMatch(/Black needs a king/);
    expect(positionProblem({ e1: "wk", e8: "bk", d8: "bk" }, "w")).toMatch(/only have one king/);
    expect(positionProblem({ e1: "wk", e8: "bk", a8: "wp" }, "w")).toMatch(/Pawns/);
    // Black king attacked by a white rook with White to move.
    expect(positionProblem({ e1: "wk", e8: "bk", e4: "wr" }, "w")).toMatch(/in check/);
    expect(positionProblem({ e1: "wk", e8: "bk" }, "w")).toMatch(/draw/);
    expect(positionProblem({ h1: "wk", h8: "bk", g7: "wq", f6: "wk" as never }, "b")).not.toBeNull();
  });
});
