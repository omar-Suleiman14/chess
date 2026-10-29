import type { GameTree, TreeNode } from "./tree";

/** FEN owns move numbers and mover color; tree ply is relative to the import. */
export function positionMove(tree: GameTree, node: TreeNode) {
  const parent = tree.nodes[node.parentKey ?? "root"];
  const fields = parent.fen.split(" ");
  return { number: Number(fields[5]) || 1, color: fields[1] === "b" ? "b" as const : "w" as const };
}

export function moveRows(tree: GameTree, path: TreeNode[]) {
  const rows: Array<{ number: number; white?: { node: TreeNode; cursor: number }; black?: { node: TreeNode; cursor: number } }> = [];
  path.forEach((node, index) => {
    const { number, color } = positionMove(tree, node);
    let row = rows.at(-1);
    if (!row || row.number !== number) { row = { number }; rows.push(row); }
    row[color === "w" ? "white" : "black"] = { node, cursor: index + 1 };
  });
  return rows;
}

/** Preserve the selected shared position, otherwise stop at the common fork. */
export function sharedCursor(previous: TreeNode[], next: TreeNode[], cursor: number) {
  if (cursor === 0) return 0;
  const selected = previous[cursor - 1];
  const found = next.findIndex((node) => node.key === selected?.key);
  if (found >= 0) return found + 1;
  let common = 0;
  while (common < Math.min(cursor, next.length) && previous[common]?.key === next[common]?.key) common++;
  return common;
}
