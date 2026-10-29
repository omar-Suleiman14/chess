import { describe, expect, it } from "vitest";
import { exportPgn, importPgn } from "./pgn";
import { moveLabel, pathTo } from "./tree";
import { moveRows, sharedCursor } from "./explorer";

describe("manual position explorer", () => {
  it("groups Black-to-move FEN imports by authoritative move number", () => {
    let id = 0;
    const { tree } = importPgn('[SetUp "1"]\n[FEN "8/4k3/8/8/8/8/4K3/8 b - - 0 17"]\n\n17... Kf6 18. Kf3 Ke5 *', () => String(++id), 0);
    const path = pathTo(tree, tree.branches[tree.activeBranchKey].headKey);
    const rows = moveRows(tree, path);
    expect(rows.map((row) => [row.number, row.white?.node.san, row.black?.node.san])).toEqual([[17, undefined, "Kf6"], [18, "Kf3", "Ke5"]]);
    expect(rows[1].white?.cursor).toBe(2);
    expect(moveLabel(path[0])).toBe("17… Kf6");
    expect(exportPgn(tree, {})).toContain("17... Kf6 18. Kf3 Ke5");
  });
  it("keeps shared positions and falls back to the fork without changing either line", () => {
    let id = 0;
    const { tree } = importPgn("1. e4 e5 (1... c5) 2. Nf3 *", () => String(++id), 0);
    const main = pathTo(tree, tree.branches[tree.activeBranchKey].headKey);
    const alt = pathTo(tree, Object.values(tree.nodes).find((node) => node.san === "c5")!.key);
    expect(sharedCursor(main, alt, 1)).toBe(1);
    expect(sharedCursor(main, alt, 3)).toBe(1);
    expect(sharedCursor(main, alt, 0)).toBe(0);
    expect(moveRows(tree, [])).toEqual([]);
  });
});
