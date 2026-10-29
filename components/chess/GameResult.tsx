"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import type { Color } from "@/lib/chess/rules";
import { useSettings } from "@/lib/client/settings";
import { Dialog } from "@/components/ui/Dialog";
import { Piece } from "./Pieces";

export type RematchState =
  | "none"
  | "requesting"
  | "pending"
  | "incoming"
  | "declined"
  | "cancelled"
  | "expired"
  | "accepted"
  | "unavailable";
type Props = {
  result?: string;
  reason?: string;
  human: Color;
  description: string;
  reducedMotion: boolean;
  onRematch: () => void;
  onReview?: () => void;
  reviewUrl?: string;
  opponentName?: string;
  kind?: "bot" | "human" | "spectator";
  rematchState?: RematchState;
  rematchDisabled?: boolean;
  extraActions?: ReactNode;
  status?: string;
  summary?: {
    moves: number;
    durationMs?: number;
    timeControl?: string;
    names?: { white: string; black: string };
  };
};
const COPY = {
  en: {
    won: "You won",
    lost: "You lost",
    draw: "Draw",
    ended: "Game over",
    again: "Play again",
    request: "Request rematch",
    accept: "Accept rematch",
    waiting: "Rematch requested",
    sending: "Sending request…",
    accepted: "Rematch accepted",
    unavailable: "Opponent unavailable",
    review: "Review game",
    board: "Back to board",
    close: "Close result",
    newGame: "New game",
    winner: "Winner",
    you: "You",
    white: "White",
    black: "Black",
    moves: "Moves",
    elapsed: "Elapsed",
    time: "Time control",
    checkmate: "Checkmate",
    stalemate: "Stalemate",
    timeout: "Time expired",
    resign: "Resignation",
    agreed: "Draw agreed",
    repetition: "Threefold repetition",
    insufficient: "Insufficient material",
    fifty: "Fifty-move rule",
    aborted: "Game abandoned or aborted",
  },
  egy: {
    won: "إنت كسبت",
    lost: "إنت خسرت",
    draw: "تعادل",
    ended: "الدور خلص",
    again: "العب تاني",
    request: "اطلب ريفانش",
    accept: "اقبل الريفانش",
    waiting: "طلب الريفانش اتبعت",
    sending: "بنبعت الطلب…",
    accepted: "الريفانش اتقبل",
    unavailable: "المنافس مش متاح",
    review: "راجع الدور",
    board: "ارجع للبورد",
    close: "اقفل النتيجة",
    newGame: "دور جديد",
    winner: "الفايز",
    you: "إنت",
    white: "الأبيض",
    black: "الأسود",
    moves: "النقلات",
    elapsed: "المدة",
    time: "وقت اللعب",
    checkmate: "كش مات",
    stalemate: "تعادل بالخنق",
    timeout: "الوقت خلص",
    resign: "استسلام",
    agreed: "تعادل بالاتفاق",
    repetition: "تكرار الوضع ٣ مرات",
    insufficient: "قطع مش كفاية للمات",
    fifty: "قاعدة الخمسين نقلة",
    aborted: "الدور اتلغى أو متكملش",
  },
  franco: {
    won: "Enta kesebt",
    lost: "Enta khesert",
    draw: "Ta3adol",
    ended: "El dor kheles",
    again: "El3ab tany",
    request: "Otlob revanche",
    accept: "E2bal el revanche",
    waiting: "Talab el revanche etba3at",
    sending: "Beneb3at el talab…",
    accepted: "El revanche et2ebel",
    unavailable: "El monafes mesh mota7",
    review: "Rage3 el dor",
    board: "Erga3 lel board",
    close: "E2fel el nateega",
    newGame: "Dor gedid",
    winner: "El fayez",
    you: "Enta",
    white: "Abyad",
    black: "Eswed",
    moves: "Na2lat",
    elapsed: "El modda",
    time: "Wa2t el le3b",
    checkmate: "Kesh mate",
    stalemate: "Ta3adol bel khan2",
    timeout: "El wa2t kheles",
    resign: "Esteslam",
    agreed: "Ta3adol bel ettefa2",
    repetition: "Tekrar el wad3 3 marrat",
    insufficient: "2eta3 mesh kefaya lel mate",
    fifty: "Qa3det el khamseen na2la",
    aborted: "El dor etlagha aw makammelsh",
  },
};

/** The result is presentation only. Dismissing it never changes the match or request. */
export function GameResult({
  result,
  reason,
  human,
  description,
  onRematch,
  onReview,
  reviewUrl,
  opponentName = "Sherine",
  kind = "bot",
  rematchState = "none",
  rematchDisabled = false,
  extraActions,
  status,
  summary,
}: Props) {
  const [dismissed, setDismissed] = useState(false);
  const { settings } = useSettings();
  if (dismissed) return null;
  const copy = COPY[settings.fatmaLanguage];
  const draw = result === "1/2-1/2";
  const validResult = result === "1-0" || result === "0-1" || draw;
  const won = !draw && validResult && (result === "1-0") === (human === "w");
  const title =
    !validResult || kind === "spectator"
      ? copy.ended
      : draw
        ? copy.draw
        : won
          ? copy.won
          : copy.lost;
  const reasons: Record<string, string> = {
    checkmate: copy.checkmate,
    stalemate: copy.stalemate,
    timeout: copy.timeout,
    fatma_timeout: copy.timeout,
    resign: copy.resign,
    agreed: copy.agreed,
    agreement: copy.agreed,
    threefold: copy.repetition,
    repetition: copy.repetition,
    insufficient: copy.insufficient,
    fifty_move: copy.fifty,
    aborted: copy.aborted,
    abort: copy.aborted,
    replaced: copy.aborted,
  };
  const why =
    reasons[reason ?? ""] ?? (validResult ? description : copy.aborted);
  const names = summary?.names ?? {
    white: human === "w" ? copy.you : opponentName,
    black: human === "b" ? copy.you : opponentName,
  };
  const primary =
    kind === "bot"
      ? copy.again
      : kind === "spectator"
        ? copy.newGame
        : rematchState === "incoming"
          ? copy.accept
          : rematchState === "pending"
            ? copy.waiting
            : rematchState === "requesting"
              ? copy.sending
              : rematchState === "accepted"
                ? copy.accepted
                : rematchState === "unavailable"
                  ? copy.unavailable
                  : copy.request;
  const score =
    result === "1-0"
      ? "1 – 0"
      : result === "0-1"
        ? "0 – 1"
        : draw
          ? "½ – ½"
          : "—";
  const duration =
    summary?.durationMs !== undefined
      ? Math.max(0, Math.round(summary.durationMs / 1000))
      : null;
  return (
    <Dialog
      dir={settings.fatmaLanguage === "egy" ? "rtl" : "ltr"}
      lang={settings.fatmaLanguage === "egy" ? "ar-EG" : "en"}
      title={title}
      description={why}
      size="result"
      focusTitle
      onClose={() => setDismissed(true)}
    >
      <div
        dir={settings.fatmaLanguage === "egy" ? "rtl" : "ltr"}
        className="grid gap-4"
      >
        <button
          onClick={() => setDismissed(true)}
          aria-label={copy.close}
          className="absolute top-1 end-1 grid h-11 w-11 place-items-center rounded-full text-muted"
        >
          <span aria-hidden="true">×</span>
        </button>
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-2xl bg-surface-2 p-4">
          {(["w", "b"] as const).map((color, index) => (
            <div key={color} className="contents">
              {index === 1 && (
                <span
                  dir="ltr"
                  className="font-mono text-2xl font-bold tabular-nums"
                >
                  {score}
                </span>
              )}
              <div className="grid min-w-0 justify-items-center gap-1 text-center">
                <Piece
                  type="k"
                  color={color}
                  set={settings.pieceSet}
                  className="h-12 w-12"
                />
                <span className="max-w-full break-words text-sm font-semibold">
                  {color === "w" ? names.white : names.black}
                </span>
                <span className="text-xs text-muted">
                  {color === "w" ? copy.white : copy.black}
                  {result === (color === "w" ? "1-0" : "0-1")
                    ? ` · ${copy.winner}`
                    : ""}
                </span>
              </div>
            </div>
          ))}
        </div>
        {summary && (
          <dl className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-center text-xs text-muted">
            <div>
              <dt>{copy.moves}</dt>
              <dd className="mt-1 font-mono text-sm font-semibold text-ink">
                {summary.moves}
              </dd>
            </div>
            {duration !== null && (
              <div>
                <dt>{copy.elapsed}</dt>
                <dd
                  dir="ltr"
                  className="mt-1 font-mono text-sm font-semibold text-ink"
                >
                  {Math.floor(duration / 60)}:
                  {String(duration % 60).padStart(2, "0")}
                </dd>
              </div>
            )}
            {summary.timeControl && (
              <div>
                <dt>{copy.time}</dt>
                <dd
                  dir="ltr"
                  className="mt-1 font-mono text-sm font-semibold text-ink"
                >
                  {summary.timeControl}
                </dd>
              </div>
            )}
          </dl>
        )}
        <button
          onClick={onRematch}
          disabled={
            rematchDisabled ||
            ["requesting", "pending", "accepted", "unavailable"].includes(
              rematchState,
            )
          }
          className="min-h-14 w-full rounded-2xl bg-accent px-5 py-3 text-base font-bold text-accent-text disabled:opacity-60"
        >
          {primary}
        </button>
        {status && (
          <p role="status" className="text-center text-sm text-muted">
            {status}
          </p>
        )}
        {extraActions}
        {onReview && (
          <button
            onClick={onReview}
            className="grid min-h-12 place-items-center rounded-2xl border border-line bg-surface-2 px-4 text-sm font-semibold"
          >
            {copy.review}
          </button>
        )}
        {!onReview && reviewUrl && (
          <Link
            href={reviewUrl}
            prefetch={false}
            className="grid min-h-12 place-items-center rounded-2xl border border-line bg-surface-2 px-4 text-sm font-semibold"
          >
            {copy.review}
          </Link>
        )}
        <button
          onClick={() => setDismissed(true)}
          className="min-h-11 px-4 text-sm text-muted"
        >
          {copy.board}
        </button>
      </div>
    </Dialog>
  );
}
