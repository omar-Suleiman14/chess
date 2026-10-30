"use client";

import { capturesAlongLine } from "@/lib/chess/captures";
import { motion } from "motion/react";
import Link from "@/components/navigation/PrefetchLink";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { FatmaPanel } from "@/components/fatma/FatmaPanel";
import { IOS_SPRING } from "@/components/ui/Switch";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
export { Dialog } from "@/components/ui/Dialog";
import { MenuButton, useGameFocus, useShell } from "@/components/shell/AppShell";
import type { TabId } from "@/components/shell/TabBar";
import { LoadingScreen } from "@/components/shell/LoadingScreen";
import { findTimeControl, remaining } from "@/lib/chess/clock";
import { findOpponent } from "@/lib/chess/engine/opponents";
import { headNode, moveLabel, pathTo } from "@/lib/chess/history/tree";
import { describeMove, kingSquare, positionStatus, sideToMove, type Color, type Square } from "@/lib/chess/rules";
import { useEngineState, usePrewarmEngine } from "@/lib/client/engine";
import { useSettings } from "@/lib/client/settings";
import { installAudioUnlock, playSound, resultSound, unlockAudio } from "@/lib/client/sound";
import { haptic, type HapticEvent } from "@/lib/client/haptics";
import { useSync } from "@/lib/client/sync";
import { monotonicNow, useChessGame, type MoveEvent, type NewGameOptions } from "@/lib/client/useChessGame";
import { ENGINE_BUILD, EVAL_SETTINGS_HASH, useEvaluation, type Evaluation } from "@/lib/client/useEvaluation";
import { useFatma } from "@/lib/client/useFatma";
import { usePremove } from "@/lib/client/usePremove";
import { HintPanel, HINT_COPY } from "./HintPanel";
import { buildHint } from "@/lib/chess/hints";
import { supportsEngine } from "@/lib/client/engine";
import { Board, type LastMove } from "./Board";
import { EvalBar } from "./EvalBar";
import { GameResult } from "./GameResult";
import { MoveList, MoveStrip } from "./MoveStrip";
import { ReviewArrows, useHoldRepeat } from "./ReviewArrows";
import { ClockChip } from "./ClockChip";
import { GameBackground } from "@/components/shell/GameBackground";
import { PlayerIdentity } from "./PlayerIdentity";
import { FriendsButton, FriendsDialog } from "@/components/friends/FriendsButton";
import { useCoachingPreferences } from "@/lib/client/useCoachingPreferences";
import { useMoveCoach } from "@/lib/client/useMoveCoach";
import { useOnline } from "@/lib/offline/client";
import { MOVE_QUALITY } from "@/lib/chess/review";

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
  const { settings, reducedMotion, update, updateExperience } = useSettings();
  const { coaching } = useCoachingPreferences();
  const fatma = useFatma();
  const sync = useSync();
  const engineState = useEngineState();
  const [announcement, setAnnouncement] = useState("");
  const [lastMove, setLastMove] = useState<LastMove>(null);
  const [orientationOverride, setOrientationOverride] = useState<Color | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [resultVersion, setResultVersion] = useState(0);
  const [confirmResign, setConfirmResign] = useState(false);
  const [confirmUndo, setConfirmUndo] = useState(false);
  const [hintRequest, setHintRequest] = useState<{ context: string; stage: 1 | 2 | 3 } | null>(null);
  const [hintConsent, setHintConsent] = useState<string | null>(null);
  const [hintBusy, setHintBusy] = useState(false);
  const [hintFailure, setHintFailure] = useState(false);
  const [hintTimedOut, setHintTimedOut] = useState<string | null>(null);
  const hintOperation = useRef(0);
  const evals = useRef(new Map<string, Evaluation>());
  const evaluatedGame = useRef<string | undefined>(undefined);
  const executingPremove = useRef(false);
  const onPremoveExecution = useCallback((active: boolean) => { executingPremove.current = active; }, []);

  const onMove = useCallback(
    ({ applied, by, node, terminal }: MoveEvent) => {
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
        if (!terminal) playSound(applied.promotion ? "promote" : castle ? "castle" : applied.check ? "check" : applied.captured ? "capture" : executingPremove.current ? "premove_execute" : by === "fatma" ? "opponent_move" : "move", settings.volume, { key: `move:${node.key}` });
      }
      // Your own taps already felt their move on the board; feel the rest here.
      if (by !== "human" || executingPremove.current) {
        const event: HapticEvent = applied.check ? "check" : applied.captured ? "capture" : by === "human" ? "move" : "opponent";
        haptic(event, { key: `move:${node.key}` });
      }
      if (by === "human") {
        if (castle) fatma.say("human_castle");
        else if (applied.promotion) fatma.say("human_promote");
        else if (node.ply <= 2) fatma.say("opening");
      }
    },
    [settings.sound, settings.volume, fatma],
  );

  // Warm up audio on the first touch so the opening move is never silent.
  useEffect(() => installAudioUnlock(), []);

  const chess = useChessGame({ think: settings.think, onMove, onFatma: fatma.say });
  const { game, loaded } = chess;
  const humanMove = chess.humanMove;
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
    haptic("select");
  }, [settings.sound, settings.volume]);
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
  const opponent = game ? findOpponent(game.meta.opponentId, game.meta.opponentVersion ?? 1) : undefined;
  const active = game?.meta.status === "active";
  const ratedEligible = game?.meta.rated === "eligible";
  const evalAllowed = settings.evalBar && (!active || !ratedEligible);
  const coachingAllowed = !active || !ratedEligible;
  const lastHumanMove = reviewing ? viewNode ?? undefined : line.findLast((node) => {
    const parent = node.parentKey ? tree?.nodes[node.parentKey] : undefined;
    return parent && sideToMove(parent.fen) === human;
  });
  const coach = useMoveCoach(lastHumanMove, lastHumanMove?.parentKey ? tree?.nodes[lastHumanMove.parentKey]?.fen : undefined,
    coachingAllowed && (coaching.moveFeedback || coaching.explanations) && (!active || turn === human));
  const checkSq = status.check ? kingSquare(fen, sideToMove(fen)) ?? null : null;
  const viewLastMove = useMemo<LastMove>(() => reviewing
    ? viewNode && viewNode.ply > 0
      ? { from: viewNode.uci.slice(0, 2) as Square, to: viewNode.uci.slice(2, 4) as Square, key: `view-${viewNode.key}` }
      : null
    : null, [reviewing, viewNode]);

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
      if ((e.depth ?? 0) >= 10 && e.score.mate !== undefined && Math.abs(e.score.mate) <= 3) fatma.say("near_mate");
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
      if (!moverIsHuman || !before || (before.depth ?? 0) < 10 || (e.depth ?? 0) < 10) return;
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
    if (game.meta.status === "active" && previous?.key !== game.meta.gameKey && Date.now() - game.tree.nodes.root.createdAt < 3_000 && settings.sound) playSound("start", settings.volume, { key: `start:${game.meta.gameKey}` });
    // Loading an old result is silent; only an active game ending gets a cue.
    if (game.meta.status !== "finished" || previous?.key !== game.meta.gameKey || previous.status !== "active") return;
    if (settings.sound) playSound(resultSound(game.meta.result, game.meta.humanColor, game.meta.resultReason), settings.volume, { key: `result:${game.meta.gameKey}` });
    // An aborted game (no result) ends quietly.
    if (game.meta.result) {
      const won = game.meta.result === (game.meta.humanColor === "w" ? "1-0" : "0-1");
      haptic(game.meta.result === "1/2-1/2" ? "draw" : won ? "success" : "defeat", { key: `result:${game.meta.gameKey}` });
    }
  }, [game, settings.sound, settings.volume]);
  const lowTimeWarned = useRef<string | null>(null);
  useEffect(() => {
    if (!game?.clock || game.meta.status !== "active") return;
    const clock = game.clock;
    const checkTime = () => {
      if (remaining(clock, human, monotonicNow()) > 20_000 || lowTimeWarned.current === game.meta.gameKey) return;
      lowTimeWarned.current = game.meta.gameKey;
      if (settings.sound) playSound("lowtime", settings.volume);
      haptic("warning");
      fatma.say("time_pressure");
    };
    const timer = setInterval(checkTime, 500);
    return () => clearInterval(timer);
  }, [game, human, settings.sound, settings.volume, fatma]);

  // She gets chatty if you think for a long time.
  useEffect(() => {
    if (!active || turn !== human || reviewing) return;
    const t = setTimeout(() => fatma.say("idle"), 40_000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [head?.key, active, turn, human, reviewing]);

  const hintContext = `${game?.meta.gameKey}:${head?.key}:${turn}:${reviewing}`;
  const [lastHintContext, setLastHintContext] = useState(hintContext);
  if (lastHintContext !== hintContext) {
    setLastHintContext(hintContext);
    setHintRequest(null);
    setHintConsent(null);
    setHintBusy(false);
    setHintFailure(false);
  }
  const hintContextRef = useRef(hintContext);
  useEffect(() => { hintContextRef.current = hintContext; hintOperation.current++; }, [hintContext]);
  const hintStage = hintRequest?.context === hintContext && active && turn === human && !reviewing && !chess.thinking ? hintRequest.stage : null;
  const hintCopy = HINT_COPY[settings.fatmaLanguage];
  useEffect(() => {
    if (!hintStage) return;
    const timer = setTimeout(() => setHintTimedOut(hintContext), 8_000);
    return () => clearTimeout(timer);
  }, [hintContext, hintStage]);
  const evaluation = useEvaluation(fen, viewNode?.key ?? "root", (evalAllowed || (coachingAllowed && hintStage !== null)) && !status.over, onFinalEval, hintStage ? 10 : 0);
  const hintEvidence = useMemo(() => hintStage && evaluation?.final && evaluation.fen === fen ? buildHint(fen, evaluation.bestmove, evaluation.depth, settings.fatmaLanguage) : null, [hintStage, evaluation, fen, settings.fatmaLanguage]);
  const hintSquares = useMemo(() => hintStage && hintStage >= 2 && hintEvidence ? hintStage === 2 ? [hintEvidence.move.from] : [hintEvidence.move.from, hintEvidence.move.to] : [], [hintStage, hintEvidence]);
  const requestHint = async (consented = false) => {
    if (hintBusy || !active || reviewing || turn !== human || chess.thinking || !supportsEngine()) return;
    if (ratedEligible && !consented) { setHintConsent(hintContext); return; }
    const context = hintContext;
    const operation = ++hintOperation.current;
    setHintBusy(true);
    setHintFailure(false);
    const permitted = !ratedEligible || await chess.markAssisted("hint");
    if (operation !== hintOperation.current) return;
    setHintBusy(false);
    setHintConsent(null);
    if (context !== hintContextRef.current) return;
    if (!permitted) { setHintFailure(true); return; }
    setHintTimedOut(null);
    setHintRequest({ context, stage: 1 });
  };
  const onSelectSound = useCallback(() => { if (settings.sound) playSound("select", settings.volume); }, [settings.sound, settings.volume]);
  const previousCoach = useRef<string | null>(null);
  useEffect(() => {
    if (coach?.kind !== "ready" || previousCoach.current === coach.key || reviewing) return;
    previousCoach.current = coach.key;
    const timer = setTimeout(() => {
      if (coach.review.quality === "blunder" || coach.review.quality === "miss") fatma.say("human_blunder");
      else if (coach.review.quality === "brilliant") fatma.say("human_sacrifice");
      else if (coach.review.quality === "best" || coach.review.quality === "great") fatma.say("human_good_move");
    }, 0);
    return () => clearTimeout(timer);
  }, [coach, fatma, reviewing]);

  const handleMove = useCallback(
    async (uci: string) => {
      unlockAudio();
      return await humanMove(uci);
    },
    [humanMove],
  );

  const premove = usePremove({
    context: `${game?.meta.gameKey}:${tree?.activeBranchKey}`,
    fen: liveFen, ply: head?.ply ?? 0, player: human,
    active: !!active && !reviewing, ready: !!active && turn === human && !reviewing,
  }, handleMove, onPremoveExecution);

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
  // A game screen is full screen on phones, like a native chess app: its own
  // bottom bar (Options · Hint · Back · Forward) instead of the tab bar.
  useGameFocus(true);
  const [showFriends, setShowFriends] = useState(false);
  const online = useOnline();
  const backHold = useHoldRepeat(() => step(-1), moveCount === 0 || viewPly === 0);
  const forwardHold = useHoldRepeat(() => step(1), !reviewing);
  const hintDisabled = hintBusy || !active || reviewing || turn !== human || chess.thinking || !supportsEngine();
  const resultText = game?.meta.status === "finished" ? resultLine(game.meta.result, game.meta.resultReason, human) : null;
  const engineWaking = (engineState === "loading" || engineState === "idle") && active && turn !== human && opponent?.policy.kind === "stockfish";

  return (
    <>
    {/* Optional living background: only behind games (Settings → Display). */}

    <main className="game-main min-h-dvh w-full px-3 sm:px-6">
      <LoadingScreen />
      {/* Phones: one column exactly as wide as the board, sized so everything fits on screen.
          Wide screens: the board as large as the window allows, controls and moves in a side panel. */}
      <div
        className="game-layout relative isolate"
        style={{ ["--eval-gutter" as string]: "0px" }}
      >
      <GameBackground />
      <header className="safe-top flex flex-wrap max-lg:!hidden items-center justify-between gap-2 pb-2 [grid-area:header] lg:pt-0">
        <span className="sr-only">Chess</span>
        <div className="game-control-bar ms-auto flex min-w-0 max-w-full flex-wrap items-center justify-end gap-1.5 lg:flex-nowrap lg:gap-1">
          <FriendsButton />
          {coaching.hints && <Button disabled={hintBusy || !active || reviewing || turn !== human || chess.thinking || !supportsEngine()} onClick={() => void requestHint()} aria-expanded={hintStage !== null} className="min-h-11 min-w-11 rounded-full px-3 text-sm font-medium lg:px-2 lg:text-xs">{hintCopy.hint}</Button>}
          <Button onClick={() => update({ evalBar: !settings.evalBar })} aria-label={settings.evalBar ? "Hide evaluation" : "Show evaluation"} aria-pressed={settings.evalBar} className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-sm font-semibold">±</Button>
          <Button onClick={() => game?.meta.status === "finished" ? setResultVersion((version) => version + 1) : setShowNew(true)} className="h-11 shrink-0 rounded-full px-4 text-sm font-semibold lg:px-3" aria-label={game?.meta.status === "finished" ? "Show game result" : "New game"} aria-keyshortcuts="n">
            {game?.meta.status === "finished" ? "Result" : "New"}
          </Button>
          <MenuButton />
        </div>
      </header>

      {/* Phones: the move list runs across the top, like a native chess app. */}
      <div className="game-strip safe-top px-1 lg:hidden">
        <MoveStrip flat line={line} cursor={viewPly ?? line.length} onSelect={jumpTo} />
      </div>
      <div className="game-moves min-h-0 [grid-area:moves] max-lg:px-3 max-lg:pt-2 lg:flex lg:flex-col">
        <details open className="hidden min-h-0 flex-1 overflow-hidden lg:flex lg:flex-col">
          <summary className="cursor-pointer px-4 py-3 text-sm font-medium">Move history</summary>
          <MoveList line={line} cursor={viewPly ?? line.length} onSelect={jumpTo} className="flex h-[calc(100%-44px)]" />
        </details>
        {hintStage && <HintPanel stage={hintStage} evidence={hintEvidence} unavailable={hintTimedOut === hintContext} language={settings.fatmaLanguage} onNext={() => { if (hintEvidence && hintStage < 3) setHintRequest({ context: hintContext, stage: hintStage === 1 ? 2 : 3 }); }} onClose={() => setHintRequest(null)} />}
        {hintFailure && <p role="alert" className="p-3 text-sm text-danger">{hintCopy.error}</p>}
        {(coaching.moveFeedback || coaching.explanations) && <section aria-label="Optional coaching" className="shrink-0 border-t border-line bg-surface p-3 text-sm" aria-live="polite">
          {!coachingAllowed ? <button onClick={() => { void chess.markAssisted("engine_lines").then((ok) => { if (!ok) setHintFailure(true); }); }} className="min-h-11 underline">Enable coaching · makes this game unrated</button> : <>
            {coaching.moveFeedback && <p>{coach?.kind === "ready" ? `${lastHumanMove?.san}: ${MOVE_QUALITY[coach.review.quality].label}` : coach?.kind === "unavailable" ? "Move analysis unavailable at sufficient depth." : lastHumanMove ? "Analyzing move…" : "Play a move to start review."}</p>}
            {coaching.explanations && coach?.kind === "ready" && <p className="mt-1 text-muted">{coach.review.quality === "best" ? "Matches the engine's best move." : `${coach.review.bestSan} was the engine alternative. Evaluation loss: ${(coach.review.lossCp / 100).toFixed(2)} pawns.`}</p>}
          </>}
        </section>}
      </div>

      <section className="game-board-group">
        <div className="game-opponent flex items-center gap-2 max-lg:px-3">
          {orientation === human ? <FatmaPanel opponent={opponent} fatma={fatma} thinking={chess.thinking} reducedMotion={reducedMotion} showName captures={captures.captured[fatmaColor]} capturedColor={human} advantage={captures.advantage[fatmaColor]} /> : <PlayerIdentity game={game?.meta} captures={captures.captured[human]} capturedColor={fatmaColor} advantage={captures.advantage[human]} />}
          {tc && <ClockChip ms={clockFor(orientation === human ? fatmaColor : human)} running={active && turn === (orientation === human ? fatmaColor : human)} />}
        </div>
        <div className="game-position relative flex w-full flex-col items-stretch gap-1">
          {settings.evalBar && (evalAllowed ? (
            // Phones: inset from the screen edges with breathing room above the board.
            <div className="max-lg:px-4 max-lg:pb-4 max-lg:pt-2"><EvalBar score={evaluation?.score ?? null} orientation={orientation} depth={evaluation?.depth} reducedMotion={reducedMotion} horizontal /></div>
          ) : (
            <button
              onClick={() => {
                void chess.markAssisted("eval_bar").then((ok) => { if (!ok) setHintFailure(true); });
              }}
              className="h-6 w-full shrink-0 rounded-[5px] bg-surface-2 text-xs max-lg:mx-4 max-lg:mb-4 max-lg:mt-2 max-lg:w-[calc(100%-2rem)]"
              aria-label="Show evaluation bar. This makes the current rated game unrated."
              title="Show evaluation (makes this game unrated)"
            >Show evaluation · makes this game unrated</button>
          ))}
          <div className="relative min-w-0 w-full">
            <Board
              result={resultText && game && !reviewing ? { result: game.meta.result, reason: game.meta.resultReason } : undefined}
              fen={fen}
              orientation={orientation}
              movable={active && turn === human && !reviewing ? human : null}
              onMove={handleMove}
              premovable={active && turn !== human && !reviewing ? human : null}
              premove={premove.uci}
              onPremove={premove.queue}
              lastMove={reviewing ? viewLastMove : lastMove}
              checkSquare={checkSq}
              hintSquares={hintSquares}
              hintMove={hintStage === 3 && hintEvidence ? { from: hintEvidence.move.from, to: hintEvidence.move.to } : undefined}
              showLegalDots={settings.legalDots}
              coordinates={settings.coordinates}
              reducedMotion={reducedMotion}
              label={`Chess board, you play ${human === "w" ? "White" : "Black"}. ${reviewing && viewNode ? `Reviewing ${viewNode.ply === 0 ? "the start" : moveLabel(viewNode)}; moves are paused.` : active ? (turn === human ? "Your move." : "Sherine to move.") : "Game over."}`}
              onSelect={onSelectSound}
            />
          </div>
          {resultText && game && !reviewing && (
            <GameResult
              key={`${game.meta.gameKey}:${head?.key}:${game.meta.result ?? "aborted"}:${resultVersion}`}
              result={game.meta.result}
              reason={game.meta.resultReason}
              human={human}
              description={resultText}
              reducedMotion={reducedMotion}
              onRematch={() => void chess.newGame({ ...defaults, opponentId: game.meta.opponentId })}
              reviewUrl={`/time-machine/${game.meta.gameKey}`}
              summary={{ moves: Math.ceil(moveCount / 2), durationMs: Math.max(0, game.meta.updatedAt - game.tree.nodes.root.createdAt), timeControl: tc?.label ?? "Untimed" }}
            />
          )}
        </div>

        <div className="game-player flex items-center justify-between gap-2 max-lg:px-3">{orientation === human ? <PlayerIdentity game={game?.meta} captures={captures.captured[human]} capturedColor={fatmaColor} advantage={captures.advantage[human]} /> : <FatmaPanel opponent={opponent} fatma={fatma} thinking={chess.thinking} reducedMotion={reducedMotion} showName captures={captures.captured[fatmaColor]} capturedColor={human} advantage={captures.advantage[fatmaColor]} />}{tc && <ClockChip ms={clockFor(orientation)} running={active && turn === orientation} />}</div>
      </section>

        {/* Fixed-height status line: nothing here can resize the layout. */}
        <div className="flex h-6 w-full items-center justify-end gap-2 overflow-hidden whitespace-nowrap text-xs text-muted empty:hidden [grid-area:status] max-lg:px-3 lg:justify-start" aria-live="polite">
          {premove.uci && <button onClick={premove.cancel} className="shrink-0 underline" aria-label="Cancel premove">Premove queued · Cancel</button>}
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
          {!online && <span>Offline · games save on this device</span>}
          {sync.status.error && online && <span className="truncate text-danger">{sync.status.error}</span>}
        </div>

      <p className="sr-only" aria-live="assertive">
        {announcement}
      </p>



      {/* The in-game toolbar. On phones game screens show it instead of the tab bar. */}
      <footer className="game-footer safe-bottom w-full pt-2 [grid-area:footer] lg:pb-0" aria-label="Game controls">
        {/* Phones: one flat bar of four big targets. */}
        <div className="game-bar grid grid-cols-4 lg:hidden">
          <button onClick={() => setShowActions(true)} aria-haspopup="dialog" className="game-bar__item">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6h11M9 12h11M9 18h11" /><circle cx="4.5" cy="6" r="1.4" fill="currentColor" stroke="none" /><circle cx="4.5" cy="12" r="1.4" fill="currentColor" stroke="none" /><circle cx="4.5" cy="18" r="1.4" fill="currentColor" stroke="none" /></svg>
            Options
          </button>
          {coaching.hints ? (
            <button disabled={hintDisabled} onClick={() => void requestHint()} aria-expanded={hintStage !== null} className="game-bar__item">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z" /></svg>
              {hintCopy.hint}
            </button>
          ) : (
            <button disabled={!game || moveCount === 0} onClick={() => setConfirmUndo(true)} className="game-bar__item">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 7L4 12l5 5M4 12h11a5 5 0 0 1 0 10h-2" /></svg>
              Undo
            </button>
          )}
          <button {...backHold} disabled={moveCount === 0 || viewPly === 0} className="game-bar__item touch-manipulation select-none" aria-label="Back (hold to rewind)" aria-keyshortcuts="ArrowLeft Home">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
            Back
          </button>
          <button {...forwardHold} disabled={!reviewing} className="game-bar__item touch-manipulation select-none" aria-label="Forward (hold to fast-forward)" aria-keyshortcuts="ArrowRight End">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" /></svg>
            Forward
          </button>
        </div>
        <div className="hidden items-center gap-1.5 lg:flex">
        <Button
          onClick={() => setShowActions(true)}
          className="grid h-14 w-14 shrink-0 place-items-center rounded-full shadow-[var(--shadow)]"
          aria-label="Game options"
          aria-haspopup="dialog"
        >
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M4 7h16M4 17h16" /><circle cx="9" cy="7" r="2.6" fill="var(--surface)" /><circle cx="15" cy="17" r="2.6" fill="var(--surface)" /></svg>
        </Button>
        <Button
          variant="tint"
          onClick={() => setConfirmUndo(true)}
          disabled={!game || moveCount === 0}
          className="flex h-14 shrink-0 items-center justify-center gap-2 rounded-full px-5 text-base font-semibold lg:px-4"
          aria-keyshortcuts="u"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true"><path d="M9 7L4 12l5 5M4 12h11a5 5 0 0 1 0 10h-2" stroke="currentColor" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
          Undo
        </Button>
        <div className="flex-1" />
        <ReviewArrows onBack={() => step(-1)} onForward={() => step(1)} backDisabled={moveCount === 0 || viewPly === 0} forwardDisabled={!reviewing} />
        </div>
      </footer>
      </div>

      {showKeys && <KeyboardHelp onClose={() => setShowKeys(false)} extra={[["U", "Undo (asks first)"], ["N", "New game"]]} />}
      {showActions && <GameOptions
        onClose={() => setShowActions(false)}
        finished={game?.meta.status === "finished"}
        canResign={!!active}
        sound={settings.sound}
        onNew={() => { setShowActions(false); if (game?.meta.status === "finished") setResultVersion((v) => v + 1); else setShowNew(true); }}
        onFlip={() => { setOrientationOverride((o) => ((o ?? human) === "w" ? "b" : "w")); setShowActions(false); }}
        onSound={() => { unlockAudio(); update({ sound: !settings.sound }); if (!settings.sound) playSound("move", settings.volume); }}
        onResign={() => { setShowActions(false); setConfirmResign(true); }}
        canUndo={!!game && moveCount > 0}
        onUndo={() => { setShowActions(false); setConfirmUndo(true); }}
        onFriends={() => { setShowActions(false); setShowFriends(true); }}
        evalBar={settings.evalBar}
        onEval={() => update({ evalBar: !settings.evalBar })}
        live={settings.experience.ambient.mode === "ambient"}
        onLive={() => updateExperience({ ambient: { ...settings.experience.ambient, mode: settings.experience.ambient.mode === "ambient" ? "minimal" : "ambient" } })}
      />}
      {showFriends && <FriendsDialog onClose={() => setShowFriends(false)} />}

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

      {hintConsent === hintContext && <Dialog dir={settings.fatmaLanguage === "egy" ? "rtl" : "ltr"} lang={settings.fatmaLanguage === "egy" ? "ar-EG" : "en"} title={hintCopy.hint} description={hintCopy.consent} onClose={() => { hintOperation.current++; setHintConsent(null); setHintBusy(false); }} focusTitle>
        <button disabled={hintBusy} onClick={() => void requestHint(true)} className="min-h-12 rounded-xl bg-accent px-4 font-semibold text-accent-text disabled:opacity-50">{hintCopy.accept}</button>
        <button disabled={hintBusy} onClick={() => { hintOperation.current++; setHintConsent(null); setHintBusy(false); }} className="min-h-11 rounded-xl bg-surface-2 px-4">{hintCopy.cancel}</button>
      </Dialog>}
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

type OptionRowProps = { icon: React.ReactNode; label: string; hint?: string; onClick: () => void; danger?: boolean; disabled?: boolean };

function OptionRow({ icon, label, hint, onClick, danger, disabled }: OptionRowProps) {
  return (
    <button onClick={onClick} disabled={disabled} aria-keyshortcuts={hint} className={`press-overlay flex min-h-[52px] w-full items-center gap-3 px-4 text-start disabled:opacity-40 ${danger ? "text-danger" : ""}`}>
      <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${danger ? "bg-danger/10" : "bg-surface-2"}`} aria-hidden="true">{icon}</span>
      <span className="min-w-0 flex-1 font-medium">{label}</span>
      {hint && <kbd aria-hidden="true" className="hidden shrink-0 font-sans text-sm text-muted sm:inline">{hint}</kbd>}
    </button>
  );
}

const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
const GO_TO: Array<{ id: TabId; label: string }> = [
  { id: "play", label: "Play" },
  { id: "bots", label: "Bots" },
  { id: "learn", label: "Learn" },
  { id: "review", label: "Review" },
  { id: "more", label: "More" },
];

/** One clear Options sheet: game actions first, then a way out to the rest of the app. */
function GameOptions({ onClose, finished, canResign, sound, onNew, onFlip, onSound, onResign, canUndo, onUndo, onFriends, evalBar, onEval, live, onLive }: {
  onClose: () => void; finished: boolean; canResign: boolean; sound: boolean;
  onNew: () => void; onFlip: () => void; onSound: () => void; onResign: () => void;
  canUndo: boolean; onUndo: () => void; onFriends: () => void; evalBar: boolean; onEval: () => void;
  live: boolean; onLive: () => void;
}) {
  const { goToTab } = useShell();
  return (
    <Dialog title="Options" onClose={onClose}>
      <div className="-mx-1 divide-y divide-line overflow-hidden rounded-2xl bg-surface-2/60 ring-1 ring-inset ring-line">
        <OptionRow onClick={onNew} label={finished ? "Show result" : "New game"} icon={<svg viewBox="0 0 24 24" className="h-[18px] w-[18px]"><path d="M12 5v14M5 12h14" {...stroke} /></svg>} />
        <OptionRow onClick={onUndo} disabled={!canUndo} label="Undo move" hint="U" icon={<svg viewBox="0 0 24 24" className="h-[18px] w-[18px]"><path d="M9 7L4 12l5 5M4 12h11a5 5 0 0 1 0 10h-2" {...stroke} /></svg>} />
        <OptionRow onClick={onFriends} label="Friends & challenges" icon={<svg viewBox="0 0 24 24" className="h-[18px] w-[18px]"><circle cx="9" cy="8" r="3" {...stroke} /><path d="M3 20v-2a6 6 0 0 1 12 0v2M16 5a3 3 0 0 1 0 6m2 3a5 5 0 0 1 3 4v2" {...stroke} /></svg>} />
        <OptionRow onClick={onEval} label={evalBar ? "Hide evaluation bar" : "Show evaluation bar"} icon={<span className="text-sm font-semibold">±</span>} />
        <OptionRow onClick={onLive} label={live ? "Turn off live background" : "Live background"} icon={<svg viewBox="0 0 24 24" className="h-[18px] w-[18px]"><path d="M3 8c3-2 5 2 8 0s5-2 8 0M3 13c3-2 5 2 8 0s5-2 8 0M3 18c3-2 5 2 8 0" {...stroke} /></svg>} />
        <OptionRow onClick={onFlip} label="Flip board" hint="F" icon={<svg viewBox="0 0 24 24" className="h-[18px] w-[18px]"><path d="M7 4v13m0 0l-3-3m3 3l3-3M17 20V7m0 0l-3 3m3-3l3 3" {...stroke} /></svg>} />
        <OptionRow onClick={onSound} label={sound ? "Mute sounds" : "Turn sounds on"} hint="M" icon={<svg viewBox="0 0 24 24" className="h-[18px] w-[18px]"><path d="M4 9.5h3.5L12 5v14l-4.5-4.5H4z" {...stroke} />{sound ? <path d="M15.5 9a4 4 0 0 1 0 6" {...stroke} /> : <path d="M16 9.5l5 5m0-5l-5 5" {...stroke} />}</svg>} />
        <OptionRow onClick={onResign} disabled={!canResign} danger label="Resign" icon={<svg viewBox="0 0 24 24" className="h-[18px] w-[18px]"><path d="M6 21V4m0 0h11l-2 4 2 4H6" {...stroke} /></svg>} />
      </div>
      <Link href="/settings/theme" className="press-overlay flex min-h-12 items-center justify-between rounded-2xl px-4 text-sm font-medium ring-1 ring-inset ring-line">
        Board theme
        <svg viewBox="0 0 24 24" className="h-4 w-4 text-muted rtl:rotate-180" aria-hidden="true"><path d="M9 5l7 7-7 7" {...stroke} /></svg>
      </Link>
      <Link href="/settings" className="press-overlay flex min-h-12 items-center justify-between rounded-2xl px-4 text-sm font-medium ring-1 ring-inset ring-line">
        Board, sound, haptics & Sherine
        <svg viewBox="0 0 24 24" className="h-4 w-4 text-muted rtl:rotate-180" aria-hidden="true"><path d="M9 5l7 7-7 7" {...stroke} /></svg>
      </Link>
      <nav aria-label="Go to" className="mt-1">
        <p className="mb-1.5 px-1 text-xs font-medium uppercase tracking-wide text-muted">Go to</p>
        <div className="grid grid-cols-5 gap-1.5">
          {GO_TO.map((tab) => (
            <button key={tab.id} onClick={() => { onClose(); goToTab(tab.id); }} className="press-overlay min-h-11 rounded-xl bg-surface-2 text-[13px] font-medium">{tab.label}</button>
          ))}
        </div>
      </nav>
    </Dialog>
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
            onClick={() => {
              if (v !== value) haptic("select");
              onChange(v);
            }}
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
