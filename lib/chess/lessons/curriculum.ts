// Fixed micro-curriculum and curated topic templates. Every step is validated
// by lib/chess/lessons/lessons.test.ts.
import type { Lesson } from "./schema";

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

export const CURRICULUM: Lesson[] = [
  {
    id: "pieces-rook", version: 1, title: "The rook", topic: "pieces", section: "Pieces", source: "fixed",
    summary: "Rooks slide in straight lines.",
    steps: [
      { id: "1", fen: "4k3/8/8/8/R6p/8/8/4K3 w - - 0 1", prompt: "Take the pawn with your rook.", lines: [["a4h4"]], hints: ["Rooks move along ranks and files."] },
      { id: "2", fen: "4k3/8/p7/8/8/8/8/R3K3 w - - 0 1", prompt: "Rooks go up files too. Take the pawn.", lines: [["a1a6"]], hints: [] },
    ],
  },
  {
    id: "pieces-bishop", version: 1, title: "The bishop", topic: "pieces", section: "Pieces", source: "fixed",
    summary: "Bishops slide diagonally and stay on one colour.",
    steps: [
      { id: "1", fen: "4k3/8/7n/8/8/8/8/2B1K3 w - - 0 1", prompt: "Capture the knight with your bishop.", lines: [["c1h6"]], hints: ["Follow the diagonal."] },
    ],
  },
  {
    id: "pieces-knight", version: 1, title: "The knight", topic: "pieces", section: "Pieces", source: "fixed",
    summary: "Knights jump in an L and can hop over pieces.",
    steps: [
      { id: "1", fen: "4k3/8/8/8/8/6p1/8/4KN2 w - - 0 1", prompt: "Jump and take the pawn.", lines: [["f1g3"]], hints: ["Two squares one way, one square the other."] },
      { id: "2", fen: "4k3/8/8/8/8/2p5/PPP5/1N2K3 w - - 0 1", prompt: "Knights hop over pieces. Take on c3.", lines: [["b1c3"]], hints: [] },
    ],
  },
  {
    id: "pieces-queen", version: 1, title: "The queen", topic: "pieces", section: "Pieces", source: "fixed",
    summary: "The queen moves like a rook and a bishop.",
    steps: [
      { id: "1", fen: "4k3/8/8/8/r7/8/8/3QK3 w - - 0 1", prompt: "Take the rook with your queen.", lines: [["d1a4"]], hints: ["Diagonals count."] },
    ],
  },
  {
    id: "pieces-king-pawn", version: 1, title: "King and pawn", topic: "pieces", section: "Pieces", source: "fixed",
    summary: "The king steps one square. Pawns capture diagonally and promote.",
    steps: [
      { id: "1", fen: "4k3/8/8/8/8/8/3p4/4K3 w - - 0 1", prompt: "You're in check. Take the pawn with the king.", lines: [["e1d2"]], hints: ["Kings can capture unprotected pieces."] },
      { id: "2", fen: "4k3/8/8/3p4/4P3/8/8/4K3 w - - 0 1", prompt: "Pawns capture diagonally. Take.", lines: [["e4d5"]], hints: [] },
      { id: "3", fen: "8/4P3/8/8/8/8/k7/4K3 w - - 0 1", prompt: "Push and promote to a queen.", lines: [["e7e8q"]], hints: ["Reach the last rank."], wrong: { e7e8r: "A rook works, but a queen is stronger.", e7e8n: "Fun, but a queen is stronger.", e7e8b: "A queen is stronger than a bishop." } },
    ],
  },
  {
    id: "rules-special", version: 1, title: "Special moves", topic: "rules", section: "Rules", source: "fixed",
    summary: "Castling and en passant.",
    steps: [
      { id: "1", fen: "r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1", prompt: "Castle kingside: move the king two squares right.", lines: [["e1g1"]], hints: ["Drag the king to g1."] },
      { id: "2", fen: "4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1", prompt: "Black just pushed two squares. Capture en passant.", lines: [["e5d6"]], hints: ["Your pawn moves behind theirs, to d6."] },
    ],
  },
  {
    id: "rules-check", version: 1, title: "Escaping check", topic: "rules", section: "Rules", source: "fixed",
    summary: "Move, block, or capture.",
    steps: [
      { id: "1", fen: "4k3/4r3/8/8/8/8/8/3BK3 w - - 0 1", prompt: "Block the check.", lines: [["d1e2"]], hints: ["Put a piece between the rook and your king."] },
      { id: "2", fen: "4k3/8/8/8/8/8/2n5/R3K3 w - - 0 1", prompt: "The knight checks. Can you escape by moving the king?", lines: [["e1d2"], ["e1e2"], ["e1f2"], ["e1f1"], ["e1d1"]], hints: ["Knight checks can't be blocked."] },
    ],
  },
  {
    id: "mate-basics", version: 1, title: "Checkmate", topic: "checkmate", section: "Checkmate", source: "fixed",
    summary: "Check with no escape wins the game.",
    steps: [
      { id: "1", fen: "6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1", prompt: "Back-rank mate in one.", lines: [], goal: "mate", hints: ["The king is boxed in by its own pawns."] },
      { id: "2", fen: "7k/R7/8/8/8/8/8/1R4K1 w - - 0 1", prompt: "Two rooks: mate in one.", lines: [], goal: "mate", hints: ["One rook guards the 7th rank."] },
      { id: "3", fen: "7k/8/5K2/8/8/8/8/6Q1 w - - 0 1", prompt: "Mate, but don't stalemate!", lines: [], goal: "mate", hints: ["Your king protects g7."] },
    ],
  },
  {
    id: "tactics-basics", version: 1, title: "First tactics", topic: "tactics", section: "Tactics", source: "fixed",
    summary: "Forks, pins and loose pieces.",
    steps: [
      { id: "1", fen: "4k3/8/8/3q4/8/2N5/8/4K3 w - - 0 1", prompt: "A loose queen. Take it.", lines: [["c3d5"]], hints: ["Which piece attacks d5?"] },
      { id: "2", fen: "r3k3/8/8/1N6/8/8/8/4K3 w - - 0 1", prompt: "Fork the king and rook, then collect.", lines: [["b5c7", "e8e7", "c7a8"]], hints: ["Find a knight check that also hits a8."] },
      { id: "3", fen: "4k3/8/2n5/8/8/8/8/4KB2 w - - 0 1", prompt: "Pin the knight to the king.", lines: [["f1b5"]], hints: ["Line up the knight and the king on a diagonal."] },
    ],
  },
  {
    id: "endgame-basics", version: 1, title: "Endgame basics", topic: "endgames", section: "Endgames", source: "fixed",
    summary: "Turn an extra pawn into a queen.",
    steps: [
      { id: "1", fen: "8/8/8/8/8/k7/4P3/4K3 w - - 0 1", prompt: "The black king is far away. Push the pawn two squares.", lines: [["e2e4"]], hints: ["Pawns may move two squares from their start."] },
      { id: "2", fen: "8/4P3/8/8/8/k7/8/4K3 w - - 0 1", prompt: "Promote.", lines: [["e7e8q"]], hints: [] },
    ],
  },
  {
    id: "opening-principles", version: 1, title: "Opening principles", topic: "openings", section: "Openings", source: "fixed",
    summary: "Centre, develop, castle.",
    steps: [
      { id: "1", fen: START, prompt: "Take the centre with a pawn.", lines: [["e2e4"], ["d2d4"]], hints: ["e4 or d4."] },
      { id: "2", fen: "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2", prompt: "Develop a knight toward the centre.", lines: [["g1f3"], ["b1c3"]], hints: ["Knights before bishops is a fine habit."], wrong: { g1h3: "Knights on the rim are dim." , b1a3: "Knights on the rim are dim." } },
      { id: "3", fen: "r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4", prompt: "Keep your king safe.", lines: [["e1g1"]], hints: ["Castle."] },
    ],
  },
];

/** Curated on-demand topics. Each is a short, legal, validated scaffold. */
export const TOPIC_LESSONS: Lesson[] = [
  {
    id: "topic-queens-gambit", version: 1, title: "Queen's Gambit", topic: "queens-gambit", source: "template",
    summary: "Offer the c-pawn to win the centre.",
    steps: [
      { id: "1", fen: START, prompt: "Start with the queen's pawn.", lines: [["d2d4", "d7d5", "c2c4"]], hints: ["d4, then hit d5 with the c-pawn."] },
      { id: "2", fen: "rnbqkbnr/ppp2ppp/4p3/3p4/2PP4/8/PP2PPPP/RNBQKBNR w KQkq - 0 3", prompt: "Declined. Develop and pressure d5.", lines: [["b1c3"], ["g1f3"]], hints: ["A knight adds a second attacker on d5."] },
      { id: "3", fen: "rnbqkbnr/ppp1pppp/8/8/2pP4/8/PP2PPPP/RNBQKBNR w KQkq - 0 3", prompt: "Accepted. Grab the centre.", lines: [["e2e4"], ["g1f3"], ["e2e3"]], hints: ["You'll win the pawn back later."] },
    ],
  },
  {
    id: "topic-sicilian", version: 1, title: "Sicilian Defence", topic: "sicilian-defense", source: "template",
    summary: "Answer 1.e4 by fighting for d4 from the side.",
    steps: [
      { id: "1", fen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1", prompt: "Play the Sicilian.", lines: [["c7c5"]], hints: ["The c-pawn."] },
      { id: "2", fen: "rnbqkbnr/pp1ppppp/8/2p5/4P3/5N2/PPPP1PPP/RNBQKBNR b KQkq - 1 2", prompt: "Pick a main line.", lines: [["d7d6"], ["b8c6"], ["e7e6"]], hints: ["d6, Nc6 and e6 are all main lines."] },
      { id: "3", fen: "rnbqkbnr/pp2pppp/3p4/2p5/3PP3/5N2/PPP2PPP/RNBQKB1R b KQkq - 0 3", prompt: "White opened the centre. Take.", lines: [["c5d4"]], hints: ["Trade a wing pawn for a centre pawn."] },
    ],
  },
  {
    id: "topic-italian", version: 1, title: "Italian Game", topic: "italian-game", source: "template",
    summary: "Fast development aiming at f7.",
    steps: [
      { id: "1", fen: START, prompt: "Play the first three Italian moves.", lines: [["e2e4", "e7e5", "g1f3", "b8c6", "f1c4"]], hints: ["e4, Nf3, Bc4."] },
    ],
  },
  {
    id: "topic-ruy-lopez", version: 1, title: "Ruy Lopez", topic: "ruy-lopez", source: "template",
    summary: "Pressure the defender of e5.",
    steps: [
      { id: "1", fen: START, prompt: "Play the Ruy Lopez.", lines: [["e2e4", "e7e5", "g1f3", "b8c6", "f1b5"]], hints: ["e4, Nf3, then the bishop to b5."] },
    ],
  },
  {
    id: "topic-london", version: 1, title: "London System", topic: "london-system", source: "template",
    summary: "A solid, repeatable setup.",
    steps: [
      { id: "1", fen: START, prompt: "Set up the London.", lines: [["d2d4", "d7d5", "c1f4"], ["d2d4", "g8f6", "c1f4"]], hints: ["d4, then the dark-squared bishop out early."] },
    ],
  },
  {
    id: "topic-french", version: 1, title: "French Defence", topic: "french-defense", source: "template",
    summary: "A solid pawn chain against 1.e4.",
    steps: [
      { id: "1", fen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1", prompt: "Play the French.", lines: [["e7e6", "d2d4", "d7d5"]], hints: ["e6 now, d5 next."] },
    ],
  },
  {
    id: "topic-caro-kann", version: 1, title: "Caro-Kann", topic: "caro-kann", source: "template",
    summary: "Support d5 with the c-pawn.",
    steps: [
      { id: "1", fen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1", prompt: "Play the Caro-Kann.", lines: [["c7c6", "d2d4", "d7d5"]], hints: ["c6 first, then d5."] },
    ],
  },
  {
    id: "topic-forks", version: 1, title: "Forks", topic: "forks", source: "template",
    summary: "One move, two targets.",
    steps: [
      { id: "1", fen: "r3k3/8/8/1N6/8/8/8/4K3 w - - 0 1", prompt: "Knight fork.", lines: [["b5c7", "e8e7", "c7a8"]], hints: ["Check the king and hit the rook."] },
      { id: "2", fen: "4k3/8/8/1n6/8/8/8/3QK3 w - - 0 1", prompt: "Queen fork: check the king and hit the knight.", lines: [["d1h5"], ["d1e2"]], hints: ["Find a check that also attacks b5."] },
    ],
  },
  {
    id: "topic-pins", version: 1, title: "Pins", topic: "pins", source: "template",
    summary: "Freeze a piece in front of something bigger.",
    steps: [
      { id: "1", fen: "4k3/8/2n5/8/8/8/8/4KB2 w - - 0 1", prompt: "Pin the knight.", lines: [["f1b5"]], hints: ["Line it up with the king."] },
      { id: "2", fen: "4k3/4n3/8/8/8/8/8/K6R w - - 0 1", prompt: "Pin the knight with your rook.", lines: [["h1e1"]], hints: ["The knight and king share the e-file."] },
    ],
  },
];

export const ALL_STATIC_LESSONS: Lesson[] = [...CURRICULUM, ...TOPIC_LESSONS];

export function findStaticLesson(id: string): Lesson | undefined {
  return ALL_STATIC_LESSONS.find((l) => l.id === id);
}

const SYNONYMS: Record<string, string[]> = {
  "queens-gambit": ["queen's gambit", "queens gambit", "qgd", "qga", "d4 c4"],
  "sicilian-defense": ["sicilian", "c5", "najdorf", "dragon"],
  "italian-game": ["italian", "giuoco", "bc4"],
  "ruy-lopez": ["ruy", "lopez", "spanish", "bb5"],
  "london-system": ["london", "bf4"],
  "french-defense": ["french", "e6"],
  "caro-kann": ["caro", "kann", "c6"],
  forks: ["fork", "double attack"],
  pins: ["pin", "pinned"],
  checkmate: ["mate", "checkmate"],
  endgames: ["endgame", "promotion"],
};

/** Simple keyword search across curated lessons (no LLM needed). */
export function searchTopics(query: string): Lesson[] {
  const q = query.toLowerCase().trim();
  if (!q) return TOPIC_LESSONS;
  return ALL_STATIC_LESSONS.filter((lesson) => {
    const words = [lesson.title.toLowerCase(), lesson.topic, ...(SYNONYMS[lesson.topic] ?? [])];
    return words.some((w) => w.includes(q) || q.includes(w));
  });
}
