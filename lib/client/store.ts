"use client";

// IndexedDB persistence for local games and the offline operation queue.
// localStorage is never used for game trees.
import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { GameTree } from "../chess/history/tree";
import type { ClockState } from "../chess/clock";
import type { Color, Outcome } from "../chess/rules";

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

interface ChessDB extends DBSchema {
  games: { key: string; value: LocalGame; indexes: { byUpdated: number } };
  queue: { key: string; value: QueuedOp; indexes: { byCreated: number } };
  kv: { key: string; value: unknown };
}

let dbPromise: Promise<IDBPDatabase<ChessDB>> | null = null;

function db(): Promise<IDBPDatabase<ChessDB>> {
  if (!dbPromise) {
    dbPromise = openDB<ChessDB>("chess-by-chaos", 1, {
      upgrade(database) {
        const games = database.createObjectStore("games", { keyPath: "meta.gameKey" });
        games.createIndex("byUpdated", "meta.updatedAt");
        const queue = database.createObjectStore("queue", { keyPath: "opId" });
        queue.createIndex("byCreated", "createdAt");
        database.createObjectStore("kv");
      },
    });
  }
  return dbPromise;
}

/** Wraps IDB calls so storage denial (Safari private mode, eviction) never breaks play. */
async function safe<T>(fn: (d: IDBPDatabase<ChessDB>) => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn(await db());
  } catch {
    return fallback;
  }
}

export const store = {
  saveGame: (game: LocalGame) => safe((d) => d.put("games", game).then(() => true), false),
  getGame: (gameKey: string) => safe((d) => d.get("games", gameKey), undefined),
  recentGames: (limit = 30) =>
    safe(async (d) => {
      const all = await d.getAllFromIndex("games", "byUpdated");
      return all.reverse().slice(0, limit);
    }, [] as LocalGame[]),
  deleteGame: (gameKey: string) => safe((d) => d.delete("games", gameKey), undefined),
  setCurrent: (gameKey: string | null) => safe((d) => d.put("kv", gameKey, "currentGame"), ""),
  getCurrent: () => safe((d) => d.get("kv", "currentGame") as Promise<string | null | undefined>, undefined),
  enqueue: (op: QueuedOp) => safe((d) => d.put("queue", op), ""),
  queued: () => safe((d) => d.getAllFromIndex("queue", "byCreated"), [] as QueuedOp[]),
  dequeue: (opId: string) => safe((d) => d.delete("queue", opId), undefined),
  updateOp: (op: QueuedOp) => safe((d) => d.put("queue", op), ""),
  clearAll: () =>
    safe(async (d) => {
      await d.clear("games");
      await d.clear("queue");
      await d.clear("kv");
    }, undefined),
};
