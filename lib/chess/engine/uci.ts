// Pure UCI protocol parsing. Scores are normalised to White's point of view.
import type { Color } from "../rules";

export type UciInfo = {
  depth?: number;
  seldepth?: number;
  multipv?: number;
  /** Raw score from the side to move. */
  scoreCp?: number;
  scoreMate?: number;
  bound?: "lower" | "upper";
  nodes?: number;
  nps?: number;
  timeMs?: number;
  pv?: string[];
};

export function parseInfo(line: string): UciInfo | null {
  if (!line.startsWith("info ")) return null;
  const tokens = line.trim().split(/\s+/);
  const info: UciInfo = {};
  let sawScoreOrDepth = false;
  for (let i = 1; i < tokens.length; i++) {
    const token = tokens[i];
    switch (token) {
      case "depth":
        info.depth = toInt(tokens[++i]);
        sawScoreOrDepth = true;
        break;
      case "seldepth":
        info.seldepth = toInt(tokens[++i]);
        break;
      case "multipv":
        info.multipv = toInt(tokens[++i]);
        break;
      case "nodes":
        info.nodes = toInt(tokens[++i]);
        break;
      case "nps":
        info.nps = toInt(tokens[++i]);
        break;
      case "time":
        info.timeMs = toInt(tokens[++i]);
        break;
      case "score": {
        const kind = tokens[++i];
        const value = toInt(tokens[++i]);
        if (kind === "cp") info.scoreCp = value;
        else if (kind === "mate") info.scoreMate = value;
        const next = tokens[i + 1];
        if (next === "lowerbound" || next === "upperbound") {
          info.bound = next === "lowerbound" ? "lower" : "upper";
          i++;
        }
        sawScoreOrDepth = true;
        break;
      }
      case "pv":
        info.pv = tokens.slice(i + 1);
        i = tokens.length;
        break;
      case "string":
        // Free-form engine text; nothing after it is structured.
        return sawScoreOrDepth ? info : null;
      default:
        break;
    }
  }
  return sawScoreOrDepth ? info : null;
}

export type BestMove = { bestmove: string | null; ponder?: string };

export function parseBestMove(line: string): BestMove | null {
  if (!line.startsWith("bestmove")) return null;
  const tokens = line.trim().split(/\s+/);
  const move = tokens[1];
  const ponderIndex = tokens.indexOf("ponder");
  return {
    // "(none)" is emitted for positions with no legal moves.
    bestmove: move && move !== "(none)" ? move : null,
    ponder: ponderIndex > 0 ? tokens[ponderIndex + 1] : undefined,
  };
}

export type WhiteScore = { cp?: number; mate?: number };

/** Converts a side-to-move score into a White-positive one. */
export function toWhiteScore(info: Pick<UciInfo, "scoreCp" | "scoreMate">, turn: Color): WhiteScore {
  const sign = turn === "w" ? 1 : -1;
  if (info.scoreMate !== undefined) return { mate: info.scoreMate * sign };
  if (info.scoreCp !== undefined) return { cp: info.scoreCp * sign };
  return {};
}

/**
 * Maps a White score to a 0..1 bar fill for White. This is a display mapping
 * (logistic, 400cp scale, the same shape as Lichess' bar), NOT a calibrated
 * win probability.
 */
export function barFill(score: WhiteScore): number {
  if (score.mate !== undefined) {
    if (score.mate === 0) return 0.5;
    return score.mate > 0 ? 1 : 0;
  }
  const cp = clamp(score.cp ?? 0, -2000, 2000);
  return 1 / (1 + Math.exp(-cp / 250));
}

export function formatScore(score: WhiteScore): string {
  if (score.mate !== undefined) {
    if (score.mate === 0) return "#";
    return `${score.mate > 0 ? "" : "-"}M${Math.abs(score.mate)}`;
  }
  const pawns = (score.cp ?? 0) / 100;
  const text = Math.abs(pawns) >= 10 ? Math.abs(pawns).toFixed(0) : Math.abs(pawns).toFixed(1);
  if (pawns > 0) return `+${text}`;
  if (pawns < 0) return `-${text}`;
  return "0.0";
}

/** Plain-language description for screen readers. */
export function describeScore(score: WhiteScore): string {
  if (score.mate !== undefined) {
    if (score.mate === 0) return "Checkmate";
    return `${score.mate > 0 ? "White" : "Black"} mates in ${Math.abs(score.mate)}`;
  }
  const cp = score.cp ?? 0;
  if (Math.abs(cp) < 30) return "Roughly equal";
  const side = cp > 0 ? "White" : "Black";
  return `${side} is better by ${(Math.abs(cp) / 100).toFixed(1)} pawns`;
}

function toInt(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : undefined;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}
