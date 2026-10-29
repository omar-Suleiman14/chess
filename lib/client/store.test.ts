import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { openDB } from "idb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { appendMove, createTree } from "../chess/history/tree";
import type { LocalGame, QueuedOp } from "./store";

const FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const game = (key: string, time: number): LocalGame => ({ meta: { gameKey: key, mode: "full_power", opponentId: "full-power-standard", humanColor: "w", rated: "unrated", status: "active", synced: false, updatedAt: time }, tree: createTree(FEN, `branch-${key}`, time) });
const operation: QueuedOp = { opId: "op1", gameKey: "game1", kind: "create", args: {}, createdAt: 1, attempts: 0 };

beforeEach(() => { vi.resetModules(); vi.stubGlobal("indexedDB", new IDBFactory()); });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("local indexed storage and analysis cache", () => {
  it("closes older local sessions without deleting history or touching imports, branches or newer sessions", async () => {
    const { store } = await import("./store");
    const old = game("old", 1);
    const imported = game("imported", 2); imported.meta.mode = "import";
    const branch = game("branch", 3); branch.meta.parentGameKey = "old";
    const newer = game("newer", 100);
    const current = game("keep", 10);
    await Promise.all([old, imported, branch, newer, current].map(g => store.saveGame(g)));
    const closed = await store.closePreviousGames("keep", 10, 10);
    expect(closed.map(g => g.meta.gameKey)).toEqual(["old"]);
    expect((await store.getGame("old"))?.meta).toMatchObject({ status: "finished", resultReason: "abort" });
    expect((await store.getGame("old"))?.tree).toEqual(old.tree);
    for (const key of ["imported", "branch", "newer", "keep"]) expect((await store.getGame(key))?.meta.status).toBe("active");
  });

  it("stops a replaced clock and preserves the result policy for a played rated game", async () => {
    const { store } = await import("./store");
    const rated = game("rated", 1);
    rated.meta.mode = "climb"; rated.meta.rated = "eligible";
    rated.tree = appendMove(rated.tree, "branch-rated", "e2e4", "rated-n1", 2).tree;
    rated.tree = appendMove(rated.tree, "branch-rated", "e7e5", "rated-n2", 3).tree;
    rated.clock = { remainingMs: { w: 60_000, b: 60_000 }, running: "b", turnStartedAt: 1, flagged: null };
    await store.saveGame(rated);
    await store.closePreviousGames("new", 10, 1000);
    const closed = await store.getGame("rated");
    expect(closed?.meta).toMatchObject({ status: "finished", result: "0-1", resultReason: "resign", rated: "eligible" });
    expect(closed?.clock).toMatchObject({ running: null, turnStartedAt: null, remainingMs: { b: 59_001 } });
    expect(Object.keys(closed!.tree.nodes)).toHaveLength(3);
  });

  it("expires card snapshots and removes revoked cards and the previous account's data", async () => {
    const { store, VIEW_CACHE_TTL_MS } = await import("./store");
    const clock = vi.spyOn(Date, "now").mockReturnValue(1000);
    await store.saveView("alice:card", "alice", { alias: "friend" });
    await store.saveView("bob:card", "bob", { alias: "other" });
    await store.saveView("public:cards", "public", []);
    expect(await store.getView("alice:card")).toEqual({ alias: "friend" });
    await store.clearViewScope("alice");
    expect(await store.getView("alice:card")).toBeUndefined();
    expect(await store.getView("bob:card")).toEqual({ alias: "other" });
    await store.deleteView("bob:card");
    expect(await store.getView("bob:card")).toBeUndefined();
    clock.mockReturnValue(1000 + VIEW_CACHE_TTL_MS);
    expect(await store.getView("public:cards")).toBeUndefined();
  });

  it("bounds card snapshots without evicting game selection and clears them with local data", async () => {
    const { store, MAX_CACHED_VIEWS } = await import("./store");
    const clock = vi.spyOn(Date, "now");
    await store.setCurrent("keep-game");
    for (let i = 0; i <= MAX_CACHED_VIEWS; i++) {
      clock.mockReturnValue(1000 + i);
      await store.saveView(`card:${i}`, "public", { alias: `p${i}` });
    }
    expect(await store.getView("card:0")).toBeUndefined();
    expect(await store.getView(`card:${MAX_CACHED_VIEWS}`)).toEqual({ alias: `p${MAX_CACHED_VIEWS}` });
    expect(await store.getCurrent()).toBe("keep-game");
    await store.clearAll();
    expect(await store.getView(`card:${MAX_CACHED_VIEWS}`)).toBeUndefined();
  });

  it("upgrades a v1 database without losing games, preferences or pending operations", async () => {
    const old = await openDB("chess-by-chaos", 1, { upgrade(db) {
      db.createObjectStore("games", { keyPath: "meta.gameKey" }).createIndex("byUpdated", "meta.updatedAt");
      db.createObjectStore("queue", { keyPath: "opId" }).createIndex("byCreated", "createdAt");
      db.createObjectStore("kv");
    } });
    await old.put("games", game("game1", 1));
    await old.put("queue", operation);
    await old.put("kv", "game1", "currentGame");
    old.close();
    const { store } = await import("./store");
    expect((await store.getGame("game1"))?.meta.gameKey).toBe("game1");
    expect(await store.getCurrent()).toBe("game1");
    expect(await store.queued()).toEqual([operation]);
    expect(await store.queuedCount()).toBe(1);
    const { writeAnalysis, readAnalysis } = await import("./analysisCache");
    await writeAnalysis(FEN, "test-settings", { score: { cp: 20 }, depth: 12, bestmove: "e2e4" });
    expect((await readAnalysis(FEN, "test-settings"))?.score.cp).toBe(20);
  });

  it("reads only the requested recent games through a descending index cursor", async () => {
    const { store } = await import("./store");
    await Promise.all(Array.from({ length: 50 }, (_, i) => store.saveGame(game(`g${i}`, i))));
    const getAll = vi.spyOn(IDBIndex.prototype, "getAll");
    expect((await store.recentGames(3)).map((row) => row.meta.gameKey)).toEqual(["g49", "g48", "g47"]);
    expect(getAll).not.toHaveBeenCalled();
    expect(await store.recentGames(0)).toEqual([]);
    expect(await store.recentGames(-10)).toEqual([]);
  });

  it("counts pending operations without reading their payloads", async () => {
    const { store } = await import("./store");
    await store.enqueue(operation);
    const getAll = vi.spyOn(IDBIndex.prototype, "getAll");
    expect(await store.queuedCount()).toBe(1);
    expect(getAll).not.toHaveBeenCalled();
    await store.dequeue(operation.opId);
    expect(await store.queuedCount()).toBe(0);
  });

  it("isolates evaluations by complete FEN, engine build and analysis settings", async () => {
    const { writeAnalysis, readAnalysis, analysisCacheKey } = await import("./analysisCache");
    await writeAnalysis(FEN, "eval", { score: { cp: 25 }, depth: 14, bestmove: "e2e4" });
    expect((await readAnalysis(FEN, "eval"))?.depth).toBe(14);
    expect(await readAnalysis(FEN.replace("0 1", "1 1"), "eval")).toBeUndefined();
    expect(await readAnalysis(FEN, "review")).toBeUndefined();
    expect(analysisCacheKey(FEN, "eval", "old-engine")).not.toBe(analysisCacheKey(FEN, "eval"));
    await writeAnalysis(FEN, "incomplete", { score: {}, depth: 0, bestmove: null });
    expect(await readAnalysis(FEN, "incomplete")).toBeUndefined();
  });

  it("bounds the analysis cache and clears it with the local game store", async () => {
    const { store, MAX_CACHED_ANALYSES } = await import("./store");
    const { writeAnalysis, readAnalysis } = await import("./analysisCache");
    for (let i = 0; i <= MAX_CACHED_ANALYSES; i++) {
      await writeAnalysis(FEN, `settings-${i}`, { score: { cp: i }, depth: 10, bestmove: "e2e4" });
    }
    expect(await readAnalysis(FEN, "settings-0")).toBeUndefined();
    expect((await readAnalysis(FEN, `settings-${MAX_CACHED_ANALYSES}`))?.score.cp).toBe(MAX_CACHED_ANALYSES);
    await store.saveGame(game("clear-me", 1));
    await store.enqueue(operation);
    await store.clearAll();
    expect(await store.recentGames()).toEqual([]);
    expect(await store.queuedCount()).toBe(0);
    expect(await readAnalysis(FEN, `settings-${MAX_CACHED_ANALYSES}`)).toBeUndefined();
  });

  it("recovers after a rejected database open and keeps play usable without storage", async () => {
    const open = vi.spyOn(indexedDB, "open").mockImplementationOnce(() => { throw new Error("storage denied"); });
    const { store } = await import("./store");
    expect(await store.getGame("missing")).toBeUndefined();
    open.mockRestore();
    expect(await store.saveGame(game("recovered", 1))).toBe(true);
    expect((await store.getGame("recovered"))?.meta.gameKey).toBe("recovered");
  });

  it("does not hang when an older tab blocks the storage upgrade", async () => {
    const old = await openDB("chess-by-chaos", 1, { upgrade(db) {
      db.createObjectStore("games", { keyPath: "meta.gameKey" }).createIndex("byUpdated", "meta.updatedAt");
      db.createObjectStore("queue", { keyPath: "opId" }).createIndex("byCreated", "createdAt");
      db.createObjectStore("kv");
    } });
    const { store } = await import("./store");
    try {
      expect(await store.getAnalysis("cache-miss")).toBeUndefined();
    } finally { old.close(); }
    expect(await store.saveGame(game("after-upgrade", 1))).toBe(true);
    expect((await store.getGame("after-upgrade"))?.meta.gameKey).toBe("after-upgrade");
  });
});

it("commits assistance without changing moves and never re-rates the game", async () => {
  const { store } = await import("./store");
  const rated = game("assisted", 1);
  rated.meta.mode = "climb"; rated.meta.rated = "eligible";
  rated.tree = appendMove(rated.tree, "branch-assisted", "e2e4", "assisted-n1", 2).tree;
  await store.saveGame(rated);
  expect(await store.markAssisted("assisted")).toBe(true);
  expect(await store.markAssisted("assisted")).toBe(true);
  const saved = await store.getGame("assisted");
  expect(saved?.meta.rated).toBe("ineligible");
  expect(saved?.tree).toEqual(rated.tree);
  await store.saveGame({ ...saved!, meta: { ...saved!.meta, status: "finished" } });
  expect(await store.markAssisted("assisted")).toBe(false);
});
