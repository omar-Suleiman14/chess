"use client";

import { capturesAlongLine } from "@/lib/chess/captures";
import { CapturedPieces } from "@/components/chess/CapturedPieces";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import Link from "@/components/navigation/PrefetchLink";
import { useAppRouter as useRouter } from "@/components/navigation/useAppRouter";
import { readAnalysis, writeAnalysis } from "@/lib/client/analysisCache";
import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/convex/_generated/api";
import { MoveReview } from "@/components/chess/MoveReview";
import { MOVE_QUALITY, reviewMove } from "@/lib/chess/review";
import { Board, type LastMove } from "@/components/chess/Board";
import { Dialog, Segmented } from "@/components/chess/GameScreen";
import { PageHeader } from "@/components/shell/AppShell";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import {
  ENGINE_BUILD,
  SearchCancelled,
  type SearchResult,
} from "@/lib/chess/engine/controller";
import { CLIMB_OPPONENTS, findOpponent } from "@/lib/chess/engine/opponents";
import { formatScore, type WhiteScore } from "@/lib/chess/engine/uci";
import { exportPgn } from "@/lib/chess/history/pgn";
import {
  branchList,
  childrenOf,
  createTree,
  moveLabel,
  pathTo,
  type TreeNode,
} from "@/lib/chess/history/tree";
import { findMistakes } from "@/lib/chess/lessons/adaptive";
import {
  kingSquare,
  positionStatus,
  sideToMove,
  type Square,
} from "@/lib/chess/rules";
import { getEngine, supportsEngine } from "@/lib/client/engine";
import { newKey } from "@/lib/client/ids";
import { useSettings } from "@/lib/client/settings";
import { playSound } from "@/lib/client/sound";
import { store, type LocalGame } from "@/lib/client/store";
import { useSync } from "@/lib/client/sync";
import { fromSnapshot } from "@/lib/client/useChessGame";

import {
  moveRows,
  positionMove,
  sharedCursor,
} from "@/lib/chess/history/explorer";
const REVIEW_MOVETIME = 700;

export default function ReplayPage({
  params,
}: {
  params: Promise<{ gameKey: string }>;
}) {
  const { gameKey } = use(params);
  const { isAuthenticated } = useConvexAuth();
  const router = useRouter();
  const sync = useSync();
  const { settings, reducedMotion } = useSettings();
  const remote = useQuery(
    api.games.get,
    isAuthenticated ? { gameKey } : "skip",
  );
  const saved = useQuery(
    api.analysis.forGame,
    isAuthenticated && remote ? { gameKey } : "skip",
  );
  const childGames = useQuery(
    api.games.children,
    isAuthenticated && remote ? { gameKey } : "skip",
  );
  const createGame = useMutation(api.games.create);
  const practiceFrom = useMutation(api.lessons.practiceFrom);
  const [local, setLocal] = useState<LocalGame | null | undefined>(undefined);
  const [branchKey, setBranchKey] = useState<string | null>(null);
  const [cursor, setCursor] = useState(0);
  const [scores, setScores] = useState<
    Record<
      string,
      {
        score: WhiteScore;
        depth?: number;
        bestmove?: string | null;
        candidates?: SearchResult["candidates"];
      }
    >
  >({});
  const [analysing, setAnalysing] = useState<{
    done: number;
    total: number;
  } | null>(null);
  const [continueFrom, setContinueFrom] = useState<TreeNode | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const analysisRun = useRef(0);

  useEffect(() => {
    void store.getGame(gameKey).then((g) => setLocal(g ?? null));
  }, [gameKey]);

  const game: LocalGame | null = useMemo(() => {
    if (remote) return fromSnapshot(remote);
    return local ?? null;
  }, [remote, local]);

  const tree =
    game?.tree ??
    createTree(
      "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
      "x",
      0,
    );
  const activeBranch =
    branchKey && tree.branches[branchKey] ? branchKey : tree.activeBranchKey;
  const path = useMemo(
    () =>
      game ? pathTo(tree, tree.branches[activeBranch]?.headKey ?? "root") : [],
    [game, tree, activeBranch],
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setScores({});
  }, [gameKey]);

  // Saved server analysis seeds the local score map.
  useEffect(() => {
    if (!saved) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setScores((s) => {
      const next = { ...s };
      for (const a of saved) {
        if (!next[a.nodeKey] || (next[a.nodeKey].depth ?? 0) < a.depth) {
          next[a.nodeKey] = {
            score:
              a.scoreMate !== undefined
                ? { mate: a.scoreMate }
                : { cp: a.scoreCp ?? 0 },
            depth: a.depth,
            bestmove: a.bestmove,
          };
        }
      }
      return next;
    });
  }, [saved]);

  const previousPath = useRef<{
    gameKey: string;
    branch: string;
    path: TreeNode[];
  } | null>(null);
  const [hintDismissed, setHintDismissed] = useState(false);
  const movePane = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!game) return;
    const previous = previousPath.current;
    let restored = path.length;
    // Restore external session storage only when loading the selected game.
    if (!previous) {
      try {
        const saved: unknown = JSON.parse(
          sessionStorage.getItem(`cbc.review.${gameKey}`) ?? "null",
        );
        if (
          saved &&
          typeof saved === "object" &&
          "branch" in saved &&
          typeof saved.branch === "string" &&
          tree.branches[saved.branch] &&
          activeBranch !== saved.branch
        ) {
          // Restore the persisted external navigation state once per game load.
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setBranchKey(saved.branch);
          return;
        }
        if (
          saved &&
          typeof saved === "object" &&
          "cursor" in saved &&
          typeof saved.cursor === "number" &&
          Number.isInteger(saved.cursor)
        )
          restored = Math.max(0, Math.min(path.length, saved.cursor));
      } catch {
        /* Start at end when unavailable. */
      }
    }
    setCursor((current) =>
      previous?.gameKey === gameKey
        ? sharedCursor(previous.path, path, current)
        : restored,
    );
    previousPath.current = { gameKey, branch: activeBranch, path };
  }, [game, gameKey, activeBranch, path, tree.branches]);
  useEffect(() => {
    const pane = movePane.current;
    const selected = pane?.querySelector<HTMLElement>('[aria-current="step"]');
    if (!pane || !selected) return;
    // Reveal inside the move pane only; never scroll the page or steal focus.
    const offset =
      selected.getBoundingClientRect().top - pane.getBoundingClientRect().top;
    if (offset < 0) pane.scrollTop += offset;
    else if (offset + selected.offsetHeight > pane.clientHeight)
      pane.scrollTop += offset + selected.offsetHeight - pane.clientHeight;
  }, [cursor, activeBranch]);
  const selectPosition = (next: number) => {
    const bounded = Math.max(0, Math.min(path.length, next));
    if (bounded === cursor) return;
    if (settings.sound) playSound("select", settings.volume * 0.7);
    setCursor(bounded);
    try {
      sessionStorage.setItem(
        `cbc.review.${gameKey}`,
        JSON.stringify({ cursor: bounded, branch: activeBranch }),
      );
    } catch {
      /* Navigation still works without storage. */
    }
  };

  const chooseLine = (key: string) => {
    const next = pathTo(tree, tree.branches[key].headKey);
    const at = sharedCursor(path, next, cursor);
    setBranchKey(key);
    setCursor(at);
    try {
      sessionStorage.setItem(
        `cbc.review.${gameKey}`,
        JSON.stringify({ cursor: at, branch: key }),
      );
    } catch {
      /* Optional navigation memory. */
    }
  };

  const node = cursor === 0 ? tree.nodes.root : path[cursor - 1];
  const fen = node?.fen ?? tree.originFen;
  const lastMove: LastMove =
    node && node.ply > 0
      ? {
          from: node.uci.slice(0, 2) as Square,
          to: node.uci.slice(2, 4) as Square,
          key: `${node.key}-${cursor}`,
        }
      : null;
  // Animate one-step moves (forward, or in reverse when stepping back); jumps snap.
  const [shown, setShown] = useState<{ cursor: number; motion: LastMove }>({
    cursor,
    motion: null,
  });
  if (shown.cursor !== cursor) {
    let motionMove: LastMove = null;
    if (cursor === shown.cursor + 1 && path[cursor - 1])
      motionMove = moveMotion(path[cursor - 1], false, cursor);
    else if (cursor === shown.cursor - 1 && path[shown.cursor - 1])
      motionMove = moveMotion(path[shown.cursor - 1], true, cursor);
    setShown({ cursor, motion: motionMove });
  }

  const status = positionStatus(fen);
  const captures = useMemo(
    () => capturesAlongLine(tree.originFen, path.slice(0, cursor)),
    [tree.originFen, path, cursor],
  );

  const mistakes = useMemo(() => {
    if (!game) return [];
    const moves = path.map((n) => {
      const parentKey = n.parentKey ?? "root";
      const before = scores[parentKey];
      const after = scores[n.key];
      return {
        fenBefore: tree.nodes[parentKey].fen,
        uci: n.uci,
        san: n.san,
        ply: n.ply,
        before: before
          ? {
              score: before.score,
              bestmove: before.bestmove ?? undefined,
              depth: before.depth,
            }
          : undefined,
        after: after ? { score: after.score, depth: after.depth } : undefined,
      };
    });
    return findMistakes(moves, game.meta.humanColor);
  }, [game, path, scores, tree.nodes]);
  const reviewed = useMemo(
    () =>
      path.flatMap((n) => {
        const parent = tree.nodes[n.parentKey ?? "root"];
        const before = scores[parent.key];
        const after = scores[n.key];
        const review = reviewMove({
          fenBefore: parent.fen,
          uci: n.uci,
          san: n.san,
          ply: n.ply,
          before: before
            ? { ...before, bestmove: before.bestmove ?? undefined }
            : undefined,
          after,
        });
        return review ? [review] : [];
      }),
    [path, scores, tree.nodes],
  );
  const reviewedByPly = useMemo(() => new Map(reviewed.map((move) => [move.ply, move])), [reviewed]);
  const selectedReview = node ? reviewedByPly.get(node.ply) : undefined;
  const selectedStyle = selectedReview
    ? MOVE_QUALITY[selectedReview.quality]
    : null;

  const analyse = useCallback(async () => {
    if (!supportsEngine() || !game) return;
    const run = ++analysisRun.current;
    const nodes = [tree.nodes.root, ...path].filter(
      (n) =>
        !scores[n.key] ||
        (scores[n.key].depth ?? 0) < 10 ||
        !scores[n.key].candidates,
    );
    setMessage(null);
    setAnalysing({ done: 0, total: nodes.length });
    for (const [i, n] of nodes.entries()) {
      if (run !== analysisRun.current) return;
      if (positionStatus(n.fen).over) {
        setAnalysing({ done: i + 1, total: nodes.length });
        continue;
      }
      try {
        const settingsHash = `review:mt${REVIEW_MOVETIME}:mpv2:v2`;
        const cached = await readAnalysis(n.fen, settingsHash);
        if (run !== analysisRun.current) return;
        const result = cached
          ? { ...cached, elapsedMs: cached.computeMs }
          : await getEngine().search({
              kind: "review",
              fen: n.fen,
              gameId: `review:${game.meta.gameKey}`,
              movetimeMs: REVIEW_MOVETIME,
              multiPv: 2,
            });
        if (run !== analysisRun.current) return;
        if (
          !Number.isFinite(result.score.cp) &&
          !Number.isFinite(result.score.mate)
        ) {
          setMessage(
            "Engine analysis is unavailable for some positions. Retry Analyze game.",
          );
          setAnalysing({ done: i + 1, total: nodes.length });
          continue;
        }
        if (!cached) void writeAnalysis(n.fen, settingsHash, result);
        setScores((s) => ({
          ...s,
          [n.key]: {
            score: result.score,
            depth: result.depth,
            bestmove: result.bestmove,
            candidates: result.candidates,
          },
        }));
        if (
          game.meta.synced &&
          isAuthenticated &&
          result.depth &&
          (result.score.cp !== undefined || result.score.mate !== undefined)
        ) {
          void sync.enqueue(game.meta.gameKey, "analysis", {
            gameKey: game.meta.gameKey,
            nodeKey: n.key,
            engineBuild: ENGINE_BUILD,
            settingsHash,
            depth: result.depth,
            scoreCp: result.score.cp,
            scoreMate: result.score.mate,
            bestmove: result.bestmove ?? undefined,
            pv: result.pv.slice(0, 12),
            computeMs: Math.round(result.elapsedMs),
          });
        }
      } catch (error) {
        if (run !== analysisRun.current) return;
        if (!(error instanceof SearchCancelled)) {
          setMessage(
            "Analysis stopped. Tap Analyze game to retry the remaining positions.",
          );
          break;
        }
      }
      setAnalysing({ done: i + 1, total: nodes.length });
    }
    if (run === analysisRun.current) setAnalysing(null);
  }, [game, path, scores, tree.nodes, isAuthenticated, sync]);

  const cancelAnalysis = useCallback(() => {
    analysisRun.current++;
    if (supportsEngine()) getEngine().cancel("review");
  }, []);
  useEffect(() => {
    cancelAnalysis();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAnalysing(null);
    return cancelAnalysis;
  }, [gameKey, activeBranch, cancelAnalysis]);

  const startBranch = async (from: TreeNode, opponentId: string) => {
    if (!game) return;
    const newGameKey = newKey("g");
    const mainBranchKey = newKey("b");
    const label = `From ${moveLabel(from)}`;
    if (game.meta.synced && isAuthenticated) {
      try {
        await createGame({
          opId: newKey("op"),
          gameKey: newGameKey,
          mode: "practice",
          opponentId,
          humanColor: sideToMove(from.fen),
          mainBranchKey,
          parentGameKey: game.meta.gameKey,
          parentNodeKey: from.key,
          label,
        });
        router.push(`/game/${newGameKey}`);
        return;
      } catch {
        setMessage(
          "Couldn't create the branch online. Try again when connected.",
        );
        return;
      }
    }
    // Guest / device-only game: branch locally.
    const saved = await store.saveGame({
      meta: {
        gameKey: newGameKey,
        mode: "practice",
        opponentId,
        humanColor: sideToMove(from.fen),
        rated: "unrated",
        status: "active",
        parentGameKey: game.meta.gameKey,
        parentNodeKey: from.key,
        label,
        synced: false,
        updatedAt: Date.now(),
      },
      tree: createTree(from.fen, mainBranchKey, Date.now()),
    });
    if (!saved) {
      setMessage(
        "Could not save this practice game on your device. Check browser storage.",
      );
      return;
    }
    await store.setCurrent(newGameKey);
    router.push(`/game/${newGameKey}`);
  };

  const opponent =
    game?.meta.mode === "import"
      ? "Unknown player"
      : (findOpponent(game?.meta.opponentId ?? "")?.name ?? "Opponent");
  const playerNames = game?.meta.playerNames
    ? { w: game.meta.playerNames.white, b: game.meta.playerNames.black }
    : game?.meta.mode === "import"
      ? { w: "White", b: "Black" }
      : {
          w: game?.meta.humanColor === "w" ? "You" : opponent,
          b: game?.meta.humanColor === "b" ? "You" : opponent,
        };
  const downloadPgn = () => {
    if (!game) return;
    const text = exportPgn(
      tree,
      {
        Date: new Date().toISOString().slice(0, 10).replace(/-/g, "."),
        White: playerNames.w,
        Black: playerNames.b,
        Result: game.meta.result ?? "*",
      },
      tree.branches[activeBranch].headKey,
    );
    const blob = new Blob([text], { type: "application/x-chess-pgn" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `chess-${game.meta.gameKey}.pgn`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (
    game === null &&
    local !== undefined &&
    (remote === null || !isAuthenticated)
  ) {
    return (
      <main className="mx-auto max-w-xl">
        <PageHeader title="Time Machine" />
        <p className="px-4">
          Game not found on this device
          {isAuthenticated
            ? " or your account"
            : ". Sign in to see synced games"}
          .
        </p>
      </main>
    );
  }
  if (!game)
    return (
      <p className="p-6 text-muted" role="status">
        Loading game…
      </p>
    );

  const alternatives = node
    ? childrenOf(tree, node.key).filter((c) => c.key !== path[cursor]?.key)
    : [];
  const branches = branchList(tree);

  return (
    <main className="mx-auto min-h-dvh max-w-[1600px] px-3 pb-8">
      <PageHeader title="Time Machine" />
      <Link
        href="/time-machine"
        className="mb-3 inline-flex min-h-11 items-center text-sm underline"
      >
        ← Game library
      </Link>
      <div
        role="region"
        aria-label="Game explorer"
        tabIndex={0}
        className="grid gap-4 rounded-2xl focus-visible:outline-2 focus-visible:outline-accent md:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]"
        onKeyDown={(event) => {
          if (
            event.target !== event.currentTarget ||
            continueFrom ||
            [...document.querySelectorAll('[role="dialog"]')].some(
              (dialog) =>
                dialog.getClientRects().length > 0 &&
                getComputedStyle(dialog).visibility !== "hidden",
            )
          )
            return;
          const next =
            event.key === "ArrowLeft"
              ? cursor - 1
              : event.key === "ArrowRight"
                ? cursor + 1
                : event.key === "Home"
                  ? 0
                  : event.key === "End"
                    ? path.length
                    : null;
          if (next !== null) {
            event.preventDefault();
            selectPosition(next);
          }
        }}
      >
        <div className="mx-auto w-full max-w-[min(96vw,calc(100dvh-245px),900px)]">
          <div className="mb-2 flex min-h-10 items-center justify-between gap-2 text-sm">
            <span className="min-w-0 break-words font-semibold">
              {playerNames[game.meta.humanColor === "w" ? "b" : "w"]}
            </span>
            <CapturedPieces
              pieces={
                captures.captured[game.meta.humanColor === "w" ? "b" : "w"]
              }
              color={game.meta.humanColor}
              advantage={
                captures.advantage[game.meta.humanColor === "w" ? "b" : "w"]
              }
            />
          </div>
          <Board
            moveBadge={
              selectedReview && selectedStyle && node
                ? {
                    square: node.uci.slice(2, 4) as Square,
                    symbol: selectedStyle.symbol,
                    color: selectedStyle.color,
                    label: selectedStyle.label,
                  }
                : undefined
            }
            result={
              game.meta.status === "finished" &&
              cursor === path.length &&
              activeBranch === tree.activeBranchKey
                ? { result: game.meta.result, reason: game.meta.resultReason }
                : undefined
            }
            fen={fen}
            orientation={game.meta.humanColor}
            movable={null}
            onMove={() => false}
            lastMove={lastMove}
            motionMove={shown.motion}
            fast
            checkSquare={
              status.check ? (kingSquare(fen, sideToMove(fen)) ?? null) : null
            }
            coordinates={settings.coordinates}
            reducedMotion={reducedMotion}
            label={`Review board at ${cursor === 0 ? "starting position" : node?.san}`}
          />
          <div className="mt-2 flex min-h-10 items-center justify-between gap-2 text-sm">
            <span className="min-w-0 break-words font-semibold">
              {playerNames[game.meta.humanColor]}
            </span>
            <CapturedPieces
              pieces={captures.captured[game.meta.humanColor]}
              color={game.meta.humanColor === "w" ? "b" : "w"}
              advantage={captures.advantage[game.meta.humanColor]}
            />
          </div>
          <nav
            aria-label="Position navigation"
            className="mt-2 grid grid-cols-4 gap-2"
            dir="ltr"
          >
            {[
              {
                label: "First",
                aria: "First position",
                at: 0,
                disabled: cursor === 0,
              },
              {
                label: "Back",
                aria: "Previous move",
                at: cursor - 1,
                disabled: cursor === 0,
              },
              {
                label: "Next",
                aria: "Next move",
                at: cursor + 1,
                disabled: cursor >= path.length,
              },
              {
                label: "Last",
                aria: "Last position",
                at: path.length,
                disabled: cursor >= path.length,
              },
            ].map((action) => (
              <Button
                key={action.label}
                onClick={() => selectPosition(action.at)}
                disabled={action.disabled}
                aria-label={action.aria}
                className="min-h-12 rounded-xl bg-surface px-2 text-sm font-semibold disabled:opacity-40"
              >
                {action.label}
              </Button>
            ))}
          </nav>
          {!hintDismissed && (
            <div className="mt-2 flex items-center gap-2 text-xs text-muted">
              <p className="flex-1">
                Tap a move to see the position. Focus this explorer and use ← →
                to step.
              </p>
              <button
                aria-label="Dismiss navigation hint"
                className="h-11 w-11"
                onClick={() => setHintDismissed(true)}
              >
                ×
              </button>
            </div>
          )}
        </div>
        <aside className="grid min-w-0 content-start gap-3">
          <section
            aria-labelledby="position-heading"
            className="rounded-2xl bg-surface p-4"
          >
            <h2
              id="position-heading"
              className="font-semibold"
              aria-live="polite"
              aria-atomic="true"
            >
              {cursor === 0 || !node
                ? "Starting position"
                : `Move ${positionMove(tree, node).number} · ${positionMove(tree, node).color === "w" ? "White" : "Black"} played ${node.san}`}
            </h2>
            <p className="mt-1 text-sm text-muted">
              {status.over
                ? status.reason === "checkmate"
                  ? "Checkmate"
                  : "Drawn position"
                : `${sideToMove(fen) === "w" ? "White" : "Black"} to move${status.check ? " · Check" : ""}`}
            </p>
            <p className="mt-2 text-sm">
              {selectedReview && selectedStyle
                ? `${selectedStyle.label} · ${selectedReview.quality === "best" ? "Matches the engine's best move." : `Best alternative: ${selectedReview.bestSan}.`}`
                : "Not analyzed"}
            </p>
          </section>
          <div
            ref={movePane}
            className="max-h-[40dvh] overflow-y-auto overscroll-contain rounded-2xl bg-surface p-2"
          >
            <table
              className="w-full table-fixed text-sm"
              aria-label="Moves"
              dir="ltr"
            >
              <thead className="sticky top-0 z-10 bg-surface text-xs text-muted">
                <tr>
                  <th scope="col" className="w-12 py-2">
                    Move
                  </th>
                  <th scope="col">White</th>
                  <th scope="col">Black</th>
                </tr>
              </thead>
              <tbody>
                {moveRows(tree, path).map((row) => (
                  <tr key={row.number}>
                    <th scope="row" className="font-mono text-xs text-muted">
                      {row.number}
                    </th>
                    {(["white", "black"] as const).map((side) => {
                      const cell = row[side];
                      const review =
                        cell &&
                        reviewedByPly.get(cell.node.ply);
                      return (
                        <td key={side} className="p-0.5">
                          {cell ? (
                            <button
                              onClick={() => selectPosition(cell.cursor)}
                              aria-current={
                                cursor === cell.cursor ? "step" : undefined
                              }
                              aria-label={`Move ${row.number}, ${side}, ${cell.node.san}${review ? `, ${MOVE_QUALITY[review.quality].label}` : ""}`}
                              className={`min-h-11 w-full rounded-xl px-2 text-start font-mono ${cursor === cell.cursor ? "bg-accent font-bold text-accent-text" : "bg-surface-2"}`}
                            >
                              <bdi>{cell.node.san}</bdi>
                              {review && (
                                <span
                                  className="ms-1 text-xs"
                                  aria-hidden="true"
                                >
                                  {MOVE_QUALITY[review.quality].symbol}
                                </span>
                              )}
                            </button>
                          ) : (
                            <span className="px-2 text-muted">—</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            {path.length === 0 && (
              <p className="p-3 text-sm text-muted">
                No moves yet. This is the starting position.
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2 text-sm">
            {analysing ? (
              <button
                onClick={() => {
                  cancelAnalysis();
                  setAnalysing(null);
                }}
                className="min-h-11 rounded-xl bg-surface-2 px-3"
              >
                Stop analysis ({analysing.done}/{analysing.total})
              </button>
            ) : (
              <button
                disabled={!supportsEngine() || path.length === 0}
                onClick={() => void analyse()}
                className="min-h-11 rounded-xl bg-surface-2 px-3 disabled:opacity-40"
              >
                Analyze game
              </button>
            )}
            {mistakes.length > 0 && (
              <button
                onClick={() => {
                  const next =
                    mistakes.find((move) => move.ply > (node?.ply ?? 0)) ??
                    mistakes[0];
                  const index = path.findIndex((move) => move.ply === next.ply);
                  if (index >= 0) selectPosition(index + 1);
                }}
                className="min-h-11 rounded-xl bg-surface-2 px-3"
              >
                Next key moment ({mistakes.length})
              </button>
            )}
          </div>
          {message && (
            <p className="text-sm text-danger" role="alert">
              {message}
            </p>
          )}
          <details className="rounded-2xl bg-surface p-3">
            <summary className="cursor-pointer py-2 font-semibold">
              Insights &amp; analysis details
            </summary>
            <p className="my-2 text-sm text-muted">
              {node && scores[node.key]
                ? `Evaluation ${formatScore(scores[node.key].score)} · depth ${scores[node.key].depth ?? "unknown"} · Stockfish on this device`
                : "Not analyzed. Analysis is optional; selecting moves works without it."}
            </p>
            <MoveReview
              moves={reviewed}
              total={path.length}
              human={game.meta.humanColor}
              cursor={node?.ply ?? 0}
              onSelect={(ply) => {
                const index = path.findIndex((move) => move.ply === ply);
                if (index >= 0) selectPosition(index + 1);
              }}
            />
          </details>
          {alternatives.length > 0 && (
            <div className="rounded-2xl bg-surface p-3 text-sm shadow-[var(--shadow)]">
              <p className="mb-1 text-muted">Other moves tried here</p>
              {alternatives.map((alt) => {
                const owner = branches.find((b) =>
                  pathTo(tree, b.headKey).some((n) => n.key === alt.key),
                );
                return (
                  <button
                    key={alt.key}
                    disabled={!owner}
                    onClick={() => owner && chooseLine(owner.key)}
                    className="mr-2 underline disabled:no-underline"
                  >
                    {alt.san}
                  </button>
                );
              })}
            </div>
          )}
          {branches.length > 1 && (
            <div className="rounded-2xl bg-surface p-3 text-sm shadow-[var(--shadow)]">
              <p className="mb-1 text-muted">
                Line · original and alternatives
              </p>
              <ul className="grid gap-1">
                {branches.map((b) => (
                  <li key={b.key}>
                    <button
                      onClick={() => chooseLine(b.key)}
                      className={`text-left ${b.key === activeBranch ? "font-semibold" : "underline"}`}
                    >
                      {b.kind === "main" || b.kind === "import"
                        ? "Original line"
                        : b.label}{" "}
                      · {Math.ceil(tree.nodes[b.headKey].ply / 2)} moves
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {childGames && childGames.length > 0 && (
            <div className="rounded-2xl bg-surface p-3 text-sm shadow-[var(--shadow)]">
              <p className="mb-1 text-muted">Continued games</p>
              <ul className="grid gap-1">
                {childGames.map((c) => (
                  <li key={c.gameKey} className="flex justify-between gap-2">
                    <Link
                      href={`/time-machine/${c.gameKey}`}
                      className="underline"
                    >
                      {c.label ?? "Branch"}
                    </Link>
                    <span className="tabular-nums text-muted">
                      {c.result ?? (c.status === "active" ? "in play" : "–")}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {game.meta.parentGameKey && (
            <Link
              href={`/time-machine/${game.meta.parentGameKey}`}
              className="text-sm underline"
            >
              ← Original game
            </Link>
          )}
          <div className="flex flex-wrap gap-2 text-sm">
            <button
              disabled={!node || status.over}
              onClick={() => node && setContinueFrom(node)}
              className="min-h-11 rounded-full bg-surface px-3 py-2 disabled:opacity-40"
              title={
                status.over
                  ? "A finished position cannot be continued"
                  : undefined
              }
            >
              Explore from this position
            </button>
            <button
              onClick={downloadPgn}
              className="min-h-11 rounded-full bg-surface px-3 py-2 shadow-[var(--shadow)]"
            >
              Export PGN
            </button>
            {isAuthenticated && game.meta.synced && (
              <button
                onClick={async () => {
                  const r = await practiceFrom({
                    gameKey: game.meta.gameKey,
                  }).catch(() => null);
                  setMessage(
                    r
                      ? r.analysedPlies === 0
                        ? "Analyse the game first so mistakes can be found."
                        : `${r.created} practice position${r.created === 1 ? "" : "s"} added.`
                      : "Could not create practice.",
                  );
                }}
                className="min-h-11 rounded-full bg-surface px-3 py-2 shadow-[var(--shadow)]"
              >
                Create practice
              </button>
            )}
          </div>
        </aside>
      </div>

      {continueFrom && (
        <ContinueDialog
          node={continueFrom}
          onClose={() => setContinueFrom(null)}
          onStart={(opp) => void startBranch(continueFrom, opp)}
        />
      )}
    </main>
  );
}

function ContinueDialog({
  onClose,
  onStart,
}: {
  node: TreeNode;
  onClose: () => void;
  onStart: (opponentId: string) => void;
}) {
  const [kind, setKind] = useState<"full" | "climb">("full");
  const [think, setThink] = useState<"fast" | "standard" | "deep">("standard");
  const [level, setLevel] = useState("climb-06");
  return (
    <Dialog title="Explore from this position" onClose={onClose}>
      <p className="text-sm text-muted">
        Creates a new, unrated game. The original stays exactly as played.
      </p>
      <Segmented
        label="Opponent"
        value={kind}
        onChange={setKind}
        options={[
          ["full", "Full Power"],
          ["climb", "Easier Sherine"],
        ]}
      />
      {kind === "full" ? (
        <Segmented
          label="Thinking time"
          value={think}
          onChange={setThink}
          options={[
            ["fast", "Fast"],
            ["standard", "Standard"],
            ["deep", "Deep"],
          ]}
        />
      ) : (
        <Select
          label="Strength"
          value={level}
          onChange={setLevel}
          options={CLIMB_OPPONENTS.slice(0, -1).map((o) => ({
            value: o.id,
            label: o.name,
            hint: `~${o.rating}`,
          }))}
        />
      )}
      <button
        onClick={() => onStart(kind === "full" ? `full-power-${think}` : level)}
        className="min-h-12 rounded-2xl bg-accent font-semibold text-accent-text"
      >
        Create unrated game
      </button>
    </Dialog>
  );
}

/** The board motion for one move, forward or reversed (castling rook included). */
function moveMotion(
  node: TreeNode,
  reverse: boolean,
  cursor: number,
): LastMove {
  const from = node.uci.slice(0, 2) as Square;
  const to = node.uci.slice(2, 4) as Square;
  let rookFrom: Square | undefined;
  let rookTo: Square | undefined;
  if (node.san.startsWith("O-O")) {
    const rank = to[1];
    const long = node.san.startsWith("O-O-O");
    rookFrom = (long ? `a${rank}` : `h${rank}`) as Square;
    rookTo = (long ? `d${rank}` : `f${rank}`) as Square;
  }
  return reverse
    ? {
        from: to,
        to: from,
        rookFrom: rookTo,
        rookTo: rookFrom,
        key: `rev-${node.key}-${cursor}`,
      }
    : { from, to, rookFrom, rookTo, key: `fwd-${node.key}-${cursor}` };
}
