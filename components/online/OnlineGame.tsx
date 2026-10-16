"use client";

import { useMutation } from "convex/react";
import { useAppRouter as useRouter } from "@/components/navigation/useAppRouter";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/convex/_generated/api";
import { Board, type LastMove } from "@/components/chess/Board";
import { CapturedPieces } from "@/components/chess/CapturedPieces";
import { Dialog, KeyboardHelp } from "@/components/chess/GameScreen";
import { ClockChip } from "@/components/chess/ClockChip";
import { CharacterField } from "@/components/shell/CharacterField";
import { GameResult } from "@/components/chess/GameResult";
import { MoveList, MoveStrip } from "@/components/chess/MoveStrip";
import { ReviewArrows } from "@/components/chess/ReviewArrows";
import { MenuButton } from "@/components/shell/AppShell";
import { Avatar } from "@/components/profile/ChessCard";
import { GlassButton } from "@/components/ui/Glass";
import { capturesAlongLine } from "@/lib/chess/captures";
import { applyUci, DEFAULT_POSITION, describeMove, kingSquare, positionStatus, sideToMove, type Color, type Square } from "@/lib/chess/rules";
import { useSettings } from "@/lib/client/settings";
import { haptic, installAudioUnlock, playSound, resultSound, unlockAudio } from "@/lib/client/sound";
import { avatarFromName, timeControlLabel, useServerOffset } from "@/lib/client/online";
import { canSubmitMove, livePendingMove, type PendingMove } from "@/lib/client/onlineMoves";
import { PLAY_STAGE } from "@/lib/client/viewTransition";
import { errorText } from "./OnlineShared";
import type { RoomView } from "./OnlineRoom";

const REASON: Record<string, string> = {
  checkmate: "by checkmate",
  resign: "by resignation",
  timeout: "on time",
  stalemate: "stalemate",
  insufficient: "insufficient material",
  fifty_move: "50-move rule",
  threefold: "threefold repetition",
  agreement: "by agreement",
};

function other(c: Color): Color {
  return c === "w" ? "b" : "w";
}

function moveSound(applied: NonNullable<ReturnType<typeof applyUci>>) {
  const castle = applied.flags.includes("k") || applied.flags.includes("q");
  return applied.promotion ? "promote" : castle ? "castle" : applied.check ? "check" : applied.captured ? "capture" : "move";
}

function toLastMove(uci: string | null, key: string): LastMove {
  if (!uci) return null;
  return { from: uci.slice(0, 2) as Square, to: uci.slice(2, 4) as Square, key };
}

/** A live game against another person; the server is the referee. */
export function OnlineGame({ room, token }: { room: RoomView; token: string }) {
  const router = useRouter();
  const { settings, reducedMotion, update } = useSettings();
  const offset = useServerOffset();
  const move = useMutation(api.online.move);
  const resign = useMutation(api.online.resign);
  const offerDraw = useMutation(api.online.offerDraw);
  const declineDraw = useMutation(api.online.declineDraw);
  const rematch = useMutation(api.online.rematch);
  const claimTimeout = useMutation(api.online.claimTimeout);

  const you = room.you;
  const playing = you !== null;
  const active = room.status === "active";
  const [orientationOverride, setOrientationOverride] = useState<Color | null>(null);
  const orientation = orientationOverride ?? you ?? "w";
  const [confirmResign, setConfirmResign] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rematchAsked, setRematchAsked] = useState(false);
  const [showKeys, setShowKeys] = useState(false);
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => installAudioUnlock(), []);

  // Optimistic move: show it instantly until the server catches up or refuses.
  const [pending, setPending] = useState<PendingMove | null>(null);
  const livePending = livePendingMove(pending, room.ply);
  const liveFen = livePending?.fen ?? room.fen;
  const livePly = room.ply + (livePending ? 1 : 0);

  const line = useMemo(() => {
    const nodes = room.moves.map((m) => ({ key: `m${m.ply}`, ply: m.ply, san: m.san }));
    if (livePending) {
      const applied = applyUci(room.fen, livePending.uci);
      if (applied) nodes.push({ key: `m${livePly}`, ply: livePly, san: applied.san });
    }
    return nodes;
  }, [room.moves, room.fen, livePending, livePly]);

  // Review: step back through the game without affecting it.
  const [viewPly, setViewPly] = useState<number | null>(null);
  const reviewing = viewPly !== null && viewPly < line.length;
  const viewFen = useMemo(() => {
    if (!reviewing) return liveFen;
    let fen = DEFAULT_POSITION;
    for (const m of room.moves.slice(0, viewPly!)) fen = applyUci(fen, m.uci)?.fen ?? fen;
    return fen;
  }, [reviewing, viewPly, liveFen, room.moves]);
  const fen = reviewing ? viewFen : liveFen;
  const step = useCallback(
    (delta: number) => {
      const at = viewPly ?? line.length;
      const next = Math.max(0, Math.min(line.length, at + delta));
      if (next === at) return;
      unlockAudio();
      if (settings.sound) playSound("move", settings.volume);
      setViewPly(next >= line.length ? null : next);
    },
    [viewPly, line.length, settings.sound, settings.volume],
  );
  const jumpTo = useCallback((ply: number) => setViewPly(ply >= line.length ? null : ply), [line.length]);

  // Sounds and haptics for moves that arrive from the other player.
  const seenPly = useRef(room.ply);
  const prevFen = useRef(room.fen);
  useEffect(() => {
    if (room.ply > seenPly.current) {
      const last = room.moves[room.moves.length - 1];
      const mine = last && sideToMove(prevFen.current) === you;
      if (last && !mine) {
        setViewPly(null);
        const applied = applyUci(prevFen.current, last.uci);
        const mover = sideToMove(prevFen.current);
        if (applied) setAnnouncement(`${(mover === "w" ? room.white : room.black) ?? "Opponent"}: ${describeMove(applied, mover)}`);
        if (applied && !applied.checkmate && settings.sound) playSound(moveSound(applied), settings.volume);
        if (settings.haptics) haptic(8);
      }
    }
    seenPly.current = room.ply;
    prevFen.current = room.fen;
  }, [room.ply, room.fen, room.moves, room.white, room.black, you, settings.sound, settings.volume, settings.haptics]);

  const ended = useRef(room.status === "finished");
  useEffect(() => {
    if (room.status !== "finished") {
      ended.current = false;
      return;
    }
    if (room.status === "finished" && !ended.current) {
      ended.current = true;
      if (settings.sound) playSound(resultSound(room.result, you), settings.volume);
    }
  }, [room.status, room.result, you, settings.sound, settings.volume]);

  // Rematch accepted: both players follow the new room.
  useEffect(() => {
    if (room.rematchCode) router.replace(`/play/${room.rematchCode}`);
  }, [room.rematchCode, router]);

  const onMove = useCallback(
    async (uci: string) => {
      unlockAudio();
      if (!canSubmitMove({ you, active, fen: room.fen, serverPly: room.ply, pending })) return false;
      const applied = applyUci(room.fen, uci);
      if (!applied) return false;
      setPending({ ply: room.ply, fen: applied.fen, uci });
      if (!applied.checkmate && settings.sound) playSound(moveSound(applied), settings.volume);
      if (settings.haptics) haptic(applied.captured ? [8, 30, 8] : 8);
      try {
        await move({ roomId: room.roomId, token, uci, ply: room.ply });
        setError(null);
      } catch (e) {
        setPending(null);
        setError(errorText(e));
        return false;
      }
      return true;
    },
    [you, active, room.fen, room.ply, room.roomId, pending, move, token, settings.sound, settings.volume, settings.haptics],
  );

  // Clocks tick locally from the server's turn start (corrected for clock drift).
  const timed = room.initialMs !== null;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!timed || !active || room.turnStartedAt === null) return;
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, [timed, active, room.turnStartedAt]);
  const toMove = sideToMove(room.fen);
  const clockOf = (c: Color): number | null => {
    const base = c === "w" ? room.clockW : room.clockB;
    if (base === null) return null;
    if (!active || room.turnStartedAt === null || c !== toMove || livePending) return base;
    return Math.max(0, base - (now + offset - room.turnStartedAt));
  };
  const flagClaimed = useRef<number | null>(null);
  const runningClock = clockOf(toMove);
  useEffect(() => {
    if (!playing || !active || runningClock === null || runningClock > 0 || room.turnStartedAt === null) return;
    if (flagClaimed.current === room.ply) return;
    flagClaimed.current = room.ply;
    void claimTimeout({ roomId: room.roomId, token }).catch(() => {});
  }, [playing, active, runningClock, room.turnStartedAt, room.ply, room.roomId, token, claimTimeout]);

  const lowTimeWarned = useRef(false);
  const myClock = you ? clockOf(you) : null;
  useEffect(() => {
    if (myClock === null || myClock > 20_000 || lowTimeWarned.current || !active) return;
    lowTimeWarned.current = true;
    if (settings.sound) playSound("lowtime", settings.volume);
  }, [myClock, active, settings.sound, settings.volume]);

  // Keyboard: arrows/Home/End review, F flips, M mutes, ? lists shortcuts.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.target instanceof HTMLElement && e.target.closest("[role=dialog]")) return;
      const inBoard = e.target instanceof HTMLElement && e.target.closest("[role=grid]");
      if (!inBoard && e.key === "ArrowLeft") step(-1);
      if (!inBoard && e.key === "ArrowRight") step(1);
      if (!inBoard && e.key === "Home") jumpTo(0);
      if (!inBoard && e.key === "End") jumpTo(line.length);
      if (e.key === "f") setOrientationOverride((o) => ((o ?? you ?? "w") === "w" ? "b" : "w"));
      if (e.key === "m") update({ sound: !settings.sound });
      if (e.key === "?") setShowKeys(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step, jumpTo, line.length, you, update, settings.sound]);

  const captures = useMemo(() => capturesAlongLine(DEFAULT_POSITION, reviewing ? room.moves.slice(0, viewPly!) : room.moves), [reviewing, viewPly, room.moves]);
  const status = useMemo(() => positionStatus(fen), [fen]);
  const checkSq = status.check ? kingSquare(fen, sideToMove(fen)) ?? null : null;
  const lastMove: LastMove = reviewing
    ? viewPly && viewPly > 0
      ? toLastMove(room.moves[viewPly - 1]?.uci ?? null, `view-${viewPly}`)
      : null
    : livePending
      ? toLastMove(livePending.uci, `m${livePly}`)
      : toLastMove(room.lastUci, `m${room.ply}`);

  const top: Color = orientation === "w" ? "b" : "w";
  const bottom: Color = orientation;
  const nameOf = (c: Color) => (c === "w" ? room.white : room.black) ?? "Waiting…";
  // Rooms from before avatars fall back to one derived from the name, so both screens agree.
  const avatarOf = (c: Color) => (c === "w" ? room.whiteAvatar : room.blackAvatar) ?? avatarFromName(nameOf(c));
  const opponentName = you ? nameOf(other(you)) : "White";
  const myTurn = !!you && active && toMove === you && !livePending;
  const finished = room.status === "finished";
  const theyOfferDraw = !!you && active && room.drawOfferBy === other(you);
  const iOfferedDraw = !!you && active && room.drawOfferBy === you;
  const theyWantRematch = !!you && finished && room.rematchBy === other(you);

  const resultText = finished
    ? !room.result
      ? "Game aborted"
      : room.result === "1/2-1/2"
        ? `Draw · ${REASON[room.resultReason ?? ""] ?? ""}`
        : `${nameOf(room.result === "1-0" ? "w" : "b")} wins ${REASON[room.resultReason ?? ""] ?? ""}`.trim()
    : null;

  const row = (c: Color) => (
    <div className="flex min-h-12 w-full min-w-0 items-center justify-between gap-2 py-1">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="shrink-0 overflow-hidden rounded-xl bg-surface">
          <Avatar {...avatarOf(c)} size={40} />
        </span>
        <div className="min-w-0">
          <span className="block truncate text-sm font-semibold">
            {nameOf(c)}
            {c === you && <span className="font-normal text-muted"> · you</span>}
          </span>
          <CapturedPieces pieces={captures.captured[c]} color={other(c)} advantage={captures.advantage[c]} />
        </div>
      </div>
      {timed && <ClockChip ms={clockOf(c)} running={active && toMove === c && room.turnStartedAt !== null} />}
    </div>
  );

  return (
    <>
    {/* Optional living background: only behind games (Settings → Display). */}
    {settings.livingBackground && <CharacterField reducedMotion={reducedMotion} />}
    <main className="min-h-dvh w-full px-3 sm:px-6">
      <div
        className="game-layout"
      >
        <header className="safe-top flex items-center justify-end gap-1.5 pb-2 [grid-area:header] lg:pt-0">
          {playing && (
            <GlassButton
              disabled={!active || room.ply < 2 || iOfferedDraw}
              onClick={() => void offerDraw({ roomId: room.roomId, token })}
              className="h-11 shrink-0 rounded-full px-3.5 text-sm font-medium"
              aria-label={iOfferedDraw ? "Draw offered" : "Offer a draw"}
            >
              {iOfferedDraw ? "Offered" : "Draw"}
            </GlassButton>
          )}
          <GlassButton
            onClick={() => setOrientationOverride((o) => ((o ?? you ?? "w") === "w" ? "b" : "w"))}
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
          {playing && (
            <GlassButton disabled={!active} onClick={() => setConfirmResign(true)} className="grid h-11 w-11 shrink-0 place-items-center rounded-full" aria-label={room.ply < 2 ? "Abort game" : "Resign"} title={room.ply < 2 ? "Abort" : "Resign"}>
              <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true"><path d="M5 21V4m0 0h11l-2 4 2 4H5" stroke="currentColor" strokeWidth="1.9" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </GlassButton>
          )}
          <MenuButton />
        </header>

        <div className="game-moves min-h-0 [grid-area:moves] lg:flex lg:flex-col">
          <p className="px-3 pb-1.5 text-xs text-muted lg:pt-3">
            {timeControlLabel(room.initialMs, room.incrementMs)} · PIN <span className="tabular-nums">{room.code}</span>
            {!playing && " · watching"}
          </p>
          <div className="lg:hidden">
            <MoveStrip line={line} cursor={viewPly ?? line.length} onSelect={jumpTo} />
          </div>
          <MoveList line={line} cursor={viewPly ?? line.length} onSelect={jumpTo} className="hidden flex-1 lg:flex" />
        </div>

        <section className="game-board-group">
          <div className="game-opponent">{row(top)}</div>
          <div className="game-position relative w-full" data-vt-ready style={{ viewTransitionName: PLAY_STAGE }}>
            <Board
              fen={fen}
              orientation={orientation}
              movable={myTurn && !reviewing ? you : null}
              onMove={onMove}
              lastMove={lastMove}
              checkSquare={checkSq}
              showLegalDots={settings.legalDots}
              coordinates={settings.coordinates}
              reducedMotion={reducedMotion}
              result={finished && !reviewing ? { result: room.result ?? undefined, reason: room.resultReason ?? undefined } : undefined}
              label={`Chess board${you ? `, you play ${you === "w" ? "White" : "Black"}` : ""}. ${reviewing ? "Reviewing an earlier move." : finished ? "Game over." : myTurn ? "Your move." : `${nameOf(toMove)} to move.`}`}
            />
          </div>
          <div className="game-player">{row(bottom)}</div>
        </section>

        <div className="flex min-h-6 w-full flex-wrap items-center justify-end gap-2 text-xs text-muted [grid-area:status] lg:justify-start" aria-live="polite">
          {theyOfferDraw ? (
            <span className="flex items-center gap-2 rounded-full bg-surface px-3 py-1 text-ink shadow-[var(--shadow)]">
              {opponentName} offers a draw
              <button onClick={() => void offerDraw({ roomId: room.roomId, token })} className="font-semibold underline">Accept</button>
              <button onClick={() => void declineDraw({ roomId: room.roomId, token })} className="text-muted underline">Decline</button>
            </span>
          ) : iOfferedDraw ? (
            <span>Draw offered…</span>
          ) : active && !myTurn && playing ? (
            <span>{livePending ? "Sending…" : `Waiting for ${opponentName}…`}</span>
          ) : active && myTurn ? (
            <span className="font-medium text-ink">Your move{room.ply === 0 ? " · you start" : ""}</span>
          ) : null}
          {error && <span className="text-danger">{error}</span>}
        </div>

        <footer className="safe-bottom flex w-full items-center gap-3 pt-2 [grid-area:footer] lg:pb-0">
          <div className="flex-1" />
          <ReviewArrows onBack={() => step(-1)} onForward={() => step(1)} backDisabled={line.length === 0 || viewPly === 0} forwardDisabled={!reviewing} />
        </footer>
      </div>

      {finished && !reviewing && resultText && (
        <GameResult
          key={`${room.roomId}:${room.result ?? "aborted"}`}
          result={room.result ?? undefined}
          reason={room.resultReason ?? undefined}
          human={you ?? "w"}
          description={resultText}
          reducedMotion={reducedMotion}
          opponentName={opponentName}
          rematchLabel={!playing ? "New game" : theyWantRematch ? `${opponentName} wants a rematch · Accept` : rematchAsked || room.rematchBy === you ? `Waiting for ${opponentName}…` : "Rematch"}
          rematchDisabled={playing && !theyWantRematch && (rematchAsked || room.rematchBy === you)}
          onRematch={() => {
            if (!playing) {
              router.push("/play");
              return;
            }
            setRematchAsked(true);
            void rematch({ roomId: room.roomId, token }).catch((e) => setError(errorText(e)));
          }}
        />
      )}

      <p className="sr-only" aria-live="assertive">{announcement}</p>
      {showKeys && <KeyboardHelp onClose={() => setShowKeys(false)} />}

      {confirmResign && (
        <Dialog title={room.ply < 2 ? "Abort this game?" : "Resign this game?"} onClose={() => setConfirmResign(false)}>
          <button
            onClick={() => {
              setConfirmResign(false);
              void resign({ roomId: room.roomId, token });
            }}
            className="w-full rounded-2xl bg-danger py-3 font-medium text-white"
          >
            {room.ply < 2 ? "Abort" : "Resign"}
          </button>
          <button onClick={() => setConfirmResign(false)} className="w-full rounded-2xl bg-surface-2 py-3">
            Keep playing
          </button>
        </Dialog>
      )}
    </main>
    </>
  );
}
