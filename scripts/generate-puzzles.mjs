// Generates original tactics puzzles with Stockfish, the way Lichess mines them:
// play varied games, find the move where one side blunders, then keep the
// position only if the punishing line is unique at every solver move.
//
//   node scripts/generate-puzzles.mjs --out .cache/puzzles-0.jsonl --games 200 --seed 1
//   node scripts/generate-puzzles.mjs --merge .cache/puzzles-*.jsonl > lib/chess/puzzles/data.json
//
// Output rows: { id, fen, moves, rating, themes }. `fen` is the position
// before the opponent's blunder and `moves[0]` is that blunder (UCI), so the
// app can animate it before the solver plays, like every puzzle site does.
import { spawn } from "node:child_process";
import { appendFileSync, readFileSync } from "node:fs";
import path from "node:path";
import { Chess } from "chess.js";

const args = Object.fromEntries(
  process.argv.slice(2).reduce((pairs, value, index, all) => {
    if (value.startsWith("--")) pairs.push([value.slice(2), all[index + 1]?.startsWith("--") ? "1" : all[index + 1] ?? "1"]);
    return pairs;
  }, []),
);

if (args.merge) {
  mergeFiles(process.argv.slice(process.argv.indexOf("--merge") + 1));
  process.exit(0);
}

const OUT = args.out ?? ".cache/puzzles.jsonl";
const GAMES = Number(args.games ?? 50);
let seed = Number(args.seed ?? 1) >>> 0 || 1;
const DEPTH = Number(args.depth ?? 16);

function random() {
  // xorshift32: reproducible runs per seed.
  seed ^= seed << 13; seed >>>= 0;
  seed ^= seed >>> 17;
  seed ^= seed << 5; seed >>>= 0;
  return seed / 0x100000000;
}

// ---------------------------------------------------------------- engine
const ENGINE = path.join(process.cwd(), "node_modules", "stockfish", "bin", "stockfish-19-single.js");

function startEngine() {
  const child = spawn(process.execPath, [ENGINE], { stdio: "pipe" });
  let buffer = "";
  let listener = null;
  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    buffer += chunk;
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) listener?.(line.trim());
  });
  const send = (cmd) => child.stdin.write(`${cmd}\n`);
  const waitFor = (predicate) => new Promise((resolve) => { listener = (line) => { if (predicate(line)) { listener = null; resolve(line); } }; });
  return {
    async init() {
      send("uci");
      await waitFor((l) => l === "uciok");
      send("setoption name Hash value 64");
      send("isready");
      await waitFor((l) => l === "readyok");
    },
    /** MultiPV search. Scores are from the side to move, mate as ±(100000 - plies). */
    async analyse(fen, { depth = DEPTH, multipv = 2 } = {}) {
      send(`setoption name MultiPV value ${multipv}`);
      send(`position fen ${fen}`);
      const lines = new Map();
      const done = new Promise((resolve) => {
        listener = (line) => {
          if (line.startsWith("info") && line.includes(" pv ") && line.includes(" multipv ")) {
            const d = Number(/ depth (\d+)/.exec(line)?.[1]);
            const k = Number(/ multipv (\d+)/.exec(line)?.[1]);
            const cp = / score cp (-?\d+)/.exec(line);
            const mate = / score mate (-?\d+)/.exec(line);
            const pv = line.split(" pv ")[1].split(" ");
            const score = mate ? (Number(mate[1]) > 0 ? 100000 - Number(mate[1]) : -100000 - Number(mate[1])) : Number(cp?.[1] ?? 0);
            const entry = lines.get(k) ?? { firstDepth: d, move: pv[0] };
            if (entry.move !== pv[0]) { entry.firstDepth = d; entry.move = pv[0]; }
            lines.set(k, { ...entry, depth: d, score, mate: mate ? Number(mate[1]) : null, pv });
          }
          if (line.startsWith("bestmove")) { listener = null; resolve(); }
        };
      });
      send(`go depth ${depth}`);
      await done;
      return [...lines.entries()].sort((a, b) => a[0] - b[0]).map(([, v]) => v);
    },
    async newGame() {
      send("ucinewgame");
      send("isready");
      await waitFor((l) => l === "readyok");
    },
    quit() { send("quit"); child.kill(); },
  };
}

// ---------------------------------------------------------------- helpers
const VALUE = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
const isMate = (s) => Math.abs(s) > 50000;
const winning = (s) => s >= 250; // solver is clearly winning
const uci = (m) => `${m.from}${m.to}${m.promotion ?? ""}`;

function material(chess, color) {
  let total = 0;
  for (const row of chess.board()) for (const sq of row) if (sq && sq.color === color) total += VALUE[sq.type];
  return total;
}

function totalPieces(chess) {
  let n = 0;
  for (const row of chess.board()) for (const sq of row) if (sq && sq.type !== "k" && sq.type !== "p") n += 1;
  return n;
}

/** Lichess-style winning chances in [-1, 1]. */
function chances(score) {
  if (isMate(score)) return score > 0 ? 1 : -1;
  return 2 / (1 + Math.exp(-0.00368208 * score)) - 1;
}

/** Is the solver's move clearly the only good one? */
function unique(lines) {
  const [best, second] = lines;
  if (!best) return false;
  if (!second) return true; // only legal move
  if (isMate(best.score) && best.score > 0) {
    // Mate: unique unless another move also mates or keeps a big win.
    return !(isMate(second.score) && second.score > 0);
  }
  return winning(best.score) && chances(best.score) - chances(second.score) >= 0.3;
}

// ---------------------------------------------------------------- mining
async function solve(engine, startFen) {
  // Returns the solution (solver, reply, solver, ...) or null if it isn't unique.
  const chess = new Chess(startFen);
  const solver = chess.turn();
  const moves = [];
  const depths = [];
  for (let ply = 0; ply < 11; ply++) {
    if (chess.turn() === solver) {
      const lines = await engine.analyse(chess.fen(), { multipv: 2 });
      if (!unique(lines)) {
        // The line must stop on a solver move and, for non-mates, once the gain is "cashed".
        if (ply === 0) return null;
        break;
      }
      const best = lines[0];
      depths.push(best.firstDepth ?? best.depth);
      const move = chess.move(best.move.length > 4 ? { from: best.move.slice(0, 2), to: best.move.slice(2, 4), promotion: best.move[4] } : { from: best.move.slice(0, 2), to: best.move.slice(2, 4) });
      moves.push(uci(move));
      if (chess.isCheckmate()) return { moves, depths, mate: true };
    } else {
      const lines = await engine.analyse(chess.fen(), { multipv: 1, depth: DEPTH - 2 });
      if (!lines[0]) break;
      const m = lines[0].move;
      chess.move(m.length > 4 ? { from: m.slice(0, 2), to: m.slice(2, 4), promotion: m[4] } : { from: m.slice(0, 2), to: m.slice(2, 4) });
      moves.push(m);
    }
  }
  // Must end on a solver move.
  if (moves.length % 2 === 0) moves.pop();
  if (!moves.length) return null;
  return { moves, depths, mate: false };
}

function themesFor(fen, blunder, solution, mate) {
  const themes = new Set();
  const chess = new Chess(fen);
  chess.move(toObj(blunder));
  const solver = chess.turn();
  const opponent = solver === "w" ? "b" : "w";
  const solverMoves = Math.ceil(solution.length / 2);
  const pieces = totalPieces(chess);
  const fullmove = Number(fen.split(" ")[5]);
  themes.add(pieces <= 6 ? "endgame" : fullmove <= 12 ? "opening" : "middlegame");
  if (mate) themes.add(`mateIn${solverMoves}`).add("mate");
  else themes.add(solverMoves === 1 ? "oneMove" : solverMoves === 2 ? "short" : "long");

  const startMaterial = material(chess, solver) - material(chess, opponent);
  let lowest = startMaterial;
  solution.forEach((move, index) => {
    const m = chess.move(toObj(move));
    if (index % 2 === 0) {
      if (m.promotion) themes.add("promotion");
      if (m.san.includes("+")) themes.add("check");
      if (index === 0 && !m.captured && !m.san.includes("+")) themes.add("quietMove");
      if (index === 0 && m.captured && solution.length === 1 && !mate) themes.add("hangingPiece");
      if (mate && index === solution.length - 1) {
        const king = chess.findPiece({ type: "k", color: opponent })[0];
        if (king && (king[1] === "1" || king[1] === "8") && (m.piece === "r" || m.piece === "q")) themes.add("backRankMate");
        if (m.piece === "n") themes.add("smotheredMate");
      }
      // Fork: the moved piece now attacks two valuable enemy pieces.
      const attacked = attackedBy(chess, m.to, solver).filter((sq) => {
        const p = chess.get(sq);
        return p && p.color === opponent && (p.type === "k" || VALUE[p.type] > VALUE[m.piece] || VALUE[p.type] >= 3);
      });
      if (attacked.length >= 2 && m.piece !== "k") themes.add("fork");
    }
    lowest = Math.min(lowest, material(chess, solver) - material(chess, opponent));
  });
  if (lowest <= startMaterial - 2) themes.add("sacrifice");
  if (!mate) themes.add((material(chess, solver) - material(chess, opponent)) - startMaterial >= 5 ? "crushing" : "advantage");
  return [...themes];
}

function attackedBy(chess, from, color) {
  // Squares the piece on `from` attacks, using a copy where it is that side's turn.
  const parts = chess.fen().split(" ");
  parts[1] = color;
  parts[3] = "-";
  try {
    const copy = new Chess(parts.join(" "), { skipValidation: true });
    return copy.moves({ square: from, verbose: true }).filter((m) => m.captured).map((m) => m.to);
  } catch {
    return [];
  }
}

const toObj = (m) => ({ from: m.slice(0, 2), to: m.slice(2, 4), promotion: m[4] });

function rate(solution, depths, mate, themes, firstIsCheckOrCapture) {
  const solverMoves = Math.ceil(solution.length / 2);
  const avgDepth = depths.reduce((a, b) => a + b, 0) / Math.max(1, depths.length);
  let r = 500 + (solverMoves - 1) * 330 + avgDepth * 38;
  if (!firstIsCheckOrCapture) r += 260;
  if (themes.includes("sacrifice")) r += 180;
  if (themes.includes("quietMove")) r += 120;
  if (mate && solverMoves === 1) r -= 200;
  if (themes.includes("hangingPiece")) r -= 150;
  r += (random() - 0.5) * 120;
  return Math.round(Math.max(400, Math.min(2800, r)));
}

async function playGame(engine, id) {
  await engine.newGame();
  const chess = new Chess();
  const found = [];
  // `prior` is the analysis of the position the last move was played from,
  // from the point of view of the side that played it.
  let prior = null;
  let priorFen = null;
  let priorMove = null;
  let priorLines = null;
  for (let ply = 0; ply < 200 && !chess.isGameOver(); ply++) {
    const fen = chess.fen();
    const lines = await engine.analyse(fen, { multipv: 5, depth: 8 });
    if (!lines.length) break;
    const best = lines[0].score;

    // Did the previous move throw away a playable position? Cheap check first.
    if (prior !== null && ply > 8 && (isMate(best) && best > 0 || (winning(best) && prior > -120 && best + prior >= 300))) {
      const deep = await engine.analyse(fen, { multipv: 2, depth: DEPTH });
      if (process.env.DEBUG) console.error("cand", ply, best, prior, deep.map((d) => d.score), unique(deep));
      if (unique(deep) && (isMate(deep[0].score) || winning(deep[0].score))) {
        const solved = await solve(engine, fen);
        if (solved) {
          const first = new Chess(fen).move(toObj(solved.moves[0]));
          const themes = themesFor(priorFen, priorMove, solved.moves, solved.mate);
          found.push({
            id: `${id}-${ply}`,
            fen: priorFen,
            moves: [priorMove, ...solved.moves],
            rating: rate(solved.moves, solved.depths, solved.mate, themes, !!(first.captured || first.san.includes("+"))),
            themes,
          });
        }
      }
    }
    // After a blunder (mined or not), take it back and play the best move so
    // the game stays balanced and keeps producing fresh positions.
    if (prior !== null && ply > 8 && best + prior >= 250) {
      chess.undo();
      const replay = chess.move(toObj(priorLines[0].move));
      if (!replay) break;
      prior = null;
      continue;
    }

    // Choose this move: book-like variety early, then mostly good moves with
    // occasional human-looking mistakes (a worse engine candidate).
    let pick;
    if (ply < 8) pick = lines[Math.floor(random() * Math.min(lines.length, 3))];
    else {
      const roll = random();
      const mistakes = lines.filter((l) => best - l.score >= 180 && l.score > -900);
      if (roll < 0.2 && mistakes.length) pick = mistakes[Math.floor(random() * mistakes.length)];
      else if (roll < 0.24) {
        const legal = chess.moves({ verbose: true });
        pick = { move: uci(legal[Math.floor(random() * legal.length)]) };
      } else {
        const ok = lines.filter((l) => best - l.score < 50);
        pick = ok[Math.floor(random() * ok.length)] ?? lines[0];
      }
    }
    prior = best;
    priorLines = lines;
    priorFen = fen;
    const moved = chess.move(toObj(pick.move));
    if (!moved) break;
    priorMove = uci(moved);
  }
  return found;
}

async function main() {
  const engine = startEngine();
  await engine.init();
  let total = 0;
  for (let g = 0; g < GAMES; g++) {
    const puzzles = await playGame(engine, `s${args.seed ?? 1}g${g}`);
    for (const p of puzzles) appendFileSync(OUT, `${JSON.stringify(p)}\n`);
    total += puzzles.length;
    process.stderr.write(`game ${g + 1}/${GAMES}: +${puzzles.length} (total ${total})\n`);
  }
  engine.quit();
}

/** Inverse standard normal CDF (Acklam's approximation). */
function normalQuantile(p) {
  const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239];
  const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
  const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
  const low = 0.02425;
  if (p < low) { const q = Math.sqrt(-2 * Math.log(p)); return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
  if (p > 1 - low) { const q = Math.sqrt(-2 * Math.log(1 - p)); return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
  const q = p - 0.5, r = q * q;
  return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
}

function uniqueId(p, used) {
  // FNV-1a over the start position and the opponent's move, in base 36.
  let salt = 0;
  for (;;) {
    let h = 0x811c9dc5;
    for (const ch of `${p.fen}|${p.moves[0]}|${salt}`) { h ^= ch.charCodeAt(0); h = Math.imul(h, 0x01000193) >>> 0; }
    const id = h.toString(36).padStart(7, "0");
    if (!used.has(id)) { used.add(id); return id; }
    salt += 1;
  }
}

function isTrivial(p) {
  return p.moves.length === 2 && !p.themes.includes("mate");
}

function mergeFiles(files) {
  const seen = new Set();
  const out = [];
  for (const file of files) {
    for (const line of readFileSync(file, "utf8").split("\n")) {
      if (!line.trim()) continue;
      const p = JSON.parse(line);
      const key = p.fen.split(" ").slice(0, 4).join(" ") + p.moves[0];
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(p);
    }
  }
  // One-move material grabs suit beginners but are easy filler; cap them at 40% of the rest.
  const oneMoveCap = Math.round(out.filter((p) => !isTrivial(p)).length * 0.4);
  let kept = 0;
  const filtered = out.filter((p) => !isTrivial(p) || kept++ < oneMoveCap);
  out.length = 0;
  out.push(...filtered);
  // The raw score only orders puzzles by difficulty; spread that order over a
  // realistic bell curve so every player level has puzzles near their rating.
  out.sort((a, b) => a.rating - b.rating || a.id.localeCompare(b.id));
  out.forEach((p, i) => { p.rating = Math.round(Math.max(500, Math.min(2600, 1450 + 430 * normalQuantile((i + 0.5) / out.length)))); });
  // Short ids derived from the position, so regenerating never renames a puzzle.
  const used = new Set();
  const rows = out.map((p) => ({ id: uniqueId(p, used), fen: p.fen, moves: p.moves.join(" "), rating: p.rating, themes: p.themes.join(" ") }));
  process.stdout.write(JSON.stringify(rows));
}

main().catch((error) => { console.error(error); process.exit(1); });
