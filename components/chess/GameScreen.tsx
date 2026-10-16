"use client";

import { capturesAlongLine } from "@/lib/chess/captures";
import { motion } from "motion/react";
import Link from "@/components/navigation/PrefetchLink";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { FatmaPanel } from "@/components/fatma/FatmaPanel";
import { IOS_SPRING } from "@/components/ui/Switch";
import { GlassButton, GlassLayer } from "@/components/ui/Glass";
import { useGlassOn } from "@/lib/client/settings";
import { MenuButton } from "@/components/shell/AppShell";
import { LoadingScreen } from "@/components/shell/LoadingScreen";
import { findTimeControl, remaining } from "@/lib/chess/clock";
import { findOpponent } from "@/lib/chess/engine/opponents";
import { headNode, moveLabel, pathTo } from "@/lib/chess/history/tree";
import { describeMove, kingSquare, positionStatus, sideToMove, type Color, type Square } from "@/lib/chess/rules";
import { useEngineState, usePrewarmEngine } from "@/lib/client/engine";
import { useSettings } from "@/lib/client/settings";
import { haptic, installAudioUnlock, playSound, resultSound, unlockAudio } from "@/lib/client/sound";
import { useSync } from "@/lib/client/sync";
import { monotonicNow, useChessGame, type MoveEvent, type NewGameOptions } from "@/lib/client/useChessGame";
import { ENGINE_BUILD, EVAL_SETTINGS_HASH, useEvaluation, type Evaluation } from "@/lib/client/useEvaluation";
import { useFatma } from "@/lib/client/useFatma";
import { Board, type LastMove } from "./Board";
import { EvalBar } from "./EvalBar";
import { GameResult } from "./GameResult";
import { MoveList, MoveStrip } from "./MoveStrip";
import { FOOTER_BUTTON_SIZE, ReviewArrows } from "./ReviewArrows";
import { ClockChip } from "./ClockChip";
import { CharacterField } from "@/components/shell/CharacterField";
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
  const [confirmUndo, setConfirmUndo] = useState(false);
  const [evalOptIn, setEvalOptIn] = useState(false);
  const evals = useRef(new Map<string, Evaluation>());
  const evaluatedGame = useRef<string | undefined>(undefined);

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
      setAnnouncement(`${by === "fatma" ? "Sherine: " : ""}${describeMove(applied, mover)}`);
      if (settings.sound) {
        // The result effect plays the ending once, after the final move.
        if (!applied.checkmate) playSound(applied.promotion ? "promote" : castle ? "castle" : applied.check ? "check" : applied.captured ? "capture" : "move", settings.volume);
      }
      if (settings.haptics && by === "human") haptic(applied.captured ? [8, 30, 8] : 8);
      if (by === "human") {
        if (castle) fatma.say("human_castle");
        else if (applied.promotion) fatma.say("human_promote");
        else if (node.ply <= 2) fatma.say("opening");
      }
    },
    [settings.sound, settings.volume, settings.haptics, fatma],
  );

  // Warm up audio on the first touch so the opening move is never silent.
  useEffect(() => installAudioUnlock(), []);

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
  const jumpTo = useCallback(
    (ply: number) => {
      if (ply === (viewPly ?? line.length)) return;
      navigationFeedback();
      setViewPly(ply >= line.length ? null : ply);
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
      if (evaluatedGame.current !== game?.meta.gameKey) {
        evals.current.clear();
        evaluatedGame.current = game?.meta.gameKey;
      }
      const previous = evals.current.get(e.nodeKey);
      evals.current.set(e.nodeKey, e);
      if (previous?.fen === e.fen && (previous.depth ?? 0) >= (e.depth ?? 0)) return;
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
  const previousGameStatus = useRef<{ key: string; status: "active" | "finished" } | null>(null);
  useEffect(() => {
    if (!game) return;
    const previous = previousGameStatus.current;
    previousGameStatus.current = { key: game.meta.gameKey, status: game.meta.status };
    // Loading an old result is silent; only an active game ending gets a cue.
    if (game.meta.status !== "finished" || previous?.key !== game.meta.gameKey || previous.status !== "active") return;
    if (settings.sound) playSound(resultSound(game.meta.result, game.meta.humanColor), settings.volume);
  }, [game, settings.sound, settings.volume]);
  const lowTimeWarned = useRef<string | null>(null);
  const humanMs = game?.clock ? remaining(game.clock, human, monotonicNow()) : null;
  useEffect(() => {
    if (humanMs === null || humanMs > 20_000 || !game || game.meta.status !== "active") return;
    if (lowTimeWarned.current === game.meta.gameKey) return;
    lowTimeWarned.current = game.meta.gameKey;
    if (settings.sound) playSound("lowtime", settings.volume);
  }, [humanMs, game, settings.sound, settings.volume]);

  // She gets chatty if you think for a long time.
  useEffect(() => {
    if (!active || turn !== human || reviewing) return;
    const t = setTimeout(() => fatma.say("idle"), 40_000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [head?.key, active, turn, human, reviewing]);

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

  // Keyboard shortcuts (press ? for the list). Ignored while typing or inside a dialog.
  const [showKeys, setShowKeys] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.target instanceof HTMLElement && e.target.closest("[role=dialog]")) return;
      const inBoard = e.target instanceof HTMLElement && e.target.closest("[role=grid]");
      if (!inBoard && e.key === "ArrowLeft") step(-1);
      if (!inBoard && e.key === "ArrowRight") step(1);
      if (!inBoard && e.key === "Home") jumpTo(0);
      if (!inBoard && e.key === "End") jumpTo(line.length);
      if (e.key === "u" && game && (head?.ply ?? 0) > 0) setConfirmUndo(true);
      if (e.key === "f") setOrientationOverride((o) => ((o ?? human) === "w" ? "b" : "w"));
      if (e.key === "n") setShowNew(true);
      if (e.key === "m") update({ sound: !settings.sound });
      if (e.key === "?") setShowKeys(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [game, head?.ply, human, step, jumpTo, line.length, update, settings.sound]);

  const tc = game?.meta.timeControlId ? findTimeControl(game.meta.timeControlId) : undefined;
  const now = monotonicNow();
  const clockFor = (c: Color) => (game?.clock ? remaining(game.clock, c, now) : null);
  const fatmaColor: Color = human === "w" ? "b" : "w";
  const moveCount = head?.ply ?? 0;
  const resultText = game?.meta.status === "finished" ? resultLine(game.meta.result, game.meta.resultReason, human) : null;
  const engineWaking = (engineState === "loading" || engineState === "idle") && active && turn !== human && opponent?.policy.kind === "stockfish";

  return (
    <>
    {/* Optional living background: only behind games (Settings → Display). */}
    {settings.livingBackground && <CharacterField reducedMotion={reducedMotion} />}
    <main className="min-h-dvh w-full px-3 sm:px-6">
      <LoadingScreen />
      {/* Phones: one column exactly as wide as the board, sized so everything fits on screen.
          Wide screens: the board as large as the window allows, controls and moves in a side panel. */}
      <div
        className="game-layout"
        style={{ ["--eval-gutter" as string]: settings.evalBar ? "36px" : "0px" }}
      >
      <header className="safe-top flex flex-wrap items-center justify-between gap-2 pb-2 [grid-area:header] lg:pt-0">
        <div className="flex min-w-0 items-center gap-2">
          <div className="min-w-0">
            <p className="sr-only">
              Chess
            </p>
          </div>
        </div>
        <div className="ms-auto flex items-center gap-1.5">
          <GlassButton onClick={() => setShowNew(true)} className="h-11 shrink-0 rounded-full px-3.5 text-sm font-medium" aria-label="New game" aria-keyshortcuts="n">
            New
          </GlassButton>
          <GlassButton
            onClick={() => setOrientationOverride((o) => ((o ?? human) === "w" ? "b" : "w"))}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full"
            aria-label="Flip board"
            aria-keyshortcuts="f"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
              <path d="M7 4v13m0 0l-3-3m3 3l3-3M17 20V7m0 0l-3 3m3-3l3 3" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </GlassButton>
          <GlassButton
            onClick={() => {
              unlockAudio();
              update({ sound: !settings.sound });
              if (!settings.sound) playSound("move", settings.volume);
            }}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full"
            aria-label={settings.sound ? "Mute sounds" : "Turn sounds on"}
            aria-pressed={settings.sound}
            title={settings.sound ? "Sound on" : "Sound off"}
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
              <path d="M4 9.5h3.5L12 5v14l-4.5-4.5H4z" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinejoin="round" />
              {settings.sound ? (
                <path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" />
              ) : (
                <path d="M16 9.5l5 5m0-5l-5 5" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" />
              )}
            </svg>
          </GlassButton>
            <GlassButton disabled={!active} onClick={() => setConfirmResign(true)} className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-ink" aria-label="Resign" title="Resign">
            <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true"><path d="M5 21V4m0 0h11l-2 4 2 4H5" stroke="currentColor" strokeWidth="1.9" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </GlassButton>
          <MenuButton />
        </div>
      </header>

      <div className="game-moves min-h-0 [grid-area:moves] lg:flex lg:flex-col">
        <div className="lg:hidden">
          <MoveStrip line={line} cursor={viewPly ?? line.length} onSelect={jumpTo} />
        </div>
        <MoveList line={line} cursor={viewPly ?? line.length} onSelect={jumpTo} className="hidden flex-1 lg:flex" />
      </div>

      <section className="game-board-group">
        <div className="game-opponent flex items-center gap-2">
          <FatmaPanel fatma={fatma} thinking={chess.thinking} reducedMotion={reducedMotion} showName captures={captures.captured[fatmaColor]} capturedColor={human} advantage={captures.advantage[fatmaColor]} />
          {tc && <ClockChip ms={clockFor(fatmaColor)} running={active && turn === fatmaColor} />}
        </div>
        <div className="game-position relative flex w-full items-stretch gap-2">
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
              label={`Chess board, you play ${human === "w" ? "White" : "Black"}. ${reviewing && viewNode ? `Reviewing ${viewNode.ply === 0 ? "the start" : moveLabel(viewNode)}; moves are paused.` : active ? (turn === human ? "Your move." : "Sherine to move.") : "Game over."}`}
              onSelect={() => settings.sound && playSound("select", settings.volume)}
            />
          </div>
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

        <div className="game-player flex items-center justify-between gap-2"><PlayerIdentity captures={captures.captured[human]} capturedColor={fatmaColor} advantage={captures.advantage[human]} />{tc && <ClockChip ms={clockFor(human)} running={active && turn === human} />}</div>
      </section>

        {/* Fixed-height status line: nothing here can resize the layout. */}
        <div className="flex h-6 w-full items-center justify-end gap-2 overflow-hidden whitespace-nowrap text-xs text-muted [grid-area:status] lg:justify-start" aria-live="polite">
          {engineWaking && <span>Sherine is waking up…</span>}
          {chess.thinking && !engineWaking && <span>Sherine is thinking…</span>}
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

      <p className="sr-only" aria-live="assertive">
        {announcement}
      </p>



      <footer className="safe-bottom flex w-full items-center gap-3 pt-2 [grid-area:footer] lg:pb-0">
        <GlassButton
          variant="tint"
          onClick={() => setConfirmUndo(true)}
          disabled={!game || moveCount === 0}
          className={`flex ${FOOTER_BUTTON_SIZE} shrink-0 items-center justify-center gap-2 rounded-full text-base font-semibold`}
          aria-keyshortcuts="u"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true"><path d="M9 7L4 12l5 5M4 12h11a5 5 0 0 1 0 10h-2" stroke="currentColor" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
          Undo
        </GlassButton>
        <div className="flex-1" />
        <ReviewArrows onBack={() => step(-1)} onForward={() => step(1)} backDisabled={moveCount === 0 || viewPly === 0} forwardDisabled={!reviewing} />

      </footer>
      </div>

      {showKeys && <KeyboardHelp onClose={() => setShowKeys(false)} extra={[["U", "Undo (asks first)"], ["N", "New game"]]} />}

      {confirmUndo && (
        <Dialog title="Undo your last move?" onClose={() => setConfirmUndo(false)}>
          <button
            onClick={() => {
              setConfirmUndo(false);
              void onUndo();
            }}
            className="w-full rounded-2xl bg-accent py-3 font-medium text-accent-text"
          >
            Undo
          </button>
          <button onClick={() => setConfirmUndo(false)} className="w-full rounded-2xl bg-surface-2 py-3">
            Keep playing
          </button>
        </Dialog>
      )}

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
    </>
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
  return `${humanWon ? "You win" : "Sherine wins"} ${why[reason ?? ""] ?? ""}`.trim();
}


export function Dialog({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const glassOn = useGlassOn();
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });
  useEffect(() => {
    // Focus moves in, Tab stays inside, Escape closes, and focus returns to where it was.
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>("button,input,select,a[href]")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab" || !ref.current) return;
      const items = Array.from(ref.current.querySelectorAll<HTMLElement>("button:not([disabled]),input,select,a[href],[tabindex]:not([tabindex='-1'])"));
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      previous?.focus?.();
    };
  }, []);
  return (
    <motion.div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/30 p-4 sm:items-center" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}>
      <motion.div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={glassOn ? "glass-panel w-full max-w-sm rounded-3xl p-5" : "w-full max-w-sm rounded-3xl bg-surface p-5 shadow-[var(--shadow)]"}
        onClick={(e) => e.stopPropagation()}
        // Glass skips the fade: a translucent parent would cut the lens off from the page.
        initial={glassOn ? { y: 48, scale: 0.96 } : { opacity: 0, y: 48, scale: 0.96 }}
        animate={glassOn ? { y: 0, scale: 1 } : { opacity: 1, y: 0, scale: 1 }}
        transition={IOS_SPRING}
      >
        <GlassLayer radius={24} blur={10} glassThickness={90} bezelWidth={24} specularOpacity={0.6} />
        <h2 id={titleId} className="mb-4 text-lg font-semibold">{title}</h2>
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
        <Segmented label="Sherine thinks" value={think} onChange={onThink} options={[["fast", "Fast"], ["standard", "Standard"], ["deep", "Deep"]]} />
      )}
      <p className="text-xs text-muted">Full strength in every setting. Thinking time changes how long she searches, not a fake Elo.</p>
      <button onClick={start} className="mt-1 w-full rounded-2xl bg-accent py-3 font-medium text-accent-text">
        Start
      </button>
      <Link href="/play" className="grid min-h-12 w-full place-items-center rounded-2xl bg-surface-2 text-sm font-medium">
        Play a friend online instead
      </Link>
    </Dialog>
  );
}

export function Segmented<T extends string>({ label, value, onChange, options }: { label: string; value: T; onChange: (v: T) => void; options: Array<[T, string]> }) {
  const group = useId();
  const labelId = useId();
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  // Radio-group keyboard pattern: one Tab stop, arrow keys move the choice.
  const onKeyDown = (e: React.KeyboardEvent) => {
    const index = options.findIndex(([v]) => v === value);
    const rtl = getComputedStyle(e.currentTarget).direction === "rtl";
    const forward = e.key === "ArrowDown" || e.key === (rtl ? "ArrowLeft" : "ArrowRight");
    const backward = e.key === "ArrowUp" || e.key === (rtl ? "ArrowRight" : "ArrowLeft");
    if (!forward && !backward) return;
    e.preventDefault();
    const next = (index + (forward ? 1 : -1) + options.length) % options.length;
    onChange(options[next][0]);
    refs.current[next]?.focus();
  };
  return (
    <div role="radiogroup" aria-labelledby={labelId} onKeyDown={onKeyDown}>
      <p id={labelId} className="mb-1 px-1 text-sm text-muted">{label}</p>
      <div className="grid rounded-[14px] bg-surface-2 p-[3px]" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
        {options.map(([v, text], i) => (
          <button
            key={v}
            ref={(el) => {
              refs.current[i] = el;
            }}
            role="radio"
            aria-checked={value === v}
            tabIndex={value === v ? 0 : -1}
            onClick={() => onChange(v)}
            className="relative min-h-10 rounded-[11px] text-sm"
          >
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

/** "?" opens this: every shortcut on the game screens. */
export function KeyboardHelp({ onClose, extra = [] }: { onClose: () => void; extra?: Array<[string, string]> }) {
  const rows: Array<[string, string]> = [
    ["← →", "Previous / next move"],
    ["Home / End", "Start / back to the live position"],
    ["Hold ← → button", "Scrub quickly"],
    ["Tab, then arrows", "Move around the board"],
    ["Enter or Space", "Pick up / drop a piece"],
    ["Esc", "Cancel selection or close"],
    ["F", "Flip board"],
    ["M", "Sound on / off"],
    ...extra,
  ];
  return (
    <Dialog title="Keyboard shortcuts" onClose={onClose}>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
        {rows.map(([keys, what]) => (
          <div key={keys} className="contents">
            <dt><kbd className="rounded-md bg-surface-2 px-1.5 py-0.5 font-mono text-xs">{keys}</kbd></dt>
            <dd className="text-muted">{what}</dd>
          </div>
        ))}
      </dl>
      <button onClick={onClose} className="mt-2 w-full rounded-2xl bg-surface-2 py-3">Close</button>
    </Dialog>
  );
}
