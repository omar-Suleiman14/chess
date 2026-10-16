/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import rateLimiterTest from "@convex-dev/rate-limiter/test";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const SECRET = "test-secret-0123456789-abcdefghijklmnopqrstuvwxyz";

const alice = { issuer: "https://test.clerk.accounts.dev", subject: "user_alice", tokenIdentifier: "https://test.clerk.accounts.dev|user_alice" };
const bob = { issuer: "https://test.clerk.accounts.dev", subject: "user_bob", tokenIdentifier: "https://test.clerk.accounts.dev|user_bob" };

function setup() {
  const t = convexTest(schema, modules);
  rateLimiterTest.register(t);
  return t;
}

let op = 0;
const opId = () => `op-test-${++op}-${Math.random().toString(36).slice(2, 8)}`;

async function newGame(t: ReturnType<typeof setup>, who = alice, extra: Record<string, unknown> = {}) {
  const user = t.withIdentity(who);
  const gameKey = `g-${Math.random().toString(36).slice(2, 10)}`;
  await user.mutation(api.games.create, {
    opId: opId(),
    gameKey,
    mode: "full_power",
    opponentId: "full-power-fast",
    humanColor: "w",
    mainBranchKey: `${gameKey}-main`,
    ...extra,
  });
  return { user, gameKey, branchKey: `${gameKey}-main` };
}

async function play(t: ReturnType<typeof setup>, ctx: { user: ReturnType<ReturnType<typeof setup>["withIdentity"]>; gameKey: string; branchKey: string }, ucis: string[], from = "root") {
  let parent = from;
  const keys: string[] = [];
  for (const uci of ucis) {
    const nodeKey = `n-${Math.random().toString(36).slice(2, 10)}`;
    const r = await ctx.user.mutation(api.games.appendMove, { opId: opId(), gameKey: ctx.gameKey, branchKey: ctx.branchKey, parentKey: parent, nodeKey, uci });
    parent = r.nodeKey;
    keys.push(r.nodeKey);
  }
  return keys;
}

beforeEach(() => {
  // Tests stand in for the deployment environment.
  // eslint-disable-next-line @convex-dev/no-process-env
  process.env.MCP_SERVICE_SECRET = SECRET;
});

describe("games", () => {
  it("replaces older Sherine sessions, retaining moves, branches, imports and other owners", async () => {
    const t = setup();
    const old = await newGame(t, alice, { startedAt: 1 });
    await play(t, old, ["e2e4", "e7e5"]);
    const unopened = await newGame(t, alice, { mode: "climb", opponentId: "climb-01", startedAt: 2 });
    const otherOwner = await newGame(t, bob, { startedAt: 1 });
    const branch = await newGame(t, alice, { mode: "practice", parentGameKey: old.gameKey, parentNodeKey: "root", startedAt: 3 });
    await old.user.mutation(api.games.importGame, { opId: opId(), gameKey: "import-kept", pgn: "1. e4 *", humanColor: "w" });
    const latest = await newGame(t, alice, { replaceActive: true, startedAt: Date.now() });
    const closed = await old.user.query(api.games.get, { gameKey: old.gameKey });
    expect(closed!.game).toMatchObject({ status: "finished", resultReason: "replaced" });
    expect(closed!.nodes.map(n => n.san)).toContain("e5");
    expect((await old.user.query(api.games.get, { gameKey: unopened.gameKey }))!.game).toMatchObject({ status: "finished", resultReason: "abort", rated: "unrated" });
    for (const key of [branch.gameKey, "import-kept", latest.gameKey]) expect((await old.user.query(api.games.get, { gameKey: key }))!.game.status).toBe("active");
    expect((await otherOwner.user.query(api.games.get, { gameKey: otherOwner.gameKey }))!.game.status).toBe("active");
    await expect(t.withIdentity(bob).mutation(api.games.finish, { opId: opId(), gameKey: old.gameKey, claim: "replace" })).rejects.toThrow(/not found/i);
  });

  it("a delayed offline creation cannot replace a newer session or lose its queued moves", async () => {
    const t = setup();
    const latest = await newGame(t, alice, { replaceActive: true, startedAt: 20 });
    const delayed = await newGame(t, alice, { replaceActive: true, startedAt: 10 });
    await play(t, delayed, ["e2e4", "e7e5"]);
    await delayed.user.mutation(api.games.finish, { opId: opId(), gameKey: delayed.gameKey, claim: "replace" });
    const old = await delayed.user.query(api.games.get, { gameKey: delayed.gameKey });
    expect(old!.game.status).toBe("finished");
    expect(old!.nodes).toHaveLength(3);
    expect((await latest.user.query(api.games.get, { gameKey: latest.gameKey }))!.game.status).toBe("active");
    await delayed.user.mutation(api.games.create, { opId: opId(), gameKey: delayed.gameKey, mode: "full_power", opponentId: "full-power-fast", humanColor: "w", mainBranchKey: delayed.branchKey, replaceActive: true, startedAt: 10 });
    expect((await latest.user.query(api.games.get, { gameKey: latest.gameKey }))!.game.status).toBe("active");
  });

  it("replacing a started rated game preserves resignation and applies its rating once", async () => {
    const t = setup();
    const rated = await newGame(t, alice, { mode: "climb", opponentId: "climb-01", startedAt: 1 });
    await play(t, rated, ["e2e4", "e7e5"]);
    await newGame(t, alice, { replaceActive: true, startedAt: 2 });
    await rated.user.mutation(api.games.finish, { opId: opId(), gameKey: rated.gameKey, claim: "replace" });
    expect((await rated.user.query(api.games.get, { gameKey: rated.gameKey }))!.game).toMatchObject({ status: "finished", result: "0-1", resultReason: "resign" });
    expect(await rated.user.query(api.progress.ledger, { pool: "climb" })).toHaveLength(1);
  });

  it("finishes a legacy backlog in bounded batches without losing history", async () => {
    vi.useFakeTimers();
    try {
      const t = setup();
      for (let i = 1; i <= 101; i++) await newGame(t, alice, { startedAt: i });
      const latest = await newGame(t, alice, { replaceActive: true, startedAt: 1000 });
      await t.finishAllScheduledFunctions(() => { vi.runAllTimers(); });
      const history = await latest.user.query(api.games.list, { paginationOpts: { numItems: 200, cursor: null } });
      expect(history.page).toHaveLength(102);
      expect(history.page.filter(g => g.status === "active").map(g => g.gameKey)).toEqual([latest.gameKey]);
    } finally { vi.useRealTimers(); }
  });

  it("requires sign-in and isolates owners", async () => {
    const t = setup();
    await expect(
      t.mutation(api.games.create, { opId: opId(), gameKey: "abcd1234", mode: "full_power", opponentId: "full-power-fast", humanColor: "w", mainBranchKey: "main1234" }),
    ).rejects.toThrow();
    const g = await newGame(t);
    expect(await t.withIdentity(bob).query(api.games.get, { gameKey: g.gameKey })).toBeNull();
    await expect(
      t.withIdentity(bob).mutation(api.games.appendMove, { opId: opId(), gameKey: g.gameKey, branchKey: g.branchKey, parentKey: "root", nodeKey: "nnnn1", uci: "e2e4" }),
    ).rejects.toThrow(/not found/i);
  });

  it("validates moves server-side and derives SAN/FEN", async () => {
    const t = setup();
    const g = await newGame(t);
    await expect(
      g.user.mutation(api.games.appendMove, { opId: opId(), gameKey: g.gameKey, branchKey: g.branchKey, parentKey: "root", nodeKey: "bad1", uci: "e2e5" }),
    ).rejects.toThrow();
    await play(t, g, ["e2e4"]);
    const snap = await g.user.query(api.games.get, { gameKey: g.gameKey });
    const node = snap!.nodes.find((n) => n.uci === "e2e4")!;
    expect(node.san).toBe("e4");
    expect(node.fen).toContain("4P3");
  });

  it("is idempotent: replayed operations and identical moves never duplicate nodes", async () => {
    const t = setup();
    const g = await newGame(t);
    const id = opId();
    const args = { opId: id, gameKey: g.gameKey, branchKey: g.branchKey, parentKey: "root", nodeKey: "dup-1", uci: "d2d4" };
    const first = await g.user.mutation(api.games.appendMove, args);
    const second = await g.user.mutation(api.games.appendMove, args);
    expect(second).toEqual(first);
    const snap = await g.user.query(api.games.get, { gameKey: g.gameKey });
    expect(snap!.nodes.filter((n) => n.uci === "d2d4")).toHaveLength(1);
    expect(snap!.game.revision).toBe(1);
  });

  it("undo keeps the abandoned line and replays create siblings, not edits", async () => {
    const t = setup();
    const g = await newGame(t);
    const keys = await play(t, g, ["e2e4", "e7e5", "g1f3", "b8c6"]);
    const undo = await g.user.mutation(api.games.undo, { opId: opId(), gameKey: g.gameKey, branchKey: g.branchKey, toNodeKey: keys[1], variationKey: "var-1" });
    expect(undo.preservedBranchKey).toBe("var-1");
    await play(t, g, ["f1c4"], keys[1]);
    const snap = await g.user.query(api.games.get, { gameKey: g.gameKey });
    expect(snap!.branches.map((b) => b.branchKey).sort()).toEqual([g.branchKey, "var-1"].sort());
    expect(snap!.nodes.filter((n) => n.parentKey === keys[1]).map((n) => n.san).sort()).toEqual(["Bc4", "Nf3"]);
  });

  it("never silently overwrites a branch that moved elsewhere", async () => {
    const t = setup();
    const g = await newGame(t);
    const keys = await play(t, g, ["e2e4", "e7e5"]);
    // A stale device appends from e4 even though the branch head is e5.
    const r = await g.user.mutation(api.games.appendMove, { opId: opId(), gameKey: g.gameKey, branchKey: g.branchKey, parentKey: keys[0], nodeKey: "stale-1", uci: "c7c5" });
    expect(r.createdBranchKey).toBeTruthy();
    const snap = await g.user.query(api.games.get, { gameKey: g.gameKey });
    const main = snap!.branches.find((b) => b.branchKey === g.branchKey)!;
    expect(main.headKey).toBe(keys[1]);
  });

  it("rejects an append made against a stale revision without writing anything", async () => {
    const t = setup();
    const g = await newGame(t);
    const base = { gameKey: g.gameKey, branchKey: g.branchKey, parentKey: "root" };
    const first = await g.user.mutation(api.games.appendMove, { ...base, opId: opId(), nodeKey: "rev-ok", uci: "e2e4", expectedRevision: 0 });
    expect(first.revision).toBe(1);
    await expect(
      g.user.mutation(api.games.appendMove, { ...base, opId: opId(), parentKey: first.nodeKey, nodeKey: "rev-stale", uci: "e7e5", expectedRevision: 0 }),
    ).rejects.toThrow(/changed/);
    const snap = await g.user.query(api.games.get, { gameKey: g.gameKey });
    expect(snap!.game.revision).toBe(1);
    expect(snap!.nodes.some((n) => n.key === "rev-stale")).toBe(false);
    // The current revision goes through.
    const next = await g.user.mutation(api.games.appendMove, { ...base, opId: opId(), parentKey: first.nodeKey, nodeKey: "rev-next", uci: "e7e5", expectedRevision: 1 });
    expect(next.revision).toBe(2);
  });

  it("a replayed append is not treated as stale after it succeeded", async () => {
    const t = setup();
    const g = await newGame(t);
    const args = { opId: opId(), gameKey: g.gameKey, branchKey: g.branchKey, parentKey: "root", nodeKey: "rev-replay", uci: "d2d4", expectedRevision: 0 };
    const first = await g.user.mutation(api.games.appendMove, args);
    expect(await g.user.mutation(api.games.appendMove, args)).toEqual(first);
  });

  it("decides checkmate on the server", async () => {
    const t = setup();
    const g = await newGame(t);
    await play(t, g, ["f2f3", "e7e5", "g2g4", "d8h4"]);
    const snap = await g.user.query(api.games.get, { gameKey: g.gameKey });
    expect(snap!.game).toMatchObject({ status: "finished", result: "0-1", resultReason: "checkmate" });
  });

  it("applies a Climb rating exactly once and undo makes the game unrated", async () => {
    const t = setup();
    const g = await newGame(t, alice, { mode: "climb", opponentId: "climb-01" });
    expect((await g.user.query(api.games.get, { gameKey: g.gameKey }))!.game.rated).toBe("eligible");
    const finishOp = opId();
    await g.user.mutation(api.games.finish, { opId: finishOp, gameKey: g.gameKey, claim: "resign" });
    await g.user.mutation(api.games.finish, { opId: finishOp, gameKey: g.gameKey, claim: "resign" });
    await g.user.mutation(api.games.finish, { opId: opId(), gameKey: g.gameKey, claim: "resign" });
    const ledger = await g.user.query(api.progress.ledger, { pool: "climb" });
    expect(ledger).toHaveLength(1);
    expect(ledger[0].after.rating).toBeLessThan(1500);

    const g2 = await newGame(t, alice, { mode: "climb", opponentId: "climb-01" });
    const keys = await play(t, g2, ["e2e4", "e7e5"]);
    const undo = await g2.user.mutation(api.games.undo, { opId: opId(), gameKey: g2.gameKey, branchKey: g2.branchKey, toNodeKey: "root", variationKey: "var-x1" });
    expect(undo.rated).toBe("ineligible");
    void keys;
    await g2.user.mutation(api.games.finish, { opId: opId(), gameKey: g2.gameKey, claim: "resign" });
    expect(await g2.user.query(api.progress.ledger, { pool: "climb" })).toHaveLength(1);
  });

  it("refuses a rated timeout claim while the server clock still has time", async () => {
    const t = setup();
    const g = await newGame(t, alice, { mode: "timed", opponentId: "full-power-fast", timeControlId: "3+2" });
    await expect(g.user.mutation(api.games.finish, { opId: opId(), gameKey: g.gameKey, claim: "timeout" })).rejects.toThrow(/time left/);
  });

  it("branch sessions start from the stored node and are unrated", async () => {
    const t = setup();
    const g = await newGame(t);
    const keys = await play(t, g, ["e2e4", "e7e5"]);
    const childKey = "child-game-1";
    const created = await g.user.mutation(api.games.create, {
      opId: opId(), gameKey: childKey, mode: "practice", opponentId: "full-power-standard", humanColor: "w",
      mainBranchKey: "child-main", parentGameKey: g.gameKey, parentNodeKey: keys[1], originFen: "8/8/8/8/8/8/8/K6k w - - 0 1",
    });
    expect(created.rated).toBe("unrated");
    expect(created.originFen).toContain("4p3/4P3");
  });

  it("imports PGN with variations", async () => {
    const t = setup();
    const user = t.withIdentity(alice);
    const r = await user.mutation(api.games.importGame, { opId: opId(), gameKey: "imp-0001", pgn: "1. e4 (1. d4) 1... e5 2. Nf3 *", humanColor: "w" });
    expect(r.nodes).toBe(4);
    await expect(user.mutation(api.games.importGame, { opId: opId(), gameKey: "imp-0002", pgn: "1. e5 *", humanColor: "w" })).rejects.toThrow();
  });
});

describe("MCP service gate", () => {
  async function signedUp(t: ReturnType<typeof setup>) {
    await t.withIdentity(alice).mutation(api.users.sync, {});
  }
  const base = { secret: SECRET, clerkUserId: "user_alice", clientId: "claude" };

  it("rejects a bad service secret outright", async () => {
    const t = setup();
    await signedUp(t);
    await expect(t.mutation(api.mcp.getChessProfile, { ...base, secret: "nope" })).rejects.toThrow();
  });

  it("denies tools until the player grants the scope, and audits it", async () => {
    const t = setup();
    await signedUp(t);
    const denied = await t.mutation(api.mcp.getChessProfile, base);
    expect(denied).toMatchObject({ ok: false, code: "permission_denied" });
    await t.withIdentity(alice).mutation(api.mcp.setGrant, { scopes: ["chess.read"], allowAutoInstall: false });
    expect(await t.mutation(api.mcp.getChessProfile, base)).toMatchObject({ ok: true });
    // Read scope never allows writes.
    const write = await t.mutation(api.mcp.createLesson, { ...base, title: "x", topic: "x", summary: "x", steps: [], clientOperationId: "op-12345678" });
    expect(write).toMatchObject({ ok: false, code: "permission_denied" });
    const { audits } = await t.withIdentity(alice).query(api.mcp.myGrant, {});
    expect(audits.map((a) => a.outcome)).toEqual(["denied", "ok", "denied"]);
  });

  it("cannot read another player's game", async () => {
    const t = setup();
    await signedUp(t);
    await t.withIdentity(alice).mutation(api.mcp.setGrant, { scopes: ["chess.read", "chess.write"], allowAutoInstall: false });
    const bobs = await newGame(t, bob);
    expect(await t.mutation(api.mcp.getGame, { ...base, gameKey: bobs.gameKey, maxNodes: 50 })).toMatchObject({ ok: false, code: "not_found" });
  });

  it("creates branches idempotently and rejects stale revisions", async () => {
    const t = setup();
    await signedUp(t);
    await t.withIdentity(alice).mutation(api.mcp.setGrant, { scopes: ["chess.read", "chess.write"], allowAutoInstall: false });
    const g = await newGame(t);
    const keys = await play(t, g, ["e2e4", "e7e5"]);
    const args = { ...base, sourceGameKey: g.gameKey, sourceNodeKey: keys[0], enginePreset: "standard" as const, label: "Try c5", clientOperationId: "branch-op-1" };
    const a = await t.mutation(api.mcp.createBranch, args);
    const b = await t.mutation(api.mcp.createBranch, args);
    expect(a).toMatchObject({ ok: true });
    expect(b).toEqual(a);
    expect(await t.mutation(api.mcp.createBranch, { ...args, clientOperationId: "branch-op-2", expectedRevision: 0 })).toMatchObject({ ok: false, code: "stale_revision" });
    expect(await t.mutation(api.mcp.createBranch, { ...args, clientOperationId: "branch-op-3", sourceNodeKey: "nope" })).toMatchObject({ ok: false, code: "stale_node" });
  });

  it("validates lessons and upgrade packs; installs need approval by default", async () => {
    const t = setup();
    await signedUp(t);
    await t.withIdentity(alice).mutation(api.mcp.setGrant, { scopes: ["lessons.write", "fatma.write"], allowAutoInstall: false });
    const bad = await t.mutation(api.mcp.createLesson, {
      ...base, title: "Bad", topic: "bad", summary: "s", clientOperationId: "lesson-op-1",
      steps: [{ id: "1", fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", prompt: "Go", lines: [["e2e5"]], hints: [] }],
    });
    expect(bad).toMatchObject({ ok: false, code: "bad_lesson" });
    const good = await t.mutation(api.mcp.createLesson, {
      ...base, title: "Center", topic: "center", summary: "Take the centre.", clientOperationId: "lesson-op-2",
      steps: [{ id: "1", fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", prompt: "Take the centre.", lines: [["e2e4"]], hints: [] }],
    });
    expect(good).toMatchObject({ ok: true });

    const pack = { schemaVersion: 1, packId: "thankful", version: 1, name: "Thankful", description: "Says thanks.", lines: [{ id: "a", event: "human_win", text: "Fine. Well played.", expression: "impressed" }] };
    expect(await t.mutation(api.mcp.proposeFatmaUpgrade, { ...base, pack: { ...pack, lines: [{ ...pack.lines[0], text: "<script>" }] } })).toMatchObject({ ok: false, code: "bad_pack" });
    expect(await t.mutation(api.mcp.proposeFatmaUpgrade, { ...base, pack })).toMatchObject({ ok: true });
    const install = await t.mutation(api.mcp.installFatmaUpgrade, { ...base, packId: "thankful", version: 1, clientOperationId: "install-op-1" });
    expect(install).toMatchObject({ ok: true, data: { status: "pending_approval" } });
    await t.withIdentity(alice).mutation(api.fatma.decidePack, { packId: "thankful", version: 1, decision: "install" });
    const state = await t.withIdentity(alice).query(api.fatma.state, {});
    expect(state!.packs.map((p) => p.packId)).toEqual(["thankful"]);
  });

  it("blocks revoked clients", async () => {
    const t = setup();
    await signedUp(t);
    await t.withIdentity(alice).mutation(api.mcp.setGrant, { scopes: ["chess.read"], allowAutoInstall: false });
    await t.withIdentity(alice).mutation(api.mcp.revokeClient, { clientId: "claude" });
    expect(await t.mutation(api.mcp.listGames, { ...base, limit: 5 })).toMatchObject({ ok: false, code: "permission_denied" });
  });
});
