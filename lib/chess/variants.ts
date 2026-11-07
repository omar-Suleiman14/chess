// Fun start positions and odds games. They are normal chess from a custom
// position, so the rules, Stockfish and Time Machine all work unchanged;
// any non-standard start is unrated.
import { DEFAULT_POSITION, type Color } from "./rules";

export type VariantId = "standard" | "queens" | "knights" | "pawns" | "pawns-queens" | "random" | "odds-queen" | "odds-rook" | "odds-knight";

export const VARIANTS: Array<{ id: VariantId; label: string; detail: string }> = [
  { id: "standard", label: "Standard", detail: "The normal starting position." },
  { id: "queens", label: "Queens only", detail: "Every piece behind the pawns is a queen. Pure chaos." },
  { id: "knights", label: "Knights only", detail: "Knights and pawns: forks everywhere." },
  { id: "pawns", label: "Pawns only", detail: "Kings and pawns: race to promote." },
  { id: "pawns-queens", label: "Pawns & queens", detail: "Each side keeps its queen and pawns." },
  { id: "random", label: "Random back rank", detail: "Chess960-style shuffled pieces, no castling." },
  { id: "odds-queen", label: "Queen odds", detail: "Your opponent starts without a queen." },
  { id: "odds-rook", label: "Rook odds", detail: "Your opponent starts without a rook." },
  { id: "odds-knight", label: "Knight odds", detail: "Your opponent starts without a knight." },
];

const mirror = (rank: string) => rank.toLowerCase();

/** A shuffled back rank with bishops on opposite colours and the king between the rooks. */
export function randomBackRank(random: () => number = Math.random): string {
  const squares: Array<string | null> = Array(8).fill(null);
  const pick = (options: number[]) => options[Math.floor(random() * options.length)];
  squares[pick([0, 2, 4, 6])] = "B";
  squares[pick([1, 3, 5, 7])] = "B";
  const free = () => squares.map((s, i) => (s ? -1 : i)).filter((i) => i >= 0);
  squares[pick(free())] = "Q";
  squares[pick(free())] = "N";
  squares[pick(free())] = "N";
  const [a, k, b] = free();
  squares[a] = "R"; squares[k] = "K"; squares[b] = "R";
  return squares.join("");
}

/**
 * Starting FEN for a variant. Odds remove a piece from the side the human
 * is NOT playing.
 */
export function variantFen(id: VariantId, human: Color, random: () => number = Math.random): string {
  switch (id) {
    case "queens": return "qqqqkqqq/pppppppp/8/8/8/8/PPPPPPPP/QQQQKQQQ w - - 0 1";
    case "knights": return "nnnnknnn/pppppppp/8/8/8/8/PPPPPPPP/NNNNKNNN w - - 0 1";
    case "pawns": return "4k3/pppppppp/8/8/8/8/PPPPPPPP/4K3 w - - 0 1";
    case "pawns-queens": return "3qk3/pppppppp/8/8/8/8/PPPPPPPP/3QK3 w - - 0 1";
    case "random": {
      const rank = randomBackRank(random);
      return `${mirror(rank)}/pppppppp/8/8/8/8/PPPPPPPP/${rank} w - - 0 1`;
    }
    case "odds-queen": return human === "w" ? "rnb1kbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1" : "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNB1KBNR w KQkq - 0 1";
    case "odds-rook": return human === "w" ? "1nbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQk - 0 1" : "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/1NBQKBNR w Kkq - 0 1";
    case "odds-knight": return human === "w" ? "r1bqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1" : "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/R1BQKBNR w KQkq - 0 1";
    default: return DEFAULT_POSITION;
  }
}
