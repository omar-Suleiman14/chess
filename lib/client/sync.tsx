"use client";

// Durable, replay-safe sync of local game operations to Convex. Operations are
// acknowledged by the server (idempotent opIds) before they leave IndexedDB.
import { useConvex, useConvexAuth } from "convex/react";
import { ConvexError } from "convex/values";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { api } from "@/convex/_generated/api";
import { newKey } from "./ids";
import { store, type QueuedOp } from "./store";

export type SyncStatus = { pending: number; online: boolean; syncing: boolean; error: string | null; signedIn: boolean };

type SyncCtx = {
  status: SyncStatus;
  enqueue: (gameKey: string, kind: QueuedOp["kind"], args: Record<string, unknown>) => Promise<void>;
  flush: () => Promise<void>;
  /** Called when the server tells us a game has diverged (conflict branch etc.). */
  onResult: (listener: (op: QueuedOp, result: unknown) => void) => () => void;
};

const Context = createContext<SyncCtx | null>(null);

/** Errors that will never succeed on retry: drop the op and surface the message. */
const PERMANENT = new Set(["illegal_move", "not_found", "bad_request", "bad_fen", "bad_pgn", "game_over", "stale_node", "conflict", "too_long", "clock_disagrees", "quota", "stale_revision"]);

export function SyncProvider({ children }: { children: ReactNode }) {
  const convex = useConvex();
  const { isAuthenticated } = useConvexAuth();
  const [status, setStatus] = useState<SyncStatus>({ pending: 0, online: true, syncing: false, error: null, signedIn: false });
  const flushing = useRef(false);
  const listeners = useRef(new Set<(op: QueuedOp, result: unknown) => void>());

  const refreshCount = useCallback(async () => {
    const pending = await store.queuedCount();
    setStatus((s) => ({ ...s, pending }));
  }, []);

  const run = useCallback(
    async (op: QueuedOp): Promise<unknown> => {
      const a = op.args as never;
      switch (op.kind) {
        case "create":
          return await convex.mutation(api.games.create, { opId: op.opId, ...(a as object) } as never);
        case "append":
          return await convex.mutation(api.games.appendMove, { opId: op.opId, ...(a as object) } as never);
        case "undo":
          return await convex.mutation(api.games.undo, { opId: op.opId, ...(a as object) } as never);
        case "finish":
          return await convex.mutation(api.games.finish, { opId: op.opId, ...(a as object) } as never);
        case "assisted":
          return await convex.mutation(api.games.markAssisted, a);
        case "analysis":
          return await convex.mutation(api.analysis.save, a);
      }
    },
    [convex],
  );

  const flush = useCallback(async () => {
    if (flushing.current || !isAuthenticated) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) return;
    flushing.current = true;
    setStatus((s) => ({ ...s, syncing: true }));
    try {
      const ops = await store.queued();
      const failedGames = new Set<string>();
      for (const op of ops) {
        // Keep per-game order: if an earlier op for this game failed transiently, wait.
        if (failedGames.has(op.gameKey)) continue;
        try {
          const result = await run(op);
          await store.dequeue(op.opId);
          for (const l of listeners.current) l(op, result);
          setStatus((s) => ({ ...s, error: null }));
        } catch (error) {
          const code = error instanceof ConvexError ? (error.data as { code?: string }).code : undefined;
          const message = error instanceof ConvexError ? (error.data as { message?: string }).message ?? "Sync failed." : "Network problem. Will retry.";
          if (code && PERMANENT.has(code)) {
            await store.dequeue(op.opId);
            for (const l of listeners.current) l(op, { error: code, message });
            // Analysis failures are not worth bothering the player about.
            if (op.kind !== "analysis") setStatus((s) => ({ ...s, error: message }));
          } else if (code === "unauthenticated") {
            failedGames.add(op.gameKey);
            break;
          } else {
            failedGames.add(op.gameKey);
            await store.updateOp({ ...op, attempts: op.attempts + 1, lastError: message });
            setStatus((s) => ({ ...s, error: message }));
          }
        }
      }
    } finally {
      flushing.current = false;
      setStatus((s) => ({ ...s, syncing: false }));
      await refreshCount();
    }
  }, [isAuthenticated, run, refreshCount]);

  const enqueue = useCallback(
    async (gameKey: string, kind: QueuedOp["kind"], args: Record<string, unknown>) => {
      await store.enqueue({ opId: newKey("op"), gameKey, kind, args, createdAt: Date.now(), attempts: 0 });
      await refreshCount();
      void flush();
    },
    [flush, refreshCount],
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStatus((s) => ({ ...s, signedIn: isAuthenticated, online: typeof navigator === "undefined" ? true : navigator.onLine }));
    void refreshCount();
    if (isAuthenticated) void flush();
    const online = () => {
      setStatus((s) => ({ ...s, online: true }));
      void flush();
    };
    const offline = () => setStatus((s) => ({ ...s, online: false }));
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    // Retry with a gentle interval for transient failures.
    const timer = setInterval(() => void flush(), 15_000);
    return () => {
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offline);
      clearInterval(timer);
    };
  }, [isAuthenticated, flush, refreshCount]);

  const onResult = useCallback((listener: (op: QueuedOp, result: unknown) => void) => {
    listeners.current.add(listener);
    return () => listeners.current.delete(listener);
  }, []);

  const value = useMemo(() => ({ status, enqueue, flush, onResult }), [status, enqueue, flush, onResult]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useSync(): SyncCtx {
  const ctx = useContext(Context);
  if (!ctx) throw new Error("useSync outside SyncProvider");
  return ctx;
}
