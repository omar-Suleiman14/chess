// PGN export/import with recursive variations (RAV). SAN is always resolved by
// chess.js; anything illegal is rejected with a precise error.
import { DEFAULT_POSITION } from "chess.js";
import { applyUci, checkFen, sanToUci } from "../rules";
import { ROOT_KEY, childrenOf, createTree, pathTo, type GameTree, type TreeNode } from "./tree";

export const MAX_PGN_BYTES = 200_000;

export type PgnHeaders = Record<string, string>;

export function exportPgn(tree: GameTree, headers: PgnHeaders, mainHeadKey = tree.branches[tree.activeBranchKey].headKey): string {
  const tags: PgnHeaders = { Event: "Chess by Chaos", Site: "https://chess.chaos.fail", Result: "*", ...headers };
  if (tree.originFen !== DEFAULT_POSITION) {
    tags.SetUp = "1";
    tags.FEN = tree.originFen;
  }
  const tagText = Object.entries(tags)
    .map(([k, v]) => `[${k} "${v.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"]`)
    .join("\n");
  const mainPath = new Set(pathTo(tree, mainHeadKey).map((n) => n.key));
  const body = renderLine(tree, ROOT_KEY, mainPath, true).trim();
  return `${tagText}\n\n${wrap(`${body} ${tags.Result}`.trim())}\n`;
}

function renderLine(tree: GameTree, fromKey: string, mainPath: Set<string>, forceNumber: boolean): string {
  const parts: string[] = [];
  let cursorKey = fromKey;
  let needNumber = forceNumber;
  for (;;) {
    const children = childrenOf(tree, cursorKey);
    if (children.length === 0) break;
    const main = children.find((c) => mainPath.has(c.key)) ?? children[0];
    parts.push(moveText(tree, main, needNumber));
    needNumber = false;
    for (const alt of children) {
      if (alt.key === main.key) continue;
      const rest = renderLine(tree, alt.key, mainPath, false);
      parts.push(`(${moveText(tree, alt, true)}${rest ? ` ${rest}` : ""})`);
      needNumber = true;
    }
    cursorKey = main.key;
  }
  return parts.join(" ");
}

function moveText(tree: GameTree, node: TreeNode, forceNumber: boolean): string {
  const parent = tree.nodes[node.parentKey ?? ROOT_KEY];
  const fields = parent.fen.split(" ");
  const number = Number(fields[5]) || 1;
  if (fields[1] === "w") return `${number}. ${node.san}`;
  return forceNumber ? `${number}... ${node.san}` : node.san;
}

function wrap(text: string, width = 80): string {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(" ")) {
    if (line && line.length + word.length + 1 > width) {
      lines.push(line);
      line = word;
    } else {
      line = line ? `${line} ${word}` : word;
    }
  }
  if (line) lines.push(line);
  return lines.join("\n");
}

export type ImportedPgn = { tree: GameTree; headers: PgnHeaders; result: string; mainHeadKey: string };

export class PgnError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PgnError";
  }
}

/** Parses one PGN game (the first in the text) into a move tree. */
export function importPgn(text: string, makeKey: () => string, now: number): ImportedPgn {
  if (new TextEncoder().encode(text).length > MAX_PGN_BYTES) throw new PgnError("PGN is too large.");
  const headers: PgnHeaders = {};
  const tagPattern = /^\s*\[(\w+)\s+"((?:[^"\\]|\\.)*)"\]\s*$/;
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  let i = 0;
  for (; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) {
      if (Object.keys(headers).length > 0) break;
      continue;
    }
    const match = tagPattern.exec(line);
    if (!match) break;
    headers[match[1]] = match[2].replace(/\\(.)/g, "$1");
  }
  let originFen = DEFAULT_POSITION;
  if (headers.FEN) {
    const fen = checkFen(headers.FEN);
    if (!fen.ok) throw new PgnError(`Invalid FEN header: ${fen.error}`);
    originFen = fen.fen;
  }
  const mainBranchKey = makeKey();
  let tree = createTree(originFen, mainBranchKey, now);
  tree = { ...tree, branches: { [mainBranchKey]: { ...tree.branches[mainBranchKey], kind: "import", label: "Imported" } } };

  const tokens = tokenize(lines.slice(i).join("\n"));
  const nodes = { ...tree.nodes };
  let tick = 0;
  // Stack of [currentKey, keyBeforeLastMove] for variations.
  const stack: Array<{ current: string; previous: string }> = [];
  let current = ROOT_KEY;
  let previous = ROOT_KEY;
  let mainHeadKey = ROOT_KEY;
  let result = headers.Result ?? "*";
  const depth0 = () => stack.length === 0;

  for (const token of tokens) {
    if (token === "(") {
      stack.push({ current, previous });
      if (stack.length > 32) throw new PgnError("Variations are nested too deeply.");
      current = previous;
      continue;
    }
    if (token === ")") {
      const frame = stack.pop();
      if (!frame) throw new PgnError("Unbalanced ')' in PGN.");
      ({ current, previous } = frame);
      continue;
    }
    if (/^(1-0|0-1|1\/2-1\/2|\*)$/.test(token)) {
      if (depth0()) result = token;
      continue;
    }
    const san = token.replace(/[!?]+$/, "");
    const parent = nodes[current];
    const uci = sanToUci(parent.fen, san);
    if (!uci) {
      throw new PgnError(`Illegal or unreadable move "${token}" at ply ${parent.ply + 1}.`);
    }
    const existing = Object.values(nodes).find((n) => n.parentKey === current && n.uci === uci);
    let key: string;
    if (existing) {
      key = existing.key;
    } else {
      if (Object.keys(nodes).length >= 5000) throw new PgnError("PGN has too many moves.");
      const applied = applyUci(parent.fen, uci)!;
      key = makeKey();
      nodes[key] = {
        key,
        parentKey: current,
        ply: parent.ply + 1,
        uci: applied.uci,
        san: applied.san,
        fen: applied.fen,
        createdAt: now + tick++,
      };
    }
    previous = current;
    current = key;
    if (depth0()) mainHeadKey = key;
  }
  if (stack.length > 0) throw new PgnError("Unclosed variation in PGN.");
  const parents = new Set(Object.values(nodes).map((node) => node.parentKey));
  const branches = { [mainBranchKey]: { ...tree.branches[mainBranchKey], headKey: mainHeadKey } };
  // Preserve imported variations as selectable lines, not unreachable orphan nodes.
  for (const leaf of Object.values(nodes).filter((node) => node.key !== ROOT_KEY && node.key !== mainHeadKey && !parents.has(node.key))) {
    const key = `variation-${leaf.key}`;
    branches[key] = { key, headKey: leaf.key, label: `Alternative ending ${leaf.san}`, kind: "variation", forkedFromBranchKey: mainBranchKey, createdAt: now };
  }
  tree = { ...tree, nodes, branches };
  return { tree, headers, result, mainHeadKey };
}

function tokenize(movetext: string): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < movetext.length) {
    const c = movetext[i];
    if (/\s/.test(c)) {
      i++;
    } else if (c === "{") {
      const end = movetext.indexOf("}", i);
      if (end < 0) throw new PgnError("Unclosed comment in PGN.");
      i = end + 1;
    } else if (c === ";") {
      const end = movetext.indexOf("\n", i);
      i = end < 0 ? movetext.length : end + 1;
    } else if (c === "(" || c === ")") {
      out.push(c);
      i++;
    } else if (c === "$") {
      i++;
      while (i < movetext.length && /\d/.test(movetext[i])) i++;
    } else {
      let j = i;
      while (j < movetext.length && !/[\s(){};]/.test(movetext[j])) j++;
      const word = movetext.slice(i, j);
      i = j;
      // Strip move numbers like "12." or "12..." (possibly glued to the SAN).
      const stripped = word.replace(/^\d+\.+/, "");
      if (stripped) out.push(stripped);
    }
  }
  return out;
}
