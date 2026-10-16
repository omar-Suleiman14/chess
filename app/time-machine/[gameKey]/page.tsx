"use client";

import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { motion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/convex/_generated/api";
import { MoveReview } from "@/components/chess/MoveReview";
import { PlayerIdentity } from "@/components/chess/PlayerIdentity";
import { FatmaSprite } from "@/components/fatma/FatmaSprite";
import { MOVE_QUALITY, reviewMove } from "@/lib/chess/review";
import { Board, type LastMove } from "@/components/chess/Board";
import { Dialog, Segmented } from "@/components/chess/GameScreen";
import { PageHeader } from "@/components/shell/AppShell";
import { Select } from "@/components/ui/Select";
import { ENGINE_BUILD, SearchCancelled } from "@/lib/chess/engine/controller";
import { CLIMB_OPPONENTS } from "@/lib/chess/engine/opponents";
import { formatScore, type WhiteScore } from "@/lib/chess/engine/uci";
import { exportPgn } from "@/lib/chess/history/pgn";
import { branchList, childrenOf, createTree, moveLabel, pathTo, type TreeNode } from "@/lib/chess/history/tree";
import { findMistakes } from "@/lib/chess/lessons/adaptive";
import { kingSquare, positionStatus, sideToMove, type Square } from "@/lib/chess/rules";
import { getEngine, supportsEngine } from "@/lib/client/engine";
import { newKey } from "@/lib/client/ids";
import { useSettings } from "@/lib/client/settings";
import { playSound } from "@/lib/client/sound";
import { store, type LocalGame } from "@/lib/client/store";
import { useSync } from "@/lib/client/sync";
import { fromSnapshot } from "@/lib/client/useChessGame";

const SPEEDS = [0.5, 1, 2] as const;
const REVIEW_MOVETIME = 700;

export default function ReplayPage({ params }: { params: Promise<{ gameKey: string }> }) {
  const { gameKey } = use(params);
  const { isAuthenticated } = useConvexAuth();
  const router = useRouter();
  const sync = useSync();
  const { settings, reducedMotion } = useSettings();
  const remote = useQuery(api.games.get, isAuthenticated ? { gameKey } : "skip");
  const saved = useQuery(api.analysis.forGame, isAuthenticated && remote ? { gameKey } : "skip");
  const childGames = useQuery(api.games.children, isAuthenticated && remote ? { gameKey } : "skip");
  const createGame = useMutation(api.games.create);
  const practiceFrom = useMutation(api.lessons.practiceFrom);
  const [local, setLocal] = useState<LocalGame | null | undefined>(undefined);
  const [branchKey, setBranchKey] = useState<string | null>(null);
  const [cursor, setCursor] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1);
  const [scores, setScores] = useState<Record<string, { score: WhiteScore; depth?: number; bestmove?: string | null }>>({});
  const [analysing, setAnalysing] = useState<{ done: number; total: number } | null>(null);
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

  const tree = game?.tree ?? createTree("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", "x", 0);
  const activeBranch = branchKey && tree.branches[branchKey] ? branchKey : tree.activeBranchKey;
  const path = useMemo(() => (game ? pathTo(tree, tree.branches[activeBranch]?.headKey ?? "root") : []), [game, tree, activeBranch]);

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
          next[a.nodeKey] = { score: a.scoreMate !== undefined ? { mate: a.scoreMate } : { cp: a.scoreCp ?? 0 }, depth: a.depth, bestmove: a.bestmove };
        }
      }
      return next;
    });
  }, [saved]);

  // Jump to the end when a game/branch loads.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCursor(path.length);
  }, [path.length, activeBranch]);

  // Playback.
  useEffect(() => {
    if (!playing) return;
    if (cursor >= path.length) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPlaying(false);
      return;
    }
    const timer = setTimeout(() => setCursor((c) => c + 1), 900 / speed);
    return () => clearTimeout(timer);
  }, [playing, cursor, path.length, speed]);

  const node = cursor === 0 ? tree.nodes.root : path[cursor - 1];
  const fen = node?.fen ?? tree.originFen;
  const lastMove: LastMove = node && node.ply > 0 ? { from: node.uci.slice(0, 2) as Square, to: node.uci.slice(2, 4) as Square, key: `${node.key}-${cursor}` } : null;
  // Animate one-step moves (forward, or in reverse when stepping back); jumps snap.
  const [shown, setShown] = useState<{ cursor: number; motion: LastMove }>({ cursor, motion: null });
  if (shown.cursor !== cursor) {
    let motionMove: LastMove = null;
    if (cursor === shown.cursor + 1 && path[cursor - 1]) motionMove = moveMotion(path[cursor - 1], false, cursor);
    else if (cursor === shown.cursor - 1 && path[shown.cursor - 1]) motionMove = moveMotion(path[shown.cursor - 1], true, cursor);
    setShown({ cursor, motion: motionMove });
  }

  const status = positionStatus(fen);

  useEffect(() => {
    if (cursor > 0 && settings.sound && !reducedMotion) playSound("select", settings.volume * 0.7);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursor]);

  // Keyboard scrubbing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "ArrowLeft") setCursor((c) => Math.max(0, c - 1));
      if (e.key === "ArrowRight") setCursor((c) => Math.min(path.length, c + 1));
      if (e.key === " ") {
        e.preventDefault();
        setPlaying((p) => !p);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [path.length]);

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
        before: before ? { score: before.score, bestmove: before.bestmove ?? undefined, depth: before.depth } : undefined,
        after: after ? { score: after.score, depth: after.depth } : undefined,
      };
    });
    return findMistakes(moves, game.meta.humanColor);
  }, [game, path, scores, tree.nodes]);
  const reviewed = useMemo(() => path.flatMap((n) => {
    const parent = tree.nodes[n.parentKey ?? "root"];
    const before = scores[parent.key];
    const after = scores[n.key];
    const review = reviewMove({ fenBefore: parent.fen, uci: n.uci, san: n.san, ply: n.ply,
      before: before ? { ...before, bestmove: before.bestmove ?? undefined } : undefined, after });
    return review ? [review] : [];
  }), [path, scores, tree.nodes]);
  const selectedReview = reviewed.find((move) => move.ply === node?.ply);
  const selectedStyle = selectedReview ? MOVE_QUALITY[selectedReview.quality] : null;
  const mistakePlies = new Set(mistakes.map((m) => m.ply));

  const analyse = useCallback(async () => {
    if (!supportsEngine() || !game) return;
    const run = ++analysisRun.current;
    const nodes = [tree.nodes.root, ...path].filter((n) => !scores[n.key] || (scores[n.key].depth ?? 0) < 10);
    setMessage(null);
    setAnalysing({ done: 0, total: nodes.length });
    for (const [i, n] of nodes.entries()) {
      if (run !== analysisRun.current) return;
      if (positionStatus(n.fen).over) { setAnalysing({ done: i + 1, total: nodes.length }); continue; }
      try {
        const result = await getEngine().search({ kind: "review", fen: n.fen, movetimeMs: REVIEW_MOVETIME });
        if (run !== analysisRun.current) return;
        setScores((s) => ({ ...s, [n.key]: { score: result.score, depth: result.depth, bestmove: result.bestmove } }));
        if (game.meta.synced && isAuthenticated && result.depth && (result.score.cp !== undefined || result.score.mate !== undefined)) {
          void sync.enqueue(game.meta.gameKey, "analysis", {
            gameKey: game.meta.gameKey,
            nodeKey: n.key,
            engineBuild: ENGINE_BUILD,
            settingsHash: `review:mt${REVIEW_MOVETIME}:mpv1`,
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
        if (!(error instanceof SearchCancelled)) { setMessage("Analysis stopped. Tap Analyse to retry the remaining positions."); break; }
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
        setMessage("Couldn't create the branch online. Try again when connected.");
        return;
      }
    }
    // Guest / device-only game: branch locally.
    await store.saveGame({
      meta: {
        gameKey: newGameKey,
        mode: "practice",
        opponentId,
        humanColor: sideToMove(from.fen),
        rated: "unrated",
        status: "active",
        label,
        synced: false,
        updatedAt: Date.now(),
      },
      tree: createTree(from.fen, mainBranchKey, Date.now()),
    });
    await store.setCurrent(newGameKey);
    router.push(`/game/${newGameKey}`);
  };

  const downloadPgn = () => {
    if (!game) return;
    const text = exportPgn(tree, {
      Date: new Date().toISOString().slice(0, 10).replace(/-/g, "."),
      White: game.meta.humanColor === "w" ? "You" : "Fatma",
      Black: game.meta.humanColor === "b" ? "You" : "Fatma",
      Result: game.meta.result ?? "*",
    }, tree.branches[activeBranch].headKey);
    const blob = new Blob([text], { type: "application/x-chess-pgn" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `chess-${game.meta.gameKey}.pgn`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (game === null && local !== undefined && (remote === null || !isAuthenticated)) {
    return (
      <main className="mx-auto max-w-xl">
        <PageHeader title="Time Machine" />
        <p className="px-4">Game not found on this device{isAuthenticated ? " or your account" : ". Sign in to see synced games"}.</p>
      </main>
    );
  }
  if (!game) return <p className="p-6 text-muted" role="status">Loading game…</p>;

  const alternatives = node ? childrenOf(tree, node.key).filter((c) => c.key !== path[cursor]?.key) : [];
  const branches = branchList(tree);

  return (
    <main className="mx-auto min-h-dvh max-w-5xl px-3 pb-8">
      <PageHeader title="Time Machine" />
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_320px]">
        <div className="mx-auto w-full max-w-[min(92vw,calc(100dvh-260px),640px)]">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold"><FatmaSprite expression="idle" size={42} reducedMotion={reducedMotion} />Fatma</div>
          <Board
            moveBadge={selectedReview && selectedStyle && node ? { square: node.uci.slice(2, 4) as Square, symbol: selectedStyle.symbol, color: selectedStyle.color, label: selectedStyle.label } : undefined}
            result={game.meta.status === "finished" && cursor === path.length && activeBranch === tree.activeBranchKey ? { result: game.meta.result, reason: game.meta.resultReason } : undefined}
            fen={fen}
            orientation={game.meta.humanColor}
            movable={null}
            onMove={() => false}
            lastMove={lastMove}
            motionMove={shown.motion}
            fast
            checkSquare={status.check ? kingSquare(fen, sideToMove(fen)) ?? null : null}
            coordinates={settings.coordinates}
            reducedMotion={reducedMotion}
            label={`Replay board at ${node ? moveLabel(node) : "start"}`}
          />
          <PlayerIdentity />
          <div className="mt-3 flex items-center gap-2">
            <button onClick={() => setCursor(0)} aria-label="Go to start" className="grid h-11 w-11 place-items-center rounded-full bg-surface shadow-[var(--shadow)]">⏮</button>
            <button onClick={() => setCursor((c) => Math.max(0, c - 1))} aria-label="Previous move" className="grid h-11 w-11 place-items-center rounded-full bg-surface shadow-[var(--shadow)]">◀</button>
            <button onClick={() => setPlaying((p) => !p)} aria-label={playing ? "Pause" : "Play"} className="grid h-11 flex-1 place-items-center rounded-full bg-accent font-medium text-accent-text">
              {playing ? "Pause" : "Play"}
            </button>
            <button onClick={() => setCursor((c) => Math.min(path.length, c + 1))} aria-label="Next move" className="grid h-11 w-11 place-items-center rounded-full bg-surface shadow-[var(--shadow)]">▶</button>
            <button onClick={() => setSpeed((s) => SPEEDS[(SPEEDS.indexOf(s) + 1) % SPEEDS.length])} aria-label={`Playback speed ${speed}x`} className="h-11 rounded-full bg-surface px-3 text-sm tabular-nums shadow-[var(--shadow)]">
              {speed}×
            </button>
          </div>
          <input
            type="range"
            min={0}
            max={path.length}
            value={cursor}
            onChange={(e) => {
              setPlaying(false);
              setCursor(Number(e.target.value));
            }}
            aria-label="Scrub through the game"
            aria-valuetext={node ? moveLabel(node) : "Start"}
            className="ios-range mt-3 w-full"
            style={{ ["--pct" as string]: `${(cursor / Math.max(1, path.length)) * 100}%`, ["--range-fill" as string]: "var(--accent)" }}
          />
          <div className="relative h-2" aria-hidden="true">
            {[...mistakePlies].map((ply) => (
              <span key={ply} className="absolute top-0 h-2 w-1 rounded bg-danger" style={{ left: `${(ply / Math.max(1, path.length)) * 100}%` }} />
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={() => node && setContinueFrom(node)}
              disabled={!node || positionStatus(node.fen).over}
              className="min-h-12 flex-1 rounded-2xl bg-accent px-4 font-semibold text-accent-text disabled:opacity-40"
            >
              Continue from here
            </button>
            {analysing ? (
              <button onClick={() => { analysisRun.current++; getEngine().cancel("review"); setAnalysing(null); }} className="min-h-12 rounded-2xl bg-surface px-4 shadow-[var(--shadow)]">
                Stop ({analysing.done}/{analysing.total})
              </button>
            ) : (
              <button onClick={() => void analyse()} className="min-h-12 rounded-2xl bg-surface px-4 shadow-[var(--shadow)]">
                Analyse
              </button>
            )}
          </div>
          {message && <p className="mt-2 text-sm text-danger" role="alert">{message}</p>}
        </div>

        <aside className="grid content-start gap-3">
          <MoveReview moves={reviewed} total={path.length} human={game.meta.humanColor} cursor={node?.ply ?? 0} onSelect={(ply) => { setPlaying(false); const index = path.findIndex((move) => move.ply === ply); if (index >= 0) setCursor(index + 1); }} />
          <ol className="max-h-[40dvh] overflow-y-auto rounded-2xl bg-surface p-2 text-sm shadow-[var(--shadow)]" aria-label="Moves">
            {path.map((n, i) => (
              <li key={n.key} className="inline-block">
                <button
                  onClick={() => {
                    setPlaying(false);
                    setCursor(i + 1);
                  }}
                  aria-current={cursor === i + 1 ? "step" : undefined}
                  className={`relative m-0.5 rounded-lg px-2 py-1 transition-colors duration-150 ${cursor === i + 1 ? "text-accent-text" : ""} ${mistakePlies.has(n.ply) ? "underline decoration-danger decoration-2" : ""}`}
                >
                  {cursor === i + 1 && <motion.span layoutId="tm-active-move" className="absolute inset-0 rounded-lg bg-accent" transition={{ type: "spring", stiffness: 600, damping: 45 }} />}
                  <span className="relative">
                    {n.ply % 2 === 1 ? `${Math.ceil(n.ply / 2)}. ` : ""}
                    {n.san}
                    {(() => { const review = reviewed.find((move) => move.ply === n.ply); return review ? <span className="ml-1 font-bold" title={MOVE_QUALITY[review.quality].label} style={{ color: MOVE_QUALITY[review.quality].color }}>{MOVE_QUALITY[review.quality].symbol}</span> : null; })()}
                  </span>
                </button>
              </li>
            ))}
            {path.length === 0 && <li className="p-2 text-muted">No moves yet.</li>}
          </ol>
          {/* Always occupies its line, so the layout never jumps while scrubbing. */}
          <p className="min-h-11 rounded-2xl bg-surface px-3 py-3 text-sm tabular-nums shadow-[var(--shadow)]" aria-live="polite">
            {node && scores[node.key] ? (
              <>
                Eval {formatScore(scores[node.key].score)} <span className="text-muted">· depth {scores[node.key].depth ?? "?"} · Stockfish on this device</span>
              </>
            ) : (
              <span className="text-muted">No evaluation yet · tap Analyse</span>
            )}
          </p>
          {alternatives.length > 0 && (
            <div className="rounded-2xl bg-surface p-3 text-sm shadow-[var(--shadow)]">
              <p className="mb-1 text-muted">Other moves tried here</p>
              {alternatives.map((alt) => {
                const owner = branches.find((b) => pathTo(tree, b.headKey).some((n) => n.key === alt.key));
                return (
                  <button key={alt.key} disabled={!owner} onClick={() => owner && setBranchKey(owner.key)} className="mr-2 underline disabled:no-underline">
                    {alt.san}
                  </button>
                );
              })}
            </div>
          )}
          {branches.length > 1 && (
            <div className="rounded-2xl bg-surface p-3 text-sm shadow-[var(--shadow)]">
              <p className="mb-1 text-muted">Lines in this game</p>
              <ul className="grid gap-1">
                {branches.map((b) => (
                  <li key={b.key}>
                    <button onClick={() => setBranchKey(b.key)} className={`text-left ${b.key === activeBranch ? "font-semibold" : "underline"}`}>
                      {b.label} · {Math.ceil(tree.nodes[b.headKey].ply / 2)} moves
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
                    <Link href={`/time-machine/${c.gameKey}`} className="underline">{c.label ?? "Branch"}</Link>
                    <span className="tabular-nums text-muted">{c.result ?? (c.status === "active" ? "in play" : "–")}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {game.meta.parentGameKey && (
            <Link href={`/time-machine/${game.meta.parentGameKey}`} className="text-sm underline">
              ← Original game
            </Link>
          )}
          <div className="flex flex-wrap gap-2 text-sm">
            <button onClick={downloadPgn} className="rounded-full bg-surface px-3 py-2 shadow-[var(--shadow)]">Export PGN</button>
            {isAuthenticated && game.meta.synced && (
              <button
                onClick={async () => {
                  const r = await practiceFrom({ gameKey: game.meta.gameKey }).catch(() => null);
                  setMessage(r ? (r.analysedPlies === 0 ? "Analyse the game first so mistakes can be found." : `${r.created} practice position${r.created === 1 ? "" : "s"} added.`) : "Could not create practice.");
                }}
                className="rounded-full bg-surface px-3 py-2 shadow-[var(--shadow)]"
              >
                Make practice
              </button>
            )}
            {mistakes.length > 0 && (
              <button
                onClick={() => {
                  const next = mistakes.find((m) => m.ply > cursor) ?? mistakes[0];
                  setCursor(next.ply);
                }}
                className="rounded-full bg-surface px-3 py-2 shadow-[var(--shadow)]"
              >
                Next mistake ({mistakes.length})
              </button>
            )}
          </div>
        </aside>
      </div>

      {continueFrom && <ContinueDialog node={continueFrom} onClose={() => setContinueFrom(null)} onStart={(opp) => void startBranch(continueFrom, opp)} />}
    </main>
  );
}

function ContinueDialog({ node, onClose, onStart }: { node: TreeNode; onClose: () => void; onStart: (opponentId: string) => void }) {
  const [kind, setKind] = useState<"full" | "climb">("full");
  const [think, setThink] = useState<"fast" | "standard" | "deep">("standard");
  const [level, setLevel] = useState("climb-06");
  return (
    <Dialog title={`Continue from ${moveLabel(node)}`} onClose={onClose}>
      <p className="text-sm text-muted">Creates a new, unrated game. The original stays exactly as played.</p>
      <Segmented label="Opponent" value={kind} onChange={setKind} options={[["full", "Full Power"], ["climb", "Easier Fatma"]]} />
      {kind === "full" ? (
        <Segmented label="Thinking time" value={think} onChange={setThink} options={[["fast", "Fast"], ["standard", "Standard"], ["deep", "Deep"]]} />
      ) : (
        <Select label="Strength" value={level} onChange={setLevel} options={CLIMB_OPPONENTS.slice(0, -1).map((o) => ({ value: o.id, label: o.name, hint: `~${o.rating}` }))} />
      )}
      <button onClick={() => onStart(kind === "full" ? `full-power-${think}` : level)} className="min-h-12 rounded-2xl bg-accent font-semibold text-accent-text">
        Play from here
      </button>
    </Dialog>
  );
}

/** The board motion for one move, forward or reversed (castling rook included). */
function moveMotion(node: TreeNode, reverse: boolean, cursor: number): LastMove {
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
    ? { from: to, to: from, rookFrom: rookTo, rookTo: rookFrom, key: `rev-${node.key}-${cursor}` }
    : { from, to, rookFrom, rookTo, key: `fwd-${node.key}-${cursor}` };
}
