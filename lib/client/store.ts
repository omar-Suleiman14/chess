"use client";

// IndexedDB persistence for local games and the offline operation queue.
// localStorage is never used for game trees.
import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import { ROOT_KEY, type GameTree } from "../chess/history/tree";
import { pause, type ClockState } from "../chess/clock";
import type { Color, Outcome } from "../chess/rules";
import type { WhiteScore } from "../chess/engine/uci";

export type LocalGameMeta = {
  gameKey: string;
  mode: "full_power" | "climb" | "timed" | "practice" | "import";
  opponentId: string;
  humanColor: Color;
  timeControlId?: string;
  rated: "eligible" | "ineligible" | "unrated";
  status: "active" | "finished";
  result?: Outcome;
  resultReason?: string;
  parentGameKey?: string;
  parentNodeKey?: string;
  label?: string;
  /** Has the server acknowledged creation? */
  synced: boolean;
  updatedAt: number;
};

export type LocalGame = { meta: LocalGameMeta; tree: GameTree; clock?: ClockState };

export type QueuedOp = {
  opId: string;
  gameKey: string;
  kind: "create" | "append" | "undo" | "finish" | "assisted" | "analysis";
  args: Record<string, unknown>;
  createdAt: number;
  attempts: number;
  lastError?: string;
};

export type CachedAnalysis = {
  key: string;
  fen: string;
  engineBuild: string;
  settingsHash: string;
  score: WhiteScore;
  depth?: number;
  bestmove: string | null;
  pv: string[];
  computeMs: number;
  updatedAt: number;
};

export const MAX_CACHED_ANALYSES = 128;
export const VIEW_CACHE_TTL_MS = 5 * 60_000;
export const MAX_CACHED_VIEWS = 64;
const VIEW_PREFIX = "cbc.view:";
type CachedView = { scope: string; data: unknown; updatedAt: number };

interface ChessDB extends DBSchema {
  games: { key: string; value: LocalGame; indexes: { byUpdated: number } };
  queue: { key: string; value: QueuedOp; indexes: { byCreated: number } };
  kv: { key: string; value: unknown };
  analyses: { key: string; value: CachedAnalysis; indexes: { byUpdated: number } };
}

let dbPromise: Promise<IDBPDatabase<ChessDB>> | null = null;

function db(): Promise<IDBPDatabase<ChessDB>> {
  if (!dbPromise) {
    dbPromise = openDB<ChessDB>("chess-by-chaos", 2, {
      upgrade(database, oldVersion) {
        if (oldVersion < 1) {
          const games = database.createObjectStore("games", { keyPath: "meta.gameKey" });
          games.createIndex("byUpdated", "meta.updatedAt");
          const queue = database.createObjectStore("queue", { keyPath: "opId" });
          queue.createIndex("byCreated", "createdAt");
          database.createObjectStore("kv");
        }
        if (oldVersion < 2) {
          const analyses = database.createObjectStore("analyses", { keyPath: "key" });
          analyses.createIndex("byUpdated", "updatedAt");
        }
      },
      blocking() {
        const previous = dbPromise;
        dbPromise = null;
        void previous?.then((database) => database.close());
      },
      terminated() { dbPromise = null; },
    }).catch((error: unknown) => { dbPromise = null; throw error; });
  }
  return dbPromise;
}

/** Wraps IDB calls so storage denial (Safari private mode, eviction) never breaks play. */
async function safe<T>(fn: (d: IDBPDatabase<ChessDB>) => Promise<T>, fallback: T): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    // An older tab can hold a v1 connection open during an upgrade. Cache
    // misses must not leave the engine or navigation waiting indefinitely.
    const database = await Promise.race([
      db(),
      new Promise<null>((resolve) => { timer = setTimeout(() => resolve(null), 1000); }),
    ]);
    if (!database) return fallback;
    return await fn(database);
  } catch {
    return fallback;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export const store = {
  saveGame: (game: LocalGame) => safe((d) => d.put("games", game).then(() => true), false),
  getGame: (gameKey: string) => safe((d) => d.get("games", gameKey), undefined),
  closePreviousGames: (keepKey: string, startedAt: number, clockNow: number) => safe(async (d) => {
    const tx = d.transaction("games", "readwrite");
    const closed: LocalGame[] = [];
    let cursor = await tx.store.openCursor();
    while (cursor) {
      const game = cursor.value;
      const meta = game.meta;
      if (meta.gameKey !== keepKey && meta.status === "active" && !meta.parentGameKey &&
        (meta.mode === "full_power" || meta.mode === "climb" || meta.mode === "timed") &&
        (game.tree.nodes[ROOT_KEY]?.createdAt ?? 0) <= startedAt) {
        const ply = game.tree.nodes[game.tree.branches[game.tree.activeBranchKey].headKey]?.ply ?? 0;
        const playedRated = ply > 1 && meta.rated === "eligible" && (meta.mode === "climb" || meta.mode === "timed");
        const next: LocalGame = { ...game, clock: game.clock ? pause(game.clock, clockNow) : undefined,
          meta: { ...meta, status: "finished", result: playedRated ? meta.humanColor === "w" ? "0-1" : "1-0" : undefined,
            resultReason: playedRated ? "resign" : ply <= 1 ? "abort" : "replaced",
            rated: !playedRated && meta.rated === "eligible" ? "unrated" : meta.rated, updatedAt: Date.now() } };
        await cursor.update(next);
        closed.push(next);
      }
      cursor = await cursor.continue();
    }
    await tx.done;
    return closed;
  }, [] as LocalGame[]),
  recentGames: (limit = 30) =>
    safe(async (d) => {
      const count = Number.isFinite(limit) ? Math.max(0, Math.min(500, Math.floor(limit))) : 30;
      if (count === 0) return [];
      const games: LocalGame[] = [];
      let cursor = await d.transaction("games").store.index("byUpdated").openCursor(null, "prev");
      while (cursor && games.length < count) {
        games.push(cursor.value);
        if (games.length < count) cursor = await cursor.continue();
      }
      return games;
    }, [] as LocalGame[]),
  deleteGame: (gameKey: string) => safe((d) => d.delete("games", gameKey), undefined),
  setCurrent: (gameKey: string | null) => safe((d) => d.put("kv", gameKey, "currentGame"), ""),
  getCurrent: () => safe((d) => d.get("kv", "currentGame") as Promise<string | null | undefined>, undefined),
  enqueue: (op: QueuedOp) => safe((d) => d.put("queue", op), ""),
  queued: () => safe((d) => d.getAllFromIndex("queue", "byCreated"), [] as QueuedOp[]),
  queuedCount: () => safe((d) => d.count("queue"), 0),
  dequeue: (opId: string) => safe((d) => d.delete("queue", opId), undefined),
  updateOp: (op: QueuedOp) => safe((d) => d.put("queue", op), ""),
  getView: <T>(key: string) => safe(async (d) => {
    const tx = d.transaction("kv", "readwrite");
    const entry = await tx.store.get(VIEW_PREFIX + key) as CachedView | undefined;
    const age = entry ? Date.now() - entry.updatedAt : Infinity;
    if (!entry || !Number.isFinite(age) || age < 0 || age >= VIEW_CACHE_TTL_MS) {
      if (entry) await tx.store.delete(VIEW_PREFIX + key);
      await tx.done;
      return undefined;
    }
    await tx.done;
    return entry.data as T;
  }, undefined as T | undefined),
  saveView: (key: string, scope: string, data: unknown) => safe(async (d) => {
    const tx = d.transaction("kv", "readwrite");
    await tx.store.put({ scope, data, updatedAt: Date.now() } satisfies CachedView, VIEW_PREFIX + key);
    const range = IDBKeyRange.bound(VIEW_PREFIX, VIEW_PREFIX + "\uffff");
    const [keys, values] = await Promise.all([tx.store.getAllKeys(range), tx.store.getAll(range)]);
    const excess = keys.length - MAX_CACHED_VIEWS;
    if (excess > 0) {
      const oldest = keys.map((key, index) => ({ key, updatedAt: (values[index] as CachedView).updatedAt })).sort((a, b) => a.updatedAt - b.updatedAt);
      for (const entry of oldest.slice(0, excess)) await tx.store.delete(entry.key);
    }
    await tx.done;
  }, undefined),
  deleteView: (key: string) => safe((d) => d.delete("kv", VIEW_PREFIX + key), undefined),
  clearViewScope: (scope: string) => safe(async (d) => {
    const tx = d.transaction("kv", "readwrite");
    let cursor = await tx.store.openCursor(IDBKeyRange.bound(VIEW_PREFIX, VIEW_PREFIX + "\uffff"));
    while (cursor) {
      if ((cursor.value as CachedView).scope === scope) await cursor.delete();
      cursor = await cursor.continue();
    }
    await tx.done;
  }, undefined),
  getAnalysis: (key: string) => safe((d) => d.get("analyses", key), undefined),
  saveAnalysis: (analysis: CachedAnalysis) => safe(async (d) => {
    const tx = d.transaction("analyses", "readwrite");
    await tx.store.put(analysis);
    let excess = (await tx.store.count()) - MAX_CACHED_ANALYSES;
    let cursor = excess > 0 ? await tx.store.index("byUpdated").openCursor() : null;
    while (cursor && excess-- > 0) {
      await cursor.delete();
      cursor = await cursor.continue();
    }
    await tx.done;
  }, undefined),
  clearAll: () =>
    safe(async (d) => {
      const tx = d.transaction(["games", "queue", "kv", "analyses"], "readwrite");
      await Promise.all([tx.objectStore("games").clear(), tx.objectStore("queue").clear(), tx.objectStore("kv").clear(), tx.objectStore("analyses").clear()]);
      await tx.done;
    }, undefined),
};
