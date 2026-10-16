import type { Doc } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { findMistakes, initialReview, type AnalysedMove } from "../../lib/chess/lessons/adaptive";
import { LESSON_SCHEMA_VERSION, validateLesson, type Lesson, type LessonStep } from "../../lib/chess/lessons/schema";
import { applyUci, checkFen, sideToMove } from "../../lib/chess/rules";
import { checkKey, fail, type Owner } from "./auth";
import { getGame, getNode, snapshot } from "./games";

export const MAX_CUSTOM_LESSONS = 300;
export const MAX_PRACTICE_PER_CALL = 20;

export async function createCustomLesson(
  ctx: MutationCtx,
  owner: Owner,
  input: { lessonId: string; title: string; topic: string; summary: string; steps: LessonStep[] },
  provenance: Doc<"customLessons">["provenance"],
  source: Doc<"customLessons">["source"],
): Promise<Doc<"customLessons">> {
  checkKey(input.lessonId, "lessonId");
  const existing = await ctx.db
    .query("customLessons")
    .withIndex("by_owner_and_lessonId", (q) => q.eq("owner", owner).eq("lessonId", input.lessonId))
    .unique();
  if (existing) return existing;
  const recent = await ctx.db
    .query("customLessons")
    .withIndex("by_owner_and_createdAt", (q) => q.eq("owner", owner))
    .order("desc")
    .take(MAX_CUSTOM_LESSONS);
  if (recent.length >= MAX_CUSTOM_LESSONS) fail("quota", "Too many custom lessons. Delete some first.");
  const lesson: Lesson = { id: input.lessonId, version: 1, title: input.title, topic: input.topic, summary: input.summary, source, steps: input.steps };
  const issues = validateLesson(lesson);
  if (issues.length > 0) {
    fail("bad_lesson", issues.slice(0, 8).map((i) => `${i.path}: ${i.message}`).join("; "));
  }
  const steps = input.steps.map((s) => ({ ...s, fen: (checkFen(s.fen) as { ok: true; fen: string }).fen }));
  const id = await ctx.db.insert("customLessons", {
    owner,
    lessonId: input.lessonId,
    version: LESSON_SCHEMA_VERSION,
    title: input.title,
    topic: input.topic,
    summary: input.summary,
    source,
    steps,
    provenance,
    validationStatus: "valid",
    createdAt: Date.now(),
  });
  return (await ctx.db.get("customLessons", id))!;
}

export async function addPracticeItem(
  ctx: MutationCtx,
  owner: Owner,
  item: { itemKey: string; fen: string; accepted: string[]; played?: string; theme: string; kind: string; note?: string; origin: "adaptive" | "mcp"; sourceGameKey?: string; sourceNodeKey?: string },
): Promise<{ itemKey: string; created: boolean }> {
  checkKey(item.itemKey, "itemKey");
  const fen = checkFen(item.fen);
  if (!fen.ok) fail("bad_fen", fen.error);
  if (item.accepted.length === 0 || item.accepted.length > 6) fail("bad_request", "Give 1-6 accepted moves.");
  const accepted: string[] = [];
  for (const uci of item.accepted) {
    const applied = applyUci(fen.fen, uci);
    if (!applied) fail("illegal_move", `Accepted move ${uci} is illegal in that position.`);
    accepted.push(applied.uci);
  }
  if (item.note && (item.note.length > 140 || /[<>{}`\\]|https?:\/\//i.test(item.note))) fail("bad_request", "Note must be short plain text.");
  const dupe = await ctx.db
    .query("practiceItems")
    .withIndex("by_owner_and_fen", (q) => q.eq("owner", owner).eq("fen", fen.fen))
    .first();
  if (dupe) return { itemKey: dupe.itemKey, created: false };
  const sameKey = await ctx.db
    .query("practiceItems")
    .withIndex("by_owner_and_itemKey", (q) => q.eq("owner", owner).eq("itemKey", item.itemKey))
    .unique();
  if (sameKey) return { itemKey: sameKey.itemKey, created: false };
  const review = initialReview(Date.now());
  await ctx.db.insert("practiceItems", {
    owner,
    itemKey: item.itemKey,
    fen: fen.fen,
    accepted,
    played: item.played,
    theme: item.theme.slice(0, 30),
    kind: item.kind.slice(0, 30),
    note: item.note,
    origin: item.origin,
    sourceGameKey: item.sourceGameKey,
    sourceNodeKey: item.sourceNodeKey,
    box: review.box,
    dueAt: review.dueAt,
    streak: 0,
    lapses: 0,
    createdAt: Date.now(),
  });
  return { itemKey: item.itemKey, created: true };
}

/** Builds analysed moves along the game's active line from SAVED analysis only. */
export async function analysedLine(ctx: QueryCtx, owner: Owner, gameKey: string): Promise<{ game: Doc<"games">; moves: Array<AnalysedMove & { nodeKey: string }> }> {
  const snap = await snapshot(ctx, owner, gameKey);
  const byKey = new Map(snap.nodes.map((n) => [n.nodeKey, n]));
  const branch = snap.branches.find((b) => b.branchKey === snap.game.activeBranchKey);
  const path: Doc<"gameNodes">[] = [];
  let cursor = branch ? byKey.get(branch.headKey) : undefined;
  while (cursor && cursor.parentKey) {
    path.push(cursor);
    cursor = byKey.get(cursor.parentKey);
  }
  path.reverse();
  const analyses = await ctx.db
    .query("engineAnalyses")
    .withIndex("by_gameId_and_nodeKey", (q) => q.eq("gameId", snap.game._id))
    .take(4000);
  const analysisOf = new Map(analyses.map((a) => [a.nodeKey, a]));
  const toScore = (a: Doc<"engineAnalyses"> | undefined) =>
    a ? { score: a.scoreMate !== undefined ? { mate: a.scoreMate } : { cp: a.scoreCp ?? 0 }, bestmove: a.bestmove, depth: a.depth } : undefined;
  const moves = path.map((node) => {
    const parent = node.parentKey ? byKey.get(node.parentKey) : undefined;
    return {
      nodeKey: node.nodeKey,
      fenBefore: parent?.fen ?? snap.game.originFen,
      uci: node.uci,
      san: node.san,
      ply: node.ply,
      before: toScore(parent ? analysisOf.get(parent.nodeKey) : undefined),
      after: toScore(analysisOf.get(node.nodeKey)),
    };
  });
  return { game: snap.game, moves };
}

export async function practiceFromGame(ctx: MutationCtx, owner: Owner, gameKey: string): Promise<{ created: number; analysedPlies: number; totalPlies: number }> {
  const { game, moves } = await analysedLine(ctx, owner, gameKey);
  const mistakes = findMistakes(moves, game.humanColor);
  let created = 0;
  for (const m of mistakes.slice(0, MAX_PRACTICE_PER_CALL)) {
    const node = moves.find((mv) => mv.ply === m.ply);
    const result = await addPracticeItem(ctx, owner, {
      itemKey: `${gameKey.slice(0, 40)}-${m.ply}`,
      fen: m.fen,
      accepted: [m.best],
      played: m.played,
      theme: m.theme,
      kind: m.kind,
      origin: "adaptive",
      sourceGameKey: gameKey,
      sourceNodeKey: node?.nodeKey,
    });
    if (result.created) created++;
  }
  const analysedPlies = moves.filter((m) => m.after).length;
  return { created, analysedPlies, totalPlies: moves.length };
}

export async function resolveNodeFen(ctx: QueryCtx, owner: Owner, gameKey: string, nodeKey: string): Promise<{ fen: string; human: boolean }> {
  const game = await getGame(ctx, owner, gameKey);
  const node = await getNode(ctx, game._id, nodeKey);
  if (!node) fail("stale_node", "That move does not exist in the game.");
  return { fen: node.fen, human: sideToMove(node.fen) === game.humanColor };
}
