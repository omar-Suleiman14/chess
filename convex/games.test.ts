/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import rateLimiterTest from "@convex-dev/rate-limiter/test";
import { beforeEach, describe, expect, it } from "vitest";
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
  process.env.MCP_SERVICE_SECRET = SECRET;
});

describe("games", () => {
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
