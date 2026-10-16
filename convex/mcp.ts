// MCP service surface. Called only by the Next.js /mcp route after it has
// verified a Clerk OAuth access token. Every call is gated by:
//   1. the shared MCP_SERVICE_SECRET (service-to-service trust),
//   2. the owner's in-app grant for the tool's scope (user consent, revocable),
//   3. a per-owner rate limit, and
//   4. an audit row (written even for denials).
// No tool can set results, ratings, ownership or timestamps.
import { HOUR, MINUTE, RateLimiter } from "@convex-dev/rate-limiter";
import { ConvexError, v, type Infer } from "convex/values";
import { components } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { env, mutation, query, type MutationCtx } from "./_generated/server";
import { exportPgn } from "../lib/chess/history/pgn";
import type { GameTree } from "../lib/chess/history/tree";
import { findMistakes } from "../lib/chess/lessons/adaptive";
import { CURRICULUM, TOPIC_LESSONS } from "../lib/chess/lessons/curriculum";
import { findOpponent, THINK_TIME_MS } from "../lib/chess/engine/opponents";
import { interval, isProvisional } from "../lib/chess/ratings/glicko2";
import { validatePack } from "../lib/chess/personality/packs";
import { applyUci, checkFen } from "../lib/chess/rules";
import { checkKey, fail, idempotent, requireOwner, type Owner } from "./model/auth";
import * as Games from "./model/games";
import { readFatma } from "./model/fatma";
import { addPracticeItem, analysedLine, createCustomLesson, resolveNodeFen } from "./model/lessons";
import { lessonStepValidator, mcpScopeValidator, packValidator } from "./schema";

export type McpScope = Infer<typeof mcpScopeValidator>;
export const ALL_SCOPES: McpScope[] = ["chess.read", "chess.write", "lessons.write", "fatma.write"];

const rateLimiter = new RateLimiter(components.rateLimiter, {
  mcpRead: { kind: "token bucket", rate: 120, period: MINUTE, capacity: 40 },
  mcpWrite: { kind: "token bucket", rate: 60, period: HOUR, capacity: 15 },
});

// ---------------------------------------------------------------------------
// User-facing consent management (called by the app with Clerk session auth).

export const myGrant = query({
  args: {},
  handler: async (ctx) => {
    const owner = await requireOwner(ctx);
    const grant = await ctx.db.query("mcpGrants").withIndex("by_owner", (q) => q.eq("owner", owner)).unique();
    const audits = await ctx.db
      .query("mcpAudits")
      .withIndex("by_owner_and_createdAt", (q) => q.eq("owner", owner))
      .order("desc")
      .take(30);
    return { grant, audits };
  },
});

export const setGrant = mutation({
  args: { scopes: v.array(mcpScopeValidator), allowAutoInstall: v.boolean() },
  handler: async (ctx, args) => {
    const owner = await requireOwner(ctx);
    const scopes = [...new Set(args.scopes)];
    const grant = await ctx.db.query("mcpGrants").withIndex("by_owner", (q) => q.eq("owner", owner)).unique();
    const now = Date.now();
    if (grant) await ctx.db.patch("mcpGrants", grant._id, { scopes, allowAutoInstall: args.allowAutoInstall, updatedAt: now });
    else await ctx.db.insert("mcpGrants", { owner, scopes, allowAutoInstall: args.allowAutoInstall, revokedClients: [], updatedAt: now });
    return null;
  },
});

export const revokeClient = mutation({
  args: { clientId: v.string() },
  handler: async (ctx, args) => {
    const owner = await requireOwner(ctx);
    const grant = await ctx.db.query("mcpGrants").withIndex("by_owner", (q) => q.eq("owner", owner)).unique();
    if (!grant) return null;
    if (!grant.revokedClients.includes(args.clientId)) {
      await ctx.db.patch("mcpGrants", grant._id, { revokedClients: [...grant.revokedClients, args.clientId.slice(0, 120)].slice(-50), updatedAt: Date.now() });
    }
    return null;
  },
});

// ---------------------------------------------------------------------------
// Service gate.

const serviceArgs = { secret: v.string(), clerkUserId: v.string(), clientId: v.string() };

type ToolResult = { ok: true; data: unknown } | { ok: false; code: string; message: string };

function secretsMatch(given: string, expected: string): boolean {
  if (given.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < given.length; i++) diff |= given.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

async function gate(
  ctx: MutationCtx,
  base: { secret: string; clerkUserId: string; clientId: string },
  tool: string,
  scope: McpScope,
  work: (owner: Owner, grant: Doc<"mcpGrants">) => Promise<unknown>,
): Promise<ToolResult> {
  const expected = env.MCP_SERVICE_SECRET;
  if (!expected || expected.length < 32 || !secretsMatch(base.secret, expected)) {
    throw new ConvexError({ code: "forbidden", message: "Service authentication failed." });
  }
  const user = await ctx.db.query("users").withIndex("by_clerkId", (q) => q.eq("clerkId", base.clerkUserId)).first();
  if (!user) {
    return { ok: false, code: "no_account", message: "Open the Chess by Chaos website once while signed in, then try again." };
  }
  const owner = user.tokenIdentifier;
  const clientId = base.clientId.slice(0, 120) || "unknown";
  const audit = (outcome: Doc<"mcpAudits">["outcome"], detail?: string) =>
    ctx.db.insert("mcpAudits", { owner, clientId, tool, scope, outcome, detail: detail?.slice(0, 200), createdAt: Date.now() });

  const grant = await ctx.db.query("mcpGrants").withIndex("by_owner", (q) => q.eq("owner", owner)).unique();
  if (!grant || !grant.scopes.includes(scope)) {
    await audit("denied", "missing scope");
    return { ok: false, code: "permission_denied", message: `Allow "${scope}" in Chess by Chaos → Profile → AI coaches first.` };
  }
  if (grant.revokedClients.includes(clientId)) {
    await audit("denied", "client revoked");
    return { ok: false, code: "permission_denied", message: "This AI client's access was revoked in the app." };
  }
  const limit = await rateLimiter.limit(ctx, scope === "chess.read" ? "mcpRead" : "mcpWrite", { key: owner });
  if (!limit.ok) {
    await audit("denied", "rate limited");
    return { ok: false, code: "rate_limited", message: `Too many requests. Retry in ${Math.ceil((limit.retryAfter ?? 1000) / 1000)}s.` };
  }
  try {
    const data = await work(owner, grant);
    await audit("ok");
    return { ok: true, data };
  } catch (error) {
    const data = error instanceof ConvexError ? (error.data as { code?: string; message?: string }) : null;
    const code = data?.code ?? "error";
    const message = data?.message ?? "Something went wrong.";
    await audit("error", `${code}: ${message}`);
    return { ok: false, code, message };
  }
}

// ---------------------------------------------------------------------------
// Read tools (chess.read). Implemented as mutations so every call is audited.

export const getChessProfile = mutation({
  args: serviceArgs,
  handler: (ctx, base) =>
    gate(ctx, base, "get_chess_profile", "chess.read", async (owner) => {
      const profile = await ctx.db.query("chessProfiles").withIndex("by_owner", (q) => q.eq("owner", owner)).unique();
      const pools = await ctx.db.query("ratingProfiles").withIndex("by_owner_and_pool", (q) => q.eq("owner", owner)).take(20);
      const fatma = await readFatma(ctx, owner);
      return {
        alias: profile?.alias ?? null,
        visibility: profile?.visibility ?? "private",
        ratings: pools.map((p) => ({ pool: p.pool, rating: Math.round(p.rating), rd: Math.round(p.rd), provisional: isProvisional(p), games: p.games, algorithm: p.algorithmVersion })),
        fatma: fatma ? { enabled: fatma.enabled, stats: fatma.stats } : null,
        note: "Ratings are per pool (Climb / Timed). Fatma's Full Power '3000' is a nominal label, not a measured Elo.",
      };
    }),
});

export const listGames = mutation({
  args: { ...serviceArgs, limit: v.number(), before: v.optional(v.number()), mode: v.optional(v.string()) },
  handler: (ctx, { limit, before, mode, ...base }) =>
    gate(ctx, base, "list_games", "chess.read", async (owner) => {
      const take = Math.max(1, Math.min(25, Math.floor(limit)));
      const rows = await ctx.db
        .query("games")
        .withIndex("by_owner_and_updatedAt", (q) => (before ? q.eq("owner", owner).lt("updatedAt", before) : q.eq("owner", owner)))
        .order("desc")
        .take(mode ? 100 : take);
      const games = rows.filter((g) => !mode || g.mode === mode).slice(0, take);
      return {
        games: games.map((g) => ({
          gameKey: g.gameKey,
          mode: g.mode,
          opponent: findOpponent(g.opponentId)?.name ?? g.opponentId,
          humanColor: g.humanColor,
          status: g.status,
          result: g.result ?? null,
          resultReason: g.resultReason ?? null,
          rated: g.rated,
          moves: g.moveCount,
          startedAt: new Date(g.startedAt).toISOString(),
          updatedAt: g.updatedAt,
          parentGameKey: g.parentGameKey ?? null,
          label: g.label ?? null,
        })),
        nextBefore: games.length === take ? games[games.length - 1].updatedAt : null,
      };
    }),
});

export const getGame = mutation({
  args: { ...serviceArgs, gameKey: v.string(), maxNodes: v.number() },
  handler: (ctx, { gameKey, maxNodes, ...base }) =>
    gate(ctx, base, "get_game", "chess.read", async (owner) => {
      const limit = Math.max(1, Math.min(600, Math.floor(maxNodes)));
      const snap = await Games.snapshot(ctx, owner, gameKey, limit);
      const tree: GameTree = {
        originFen: snap.game.originFen,
        nodes: Object.fromEntries(snap.nodes.map((n) => [n.nodeKey, { key: n.nodeKey, parentKey: n.parentKey, ply: n.ply, uci: n.uci, san: n.san, fen: n.fen, createdAt: n.createdAt }])),
        branches: Object.fromEntries(snap.branches.map((b) => [b.branchKey, { key: b.branchKey, label: b.label, headKey: b.headKey, kind: b.kind, createdAt: b.createdAt }])),
        activeBranchKey: snap.game.activeBranchKey,
      };
      const activeHead = snap.branches.find((b) => b.branchKey === snap.game.activeBranchKey)?.headKey;
      let pgn: string | null = null;
      try {
        pgn = activeHead && tree.nodes[activeHead] ? exportPgn(tree, { Result: snap.game.result ?? "*", White: snap.game.humanColor === "w" ? "You" : "Fatma", Black: snap.game.humanColor === "b" ? "You" : "Fatma" }, activeHead) : null;
      } catch {
        pgn = null;
      }
      return {
        gameKey,
        mode: snap.game.mode,
        status: snap.game.status,
        result: snap.game.result ?? null,
        rated: snap.game.rated,
        humanColor: snap.game.humanColor,
        originFen: snap.game.originFen,
        revision: snap.game.revision,
        activeBranchKey: snap.game.activeBranchKey,
        branches: snap.branches.map((b) => ({ branchKey: b.branchKey, label: b.label, headNodeKey: b.headKey, kind: b.kind })),
        nodes: snap.nodes.map((n) => ({ nodeKey: n.nodeKey, parentKey: n.parentKey, ply: n.ply, san: n.san, uci: n.uci, fen: n.fen })),
        truncated: snap.truncated,
        pgn,
      };
    }),
});

export const getGameAnalysis = mutation({
  args: { ...serviceArgs, gameKey: v.string() },
  handler: (ctx, { gameKey, ...base }) =>
    gate(ctx, base, "get_game_analysis", "chess.read", async (owner) => {
      const { game, moves } = await analysedLine(ctx, owner, gameKey);
      const analysed = moves.filter((m) => m.after);
      const mistakes = findMistakes(moves, game.humanColor);
      return {
        gameKey,
        source: "Stockfish evaluations computed in the player's browser and saved; nothing here is generated by the MCP server.",
        coverage: { analysedPlies: analysed.length, totalPlies: moves.length },
        available: analysed.length > 0,
        evaluations: analysed.slice(0, 400).map((m) => ({ ply: m.ply, san: m.san, nodeKey: m.nodeKey, scoreWhite: m.after!.score, depth: m.after!.depth ?? null })),
        mistakes: mistakes.map((m) => ({ ply: m.ply, played: m.playedSan, bestUci: m.best, lossCp: m.lossCp, kind: m.kind, theme: m.theme })),
        note: analysed.length === 0 ? "No saved analysis yet. Open the game in Time Machine on the website and tap Analyse." : undefined,
      };
    }),
});

export const getProgress = mutation({
  args: serviceArgs,
  handler: (ctx, base) =>
    gate(ctx, base, "get_progress", "chess.read", async (owner) => {
      const pools = await ctx.db.query("ratingProfiles").withIndex("by_owner_and_pool", (q) => q.eq("owner", owner)).take(20);
      const climb = await ctx.db.query("climbProgress").withIndex("by_owner", (q) => q.eq("owner", owner)).unique();
      const lessons = await ctx.db.query("lessonProgress").withIndex("by_owner_and_lessonId", (q) => q.eq("owner", owner)).take(300);
      const practice = await ctx.db.query("practiceItems").withIndex("by_owner_and_dueAt", (q) => q.eq("owner", owner)).take(500);
      const recent = await ctx.db.query("games").withIndex("by_owner_and_updatedAt", (q) => q.eq("owner", owner)).order("desc").take(40);
      const finished = recent.filter((g) => g.result);
      return {
        ratings: pools.map((p) => ({ pool: p.pool, rating: Math.round(p.rating), rd: Math.round(p.rd), interval95: interval(p), provisional: isProvisional(p), games: p.games })),
        climb: { unlockedLevel: climb?.unlockedLevel ?? 0, beaten: climb?.beaten ?? [] },
        lessons: { completed: lessons.filter((l) => l.completed).length, started: lessons.length },
        practice: { total: practice.length, mastered: practice.filter((p) => p.box >= 4).length, lapses: practice.reduce((s, p) => s + p.lapses, 0) },
        recentResults: { sample: finished.length, byMode: countBy(finished.map((g) => g.mode)) },
        caveat: "Sample sizes are small; provisional ratings have wide uncertainty.",
      };
    }),
});

function countBy(values: string[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const value of values) out[value] = (out[value] ?? 0) + 1;
  return out;
}

export const listLessons = mutation({
  args: serviceArgs,
  handler: (ctx, base) =>
    gate(ctx, base, "list_lessons", "chess.read", async (owner) => {
      const custom = await ctx.db.query("customLessons").withIndex("by_owner_and_createdAt", (q) => q.eq("owner", owner)).order("desc").take(50);
      const progress = await ctx.db.query("lessonProgress").withIndex("by_owner_and_lessonId", (q) => q.eq("owner", owner)).take(300);
      const done = new Set(progress.filter((p) => p.completed).map((p) => p.lessonId));
      const describe = (l: { id?: string; lessonId?: string; title: string; topic: string; steps: unknown[] }, kind: string) => ({
        lessonId: l.id ?? l.lessonId,
        title: l.title,
        topic: l.topic,
        steps: l.steps.length,
        kind,
        completed: done.has((l.id ?? l.lessonId)!),
      });
      return {
        fixed: CURRICULUM.map((l) => describe(l, "fixed")),
        topics: TOPIC_LESSONS.map((l) => describe(l, "topic")),
        custom: custom.map((l) => describe(l, l.source)),
      };
    }),
});

export const getFatmaProfile = mutation({
  args: serviceArgs,
  handler: (ctx, base) =>
    gate(ctx, base, "get_fatma_profile", "chess.read", async (owner) => {
      const fatma = await readFatma(ctx, owner);
      const installed = await ctx.db.query("fatmaPacks").withIndex("by_owner_and_status", (q) => q.eq("owner", owner).eq("status", "installed")).take(20);
      const pending = await ctx.db.query("fatmaPacks").withIndex("by_owner_and_status", (q) => q.eq("owner", owner).eq("status", "pending_approval")).take(20);
      return {
        enabled: fatma?.enabled ?? true,
        mood: fatma?.mood ?? "smug",
        disableCount: fatma?.disableCount ?? 0,
        reenableCount: fatma?.reenableCount ?? 0,
        achievements: fatma?.achievements ?? [],
        stats: fatma?.stats ?? null,
        installedUpgrades: installed.map((p) => ({ packId: p.packId, version: p.version, name: p.pack.name })),
        pendingUpgrades: pending.map((p) => ({ packId: p.packId, version: p.version, name: p.pack.name })),
      };
    }),
});

// ---------------------------------------------------------------------------
// Write tools.

export const createBranch = mutation({
  args: {
    ...serviceArgs,
    sourceGameKey: v.string(),
    sourceNodeKey: v.string(),
    enginePreset: v.union(v.literal("fast"), v.literal("standard"), v.literal("deep")),
    label: v.string(),
    clientOperationId: v.string(),
    expectedRevision: v.optional(v.number()),
  },
  handler: (ctx, { sourceGameKey, sourceNodeKey, enginePreset, label, clientOperationId, expectedRevision, ...base }) =>
    gate(ctx, base, "create_branch", "chess.write", async (owner) =>
      idempotent(ctx, owner, `mcp-${clientOperationId}`, "mcp.create_branch", async () => {
        const source = await Games.getGame(ctx, owner, sourceGameKey);
        if (expectedRevision !== undefined && source.revision !== expectedRevision) {
          fail("stale_revision", `The game changed (revision ${source.revision}). Re-read it with get_game.`);
        }
        const node = await Games.getNode(ctx, source._id, sourceNodeKey);
        if (!node) fail("stale_node", "Unknown sourceNodeKey for that game.");
        const cleanLabel = label.trim().slice(0, 60);
        if (/[<>{}`\\]|https?:\/\//i.test(cleanLabel)) fail("bad_request", "Label must be plain text.");
        if (!(enginePreset in THINK_TIME_MS)) fail("bad_request", "Unknown engine preset.");
        const gameKey = `b${clientOperationId.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 40)}`;
        checkKey(gameKey, "gameKey");
        const game = await Games.createGame(ctx, owner, {
          gameKey,
          mode: "practice",
          opponentId: `full-power-${enginePreset}`,
          humanColor: source.humanColor,
          mainBranchKey: `${gameKey.slice(0, 50)}-main`,
          parentGameKey: source.gameKey,
          parentNodeKey: node.nodeKey,
          label: cleanLabel || `Branch from move ${Math.ceil(node.ply / 2)}`,
          createdBy: "mcp",
        });
        return { sessionGameKey: game.gameKey, sourceFen: game.originFen, rated: game.rated, sourceGameKey, sourceNodeKey };
      }),
    ),
});

export const queuePractice = mutation({
  args: {
    ...serviceArgs,
    items: v.array(
      v.object({
        gameKey: v.optional(v.string()),
        nodeKey: v.optional(v.string()),
        fen: v.optional(v.string()),
        acceptedUci: v.optional(v.array(v.string())),
        note: v.optional(v.string()),
      }),
    ),
    clientOperationId: v.string(),
  },
  handler: (ctx, { items, clientOperationId, ...base }) =>
    gate(ctx, base, "queue_practice", "lessons.write", async (owner) =>
      idempotent(ctx, owner, `mcp-${clientOperationId}`, "mcp.queue_practice", async () => {
        if (items.length === 0 || items.length > 10) fail("bad_request", "Queue 1-10 items at a time.");
        // Resolve and validate every item before writing anything.
        const prepared: Array<{ fen: string; accepted: string[]; item: (typeof items)[number] }> = [];
        for (const [i, item] of items.entries()) {
          let fen = item.fen;
          let accepted = item.acceptedUci ?? [];
          if (item.gameKey && item.nodeKey) {
            const resolved = await resolveNodeFen(ctx, owner, item.gameKey, item.nodeKey);
            fen = resolved.fen;
            if (accepted.length === 0) {
              const game = await Games.getGame(ctx, owner, item.gameKey);
              const saved = await ctx.db
                .query("engineAnalyses")
                .withIndex("by_gameId_and_nodeKey", (q) => q.eq("gameId", game._id).eq("nodeKey", item.nodeKey!))
                .take(8);
              const best = saved.sort((a, b) => b.depth - a.depth)[0]?.bestmove;
              if (!best) fail("analysis_missing", `Item ${i + 1}: no saved best move for that position; pass acceptedUci.`);
              accepted = [best];
            }
          }
          if (!fen) fail("bad_request", `Item ${i + 1}: give gameKey+nodeKey or a fen.`);
          if (accepted.length === 0) fail("bad_request", `Item ${i + 1}: acceptedUci is required with a raw FEN.`);
          const check = checkFen(fen);
          if (!check.ok) fail("bad_fen", `Item ${i + 1}: ${check.error}`);
          for (const uci of accepted) if (!applyUci(check.fen, uci)) fail("illegal_move", `Item ${i + 1}: ${uci} is illegal there.`);
          if (item.note && (item.note.length > 140 || /[<>{}`\\]|https?:\/\//i.test(item.note))) fail("bad_request", `Item ${i + 1}: note must be short plain text.`);
          prepared.push({ fen: check.fen, accepted, item });
        }
        const results: Array<{ itemKey: string; created: boolean }> = [];
        for (const [i, { fen, accepted, item }] of prepared.entries()) {
          results.push(
            await addPracticeItem(ctx, owner, {
              itemKey: `m${clientOperationId.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 40)}-${i}`,
              fen,
              accepted,
              theme: "coach",
              kind: "coach",
              note: item.note,
              origin: "mcp",
              sourceGameKey: item.gameKey,
              sourceNodeKey: item.nodeKey,
            }),
          );
        }
        return { items: results };
      }),
    ),
});

export const createLesson = mutation({
  args: {
    ...serviceArgs,
    title: v.string(),
    topic: v.string(),
    summary: v.string(),
    steps: v.array(lessonStepValidator),
    sourceGameKey: v.optional(v.string()),
    clientOperationId: v.string(),
  },
  handler: (ctx, { title, topic, summary, steps, sourceGameKey, clientOperationId, ...base }) =>
    gate(ctx, base, "create_lesson", "lessons.write", async (owner) =>
      idempotent(ctx, owner, `mcp-${clientOperationId}`, "mcp.create_lesson", async () => {
        const lessonId = `l${clientOperationId.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 40)}`;
        const lesson = await createCustomLesson(
          ctx,
          owner,
          { lessonId, title, topic, summary, steps },
          { createdBy: "mcp", clientId: base.clientId.slice(0, 120), sourceGameKey },
          "mcp",
        );
        return { lessonId: lesson.lessonId, steps: lesson.steps.length };
      }),
    ),
});

export const proposeFatmaUpgrade = mutation({
  args: { ...serviceArgs, pack: packValidator },
  handler: (ctx, { pack, ...base }) =>
    gate(ctx, base, "propose_fatma_upgrade", "fatma.write", async (owner) => {
      const validation = validatePack(pack);
      if (!validation.ok) fail("bad_pack", validation.errors.join("; "));
      const existing = await ctx.db
        .query("fatmaPacks")
        .withIndex("by_owner_and_packId_and_version", (q) => q.eq("owner", owner).eq("packId", pack.packId).eq("version", pack.version))
        .unique();
      if (existing) {
        if (JSON.stringify(existing.pack) !== JSON.stringify(validation.pack)) {
          fail("conflict", "That packId/version already exists with different content. Bump the version.");
        }
        return { packId: pack.packId, version: pack.version, status: existing.status };
      }
      const drafts = await ctx.db.query("fatmaPacks").withIndex("by_owner_and_status", (q) => q.eq("owner", owner).eq("status", "draft")).take(30);
      if (drafts.length >= 25) fail("quota", "Too many draft upgrades.");
      const now = Date.now();
      await ctx.db.insert("fatmaPacks", {
        owner,
        packId: validation.pack.packId,
        version: validation.pack.version,
        status: "draft",
        pack: validation.pack,
        source: "mcp",
        clientId: base.clientId.slice(0, 120),
        createdAt: now,
        updatedAt: now,
      });
      return { packId: pack.packId, version: pack.version, status: "draft", lines: validation.pack.lines.length };
    }),
});

export const installFatmaUpgrade = mutation({
  args: { ...serviceArgs, packId: v.string(), version: v.number(), clientOperationId: v.string() },
  handler: (ctx, { packId, version, clientOperationId, ...base }) =>
    gate(ctx, base, "install_fatma_upgrade", "fatma.write", async (owner, grant) =>
      idempotent(ctx, owner, `mcp-${clientOperationId}`, "mcp.install_fatma_upgrade", async () => {
        const pack = await ctx.db
          .query("fatmaPacks")
          .withIndex("by_owner_and_packId_and_version", (q) => q.eq("owner", owner).eq("packId", packId).eq("version", version))
          .unique();
        if (!pack) fail("not_found", "Propose the upgrade first.");
        if (pack.status === "installed") return { status: "installed" as const };
        if (pack.status === "rejected") fail("rejected", "The player rejected this upgrade.");
        const now = Date.now();
        if (!grant.allowAutoInstall) {
          await ctx.db.patch("fatmaPacks", pack._id, { status: "pending_approval", updatedAt: now });
          return { status: "pending_approval" as const };
        }
        const installed = await ctx.db.query("fatmaPacks").withIndex("by_owner_and_status", (q) => q.eq("owner", owner).eq("status", "installed")).take(50);
        if (installed.filter((p) => p.packId !== packId).length >= 10) fail("quota", "Fatma already has 10 upgrades installed.");
        for (const other of installed) {
          if (other.packId === packId) await ctx.db.patch("fatmaPacks", other._id, { status: "uninstalled", updatedAt: now });
        }
        await ctx.db.patch("fatmaPacks", pack._id, { status: "installed", updatedAt: now });
        const state = await readFatma(ctx, owner);
        if (state) await ctx.db.patch("fatmaStates", state._id, { pendingEvent: "upgrade_installed", updatedAt: now });
        return { status: "installed" as const };
      }),
    ),
});
