import { describe, expect, it } from "vitest";
import { dragActivated, squareFromClientPoint } from "./boardGesture";

const board = { left: 12, top: 24, width: 320, height: 320 };

describe("board pointer hit testing", () => {
  it("maps every corner and centre on either side", () => {
    expect(squareFromClientPoint(12, 24, board, "w")).toBe("a8");
    expect(squareFromClientPoint(331.99, 343.99, board, "w")).toBe("h1");
    expect(squareFromClientPoint(12, 24, board, "b")).toBe("h1");
    expect(squareFromClientPoint(331.99, 343.99, board, "b")).toBe("a8");
    expect(squareFromClientPoint(192, 204, board, "w")).toBe("e4");
  });

  it("rejects invalid dimensions and off-board drops, including exact edges", () => {
    expect(squareFromClientPoint(332, 100, board, "w")).toBeNull();
    expect(squareFromClientPoint(20, 344, board, "w")).toBeNull();
    expect(squareFromClientPoint(11.9, 100, board, "w")).toBeNull();
    expect(squareFromClientPoint(20, 23.9, board, "b")).toBeNull();
    expect(squareFromClientPoint(20, 100, { ...board, width: 0 }, "w")).toBeNull();
    expect(squareFromClientPoint(Number.NaN, 100, board, "w")).toBeNull();
  });

  it("requires a deliberate gesture but feels more precise with a mouse", () => {
    expect(dragActivated(0, 0, 5, 3, "mouse")).toBe(true);
    expect(dragActivated(0, 0, 5, 3, "touch")).toBe(false);
    expect(dragActivated(0, 0, 7, 5, "touch")).toBe(true);
    expect(dragActivated(0, 0, 4, 0, "mouse")).toBe(false);
  });
});
