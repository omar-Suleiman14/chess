"use client";

import { useConvex } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/convex/_generated/api";
import { beginnerMove, hashSeed } from "../chess/engine/beginner";
import { SearchCancelled } from "../chess/engine/controller";
import { findOpponent, THINK_TIME_MS, type ThinkPreset } from "../chess/engine/opponents";
import { checkFlag, findTimeControl, initialClock, pause, pressClock, startTurn, type ClockState } from "../chess/clock";
import { appendMove, createTree, headNode, pathTo, rewindBranch, undoTarget, type GameTree, type TreeNode } from "../chess/history/tree";
import { applyUci, DEFAULT_POSITION, sideToMove, statusFromPath, timeoutOutcome, type AppliedMove, type Color, type Outcome } from "../chess/rules";
import type { FatmaEvent } from "../chess/personality/fatma";
import { getEngine, supportsEngine } from "./engine";
import { newKey } from "./ids";
import { store, type LocalGame, type LocalGameMeta } from "./store";
import { useSync } from "./sync";

export type NewGameOptions = {
  mode: LocalGameMeta["mode"];
  opponentId: string;
  humanColor: Color;
  timeControlId?: string;
  originFen?: string;
  parentGameKey?: string;
  parentNodeKey?: string;
  label?: string;
};

export type MoveEvent = { applied: AppliedMove; by: "human" | "fatma"; node: TreeNode };

export function monotonicNow(): number {
  // timeOrigin + performance.now() is monotonic within a page and close to epoch ms across reloads.
  return typeof performance !== "undefined" ? performance.timeOrigin + performance.now() : Date.now();
}

type Options = {
  think: ThinkPreset;
  onMove?: (event: MoveEvent) => void;
  onFatma?: (event: FatmaEvent) => void;
};

export function useChessGame({ think, onMove, onFatma }: Options) {
  const sync = useSync();
  const convex = useConvex();
  const [game, setGame] = useState<LocalGame | null>(null);
  const [thinking, setThinking] = useState(false);
  const [engineError, setEngineError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const gameRef = useRef<LocalGame | null>(null);
  const thinkRef = useRef(think);
  const callbacks = useRef({ onMove, onFatma });
  const replyGeneration = useRef(0);

  useEffect(() => {
    thinkRef.current = think;
    callbacks.current = { onMove, onFatma };
  });

  const commit = useCallback((next: LocalGame) => {
    gameRef.current = next;
    setGame(next);
    void store.saveGame(next);
  }, []);

  const ensureCreated = useCallback(
    async (g: LocalGame) => {
      if (g.meta.synced) return g;
      const mainBranch = Object.values(g.tree.branches).find((b) => b.kind === "main") ?? Object.values(g.tree.branches)[0];
      await sync.enqueue(g.meta.gameKey, "create", {
        gameKey: g.meta.gameKey,
        mode: g.meta.mode,
        opponentId: g.meta.opponentId,
        humanColor: g.meta.humanColor,
        originFen: g.tree.originFen === DEFAULT_POSITION ? undefined : g.tree.originFen,
        timeControlId: g.meta.timeControlId,
        mainBranchKey: mainBranch.key,
        parentGameKey: g.meta.parentGameKey,
        parentNodeKey: g.meta.parentNodeKey,
        label: g.meta.label,
      });
      const next = { ...g, meta: { ...g.meta, synced: true } };
      return next;
    },
    [sync],
  );

  const finishLocally = useCallback(
    (g: LocalGame, result: Outcome | undefined, reason: string): LocalGame => {
      const clock = g.clock ? pause(g.clock, monotonicNow()) : undefined;
      const next: LocalGame = { ...g, clock, meta: { ...g.meta, status: "finished", result, resultReason: reason, updatedAt: Date.now() } };
      if (result) {
        const humanScore = result === "1/2-1/2" ? 0.5 : (result === "1-0") === (g.meta.humanColor === "w") ? 1 : 0;
        callbacks.current.onFatma?.(humanScore === 1 ? "human_win" : humanScore === 0 ? "human_loss" : "draw");
      }
      return next;
    },
    [],
  );

  /** Applies a move to the active branch locally and queues it for the server. */
  const play = useCallback(
    async (uci: string, by: "human" | "fatma"): Promise<boolean> => {
      let g = gameRef.current;
      if (!g || g.meta.status !== "active") return false;
      const head = headNode(g.tree);
      const applied = applyUci(head.fen, uci);
      if (!applied) return false;
      const mover = sideToMove(head.fen);
      const now = monotonicNow();
      let clock = g.clock;
      const tc = g.meta.timeControlId ? findTimeControl(g.meta.timeControlId) : undefined;
      if (clock && tc) {
        clock = checkFlag(clock, now);
        if (clock.flagged) {
          g = finishLocally({ ...g, clock }, timeoutOutcome(head.fen, clock.flagged), clock.flagged === g.meta.humanColor ? "timeout" : "fatma_timeout");
          commit(g);
          void sync.enqueue(g.meta.gameKey, "finish", { gameKey: g.meta.gameKey, claim: "timeout" });
          return false;
        }
        clock = clock.running ? pressClock(clock, mover, tc, now) : startTurn(clock, mover === "w" ? "b" : "w", now);
      }
      if (by === "human") g = await ensureCreated(g);
      const nodeKey = newKey("n");
      const { tree, node } = appendMove(g.tree, g.tree.activeBranchKey, applied.uci, nodeKey, Date.now(), clock?.remainingMs[mover]);
      let next: LocalGame = { ...g, tree, clock, meta: { ...g.meta, updatedAt: Date.now() } };
      if (!g.meta.synced) {
        // A Fatma move before the human ever moved (human plays Black): create first.
        next = await ensureCreated(next);
      }
      void sync.enqueue(g.meta.gameKey, "append", {
        gameKey: g.meta.gameKey,
        branchKey: g.tree.activeBranchKey,
        parentKey: head.key,
        nodeKey: node.key,
        uci: applied.uci,
        clockAfterMs: clock?.remainingMs[mover],
      });
      const status = statusFromPath(tree.originFen, pathTo(tree, node.key).map((n) => n.uci));
      if (status?.over) next = finishLocally(next, status.outcome, status.reason);
      commit(next);
      callbacks.current.onMove?.({ applied, by, node });
      const fatmaColor: Color = g.meta.humanColor === "w" ? "b" : "w";
      if (applied.captured) callbacks.current.onFatma?.(by === "human" ? "human_capture" : "fatma_capture");
      if (applied.check && !applied.checkmate) callbacks.current.onFatma?.(mover === fatmaColor ? "check_given" : "check_received");
      return true;
    },
    [commit, ensureCreated, finishLocally, sync],
  );

  const requestReply = useCallback(async () => {
    const g = gameRef.current;
    if (!g || g.meta.status !== "active") return;
    const head = headNode(g.tree);
    if (sideToMove(head.fen) === g.meta.humanColor) return;
    const opponent = findOpponent(g.meta.opponentId);
    if (!opponent) return;
    const generation = ++replyGeneration.current;
    setThinking(true);
    setEngineError(null);
    try {
      let uci: string | null;
      if (opponent.policy.kind === "beginner") {
        await new Promise((r) => setTimeout(r, 350 + Math.random() * 450));
        uci = beginnerMove(head.fen, opponent.policy.policy, opponent.policy.blunderRate, hashSeed(`${g.meta.gameKey}:${head.ply}`));
      } else {
        if (!supportsEngine()) throw new Error("This browser cannot run the chess engine (WebAssembly workers unavailable).");
        const isFullPower = g.meta.opponentId.startsWith("full-power") || opponent.id === "climb-11";
        // Full Power follows the player's thinking-time setting; branches keep their chosen preset.
        const movetime = isFullPower && g.meta.mode === "full_power" ? THINK_TIME_MS[thinkRef.current] : opponent.policy.movetimeMs;
        const result = await getEngine().search({
          kind: "move",
          fen: head.fen,
          movetimeMs: movetime,
          depth: opponent.policy.depth,
          options: opponent.policy.options,
        });
        uci = result.bestmove;
      }
      // Discard stale replies (undo, new game, branch switch while thinking).
      const current = gameRef.current;
      if (generation !== replyGeneration.current || !current || headNode(current.tree).key !== head.key) return;
      if (uci) await play(uci, "fatma");
    } catch (error) {
      if (error instanceof SearchCancelled) return;
      if (generation === replyGeneration.current) {
        setEngineError(error instanceof Error ? error.message : "Fatma could not move.");
      }
    } finally {
      if (generation === replyGeneration.current) setThinking(false);
    }
  }, [play]);

  // Whenever it is Fatma's turn in an active game, ask for a reply.
  const headKey = game ? game.tree.branches[game.tree.activeBranchKey]?.headKey : null;
  useEffect(() => {
    const g = gameRef.current;
    if (!g || g.meta.status !== "active") return;
    if (sideToMove(headNode(g.tree).fen) !== g.meta.humanColor) void requestReply();
  }, [headKey, game?.meta.status, requestReply]);

  const humanMove = useCallback(
    async (uci: string) => {
      const g = gameRef.current;
      if (!g || g.meta.status !== "active") return false;
      if (sideToMove(headNode(g.tree).fen) !== g.meta.humanColor) return false;
      return await play(uci, "human");
    },
    [play],
  );

  const newGame = useCallback(
    async (opts: NewGameOptions) => {
      replyGeneration.current++;
      if (supportsEngine()) getEngine().cancel("move");
      setThinking(false);
      const branchKey = newKey("b");
      const tree = createTree(opts.originFen ?? DEFAULT_POSITION, branchKey, Date.now());
      const tc = opts.timeControlId ? findTimeControl(opts.timeControlId) : undefined;
      const rated = (opts.mode === "climb" || opts.mode === "timed") && !opts.parentGameKey && (opts.originFen ?? DEFAULT_POSITION) === DEFAULT_POSITION ? "eligible" : "unrated";
      const g: LocalGame = {
        meta: {
          gameKey: newKey("g"),
          mode: opts.mode,
          opponentId: opts.opponentId,
          humanColor: opts.humanColor,
          timeControlId: opts.timeControlId,
          rated,
          status: "active",
          parentGameKey: opts.parentGameKey,
          parentNodeKey: opts.parentNodeKey,
          label: opts.label,
          synced: false,
          updatedAt: Date.now(),
        },
        tree,
        clock: tc ? startTurn(initialClock(tc), sideToMove(tree.originFen), monotonicNow()) : undefined,
      };
      commit(g);
      await store.setCurrent(g.meta.gameKey);
      callbacks.current.onFatma?.("game_start");
      // Branch sessions and Black games must exist on the server before Fatma moves.
      if (opts.parentGameKey || opts.humanColor === "b") commit(await ensureCreated(g));
      return g;
    },
    [commit, ensureCreated],
  );

  const undo = useCallback(async () => {
    const g = gameRef.current;
    if (!g) return false;
    replyGeneration.current++;
    if (supportsEngine()) getEngine().cancel("move");
    setThinking(false);
    const branchKey = g.tree.activeBranchKey;
    const target = undoTarget(g.tree, branchKey, g.meta.humanColor);
    if (!target) return false;
    const variationKey = newKey("v");
    const { tree } = rewindBranch(g.tree, branchKey, target, variationKey, Date.now());
    const ratedMode = g.meta.mode === "climb" || g.meta.mode === "timed";
    // Finished rated games stay finished (their record is immutable); continue in Time Machine instead.
    if (g.meta.status === "finished" && ratedMode) return false;
    let next: LocalGame = {
      ...g,
      tree,
      meta: {
        ...g.meta,
        rated: g.meta.rated === "eligible" ? "ineligible" : g.meta.rated,
        status: "active",
        result: undefined,
        resultReason: undefined,
        updatedAt: Date.now(),
      },
    };
    if (next.clock && next.meta.timeControlId) {
      next = { ...next, clock: startTurn(pause(next.clock, monotonicNow()), g.meta.humanColor, monotonicNow()) };
    }
    if (g.meta.synced) {
      void sync.enqueue(g.meta.gameKey, "undo", { gameKey: g.meta.gameKey, branchKey, toNodeKey: target, variationKey });
    }
    commit(next);
    callbacks.current.onFatma?.("undo");
    return true;
  }, [commit, sync]);

  const resign = useCallback(async () => {
    const g = gameRef.current;
    if (!g || g.meta.status !== "active") return;
    replyGeneration.current++;
    if (supportsEngine()) getEngine().cancel("move");
    setThinking(false);
    const result: Outcome = g.meta.humanColor === "w" ? "0-1" : "1-0";
    const synced = await ensureCreated(g);
    void sync.enqueue(g.meta.gameKey, "finish", { gameKey: g.meta.gameKey, claim: "resign" });
    commit(finishLocally(synced, result, "resign"));
  }, [commit, ensureCreated, finishLocally, sync]);

  const markAssisted = useCallback(
    (reason: "eval_bar" | "hint" | "engine_lines" | "pause") => {
      const g = gameRef.current;
      if (!g || g.meta.rated !== "eligible") return;
      const next = { ...g, meta: { ...g.meta, rated: "ineligible" as const } };
      commit(next);
      if (g.meta.synced) void sync.enqueue(g.meta.gameKey, "assisted", { gameKey: g.meta.gameKey, reason });
    },
    [commit, sync],
  );

  const switchBranch = useCallback(
    (branchKey: string) => {
      const g = gameRef.current;
      if (!g || !g.tree.branches[branchKey]) return;
      replyGeneration.current++;
      commit({ ...g, tree: { ...g.tree, activeBranchKey: branchKey } });
    },
    [commit],
  );

  const retryEngine = useCallback(async () => {
    setEngineError(null);
    if (supportsEngine()) await getEngine().restart().catch(() => {});
    void requestReply();
  }, [requestReply]);

  /** Loads a game: local copy first, then the server snapshot if signed in. */
  const load = useCallback(
    async (gameKey: string): Promise<LocalGame | null> => {
      const local = await store.getGame(gameKey);
      if (local) {
        commit(local);
        await store.setCurrent(gameKey);
      }
      try {
        const snap = await convex.query(api.games.get, { gameKey });
        if (snap) {
          const pending = (await store.queued()).some((op) => op.gameKey === gameKey);
          // Never overwrite local moves that are still waiting to sync.
          if (!local || !pending) {
            const remote = fromSnapshot(snap, local?.clock);
            commit(remote);
            await store.setCurrent(gameKey);
            return remote;
          }
        }
      } catch {
        // Offline: local copy is the truth until we reconnect.
      }
      return local ?? null;
    },
    [commit, convex],
  );

  // Resume the current game on first mount.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const key = await store.getCurrent();
      if (!cancelled && key && !gameRef.current) {
        const g = await store.getGame(key);
        if (g && !cancelled && !gameRef.current) commit(g);
      }
      if (!cancelled) setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [commit]);

  // Reconcile with server decisions (conflict branches, server-decided results).
  useEffect(() => {
    return sync.onResult((op, result) => {
      const g = gameRef.current;
      if (!g || op.gameKey !== g.meta.gameKey) return;
      const r = result as { createdBranchKey?: string | null; status?: string; result?: Outcome | null; resultReason?: string | null; rated?: LocalGameMeta["rated"]; error?: string };
      if (r?.error || r?.createdBranchKey) {
        void load(g.meta.gameKey);
        return;
      }
      if (r?.status === "finished" && g.meta.status !== "finished") {
        commit(finishLocally(g, r.result ?? undefined, r.resultReason ?? "server"));
      }
      if (r?.rated && r.rated !== g.meta.rated) commit({ ...g, meta: { ...g.meta, rated: r.rated } });
    });
  }, [sync, load, commit, finishLocally]);

  // Clock ticking + flag detection.
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!game?.clock || game.meta.status !== "active") return;
    const timer = setInterval(() => {
      const g = gameRef.current;
      if (!g?.clock || g.meta.status !== "active") return;
      const checked = checkFlag(g.clock, monotonicNow());
      if (checked.flagged) {
        const head = headNode(g.tree);
        const flagged = checked.flagged;
        replyGeneration.current++;
        if (supportsEngine()) getEngine().cancel("move");
        setThinking(false);
        commit(finishLocally({ ...g, clock: checked }, timeoutOutcome(head.fen, flagged), flagged === g.meta.humanColor ? "timeout" : "fatma_timeout"));
        if (g.meta.synced) void sync.enqueue(g.meta.gameKey, "finish", { gameKey: g.meta.gameKey, claim: "timeout" });
      } else {
        setTick((t) => t + 1);
      }
    }, 100);
    return () => clearInterval(timer);
  }, [game?.clock, game?.meta.status, commit, finishLocally, sync]);

  return { game, loaded, thinking, engineError, humanMove, newGame, undo, resign, markAssisted, switchBranch, retryEngine, load };
}

type Snapshot = NonNullable<FunctionReturnType<typeof api.games.get>>;

export function fromSnapshot(snap: Snapshot, clock?: ClockState): LocalGame {
  const tree: GameTree = {
    originFen: snap.game.originFen,
    nodes: Object.fromEntries(snap.nodes.map((n) => [n.key, { key: n.key, parentKey: n.parentKey, ply: n.ply, uci: n.uci, san: n.san, fen: n.fen, createdAt: n.createdAt, clockAfterMs: n.clockAfterMs }])),
    branches: Object.fromEntries(
      snap.branches.map((b) => [b.branchKey, { key: b.branchKey, label: b.label, headKey: b.headKey, kind: b.kind, forkedFromBranchKey: b.forkedFromBranchKey, createdAt: b.createdAt }]),
    ),
    activeBranchKey: snap.game.activeBranchKey,
  };
  const g = snap.game;
  return {
    meta: {
      gameKey: g.gameKey,
      mode: g.mode,
      opponentId: g.opponentId,
      humanColor: g.humanColor,
      timeControlId: g.timeControlId,
      rated: g.rated,
      status: g.status,
      result: g.result,
      resultReason: g.resultReason,
      parentGameKey: g.parentGameKey,
      parentNodeKey: g.parentNodeKey,
      label: g.label,
      synced: true,
      updatedAt: g.updatedAt,
    },
    tree,
    clock,
  };
}
