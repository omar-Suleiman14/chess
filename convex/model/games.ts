// Game domain service shared by app mutations and MCP tools.
// Invariants (docs/ARCHITECTURE.md): immutable nodes, server-side legality,
// monotonic rating eligibility, no silent last-write-wins.
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { applyUci, checkFen, DEFAULT_POSITION, positionStatus, sideToMove, timeoutOutcome, type Color, type Outcome } from "../../lib/chess/rules";
import { ENGINE_BUILD } from "../../lib/chess/engine/controller";
import { findOpponent, OPPONENT_POOL_VERSION, CLIMB_OPPONENTS } from "../../lib/chess/engine/opponents";
import { findTimeControl } from "../../lib/chess/clock";
import { ROOT_KEY } from "../../lib/chess/history/tree";
import { checkKey, fail, type Owner } from "./auth";
import { applyRating } from "./ratings";
import { recordGameForFatma } from "./fatma";
import { internal } from "../_generated/api";

export type Mode = Doc<"games">["mode"];
export const MODE_VERSION = 1;
export const MAX_PLIES = 1200;
const MAX_LABEL = 60;

export async function getGame(ctx: QueryCtx, owner: Owner, gameKey: string): Promise<Doc<"games">> {
  const game = await ctx.db
    .query("games")
    .withIndex("by_owner_and_gameKey", (q) => q.eq("owner", owner).eq("gameKey", gameKey))
    .unique();
  // Same error for "missing" and "someone else's": never leak existence.
  if (!game) fail("not_found", "Game not found.");
  return game;
}

export async function getNode(ctx: QueryCtx, gameId: Id<"games">, nodeKey: string): Promise<Doc<"gameNodes"> | null> {
  return await ctx.db
    .query("gameNodes")
    .withIndex("by_gameId_and_nodeKey", (q) => q.eq("gameId", gameId).eq("nodeKey", nodeKey))
    .unique();
}

export async function getBranch(ctx: QueryCtx, gameId: Id<"games">, branchKey: string): Promise<Doc<"gameBranches"> | null> {
  return await ctx.db
    .query("gameBranches")
    .withIndex("by_gameId_and_branchKey", (q) => q.eq("gameId", gameId).eq("branchKey", branchKey))
    .unique();
}

export type CreateGameInput = {
  gameKey: string;
  mode: Mode;
  opponentId: string;
  opponentVersion?: number;
  humanColor: Color;
  originFen?: string;
  timeControlId?: string;
  mainBranchKey: string;
  parentGameKey?: string;
  parentNodeKey?: string;
  label?: string;
  createdBy: Doc<"games">["createdBy"];
  startedAt?: number;
};

export async function createGame(ctx: MutationCtx, owner: Owner, input: CreateGameInput): Promise<Doc<"games">> {
  checkKey(input.gameKey, "gameKey");
  checkKey(input.mainBranchKey, "branchKey");
  const existing = await ctx.db
    .query("games")
    .withIndex("by_owner_and_gameKey", (q) => q.eq("owner", owner).eq("gameKey", input.gameKey))
    .unique();
  if (existing) return existing;

  // Older clients and offline queued creates omit the version and played v1.
  const opponent = findOpponent(input.opponentId, input.opponentVersion ?? 1);
  if (!opponent) fail("bad_request", "Unknown opponent.");
  if (input.mode === "climb" && !CLIMB_OPPONENTS.some((o) => o.id === opponent.id)) {
    fail("bad_request", "Climb games must use a Climb opponent.");
  }
  if (input.mode === "timed") {
    if (!input.timeControlId || !findTimeControl(input.timeControlId)) fail("bad_request", "Timed games need a preset time control.");
  } else if (input.timeControlId) {
    fail("bad_request", "Only Timed mode has a clock.");
  }
  if (input.label && input.label.length > MAX_LABEL) fail("bad_request", "Label is too long.");

  let originFen = DEFAULT_POSITION;
  if (input.parentGameKey) {
    // Branch sessions derive their start from the stored node, never from the client.
    if (!input.parentNodeKey) fail("bad_request", "A branch needs a source node.");
    const parent = await getGame(ctx, owner, input.parentGameKey);
    const node = await getNode(ctx, parent._id, input.parentNodeKey);
    if (!node) fail("stale_node", "That move no longer exists in the source game.");
    originFen = node.fen;
  } else if (input.originFen) {
    const fen = checkFen(input.originFen);
    if (!fen.ok) fail("bad_fen", fen.error);
    originFen = fen.fen;
  }
  if (positionStatus(originFen).over) fail("bad_fen", "That position is already finished.");

  const standardStart = originFen === DEFAULT_POSITION && !input.parentGameKey;
  const ratedMode = input.mode === "climb" || input.mode === "timed";
  const now = Date.now();
  const startedAt = input.startedAt ?? now;
  if (!Number.isFinite(startedAt) || startedAt < 0 || startedAt > now + 300_000) fail("bad_request", "Invalid game start time.");
  const gameId = await ctx.db.insert("games", {
    owner,
    gameKey: input.gameKey,
    mode: input.mode,
    modeVersion: MODE_VERSION,
    opponentId: opponent.id,
    opponentVersion: opponent.version,
    engineBuild: ENGINE_BUILD,
    humanColor: input.humanColor,
    originFen,
    timeControlId: input.timeControlId,
    status: "active",
    rated: ratedMode && standardStart ? "eligible" : "unrated",
    ineligibleReasons: [],
    activeBranchKey: input.mainBranchKey,
    revision: 0,
    moveCount: 0,
    startedAt,
    updatedAt: now,
    parentGameKey: input.parentGameKey,
    parentNodeKey: input.parentNodeKey,
    label: input.label,
    createdBy: input.createdBy,
  });
  await ctx.db.insert("gameNodes", {
    owner,
    gameId,
    nodeKey: ROOT_KEY,
    parentKey: null,
    ply: 0,
    uci: "",
    san: "",
    fen: originFen,
    createdAt: now,
  });
  await ctx.db.insert("gameBranches", {
    owner,
    gameId,
    branchKey: input.mainBranchKey,
    label: "Main line",
    headKey: ROOT_KEY,
    kind: "main",
    createdAt: now,
    updatedAt: now,
  });
  return (await ctx.db.get("games", gameId))!;
}

const SESSION_MODES = ["full_power", "climb", "timed"] as const;
type SessionMode = typeof SESSION_MODES[number];

async function closeReplacedSession(ctx: MutationCtx, owner: Owner, game: Doc<"games">): Promise<void> {
  if (game.status !== "active") return;
  if (game.moveCount <= 1) { await finish(ctx, owner, { gameKey: game.gameKey, claim: "abort" }); return; }
  if (game.rated === "eligible" && (game.mode === "climb" || game.mode === "timed")) {
    await finish(ctx, owner, { gameKey: game.gameKey, claim: "resign" });
    return;
  }
  const now = Date.now();
  await ctx.db.patch("games", game._id, { status: "finished", result: undefined, resultReason: "replaced", endedAt: now, updatedAt: now, revision: game.revision + 1 });
}

export async function closeOlderSessions(ctx: MutationCtx, owner: Owner, args: {
  mode: SessionMode; startedAt: number; creationTime: number;
}): Promise<void> {
  const candidates = await ctx.db.query("games")
    .withIndex("by_owner_and_status_and_mode_and_parentGameKey_and_startedAt", q => q.eq("owner", owner).eq("status", "active").eq("mode", args.mode).eq("parentGameKey", undefined).lte("startedAt", args.startedAt))
    .take(101);
  let closed = 0;
  for (const game of candidates.slice(0, 100)) {
    if (game.startedAt === args.startedAt && game._creationTime >= args.creationTime) continue;
    await closeReplacedSession(ctx, owner, game);
    closed++;
  }
  // Closed rows leave this index range, so each continuation reads the next
  // bounded batch without retaining a cursor into a changing result set.
  if (candidates.length > 100 && closed > 0) await ctx.scheduler.runAfter(0, internal.games.closeOlderSessions, { owner, ...args });
}

/** Only a freshly opened main game replaces older live sessions. Replays of
 * an offline create cannot displace a game that was actually started later. */
export async function replaceActiveSessions(ctx: MutationCtx, owner: Owner, game: Doc<"games">): Promise<void> {
  if (game.parentGameKey || !SESSION_MODES.some(mode => mode === game.mode)) return;
  for (const mode of SESSION_MODES) {
    const latest = await ctx.db.query("games")
      .withIndex("by_owner_and_status_and_mode_and_parentGameKey_and_startedAt", q => q.eq("owner", owner).eq("status", "active").eq("mode", mode).eq("parentGameKey", undefined))
      .order("desc").first();
    if (latest && (latest.startedAt > game.startedAt || (latest.startedAt === game.startedAt && latest._creationTime > game._creationTime))) {
      // A delayed offline create must keep accepting its queued history. Its
      // replacement operation follows those moves in the durable client queue.
      return;
    }
  }
  for (const mode of SESSION_MODES) await closeOlderSessions(ctx, owner, { mode, startedAt: game.startedAt, creationTime: game._creationTime });
}

export type AppendResult = {
  nodeKey: string;
  san: string;
  fen: string;
  revision: number;
  branchKey: string;
  createdBranchKey: string | null;
  reused: boolean;
  status: "active" | "finished";
  result: Outcome | null;
  resultReason: string | null;
};

export async function appendMove(
  ctx: MutationCtx,
  owner: Owner,
  args: { gameKey: string; branchKey: string; parentKey: string; nodeKey: string; uci: string; clockAfterMs?: number },
): Promise<AppendResult> {
  checkKey(args.nodeKey, "nodeKey");
  const game = await getGame(ctx, owner, args.gameKey);
  if (game.status !== "active") fail("game_over", "This game is finished. Start a branch to keep playing.");
  if (game.moveCount >= MAX_PLIES) fail("too_long", "Game is too long.");
  const branch = await getBranch(ctx, game._id, args.branchKey);
  if (!branch) fail("not_found", "Branch not found.");
  const parent = await getNode(ctx, game._id, args.parentKey);
  if (!parent) fail("stale_node", "The position you moved from is not saved yet.");
  const applied = applyUci(parent.fen, args.uci);
  if (!applied) fail("illegal_move", `Illegal move ${args.uci}.`);
  if (args.clockAfterMs !== undefined && (args.clockAfterMs < 0 || args.clockAfterMs > 3 * 60 * 60_000)) {
    fail("bad_request", "Clock value out of range.");
  }

  const now = Date.now();
  // Identical move from the same parent reuses the node: duplicates are impossible.
  const siblings = await ctx.db
    .query("gameNodes")
    .withIndex("by_gameId_and_parentKey", (q) => q.eq("gameId", game._id).eq("parentKey", parent.nodeKey))
    .take(64);
  let node = siblings.find((n) => n.uci === applied.uci) ?? null;
  const reused = node !== null;
  if (!node) {
    if (await getNode(ctx, game._id, args.nodeKey)) fail("conflict", "Node key already used for another move.");
    const id = await ctx.db.insert("gameNodes", {
      owner,
      gameId: game._id,
      nodeKey: args.nodeKey,
      parentKey: parent.nodeKey,
      ply: parent.ply + 1,
      uci: applied.uci,
      san: applied.san,
      fen: applied.fen,
      createdAt: now,
      clockAfterMs: args.clockAfterMs,
    });
    node = (await ctx.db.get("gameNodes", id))!;
  }

  let branchKey = branch.branchKey;
  let createdBranchKey: string | null = null;
  if (branch.headKey === parent.nodeKey) {
    await ctx.db.patch("gameBranches", branch._id, { headKey: node.nodeKey, updatedAt: now });
  } else if (branch.headKey !== node.nodeKey) {
    // The branch moved on elsewhere (another device / offline replay). Keep
    // both: the new move gets its own conflict branch.
    createdBranchKey = `${branch.branchKey.slice(0, 40)}-c${game.revision + 1}`;
    await ctx.db.insert("gameBranches", {
      owner,
      gameId: game._id,
      branchKey: createdBranchKey,
      label: `Alternative from move ${Math.ceil(node.ply / 2)}`,
      headKey: node.nodeKey,
      kind: "conflict",
      forkedFromBranchKey: branch.branchKey,
      createdAt: now,
      updatedAt: now,
    });
    branchKey = createdBranchKey;
  }

  const revision = game.revision + 1;
  const patch: Partial<Doc<"games">> = {
    revision,
    moveCount: game.moveCount + (reused ? 0 : 1),
    updatedAt: now,
    activeBranchKey: branchKey,
  };
  // Results are decided here, by the rules, not by the client.
  const status = await terminalStatus(ctx, game._id, node);
  if (status && branchKey === game.activeBranchKey) {
    Object.assign(patch, { status: "finished", result: status.outcome, resultReason: status.reason, endedAt: now });
  }
  await ctx.db.patch("games", game._id, patch);
  if (patch.status === "finished") await onFinished(ctx, owner, { ...game, ...patch } as Doc<"games">);
  return {
    nodeKey: node.nodeKey,
    san: node.san,
    fen: node.fen,
    revision,
    branchKey,
    createdBranchKey,
    reused,
    status: (patch.status as "finished" | undefined) ?? "active",
    result: (patch.result as Outcome | undefined) ?? null,
    resultReason: (patch.resultReason as string | undefined) ?? null,
  };
}

async function terminalStatus(ctx: QueryCtx, gameId: Id<"games">, node: Doc<"gameNodes">): Promise<{ outcome: Outcome; reason: string } | null> {
  const single = positionStatus(node.fen);
  if (single.over) return { outcome: single.outcome, reason: single.reason };
  // Threefold: repeated positions can only occur within the half-move clock window.
  const halfmove = Number.parseInt(node.fen.split(" ")[4] ?? "0", 10);
  if (halfmove < 8) return null;
  const key = positionKey(node.fen);
  let count = 1;
  let cursor: Doc<"gameNodes"> | null = node;
  for (let i = 0; i < halfmove && cursor?.parentKey; i++) {
    cursor = await getNode(ctx, gameId, cursor.parentKey);
    if (cursor && positionKey(cursor.fen) === key) count++;
    if (count >= 3) return { outcome: "1/2-1/2", reason: "threefold" };
  }
  return null;
}

/** FEN without move counters: identifies a position for repetition and analysis caching. */
export function positionKey(fen: string): string {
  return fen.split(" ").slice(0, 4).join(" ");
}

export async function isAncestor(ctx: QueryCtx, gameId: Id<"games">, ancestorKey: string, nodeKey: string): Promise<boolean> {
  let cursor = await getNode(ctx, gameId, nodeKey);
  let guard = 0;
  while (cursor && guard++ <= MAX_PLIES) {
    if (cursor.nodeKey === ancestorKey) return true;
    if (!cursor.parentKey) return false;
    cursor = await getNode(ctx, gameId, cursor.parentKey);
  }
  return false;
}

export async function rewind(
  ctx: MutationCtx,
  owner: Owner,
  args: { gameKey: string; branchKey: string; toNodeKey: string; variationKey: string },
): Promise<{ revision: number; headKey: string; preservedBranchKey: string | null; rated: Doc<"games">["rated"] }> {
  checkKey(args.variationKey, "variationKey");
  const game = await getGame(ctx, owner, args.gameKey);
  const branch = await getBranch(ctx, game._id, args.branchKey);
  if (!branch) fail("not_found", "Branch not found.");
  if (!(await isAncestor(ctx, game._id, args.toNodeKey, branch.headKey))) {
    fail("stale_node", "Undo target is not on this line any more.");
  }
  const now = Date.now();
  let preservedBranchKey: string | null = null;
  if (branch.headKey !== args.toNodeKey) {
    const keepers = await ctx.db
      .query("gameBranches")
      .withIndex("by_gameId_and_branchKey", (q) => q.eq("gameId", game._id))
      .take(200);
    const alreadyKept = keepers.some((b) => b._id !== branch._id && b.headKey === branch.headKey);
    if (!alreadyKept && !keepers.some((b) => b.branchKey === args.variationKey)) {
      const oldHead = await getNode(ctx, game._id, branch.headKey);
      await ctx.db.insert("gameBranches", {
        owner,
        gameId: game._id,
        branchKey: args.variationKey,
        label: oldHead ? `Line ending ${Math.ceil(oldHead.ply / 2)}${oldHead.ply % 2 ? "." : "…"} ${oldHead.san}` : "Earlier line",
        headKey: branch.headKey,
        kind: "variation",
        forkedFromBranchKey: branch.branchKey,
        createdAt: now,
        updatedAt: now,
      });
      preservedBranchKey = args.variationKey;
    }
    await ctx.db.patch("gameBranches", branch._id, { headKey: args.toNodeKey, updatedAt: now });
  }
  const patch: Partial<Doc<"games">> = { revision: game.revision + 1, updatedAt: now };
  if (game.rated === "eligible") {
    patch.rated = "ineligible";
    patch.ineligibleReasons = [...game.ineligibleReasons, "undo"];
  }
  // Undo of a finished game reopens play on the same record only in unrated modes.
  if (game.status === "finished" && game.rated !== "eligible" && game.mode !== "climb" && game.mode !== "timed") {
    Object.assign(patch, { status: "active", result: undefined, resultReason: undefined, endedAt: undefined });
  }
  await ctx.db.patch("games", game._id, patch);
  await bumpFatmaStat(ctx, owner, "undos");
  return { revision: patch.revision!, headKey: args.toNodeKey, preservedBranchKey, rated: patch.rated ?? game.rated };
}

/** Eligibility only ever moves from eligible to ineligible. */
export async function markAssisted(ctx: MutationCtx, owner: Owner, gameKey: string, reason: string): Promise<Doc<"games">["rated"]> {
  const game = await getGame(ctx, owner, gameKey);
  if (game.rated !== "eligible") return game.rated;
  await ctx.db.patch("games", game._id, {
    rated: "ineligible",
    ineligibleReasons: [...game.ineligibleReasons, reason.slice(0, 40)],
    updatedAt: Date.now(),
  });
  return "ineligible";
}

export type FinishClaim = "resign" | "timeout" | "abort" | "replace";

const TIMEOUT_TOLERANCE_MS = 2_500;

export async function finish(
  ctx: MutationCtx,
  owner: Owner,
  args: { gameKey: string; claim: FinishClaim },
): Promise<{ status: "finished"; result: Outcome | null; reason: string; rated: Doc<"games">["rated"] }> {
  const game = await getGame(ctx, owner, args.gameKey);
  if (game.status === "finished") {
    return { status: "finished", result: game.result ?? null, reason: game.resultReason ?? "", rated: game.rated };
  }
  const branch = await getBranch(ctx, game._id, game.activeBranchKey);
  const head = branch ? await getNode(ctx, game._id, branch.headKey) : null;
  if (!head) fail("not_found", "Game position missing.");
  const now = Date.now();
  let result: Outcome | null;
  let reason: string = args.claim;
  let rated = game.rated;
  const humanLoses: Outcome = game.humanColor === "w" ? "0-1" : "1-0";

  if (args.claim === "replace") {
    const playedRated = game.moveCount > 1 && rated === "eligible" && (game.mode === "climb" || game.mode === "timed");
    result = playedRated ? humanLoses : null;
    reason = playedRated ? "resign" : game.moveCount <= 1 ? "abort" : "replaced";
    if (!playedRated && rated === "eligible") rated = "unrated";
  } else if (args.claim === "resign") {
    result = humanLoses;
  } else if (args.claim === "abort") {
    // Abort only before the human has moved; otherwise it is a resignation.
    if (game.moveCount > 1) fail("bad_request", "Too late to abort, resign instead.");
    result = null;
    rated = rated === "eligible" ? "unrated" : rated;
  } else {
    const tc = game.timeControlId ? findTimeControl(game.timeControlId) : undefined;
    if (!tc) fail("bad_request", "This game has no clock.");
    const flagged = sideToMove(head.fen);
    // The flagged side's clock after its previous move (or the initial time).
    const previousOwnMove = head.parentKey ? await getNode(ctx, game._id, head.parentKey) : null;
    const remainingMs = previousOwnMove && previousOwnMove.ply > 0 && previousOwnMove.clockAfterMs !== undefined ? previousOwnMove.clockAfterMs : tc.initialMs;
    const elapsed = now - head.createdAt;
    if (rated === "eligible" && elapsed + TIMEOUT_TOLERANCE_MS < remainingMs) {
      fail("clock_disagrees", "The server clock says there is still time left.");
    }
    result = timeoutOutcome(head.fen, flagged);
    reason = flagged === game.humanColor ? "timeout" : "fatma_timeout";
  }
  await ctx.db.patch("games", game._id, {
    status: "finished",
    result: result ?? undefined,
    resultReason: reason,
    rated,
    endedAt: now,
    updatedAt: now,
    revision: game.revision + 1,
  });
  const finished = (await ctx.db.get("games", game._id))!;
  await onFinished(ctx, owner, finished);
  return { status: "finished", result, reason, rated };
}

async function onFinished(ctx: MutationCtx, owner: Owner, game: Doc<"games">): Promise<void> {
  if (!game.result) return;
  const humanScore = game.result === "1/2-1/2" ? 0.5 : (game.result === "1-0") === (game.humanColor === "w") ? 1 : 0;
  if (game.rated === "eligible" && (game.mode === "climb" || game.mode === "timed")) {
    await applyRating(ctx, owner, game, humanScore as 0 | 0.5 | 1);
  }
  if (game.mode === "climb" && humanScore === 1) await advanceClimb(ctx, owner, game.opponentId);
  await recordGameForFatma(ctx, owner, humanScore);
}

async function advanceClimb(ctx: MutationCtx, owner: Owner, opponentId: string): Promise<void> {
  const index = CLIMB_OPPONENTS.findIndex((o) => o.id === opponentId);
  if (index < 0) return;
  const progress = await ctx.db.query("climbProgress").withIndex("by_owner", (q) => q.eq("owner", owner)).unique();
  const unlocked = Math.min(CLIMB_OPPONENTS.length - 1, index + 1);
  const now = Date.now();
  if (!progress) {
    await ctx.db.insert("climbProgress", { owner, unlockedLevel: unlocked, beaten: [opponentId], updatedAt: now });
  } else {
    await ctx.db.patch("climbProgress", progress._id, {
      unlockedLevel: Math.max(progress.unlockedLevel, unlocked),
      beaten: progress.beaten.includes(opponentId) ? progress.beaten : [...progress.beaten, opponentId],
      updatedAt: now,
    });
  }
}

async function bumpFatmaStat(ctx: MutationCtx, owner: Owner, stat: "undos"): Promise<void> {
  const state = await ctx.db.query("fatmaStates").withIndex("by_owner", (q) => q.eq("owner", owner)).unique();
  if (state) await ctx.db.patch("fatmaStates", state._id, { stats: { ...state.stats, [stat]: state.stats[stat] + 1 } });
}

export const NODE_PAGE_LIMIT = 2000;

export type GameSnapshot = {
  game: Doc<"games">;
  branches: Doc<"gameBranches">[];
  nodes: Doc<"gameNodes">[];
  truncated: boolean;
};

export async function snapshot(ctx: QueryCtx, owner: Owner, gameKey: string, limit = NODE_PAGE_LIMIT): Promise<GameSnapshot> {
  const game = await getGame(ctx, owner, gameKey);
  const nodes = await ctx.db
    .query("gameNodes")
    .withIndex("by_gameId_and_ply", (q) => q.eq("gameId", game._id))
    .take(limit + 1);
  const branches = await ctx.db
    .query("gameBranches")
    .withIndex("by_gameId_and_branchKey", (q) => q.eq("gameId", game._id))
    .take(200);
  return { game, branches, nodes: nodes.slice(0, limit), truncated: nodes.length > limit };
}

export { OPPONENT_POOL_VERSION };
