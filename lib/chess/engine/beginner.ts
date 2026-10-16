// Deterministic beginner policies for opponents weaker than Stockfish's
// UCI_Elo floor. They only ever choose from chess.js legal moves.
import { Chess, type Move } from "chess.js";
import { moveToUci } from "../rules";

const VALUE: Record<Move["piece"], number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

/** Small seeded PRNG (mulberry32) so a game can be replayed deterministically. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashSeed(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export type BeginnerPolicy = "random" | "greedy" | "careful";

/**
 * Picks a move. `blunderRate` is the chance of ignoring the policy and playing
 * a random legal move, which keeps low levels genuinely beatable.
 */
export function beginnerMove(fen: string, policy: BeginnerPolicy, blunderRate: number, seed: number): string | null {
  const chess = new Chess(fen);
  const moves = chess.moves({ verbose: true });
  if (moves.length === 0) return null;
  const rand = seededRandom(seed);
  const pick = <T,>(items: T[]): T => items[Math.floor(rand() * items.length)];

  // Even beginners take a mate in one when it is on the board.
  if (policy !== "random") {
    const mate = moves.find((m) => m.san.endsWith("#"));
    if (mate) return moveToUci(mate);
  }
  if (policy === "random" || rand() < blunderRate) return moveToUci(pick(moves));

  const scored = moves.map((move) => ({ move, score: scoreMove(chess, move, policy) + rand() * 0.3 }));
  scored.sort((a, b) => b.score - a.score);
  return moveToUci(scored[0].move);
}

function scoreMove(chess: Chess, move: Move, policy: BeginnerPolicy): number {
  let score = move.captured ? VALUE[move.captured] : 0;
  if (move.promotion) score += VALUE[move.promotion] - 1;
  if (move.san.includes("+")) score += 0.2;
  if (policy === "careful") {
    // One-ply safety: does the moved piece become capturable by something cheaper?
    chess.move(move);
    const attackers = chess.attackers(move.to, chess.turn());
    if (attackers.length > 0) {
      const defenders = chess.attackers(move.to, move.color);
      const cheapest = Math.min(...attackers.map((sq) => VALUE[chess.get(sq)!.type] || 10));
      const ownValue = VALUE[move.promotion ?? move.piece] || 10;
      if (defenders.length === 0 || cheapest < ownValue) score -= ownValue;
    }
    chess.undo();
  }
  return score;
}
