// Climb ladder calibration (P13). Plays adjacent ladder levels against each
// other with the exact opponent policies the app uses, then reports score,
// a 95% interval and the implied rating gap. Output is EVIDENCE, not truth:
// bot-vs-bot results on one machine are not human ratings.
//
//   pnpm calibrate -- --games 40 --pairs 0-10 --out docs/calibration/climb-v1.json
//
// Each game starts from one of a fixed set of balanced openings, and every
// opening is played twice with colours swapped, so deterministic presets
// cannot replay the same game and neither side gets the better opening.
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { createRequire } from "node:module";
import { Chess } from "chess.js";
import { beginnerMove, hashSeed } from "../lib/chess/engine/beginner";
import { CLIMB_OPPONENTS, OPPONENT_POOL_VERSION, type Opponent } from "../lib/chess/engine/opponents";
import { parseBestMove } from "../lib/chess/engine/uci";

const require = createRequire(import.meta.url);
type Engine = { processCommand: (cmd: string) => void; listener?: (line: string) => void; terminate?: () => void };
const createEngine = require("stockfish") as (flavor: string, onMessage: (line: string) => void) => Engine;

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : fallback;
}

const GAMES = Number(arg("games", "10"));
const [FROM, TO] = arg("pairs", "0-3").split("-").map(Number);
const OUT = arg("out", "docs/calibration/climb-v1.json");
const MAX_PLIES = 240;

class NodeEngine {
  private engine: Engine;
  private waiter: ((line: string) => void) | null = null;
  constructor() {
    this.engine = createEngine("lite-single", (line) => this.waiter?.(String(line)));
  }
  private until(pred: (l: string) => boolean): Promise<string> {
    return new Promise((resolve) => {
      this.waiter = (line) => {
        if (pred(line)) {
          this.waiter = null;
          resolve(line);
        }
      };
    });
  }
  async init(): Promise<void> {
    const ok = this.until((l) => l === "uciok");
    this.engine.processCommand("uci");
    await ok;
    this.engine.processCommand("setoption name Threads value 1");
    this.engine.processCommand("setoption name Hash value 16");
  }
  async move(fen: string, opp: Extract<Opponent["policy"], { kind: "stockfish" }>): Promise<string | null> {
    const options = { UCI_LimitStrength: false, "Skill Level": 20, ...opp.options };
    for (const [k, v] of Object.entries(options)) this.engine.processCommand(`setoption name ${k} value ${v}`);
    const ready = this.until((l) => l === "readyok");
    this.engine.processCommand("isready");
    await ready;
    const best = this.until((l) => l.startsWith("bestmove"));
    this.engine.processCommand(`position fen ${fen}`);
    this.engine.processCommand(`go ${opp.depth ? `depth ${opp.depth} ` : ""}movetime ${opp.movetimeMs}`);
    return parseBestMove(await best)?.bestmove ?? null;
  }
  /** Clears hash and history so one game cannot inform the next. */
  async newGame(): Promise<void> {
    this.engine.processCommand("ucinewgame");
    const ready = this.until((l) => l === "readyok");
    this.engine.processCommand("isready");
    await ready;
  }
  quit(): void {
    this.engine.terminate?.();
  }
}

async function choose(engine: NodeEngine, opp: Opponent, fen: string, seed: string): Promise<string | null> {
  if (opp.policy.kind === "beginner") return beginnerMove(fen, opp.policy.policy, opp.policy.blunderRate, hashSeed(seed));
  return await engine.move(fen, opp.policy);
}

/** Short, mainstream openings (SAN). Game g uses OPENINGS[floor(g / 2) % n]. */
export const OPENINGS: string[][] = [
  ["e4", "e5"],
  ["d4", "d5"],
  ["e4", "c5"],
  ["d4", "Nf6"],
  ["c4", "e5"],
  ["e4", "e6"],
  ["Nf3", "d5"],
  ["e4", "c6"],
  ["d4", "Nf6", "c4", "e6"],
  ["e4", "e5", "Nf3", "Nc6"],
];

async function play(engine: NodeEngine, white: Opponent, black: Opponent, gameId: string, opening: string[]): Promise<number> {
  await engine.newGame();
  const chess = new Chess();
  for (const san of opening) chess.move(san);
  for (let ply = chess.history().length; ply < MAX_PLIES && !chess.isGameOver(); ply++) {
    const side = chess.turn() === "w" ? white : black;
    const uci = await choose(engine, side, chess.fen(), `${gameId}:${ply}`);
    if (!uci) break;
    chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
  }
  if (chess.isCheckmate()) return chess.turn() === "w" ? 0 : 1; // score for White
  return 0.5; // draws and adjudicated long games
}

/** Wilson score interval on the per-game score (draw = 0.5); stays sensible at 0% and 100%. */
function wilson(mean: number, n: number, z = 1.96): [number, number] {
  const denom = 1 + (z * z) / n;
  const centre = (mean + (z * z) / (2 * n)) / denom;
  const half = (z * Math.sqrt((mean * (1 - mean)) / n + (z * z) / (4 * n * n))) / denom;
  return [Math.max(0, centre - half), Math.min(1, centre + half)];
}

function eloGap(score: number): number {
  const s = Math.min(0.99, Math.max(0.01, score));
  return Math.round(-400 * Math.log10(1 / s - 1));
}

async function main(): Promise<void> {
  const engine = new NodeEngine();
  await engine.init();
  const pairs: unknown[] = [];
  for (let i = FROM; i < Math.min(TO, CLIMB_OPPONENTS.length - 1); i++) {
    const lower = CLIMB_OPPONENTS[i];
    const upper = CLIMB_OPPONENTS[i + 1];
    let upperScore = 0;
    const results: number[] = [];
    for (let g = 0; g < GAMES; g++) {
      const upperIsWhite = g % 2 === 0;
      const opening = OPENINGS[Math.floor(g / 2) % OPENINGS.length];
      const whiteScore = await play(engine, upperIsWhite ? upper : lower, upperIsWhite ? lower : upper, `${upper.id}-${lower.id}-${g}`, opening);
      const s = upperIsWhite ? whiteScore : 1 - whiteScore;
      upperScore += s;
      results.push(s);
      process.stdout.write(s === 1 ? "W" : s === 0 ? "L" : "D");
    }
    const mean = upperScore / GAMES;
    const [lo, hi] = wilson(mean, GAMES);
    const row = {
      upper: upper.id,
      lower: lower.id,
      games: GAMES,
      wins: results.filter((r) => r === 1).length,
      draws: results.filter((r) => r === 0.5).length,
      losses: results.filter((r) => r === 0).length,
      upperScore: Number(mean.toFixed(3)),
      score95: [Number(lo.toFixed(3)), Number(hi.toFixed(3))],
      impliedGap: eloGap(mean),
      impliedGap95: [eloGap(lo), eloGap(hi)],
      nominalGap: upper.rating - lower.rating,
      // Monotonic only when the whole interval clears 50%, not just the point estimate.
      monotonic: lo > 0.5,
    };
    pairs.push(row);
    console.log(`\n${upper.name} vs ${lower.name}: ${JSON.stringify(row)}`);
  }
  engine.quit();
  const report = {
    pool: OPPONENT_POOL_VERSION,
    engine: "stockfish-19.0.1-lite-single (node)",
    date: new Date().toISOString(),
    machine: { platform: process.platform, arch: process.arch, node: process.version },
    maxPlies: MAX_PLIES,
    openings: OPENINGS.map((o) => o.join(" ")),
    note: "Bot-vs-bot evidence on one machine. Gaps are relative; absolute ratings are an anchored assumption, not a human measurement.",
    pairs,
  };
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(report, null, 2) + "\n");
  console.log(`\nWrote ${OUT}`);
  process.exit(0);
}

void main();
