import { describe, expect, it } from "vitest";
import {
  applyUci,
  checkFen,
  DEFAULT_POSITION,
  describeMove,
  legalUcis,
  positionStatus,
  statusFromPath,
  timeoutOutcome,
} from "./rules";

describe("rules", () => {
  it("applies legal moves and rejects illegal ones", () => {
    expect(applyUci(DEFAULT_POSITION, "e2e4")?.san).toBe("e4");
    expect(applyUci(DEFAULT_POSITION, "e2e5")).toBeNull();
    expect(applyUci(DEFAULT_POSITION, "zz")).toBeNull();
    // A promotion letter on a normal move is not a second spelling.
    expect(applyUci(DEFAULT_POSITION, "e2e4q")).toBeNull();
  });

  it("handles castling, en passant and promotion", () => {
    const castle = applyUci("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1", "e1c1");
    expect(castle?.san).toBe("O-O-O");
    const ep = applyUci("4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1", "e5d6");
    expect(ep?.captured).toBe("p");
    expect(ep?.flags).toContain("e");
    const promo = applyUci("8/4P3/8/8/8/8/k7/4K3 w - - 0 1", "e7e8n");
    expect(promo?.promotion).toBe("n");
    expect(applyUci("8/4P3/8/8/8/8/k7/4K3 w - - 0 1", "e7e8")).toBeNull();
  });

  it("detects terminal positions", () => {
    expect(positionStatus("7k/6Q1/6K1/8/8/8/8/8 b - - 0 1")).toMatchObject({ over: true, reason: "checkmate", outcome: "1-0" });
    expect(positionStatus("7k/8/5KQ1/8/8/8/8/8 b - - 0 1")).toMatchObject({ reason: "stalemate" });
    expect(positionStatus("8/8/8/4k3/8/8/8/4K3 w - - 0 1")).toMatchObject({ reason: "insufficient" });
    expect(positionStatus(DEFAULT_POSITION).over).toBe(false);
  });

  it("detects threefold repetition from a path", () => {
    const shuffle = ["g1f3", "g8f6", "f3g1", "f6g8", "g1f3", "g8f6", "f3g1", "f6g8"];
    expect(statusFromPath(DEFAULT_POSITION, shuffle)).toMatchObject({ reason: "threefold" });
    expect(statusFromPath(DEFAULT_POSITION, ["e2e5"])).toBeNull();
  });

  it("adjudicates timeouts by mating material", () => {
    expect(timeoutOutcome("8/8/8/4k3/8/8/8/4K2R w - - 0 1", "b")).toBe("1-0");
    // Black flags but White has only a king: draw.
    expect(timeoutOutcome("8/8/8/4k3/8/8/8/4K3 w - - 0 1", "b")).toBe("1/2-1/2");
    expect(timeoutOutcome("8/8/8/4k3/8/8/8/3NK3 w - - 0 1", "b")).toBe("1/2-1/2");
  });

  it("validates FENs including impossible checks", () => {
    expect(checkFen(DEFAULT_POSITION).ok).toBe(true);
    expect(checkFen("not a fen").ok).toBe(false);
    // White to move while Black is in check from the rook is impossible.
    expect(checkFen("4k3/8/8/8/8/8/8/4RK2 w - - 0 1").ok).toBe(false);
    expect(checkFen("x".repeat(200)).ok).toBe(false);
  });

  it("lists legal moves and describes them", () => {
    expect(legalUcis(DEFAULT_POSITION)).toHaveLength(20);
    const move = applyUci(DEFAULT_POSITION, "g1f3")!;
    expect(describeMove(move, "w")).toBe("White knight to f3");
  });
});
