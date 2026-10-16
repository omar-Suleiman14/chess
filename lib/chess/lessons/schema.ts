// Lesson schema, validation and grading. Author-provided solutions are always
// re-checked with chess.js; nothing in a lesson can execute code.
import { Chess } from "chess.js";
import { applyUci, checkFen, legalMoves, moveToUci, pieceName, positionStatus, UCI_PATTERN } from "../rules";

export const LESSON_SCHEMA_VERSION = 1;
export const LIMITS = {
  title: 60,
  summary: 120,
  prompt: 140,
  hint: 100,
  explanation: 140,
  steps: 12,
  hints: 3,
  lines: 8,
  lineLength: 9,
  topic: 40,
} as const;

export type LessonGoal = "move" | "mate";

export type LessonStep = {
  id: string;
  fen: string;
  prompt: string;
  /**
   * Accepted continuations. Even indexes are the learner's moves, odd indexes
   * are scripted replies. Ignored for goal "mate" (any mate in one is right).
   */
  lines: string[][];
  goal?: LessonGoal;
  hints: string[];
  /** Optional specific feedback for known wrong moves (UCI -> text). */
  wrong?: Record<string, string>;
};

export type LessonSource = "fixed" | "template" | "adaptive" | "mcp" | "user";

export type Lesson = {
  id: string;
  version: number;
  title: string;
  topic: string;
  section?: string;
  summary: string;
  source: LessonSource;
  steps: LessonStep[];
};

export type ValidationIssue = { path: string; message: string };

const SAFE_TEXT = /^[^<>{}`\\]*$/;

export function validateText(value: unknown, max: number, path: string, issues: ValidationIssue[], required = true): void {
  if (typeof value !== "string") {
    if (required || value !== undefined) issues.push({ path, message: "must be text" });
    return;
  }
  if (required && value.trim().length === 0) issues.push({ path, message: "must not be empty" });
  if (value.length > max) issues.push({ path, message: `must be at most ${max} characters` });
  if (!SAFE_TEXT.test(value)) issues.push({ path, message: "contains markup or code characters" });
  if (/https?:\/\//i.test(value)) issues.push({ path, message: "must not contain links" });
}

/** Validates structure, text budgets and every move of every accepted line. */
export function validateLesson(lesson: Lesson): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  validateText(lesson.title, LIMITS.title, "title", issues);
  validateText(lesson.summary, LIMITS.summary, "summary", issues);
  validateText(lesson.topic, LIMITS.topic, "topic", issues);
  if (!/^[a-z0-9-]+$/.test(lesson.topic)) issues.push({ path: "topic", message: "use lowercase-kebab-case" });
  if (!Array.isArray(lesson.steps) || lesson.steps.length === 0) {
    issues.push({ path: "steps", message: "needs at least one step" });
    return issues;
  }
  if (lesson.steps.length > LIMITS.steps) issues.push({ path: "steps", message: `at most ${LIMITS.steps} steps` });
  lesson.steps.forEach((step, i) => validateStep(step, `steps[${i}]`, issues));
  return issues;
}

export function validateStep(step: LessonStep, path: string, issues: ValidationIssue[]): void {
  validateText(step.prompt, LIMITS.prompt, `${path}.prompt`, issues);
  const fen = checkFen(step.fen ?? "");
  if (!fen.ok) {
    issues.push({ path: `${path}.fen`, message: fen.error });
    return;
  }
  if (positionStatus(fen.fen).over) issues.push({ path: `${path}.fen`, message: "position is already finished" });
  if (!Array.isArray(step.hints) || step.hints.length > LIMITS.hints) {
    issues.push({ path: `${path}.hints`, message: `0-${LIMITS.hints} hints` });
  } else {
    step.hints.forEach((h, j) => validateText(h, LIMITS.hint, `${path}.hints[${j}]`, issues));
  }
  for (const [uci, text] of Object.entries(step.wrong ?? {})) {
    if (!UCI_PATTERN.test(uci)) issues.push({ path: `${path}.wrong`, message: `bad move key ${uci}` });
    validateText(text, LIMITS.explanation, `${path}.wrong.${uci}`, issues);
  }
  if (step.goal === "mate") {
    const hasMate = legalMoves(fen.fen).some((m) => m.san.endsWith("#"));
    if (!hasMate) issues.push({ path, message: "goal is mate but there is no mate in one" });
    return;
  }
  if (!Array.isArray(step.lines) || step.lines.length === 0 || step.lines.length > LIMITS.lines) {
    issues.push({ path: `${path}.lines`, message: `1-${LIMITS.lines} accepted lines` });
    return;
  }
  step.lines.forEach((line, j) => {
    if (!Array.isArray(line) || line.length === 0 || line.length > LIMITS.lineLength || line.length % 2 === 0) {
      issues.push({ path: `${path}.lines[${j}]`, message: "a line has an odd number of moves (ends with the learner)" });
      return;
    }
    let current = fen.fen;
    for (const [k, uci] of line.entries()) {
      const applied = applyUci(current, uci);
      if (!applied) {
        issues.push({ path: `${path}.lines[${j}][${k}]`, message: `illegal move ${uci}` });
        return;
      }
      current = applied.fen;
    }
  });
}

export type GradeResult =
  | { kind: "illegal" }
  | { kind: "wrong"; explanation: string; fen: string }
  | { kind: "continue"; reply: string; replyFen: string; userFen: string }
  | { kind: "complete"; fen: string };

/**
 * Grades the learner's next move. `played` is the UCI moves made so far in this
 * step (both sides), `uci` the new attempt.
 */
export function gradeMove(step: LessonStep, played: string[], uci: string): GradeResult {
  let fen = step.fen;
  for (const m of played) {
    const a = applyUci(fen, m);
    if (!a) return { kind: "illegal" };
    fen = a.fen;
  }
  const applied = applyUci(fen, uci);
  if (!applied) return { kind: "illegal" };
  const normalized = applied.uci;

  if (step.goal === "mate") {
    if (applied.checkmate) return { kind: "complete", fen: applied.fen };
    return { kind: "wrong", explanation: step.wrong?.[normalized] ?? explainWrong(fen, normalized, "mate"), fen: applied.fen };
  }

  const candidates = step.lines.filter(
    (line) => played.every((m, i) => line[i] === m) && line[played.length] === normalized,
  );
  if (candidates.length === 0) {
    return { kind: "wrong", explanation: step.wrong?.[normalized] ?? explainWrong(fen, normalized, "move"), fen: applied.fen };
  }
  const continuing = candidates.find((line) => line.length > played.length + 1);
  if (!continuing) return { kind: "complete", fen: applied.fen };
  const reply = continuing[played.length + 1];
  const replied = applyUci(applied.fen, reply);
  if (!replied) return { kind: "complete", fen: applied.fen };
  return { kind: "continue", reply, replyFen: replied.fen, userFen: applied.fen };
}

const VALUE: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 };

/** Deterministic, short explanation of why a move fails. */
export function explainWrong(fen: string, uci: string, goal: LessonGoal): string {
  const chess = new Chess(fen);
  const move = chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
  if (chess.isStalemate()) return "That's stalemate: no legal moves, so it's only a draw.";
  if (chess.isDraw()) return "That allows a draw.";
  const replies = chess.moves({ verbose: true });
  const mate = replies.find((r) => r.san.endsWith("#"));
  if (mate) return `That lets the opponent mate with ${mate.san}.`;
  const grab = replies
    .filter((r) => r.captured)
    .sort((a, b) => VALUE[b.captured!] - VALUE[a.captured!])[0];
  if (grab && VALUE[grab.captured!] >= 3) {
    // Is the captured piece defended?
    chess.move(grab);
    const recapture = chess.moves({ verbose: true }).some((r) => r.to === grab.to);
    chess.undo();
    if (!recapture) return `That leaves your ${pieceName(grab.captured!)} on ${grab.to} hanging.`;
  }
  if (goal === "mate") return move.san.includes("+") ? "Check, but the king can escape." : "Not mate yet. Look for a check that leaves no escape.";
  return "Not quite. Try a move that matches the idea.";
}

/** Progressive hints, falling back to automatic ones. */
export function hintFor(step: LessonStep, played: string[], level: number): string | null {
  if (level < step.hints.length) return step.hints[level];
  const auto = level - step.hints.length;
  let fen = step.fen;
  for (const m of played) fen = applyUci(fen, m)?.fen ?? fen;
  let target: string | undefined;
  if (step.goal === "mate") {
    const mate = legalMoves(fen).find((m) => m.san.endsWith("#"));
    target = mate ? moveToUci(mate) : undefined;
  } else {
    target = step.lines.find((line) => played.every((m, i) => line[i] === m))?.[played.length];
  }
  if (!target) return null;
  if (auto === 0) {
    const piece = new Chess(fen).get(target.slice(0, 2) as Parameters<Chess["get"]>[0]);
    return piece ? `Use your ${pieceName(piece.type)} on ${target.slice(0, 2)}.` : null;
  }
  if (auto === 1) return `Move it to ${target.slice(2, 4)}.`;
  return null;
}

export function maxHintLevel(step: LessonStep): number {
  return step.hints.length + 2;
}
