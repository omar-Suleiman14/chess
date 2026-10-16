import { describe, expect, it } from "vitest";
import { DEFAULT_POSITION } from "../rules";
import { exportPgn, importPgn, PgnError } from "./pgn";
import { appendMove, branchList, childrenOf, createTree, headNode, pathTo, rewindBranch, undoTarget, type GameTree } from "./tree";

let counter = 0;
const key = () => `k${++counter}`;

function play(tree: GameTree, ucis: string[]): GameTree {
  let t = tree;
  for (const uci of ucis) t = appendMove(t, t.activeBranchKey, uci, key(), counter).tree;
  return t;
}

describe("move tree", () => {
  it("appends, reuses identical moves and never duplicates nodes", () => {
    let tree = createTree(DEFAULT_POSITION, "main", 0);
    tree = play(tree, ["e2e4", "e7e5"]);
    const before = Object.keys(tree.nodes).length;
    const rewind = rewindBranch(tree, "main", pathTo(tree, headNode(tree).key)[0].key, "v1", 1);
    const again = appendMove(rewind.tree, "main", "e7e5", key(), 2);
    expect(again.reused).toBe(true);
    expect(Object.keys(again.tree.nodes)).toHaveLength(before);
  });

  it("undo goes back a full turn and preserves the abandoned line", () => {
    let tree = createTree(DEFAULT_POSITION, "main", 0);
    tree = play(tree, ["e2e4", "e7e5", "g1f3", "b8c6"]);
    const target = undoTarget(tree, "main", "w")!;
    expect(tree.nodes[target].san).toBe("e5");
    const { tree: after, preservedBranchKey } = rewindBranch(tree, "main", target, "var-1", 5);
    expect(preservedBranchKey).toBe("var-1");
    expect(headNode(after).san).toBe("e5");
    expect(after.nodes[after.branches["var-1"].headKey].san).toBe("Nc6");
    // A different continuation creates a sibling, originals untouched.
    const diverged = appendMove(after, "main", "f1c4", key(), 6).tree;
    expect(childrenOf(diverged, target).map((n) => n.san)).toEqual(["Nf3", "Bc4"]);
    expect(branchList(diverged)).toHaveLength(2);
    expect(diverged.nodes[tree.branches.main.headKey]).toEqual(tree.nodes[tree.branches.main.headKey]);
  });

  it("undo before the engine replies is one ply", () => {
    let tree = createTree(DEFAULT_POSITION, "main", 0);
    tree = play(tree, ["e2e4", "e7e5", "g1f3"]);
    expect(tree.nodes[undoTarget(tree, "main", "w")!].san).toBe("e5");
  });

  it("rejects illegal moves", () => {
    const tree = createTree(DEFAULT_POSITION, "main", 0);
    expect(() => appendMove(tree, "main", "e2e5", "x", 0)).toThrow("Illegal");
  });
});

describe("PGN", () => {
  it("round-trips a game with variations, castling, en passant and promotion", () => {
    const pgn = `[Event "Test"]
[Result "1-0"]

1. e4 (1. d4 d5 2. c4) 1... d5 2. e5 f5 3. exf6 {en passant} gxf6 4. Nf3 (4. Qh5+ Kd7) 4... Nc6 5. Bb5 Bd7 6. O-O Qc8 1-0`;
    const imported = importPgn(pgn, key, 0);
    expect(imported.result).toBe("1-0");
    const main = pathTo(imported.tree, imported.mainHeadKey).map((n) => n.san);
    expect(main).toEqual(["e4", "d5", "e5", "f5", "exf6", "gxf6", "Nf3", "Nc6", "Bb5", "Bd7", "O-O", "Qc8"]);
    const out = exportPgn(imported.tree, { Result: "1-0" }, imported.mainHeadKey);
    expect(out).toContain("(1. d4 d5 2. c4)");
    expect(out).toContain("(4. Qh5+ Kd7)");
    const again = importPgn(out, key, 0);
    expect(Object.keys(again.tree.nodes)).toHaveLength(Object.keys(imported.tree.nodes).length);
  });

  it("imports from a FEN header and promotes", () => {
    const imported = importPgn(`[FEN "8/4P3/8/8/8/8/k7/4K3 w - - 0 1"]\n\n1. e8=Q *`, key, 0);
    expect(imported.tree.nodes[imported.mainHeadKey].uci).toBe("e7e8q");
  });

  it("rejects illegal or malformed PGN", () => {
    expect(() => importPgn("1. e5 *", key, 0)).toThrow(PgnError);
    expect(() => importPgn("1. e4 (1. d4 *", key, 0)).toThrow(PgnError);
    expect(() => importPgn("1. e4 e5 ) *", key, 0)).toThrow(PgnError);
    expect(() => importPgn("x".repeat(300_000), key, 0)).toThrow("too large");
  });
});
