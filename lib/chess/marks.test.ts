import { describe, expect, it } from "vitest";
import { markColor, toggleMark, type Mark } from "./marks";

const plain = { shiftKey: false, ctrlKey: false, altKey: false, metaKey: false };

describe("board marks", () => {
  it("uses red squares and orange arrows by default, modifiers for other colours", () => {
    expect(markColor(plain, false)).toBe("red");
    expect(markColor(plain, true)).toBe("orange");
    expect(markColor({ ...plain, shiftKey: true }, true)).toBe("green");
    expect(markColor({ ...plain, altKey: true }, false)).toBe("blue");
  });

  it("toggles the same mark off and replaces a different colour", () => {
    const red: Mark = { from: "e4", to: "e4", color: "red" };
    expect(toggleMark([], red)).toEqual([red]);
    expect(toggleMark([red], red)).toEqual([]);
    const green: Mark = { ...red, color: "green" };
    expect(toggleMark([red], green)).toEqual([green]);
    const arrow: Mark = { from: "g1", to: "f3", color: "orange" };
    expect(toggleMark([red], arrow)).toEqual([red, arrow]);
  });
});
