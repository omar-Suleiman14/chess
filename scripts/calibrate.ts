// Climb ladder calibration (P13). Plays adjacent ladder levels against each
// other with the exact opponent policies the app uses, then reports score,
// a 95% interval and the implied rating gap. Output is EVIDENCE, not truth:
// bot-vs-bot results on one machine are not human ratings.
//
//   pnpm calibrate -- --games 20 --pairs 0-4 --out docs/calibration/climb-v1.json
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
  quit(): void {
    this.engine.terminate?.();
  }
}

async function choose(engine: NodeEngine, opp: Opponent, fen: string, seed: string): Promise<string | null> {
  if (opp.policy.kind === "beginner") return beginnerMove(fen, opp.policy.policy, opp.policy.blunderRate, hashSeed(seed));
  return await engine.move(fen, opp.policy);
}

async function play(engine: NodeEngine, white: Opponent, black: Opponent, gameId: string): Promise<number> {
  const chess = new Chess();
  for (let ply = 0; ply < MAX_PLIES && !chess.isGameOver(); ply++) {
    const side = chess.turn() === "w" ? white : black;
    const uci = await choose(engine, side, chess.fen(), `${gameId}:${ply}`);
    if (!uci) break;
    chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
  }
  if (chess.isCheckmate()) return chess.turn() === "w" ? 0 : 1; // score for White
  return 0.5; // draws and adjudicated long games
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
      const whiteScore = await play(engine, upperIsWhite ? upper : lower, upperIsWhite ? lower : upper, `${upper.id}-${lower.id}-${g}`);
      const s = upperIsWhite ? whiteScore : 1 - whiteScore;
      upperScore += s;
      results.push(s);
      process.stdout.write(s === 1 ? "W" : s === 0 ? "L" : "D");
    }
    const mean = upperScore / GAMES;
    const sd = Math.sqrt(results.reduce((acc, r) => acc + (r - mean) ** 2, 0) / Math.max(1, GAMES - 1));
    const half = (1.96 * sd) / Math.sqrt(GAMES);
    const row = {
      upper: upper.id,
      lower: lower.id,
      games: GAMES,
      upperScore: Number(mean.toFixed(3)),
      score95: [Number(Math.max(0, mean - half).toFixed(3)), Number(Math.min(1, mean + half).toFixed(3))],
      impliedGap: eloGap(mean),
      nominalGap: upper.rating - lower.rating,
      monotonic: mean > 0.5,
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
    note: "Bot-vs-bot evidence on one machine. Gaps are relative; absolute ratings are an anchored assumption, not a human measurement.",
    pairs,
  };
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(report, null, 2) + "\n");
  console.log(`\nWrote ${OUT}`);
  process.exit(0);
}

void main();
