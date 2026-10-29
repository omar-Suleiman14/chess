import { applyUci, DEFAULT_POSITION } from "./rules";

// Small, explicit book. Only these verified positions earn a Book label.
const LINES = [
  "e2e4 e7e5 g1f3 b8c6 f1b5 a7a6 b5a4 g8f6",
  "e2e4 e7e5 g1f3 b8c6 f1c4 g8f6 d2d3 f8c5",
  "e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6",
  "e2e4 e7e6 d2d4 d7d5 b1c3 g8f6",
  "e2e4 c7c6 d2d4 d7d5 b1c3 d5e4 c3e4",
  "d2d4 d7d5 c2c4 e7e6 b1c3 g8f6",
  "d2d4 g8f6 c2c4 e7e6 b1c3 f8b4",
  "g1f3 d7d5 d2d4 g8f6 c2c4",
  "c2c4 e7e5 b1c3 g8f6",
];
const book = new Map<string, Set<string>>();
for (const line of LINES) {
  let fen = DEFAULT_POSITION;
  for (const uci of line.split(" ")) {
    const move = applyUci(fen, uci);
    if (!move) throw new Error(`Illegal opening-book move: ${uci}`);
    const moves = book.get(fen) ?? new Set<string>();
    moves.add(uci);
    book.set(fen, moves);
    fen = move.fen;
  }
}
export function isBookMove(fen: string, uci: string): boolean {
  return book.get(fen)?.has(uci) ?? false;
}
