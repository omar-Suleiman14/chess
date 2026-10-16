"use client";

import { capturesAlongLine } from "@/lib/chess/captures";
import { motion } from "motion/react";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { FatmaPanel } from "@/components/fatma/FatmaPanel";
import { IOS_SPRING } from "@/components/ui/Switch";
import { MenuButton } from "@/components/shell/AppShell";
import { LoadingScreen } from "@/components/shell/LoadingScreen";
import { findTimeControl, formatClock, remaining } from "@/lib/chess/clock";
import { findOpponent } from "@/lib/chess/engine/opponents";
import { headNode, moveLabel, pathTo } from "@/lib/chess/history/tree";
import { describeMove, kingSquare, positionStatus, sideToMove, type Color, type Square } from "@/lib/chess/rules";
import { useEngineState, usePrewarmEngine } from "@/lib/client/engine";
import { useSettings } from "@/lib/client/settings";
import { haptic, playSound, unlockAudio } from "@/lib/client/sound";
import { useSync } from "@/lib/client/sync";
import { monotonicNow, useChessGame, type MoveEvent, type NewGameOptions } from "@/lib/client/useChessGame";
import { ENGINE_BUILD, EVAL_SETTINGS_HASH, useEvaluation, type Evaluation } from "@/lib/client/useEvaluation";
import { useFatma } from "@/lib/client/useFatma";
import { Board, type LastMove } from "./Board";
import { EvalBar } from "./EvalBar";
import { GameResult } from "./GameResult";
import { PlayerIdentity } from "./PlayerIdentity";

type Props = {
  /** Default options for "New game" on this screen. */
  defaults: NewGameOptions;
  /** Load this server game (deep link) instead of resuming. */
  gameKey?: string;
  /** Start a new game immediately with `defaults` (e.g. a chosen Climb level). */
  startFresh?: boolean;
  /** Only resume a stored game whose mode matches. */
  resumeMode?: NewGameOptions["mode"][];
};

export function GameScreen({ defaults, gameKey, startFresh, resumeMode }: Props) {
  const { settings, reducedMotion, update } = useSettings();
  const fatma = useFatma();
  const sync = useSync();
  const engineState = useEngineState();
  const [announcement, setAnnouncement] = useState("");
  const [lastMove, setLastMove] = useState<LastMove>(null);
  const [orientationOverride, setOrientationOverride] = useState<Color | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [confirmResign, setConfirmResign] = useState(false);
  const [evalOptIn, setEvalOptIn] = useState(false);
  const evals = useRef(new Map<string, Evaluation>());

  const onMove = useCallback(
    ({ applied, by, node }: MoveEvent) => {
      const castle = applied.flags.includes("k") || applied.flags.includes("q");
      let rookFrom: Square | undefined;
      let rookTo: Square | undefined;
      if (castle) {
        const rank = applied.to[1];
        rookFrom = (applied.flags.includes("k") ? `h${rank}` : `a${rank}`) as Square;
        rookTo = (applied.flags.includes("k") ? `f${rank}` : `d${rank}`) as Square;
      }
      setLastMove({ from: applied.from, to: applied.to, rookFrom, rookTo, key: node.key });
      const mover: Color = node.ply % 2 === 1 ? "w" : "b";
      setAnnouncement(`${by === "fatma" ? "Fatma: " : ""}${describeMove(applied, mover)}`);
      if (settings.sound) {
        playSound(applied.checkmate ? "mate" : applied.promotion ? "promote" : castle ? "castle" : applied.check ? "check" : applied.captured ? "capture" : "move", settings.volume);
      }
      if (settings.haptics && by === "human") haptic(applied.captured ? [8, 30, 8] : 8);
    },
    [settings.sound, settings.volume, settings.haptics],
  );

  const chess = useChessGame({ think: settings.think, onMove, onFatma: fatma.say });
  const { game, loaded } = chess;
  usePrewarmEngine(true);

  // Load / resume / start.
  const started = useRef(false);
  useEffect(() => {
    if (!loaded || started.current) return;
    started.current = true;
    void (async () => {
      if (gameKey) {
        const g = await chess.load(gameKey);
        if (g) return;
      }
      if (startFresh) {
        await chess.newGame(defaults);
        return;
      }
      const current = chess.game;
      if (current && (!resumeMode || resumeMode.includes(current.meta.mode)) && (current.meta.status === "active" || !resumeMode)) return;
      await chess.newGame(defaults);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  const tree = game?.tree;
  const head = tree ? headNode(tree) : null;
  const liveFen = head?.fen ?? "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
  // Review mode: step through earlier positions without changing the game.
  const [viewPly, setViewPly] = useState<number | null>(null);
  const line = useMemo(() => (tree && head ? pathTo(tree, head.key) : []), [tree, head]);
  const reviewing = viewPly !== null && viewPly < line.length;
  const viewNode = reviewing ? (viewPly === 0 ? tree!.nodes.root : line[viewPly - 1]) : head;
  const fen = viewNode?.fen ?? liveFen;
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setViewPly(null);
  }, [head?.key]);
  const navigationFeedback = useCallback(() => {
    unlockAudio();
    if (settings.sound) playSound("move", settings.volume);
    if (settings.haptics) haptic(8);
  }, [settings.sound, settings.volume, settings.haptics]);
  const step = useCallback(
    (delta: number) => {
      const at = viewPly ?? line.length;
      const next = Math.max(0, Math.min(line.length, at + delta));
      if (next === at) return;
      navigationFeedback();
      setViewPly(next >= line.length ? null : next);
    },
    [line.length, viewPly, navigationFeedback],
  );
  const captures = useMemo(() => capturesAlongLine(tree?.originFen ?? liveFen, reviewing ? line.slice(0, viewPly ?? 0) : line), [tree?.originFen, liveFen, reviewing, line, viewPly]);
  const human: Color = game?.meta.humanColor ?? "w";
  const orientation = orientationOverride ?? human;
  const status = useMemo(() => positionStatus(fen), [fen]);
  const turn = sideToMove(liveFen);
  const opponent = game ? findOpponent(game.meta.opponentId) : undefined;
  const active = game?.meta.status === "active";
  const ratedEligible = game?.meta.rated === "eligible";
  const evalAllowed = settings.evalBar && (!ratedEligible || evalOptIn);
  const checkSq = status.check ? kingSquare(fen, sideToMove(fen)) ?? null : null;
  const viewLastMove: LastMove = reviewing
    ? viewNode && viewNode.ply > 0
      ? { from: viewNode.uci.slice(0, 2) as Square, to: viewNode.uci.slice(2, 4) as Square, key: `view-${viewNode.key}` }
      : null
    : null;

  // Restore last-move highlight after reloads.
  useEffect(() => {
    if (!head || head.ply === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLastMove(null);
    } else if (!lastMove || lastMove.key !== head.key) {
      setLastMove({ from: head.uci.slice(0, 2) as Square, to: head.uci.slice(2, 4) as Square, key: `restore-${head.key}` });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [head?.key]);

  const onFinalEval = useCallback(
    (e: Evaluation) => {
      evals.current.set(e.nodeKey, e);
      const g = game;
      if (!g || !tree) return;
      // Save meaningful browser analysis for practice/MCP (signed-in, synced games).
      if (g.meta.synced && e.depth && e.depth >= 10 && (e.score.cp !== undefined || e.score.mate !== undefined)) {
        void sync.enqueue(g.meta.gameKey, "analysis", {
          gameKey: g.meta.gameKey,
          nodeKey: e.nodeKey,
          engineBuild: ENGINE_BUILD,
          settingsHash: EVAL_SETTINGS_HASH,
          depth: e.depth,
          scoreCp: e.score.cp,
          scoreMate: e.score.mate,
          bestmove: e.bestmove ?? undefined,
          pv: [],
          computeMs: 1500,
        });
      }
      // Blunder/praise detection on the human's last move (live position only).
      const node = tree.nodes[e.nodeKey];
      if (!node?.parentKey || node.ply === 0 || e.nodeKey !== headNode(tree).key) return;
      const moverIsHuman = sideToMove(tree.nodes[node.parentKey].fen) === g.meta.humanColor;
      const before = evals.current.get(node.parentKey);
      if (!moverIsHuman || !before) return;
      const sign = g.meta.humanColor === "w" ? 1 : -1;
      const val = (s: Evaluation["score"]) => (s.mate !== undefined ? Math.sign(s.mate) * 3000 : s.cp ?? 0) * sign;
      const delta = val(e.score) - val(before.score);
      if (delta <= -250) fatma.say("human_blunder");
      else if (before.bestmove === node.uci && delta > -20) fatma.say("human_good_move");
    },
    [game, tree, sync, fatma],
  );

  // End-of-game and low-time cues.
  const endSounded = useRef<string | null>(null);
  useEffect(() => {
    if (!game || game.meta.status !== "finished" || endSounded.current === game.meta.gameKey) return;
    endSounded.current = game.meta.gameKey;
    if (settings.sound && game.meta.resultReason !== "checkmate") playSound("end", settings.volume);
  }, [game, settings.sound, settings.volume]);
  const lowTimeWarned = useRef<string | null>(null);
  const humanMs = game?.clock ? remaining(game.clock, human, monotonicNow()) : null;
  useEffect(() => {
    if (humanMs === null || humanMs > 20_000 || !game || game.meta.status !== "active") return;
    if (lowTimeWarned.current === game.meta.gameKey) return;
    lowTimeWarned.current = game.meta.gameKey;
    if (settings.sound) playSound("lowtime", settings.volume);
  }, [humanMs, game, settings.sound, settings.volume]);

  const evaluation = useEvaluation(fen, viewNode?.key ?? "root", evalAllowed && !status.over, onFinalEval);

  const handleMove = useCallback(
    async (uci: string) => {
      unlockAudio();
      return await chess.humanMove(uci);
    },
    [chess],
  );

  const onUndo = useCallback(async () => {
    unlockAudio();
    if (game?.meta.status === "finished" && (game.meta.mode === "climb" || game.meta.mode === "timed")) {
      setAnnouncement("Finished rated games are kept as played. Open Time Machine to try another line.");
      return;
    }
    const ok = await chess.undo();
    if (ok) {
      setLastMove(null);
      navigationFeedback();
    }
  }, [chess, game, navigationFeedback]);

  // Keyboard shortcuts: U = undo, F = flip, N = new game.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.metaKey || e.ctrlKey || e.altKey) return;
      const inBoard = e.target instanceof HTMLElement && e.target.closest("[role=grid]");
      if (!inBoard && e.key === "ArrowLeft") step(-1);
      if (!inBoard && e.key === "ArrowRight") step(1);
      if (e.key === "u") void onUndo();
      if (e.key === "f") setOrientationOverride((o) => ((o ?? human) === "w" ? "b" : "w"));
      if (e.key === "n") setShowNew(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onUndo, human, step]);

  const tc = game?.meta.timeControlId ? findTimeControl(game.meta.timeControlId) : undefined;
  const now = monotonicNow();
  const clockFor = (c: Color) => (game?.clock ? remaining(game.clock, c, now) : null);
  const fatmaColor: Color = human === "w" ? "b" : "w";
  const moveCount = head?.ply ?? 0;
  const resultText = game?.meta.status === "finished" ? resultLine(game.meta.result, game.meta.resultReason, human) : null;
  const engineWaking = (engineState === "loading" || engineState === "idle") && active && turn !== human && opponent?.policy.kind === "stockfish";

  return (
    <main className="flex min-h-dvh w-full flex-col items-center px-3 sm:px-6">
      <LoadingScreen />
      {/* One column, exactly as wide as the board: everything groups around it. */}
      <div className="flex min-h-dvh w-full min-w-0 max-w-[min(100%,calc(100dvh-210px),790px)] flex-col">
      <header className="safe-top flex flex-wrap items-center justify-between gap-2 pb-2">
        <div className="flex min-w-0 items-center gap-2">
          <div className="min-w-0">
            <p className="sr-only">
              Chess
            </p>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <motion.button whileTap={{ scale: 0.94 }} transition={IOS_SPRING} onClick={() => setShowNew(true)} className="h-11 shrink-0 rounded-full bg-surface px-3.5 text-sm font-medium shadow-[var(--shadow)]" aria-label="New game" aria-keyshortcuts="n">
            New
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.94 }}
            transition={IOS_SPRING}
            onClick={() => setOrientationOverride((o) => ((o ?? human) === "w" ? "b" : "w"))}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-surface shadow-[var(--shadow)]"
            aria-label="Flip board"
            aria-keyshortcuts="f"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
              <path d="M7 4v13m0 0l-3-3m3 3l3-3M17 20V7m0 0l-3 3m3-3l3 3" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </motion.button>
            <button disabled={!active} onClick={() => setConfirmResign(true)} className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-surface text-ink shadow-[var(--shadow)] disabled:opacity-40" aria-label="Resign" title="Resign">
            <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true"><path d="M5 21V4m0 0h11l-2 4 2 4H5" stroke="currentColor" strokeWidth="1.9" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
          <MenuButton />
        </div>
      </header>

      <section className="flex flex-1 flex-col items-center justify-center">
        <div className="mb-2 flex w-full items-center gap-2">
          <FatmaPanel fatma={fatma} thinking={chess.thinking} reducedMotion={reducedMotion} showName captures={captures.captured[fatmaColor]} capturedColor={human} advantage={captures.advantage[fatmaColor]} />
          {tc && <ClockChip ms={clockFor(fatmaColor)} running={active && turn === fatmaColor} />}
        </div>
        <div className="flex w-full items-stretch gap-2">
          {settings.evalBar && (evalAllowed ? (
            <EvalBar score={evaluation?.score ?? null} orientation={orientation} depth={evaluation?.depth} reducedMotion={reducedMotion} />
          ) : (
            <button
              onClick={() => {
                setEvalOptIn(true);
                chess.markAssisted("eval_bar");
              }}
              className="w-[28px] shrink-0 rounded-[5px] bg-surface-2"
              aria-label="Show evaluation bar. This makes the current rated game unrated."
              title="Show evaluation (makes this game unrated)"
            />
          ))}
          <div className="relative min-w-0 flex-1">
            <Board
              result={resultText && game && !reviewing ? { result: game.meta.result, reason: game.meta.resultReason } : undefined}
              fen={fen}
              orientation={orientation}
              movable={active && turn === human && !reviewing ? human : null}
              onMove={handleMove}
              lastMove={reviewing ? viewLastMove : lastMove}
              checkSquare={checkSq}
              showLegalDots={settings.legalDots}
              coordinates={settings.coordinates}
              reducedMotion={reducedMotion}
              label={`Chess board, you play ${human === "w" ? "White" : "Black"}. ${reviewing && viewNode ? `Reviewing ${viewNode.ply === 0 ? "the start" : moveLabel(viewNode)}; moves are paused.` : active ? (turn === human ? "Your move." : "Fatma to move.") : "Game over."}`}
              onSelect={() => settings.sound && playSound("select", settings.volume)}
            />
            {resultText && game && !reviewing && (
              <GameResult
                key={`${game.meta.gameKey}:${head?.key}:${game.meta.result ?? "aborted"}`}
                result={game.meta.result}
                reason={game.meta.resultReason}
                human={human}
                description={resultText}
                reducedMotion={reducedMotion}
                onRematch={() => void chess.newGame({ ...defaults, opponentId: game.meta.opponentId })}
                reviewUrl={`/time-machine/${game.meta.gameKey}`}
              />
            )}
          </div>
        </div>

        <div className="flex w-full items-center justify-between gap-2"><PlayerIdentity captures={captures.captured[human]} capturedColor={fatmaColor} advantage={captures.advantage[human]} />{tc && <ClockChip ms={clockFor(human)} running={active && turn === human} large />}</div>

        {/* Fixed-height status line, then Fatma's fixed-size corner: nothing here can resize the layout. */}
        <div className="mt-1.5 flex h-6 w-full items-center justify-end gap-2 overflow-hidden whitespace-nowrap text-xs text-muted" aria-live="polite">
          {reviewing && viewNode && (
            <button onClick={() => setViewPly(null)} className="rounded-full bg-surface px-3 py-1 font-medium text-ink shadow-[var(--shadow)]">
              Viewing {viewNode.ply === 0 ? "start" : moveLabel(viewNode)} · Back to game
            </button>
          )}
          {engineWaking && <span>Fatma is waking up…</span>}
          {chess.thinking && !engineWaking && <span>Fatma is thinking…</span>}
          {chess.engineError && (
            <span className="text-danger">
              {chess.engineError}{" "}
              <button className="underline" onClick={() => void chess.retryEngine()}>
                Restart engine
              </button>
            </span>
          )}
          {game && (game.meta.mode === "climb" || game.meta.mode === "timed") && (
            <span className={ratedEligible ? "text-ok" : ""}>{ratedEligible ? "Rated" : game.meta.rated === "ineligible" ? "Unrated · assistance used" : "Unrated"}</span>
          )}
          {sync.status.error && <span className="truncate text-danger">{sync.status.error}</span>}
        </div>
      </section>

      <p className="sr-only" aria-live="assertive">
        {announcement}
      </p>



      <footer className="safe-bottom flex w-full items-center gap-3 pt-2">
        <div className="flex-1" />
        <motion.button
          whileTap={{ scale: 0.94 }}
          transition={IOS_SPRING}
          onClick={() => void onUndo()}
          disabled={!game || moveCount === 0}
          className="flex h-16 shrink-0 items-center gap-2 rounded-full bg-accent px-4 text-base font-semibold text-accent-text disabled:opacity-40"
          aria-keyshortcuts="u"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true"><path d="M9 7L4 12l5 5M4 12h11a5 5 0 0 1 0 10h-2" stroke="currentColor" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
          Undo
        </motion.button>
        <div className="flex h-16 shrink-0 overflow-hidden rounded-full bg-surface shadow-[var(--shadow)]" role="group" aria-label="Review moves">
          <button onClick={() => step(-1)} disabled={moveCount === 0 || viewPly === 0} className="grid h-16 w-16 shrink-0 place-items-center disabled:opacity-30" aria-label="Previous move" aria-keyshortcuts="ArrowLeft">
            <svg viewBox="0 0 24 24" className="h-8 w-8" aria-hidden="true"><path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
          <span className="my-2.5 w-px bg-line" aria-hidden="true" />
          <button onClick={() => step(1)} disabled={!reviewing} className="grid h-16 w-16 shrink-0 place-items-center disabled:opacity-30" aria-label="Next move" aria-keyshortcuts="ArrowRight">
            <svg viewBox="0 0 24 24" className="h-8 w-8" aria-hidden="true"><path d="M9 5l7 7-7 7" stroke="currentColor" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        </div>

      </footer>
      </div>

      {confirmResign && (
        <Dialog title="Resign this game?" onClose={() => setConfirmResign(false)}>
          <button
            onClick={() => {
              setConfirmResign(false);
              void chess.resign();
            }}
            className="w-full rounded-2xl bg-danger py-3 font-medium text-white"
          >
            Resign
          </button>
          <button onClick={() => setConfirmResign(false)} className="w-full rounded-2xl bg-surface-2 py-3">
            Keep playing
          </button>
        </Dialog>
      )}

      {showNew && (
        <NewGameDialog
          defaults={defaults}
          think={settings.think}
          onThink={(think) => update({ think })}
          onClose={() => setShowNew(false)}
          onStart={(opts) => {
            setShowNew(false);
            setOrientationOverride(null);
            setLastMove(null);
            void chess.newGame(opts);
          }}
        />
      )}
    </main>
  );
}

function resultLine(result: string | undefined, reason: string | undefined, human: Color): string {
  if (!result) return "Game aborted.";
  const humanWon = (result === "1-0") === (human === "w") && result !== "1/2-1/2";
  const why: Record<string, string> = {
    checkmate: "by checkmate",
    resign: "by resignation",
    timeout: "on time",
    fatma_timeout: "on time",
    stalemate: "stalemate",
    insufficient: "insufficient material",
    fifty_move: "50-move rule",
    threefold: "threefold repetition",
  };
  if (result === "1/2-1/2") return `Draw · ${why[reason ?? ""] ?? reason ?? ""}`;
  return `${humanWon ? "You win" : "Fatma wins"} ${why[reason ?? ""] ?? ""}`.trim();
}

function ClockChip({ ms, running, large }: { ms: number | null; running: boolean; large?: boolean }) {
  if (ms === null) return null;
  const low = ms < 20_000;
  return (
    <span
      className={`rounded-xl px-3 font-mono tabular-nums ${large ? "min-h-12 content-center text-lg" : "py-1.5 text-base"} ${
        running ? "bg-accent text-accent-text" : "bg-surface text-ink shadow-[var(--shadow)]"
      } ${low && running ? "!bg-danger !text-white" : ""}`}
      role="timer"
      aria-label={`${formatClock(ms)} remaining${running ? ", running" : ""}`}
    >
      {formatClock(ms)}
    </span>
  );
}

export function Dialog({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>("button,input,select")?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <motion.div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/30 p-4 sm:items-center" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}>
      <motion.div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="w-full max-w-sm rounded-3xl bg-surface p-5 shadow-[var(--shadow)]"
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, y: 48, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={IOS_SPRING}
      >
        <p className="mb-4 text-lg font-semibold">{title}</p>
        <div className="grid gap-2">{children}</div>
      </motion.div>
    </motion.div>
  );
}

function NewGameDialog({
  defaults,
  think,
  onThink,
  onStart,
  onClose,
}: {
  defaults: NewGameOptions;
  think: "fast" | "standard" | "deep";
  onThink: (t: "fast" | "standard" | "deep") => void;
  onStart: (o: NewGameOptions) => void;
  onClose: () => void;
}) {
  const [color, setColor] = useState<"w" | "b" | "random">(defaults.humanColor);
  const start = () => {
    const humanColor: Color = color === "random" ? (Math.random() < 0.5 ? "w" : "b") : color;
    onStart({ ...defaults, humanColor, parentGameKey: undefined, parentNodeKey: undefined, originFen: undefined });
  };
  return (
    <Dialog title="New game" onClose={onClose}>
      <Segmented label="Play as" value={color} onChange={setColor} options={[["w", "White"], ["random", "Random"], ["b", "Black"]]} />
      {defaults.mode === "full_power" && (
        <Segmented label="Fatma thinks" value={think} onChange={onThink} options={[["fast", "Fast"], ["standard", "Standard"], ["deep", "Deep"]]} />
      )}
      <p className="text-xs text-muted">Full strength in every setting. Thinking time changes how long she searches, not a fake Elo.</p>
      <button onClick={start} className="mt-1 w-full rounded-2xl bg-accent py-3 font-medium text-accent-text">
        Start
      </button>
    </Dialog>
  );
}

export function Segmented<T extends string>({ label, value, onChange, options }: { label: string; value: T; onChange: (v: T) => void; options: Array<[T, string]> }) {
  const group = useId();
  return (
    <div role="radiogroup" aria-label={label}>
      <p className="mb-1 px-1 text-sm text-muted">{label}</p>
      <div className="grid rounded-[14px] bg-surface-2 p-[3px]" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
        {options.map(([v, text]) => (
          <button key={v} role="radio" aria-checked={value === v} onClick={() => onChange(v)} className="relative min-h-10 rounded-[11px] text-sm">
            {value === v && (
              <motion.span layoutId={`seg-${group}`} className="absolute inset-0 rounded-[11px] bg-surface shadow-[0_3px_8px_rgba(0,0,0,0.12),0_1px_1px_rgba(0,0,0,0.06)]" transition={IOS_SPRING} />
            )}
            <span className={`relative ${value === v ? "font-medium" : "text-muted"}`}>{text}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
