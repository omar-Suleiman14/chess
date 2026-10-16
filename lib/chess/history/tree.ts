// Immutable, branch-capable move tree shared by the client and Convex.
// Nodes are never edited or removed; branches are named head pointers.
import { applyUci, sideToMove, type Color } from "../rules";

export const ROOT_KEY = "root";

export type TreeNode = {
  key: string;
  parentKey: string | null;
  ply: number;
  uci: string;
  san: string;
  fen: string;
  createdAt: number;
  clockAfterMs?: number;
};

export type BranchKind = "main" | "variation" | "conflict" | "import";

export type Branch = {
  key: string;
  label: string;
  headKey: string;
  kind: BranchKind;
  forkedFromBranchKey?: string;
  createdAt: number;
};

export type GameTree = {
  originFen: string;
  nodes: Record<string, TreeNode>;
  branches: Record<string, Branch>;
  activeBranchKey: string;
};

export const MAX_TREE_NODES = 5000;

export function createTree(originFen: string, mainBranchKey: string, now: number): GameTree {
  return {
    originFen,
    nodes: {
      [ROOT_KEY]: { key: ROOT_KEY, parentKey: null, ply: 0, uci: "", san: "", fen: originFen, createdAt: now },
    },
    branches: {
      [mainBranchKey]: { key: mainBranchKey, label: "Main line", headKey: ROOT_KEY, kind: "main", createdAt: now },
    },
    activeBranchKey: mainBranchKey,
  };
}

export function activeBranch(tree: GameTree): Branch {
  return tree.branches[tree.activeBranchKey];
}

export function headNode(tree: GameTree, branchKey = tree.activeBranchKey): TreeNode {
  return tree.nodes[tree.branches[branchKey].headKey];
}

/** Root-to-node path, excluding the virtual root. */
export function pathTo(tree: GameTree, key: string): TreeNode[] {
  const out: TreeNode[] = [];
  let cursor: TreeNode | undefined = tree.nodes[key];
  let guard = 0;
  while (cursor && cursor.key !== ROOT_KEY) {
    out.push(cursor);
    cursor = cursor.parentKey ? tree.nodes[cursor.parentKey] : undefined;
    if (++guard > MAX_TREE_NODES) throw new Error("Cycle in move tree");
  }
  return out.reverse();
}

export function childrenOf(tree: GameTree, key: string): TreeNode[] {
  return Object.values(tree.nodes)
    .filter((n) => n.parentKey === key)
    .sort((a, b) => a.createdAt - b.createdAt || a.key.localeCompare(b.key));
}

export function isAncestor(tree: GameTree, ancestorKey: string, key: string): boolean {
  let cursor: TreeNode | undefined = tree.nodes[key];
  while (cursor) {
    if (cursor.key === ancestorKey) return true;
    cursor = cursor.parentKey ? tree.nodes[cursor.parentKey] : undefined;
  }
  return false;
}

export type AppendResult = { tree: GameTree; node: TreeNode; reused: boolean };

/**
 * Appends a legal move after the branch head. An identical move from the same
 * parent reuses the existing node (idempotent), it never duplicates.
 */
export function appendMove(
  tree: GameTree,
  branchKey: string,
  uci: string,
  newKey: string,
  now: number,
  clockAfterMs?: number,
): AppendResult {
  const branch = tree.branches[branchKey];
  if (!branch) throw new Error("Unknown branch");
  const parent = tree.nodes[branch.headKey];
  const applied = applyUci(parent.fen, uci);
  if (!applied) throw new Error(`Illegal move ${uci}`);
  const existing = childrenOf(tree, parent.key).find((n) => n.uci === applied.uci);
  if (existing) {
    return { tree: withHead(tree, branchKey, existing.key), node: existing, reused: true };
  }
  if (Object.keys(tree.nodes).length >= MAX_TREE_NODES) throw new Error("Game tree is too large");
  if (tree.nodes[newKey]) throw new Error("Node key already used");
  const node: TreeNode = {
    key: newKey,
    parentKey: parent.key,
    ply: parent.ply + 1,
    uci: applied.uci,
    san: applied.san,
    fen: applied.fen,
    createdAt: now,
    clockAfterMs,
  };
  const next: GameTree = { ...tree, nodes: { ...tree.nodes, [newKey]: node } };
  return { tree: withHead(next, branchKey, newKey), node, reused: false };
}

function withHead(tree: GameTree, branchKey: string, headKey: string): GameTree {
  return {
    ...tree,
    branches: { ...tree.branches, [branchKey]: { ...tree.branches[branchKey], headKey } },
  };
}

/**
 * Where Undo goes: the latest earlier position where it is the human's turn.
 * After Sherine replied that is two plies back (a full turn); if Sherine has not
 * replied yet it is one ply back.
 */
export function undoTarget(tree: GameTree, branchKey: string, human: Color): string | null {
  let cursor = tree.nodes[tree.branches[branchKey].headKey];
  while (cursor.parentKey) {
    const parent = tree.nodes[cursor.parentKey];
    if (sideToMove(parent.fen) === human) return parent.key;
    cursor = parent;
  }
  return null;
}

/**
 * Moves a branch head back to an ancestor. The abandoned line is kept as a
 * named variation branch unless some branch already points at it.
 */
export function rewindBranch(
  tree: GameTree,
  branchKey: string,
  toKey: string,
  variationKey: string,
  now: number,
): { tree: GameTree; preservedBranchKey: string | null } {
  const branch = tree.branches[branchKey];
  if (!branch) throw new Error("Unknown branch");
  if (!isAncestor(tree, toKey, branch.headKey)) throw new Error("Undo target is not on this line");
  if (toKey === branch.headKey) return { tree, preservedBranchKey: null };
  const oldHead = branch.headKey;
  const alreadyKept = Object.values(tree.branches).some((b) => b.key !== branchKey && b.headKey === oldHead);
  let next = withHead(tree, branchKey, toKey);
  let preservedBranchKey: string | null = null;
  if (!alreadyKept && !tree.branches[variationKey]) {
    const node = tree.nodes[oldHead];
    next = {
      ...next,
      branches: {
        ...next.branches,
        [variationKey]: {
          key: variationKey,
          label: `Line ending ${moveLabel(node)}`,
          headKey: oldHead,
          kind: "variation",
          forkedFromBranchKey: branchKey,
          createdAt: now,
        },
      },
    };
    preservedBranchKey = variationKey;
  }
  return { tree: next, preservedBranchKey };
}

export function moveLabel(node: Pick<TreeNode, "ply" | "san">): string {
  if (node.ply === 0) return "start";
  const number = Math.ceil(node.ply / 2);
  return node.ply % 2 === 1 ? `${number}. ${node.san}` : `${number}… ${node.san}`;
}

export function branchList(tree: GameTree): Branch[] {
  return Object.values(tree.branches).sort((a, b) => a.createdAt - b.createdAt);
}

/** All nodes reachable from any branch head; used for compact serialisation. */
export function nodeCount(tree: GameTree): number {
  return Object.keys(tree.nodes).length - 1;
}
