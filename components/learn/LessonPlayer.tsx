"use client";

import { useConvexAuth, useMutation } from "convex/react";
import Link from "next/link";
import { useCallback, useMemo, useRef, useState } from "react";
import { api } from "@/convex/_generated/api";
import { Board, type LastMove } from "@/components/chess/Board";
import { FatmaSprite } from "@/components/fatma/FatmaSprite";
import { gradeMove, hintFor, maxHintLevel, type Lesson } from "@/lib/chess/lessons/schema";
import { applyUci, kingSquare, positionStatus, sideToMove, type Square } from "@/lib/chess/rules";
import { useSettings } from "@/lib/client/settings";
import { playSound, unlockAudio } from "@/lib/client/sound";

type Feedback = { kind: "wrong" | "right" | "hint" | "done"; text: string } | null;

/** Board-first micro-lesson: 1-3 moves per step, progressive hints, short feedback. */
export function LessonPlayer({ lesson, onComplete }: { lesson: Lesson; onComplete?: (stats: { hints: number; mistakes: number }) => void }) {
  const { settings, reducedMotion } = useSettings();
  const { isAuthenticated } = useConvexAuth();
  const recordStep = useMutation(api.lessons.recordStep);
  const [stepIndex, setStepIndex] = useState(0);
  const [played, setPlayed] = useState<string[]>([]);
  const [fen, setFen] = useState(lesson.steps[0].fen);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [hintLevel, setHintLevel] = useState(0);
  const [stepHints, setStepHints] = useState(0);
  const [stepMistakes, setStepMistakes] = useState(0);
  const [totals, setTotals] = useState({ hints: 0, mistakes: 0 });
  const [lastMove, setLastMove] = useState<LastMove>(null);
  const [stepDone, setStepDone] = useState(false);
  const [finished, setFinished] = useState(false);
  const step = lesson.steps[stepIndex];
  const learner = sideToMove(step.fen);

  const resetStep = useCallback((index: number) => {
    setStepIndex(index);
    setPlayed([]);
    setFen(lesson.steps[index].fen);
    setFeedback(null);
    setHintLevel(0);
    setStepHints(0);
    setStepMistakes(0);
    setLastMove(null);
    setStepDone(false);
  }, [lesson.steps]);

  // Callers remount with key={lesson.id}; moveSeq gives each animation a unique key.
  const moveSeq = useRef(0);

  const sound = (name: Parameters<typeof playSound>[0]) => settings.sound && playSound(name, settings.volume);

  const onMove = (uci: string) => {
    unlockAudio();
    const result = gradeMove(step, played, uci);
    if (result.kind === "illegal") return false;
    const applied = applyUci(fen, uci)!;
    if (result.kind === "wrong") {
      sound("wrong");
      setFeedback({ kind: "wrong", text: result.explanation });
      setStepMistakes((m) => m + 1);
      // Show the wrong move briefly, then put the position back.
      setFen(applied.fen);
      setLastMove({ from: applied.from, to: applied.to, key: `w${++moveSeq.current}` });
      setTimeout(() => {
        setFen(fen);
        setLastMove(null);
      }, 900);
      return true;
    }
    sound(applied.captured ? "capture" : "move");
    if (result.kind === "complete") {
      setFen(result.fen);
      setLastMove({ from: applied.from, to: applied.to, key: `c${++moveSeq.current}` });
      setPlayed([...played, applied.uci]);
      completeStep();
      return true;
    }
    // Continue: show learner move then the scripted reply.
    setFen(result.userFen);
    setLastMove({ from: applied.from, to: applied.to, key: `u${++moveSeq.current}` });
    setFeedback({ kind: "right", text: "Good." });
    setTimeout(() => {
      const reply = applyUci(result.userFen, result.reply)!;
      setFen(result.replyFen);
      setLastMove({ from: reply.from, to: reply.to, key: `r${++moveSeq.current}` });
      setPlayed((p) => [...p, applied.uci, result.reply]);
      setHintLevel(0);
      sound(reply.captured ? "capture" : "move");
    }, 450);
    return true;
  };

  const completeStep = () => {
    sound("correct");
    setStepDone(true);
    const isLast = stepIndex === lesson.steps.length - 1;
    setFeedback({ kind: "done", text: isLast ? "Lesson complete." : "Nice." });
    const nextTotals = { hints: totals.hints + stepHints, mistakes: totals.mistakes + stepMistakes };
    setTotals(nextTotals);
    if (isAuthenticated) {
      void recordStep({
        lessonId: lesson.id,
        lessonVersion: lesson.version,
        stepIndex,
        totalSteps: lesson.steps.length,
        hintsUsed: stepHints,
        mistakes: stepMistakes,
      }).catch(() => {});
    }
    if (isLast) {
      setFinished(true);
      onComplete?.(nextTotals);
    }
  };

  const showHint = () => {
    const text = hintFor(step, played, hintLevel);
    if (!text) return;
    setFeedback({ kind: "hint", text });
    setHintLevel((h) => h + 1);
    setStepHints((h) => h + 1);
  };

  const status = useMemo(() => positionStatus(fen), [fen]);
  const hintTarget = hintLevel > step.hints.length ? (feedback?.text.match(/on ([a-h][1-8])/)?.[1] as Square | undefined) : undefined;

  return (
    <div className="mx-auto w-full max-w-[min(92vw,calc(100dvh-250px),640px)]">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-lg font-medium leading-snug">{step.prompt}</p>
        <span className="shrink-0 text-sm tabular-nums text-muted" aria-label={`Step ${stepIndex + 1} of ${lesson.steps.length}`}>
          {stepIndex + 1}/{lesson.steps.length}
        </span>
      </div>
      <Board
        fen={fen}
        orientation={learner}
        movable={stepDone || finished ? null : learner}
        onMove={onMove}
        lastMove={lastMove}
        checkSquare={status.check ? kingSquare(fen, sideToMove(fen)) ?? null : null}
        showLegalDots={settings.legalDots}
        coordinates={settings.coordinates}
        reducedMotion={reducedMotion}
        hintSquares={hintTarget ? [hintTarget] : []}
        label={`Lesson board. ${step.prompt}`}
      />
      <div className="mt-3 flex min-h-16 items-center gap-3" aria-live="polite">
        {feedback && (
          <>
            <FatmaSprite
              expression={feedback.kind === "wrong" ? "amused" : feedback.kind === "done" ? "impressed" : "idle"}
              size={48}
              reducedMotion={reducedMotion}
            />
            <p className={`bubble-in rounded-2xl px-3 py-2 text-sm ${feedback.kind === "wrong" ? "bg-surface text-danger" : "bg-surface"}`}>{feedback.text}</p>
          </>
        )}
      </div>
      <div className="safe-bottom mt-2 flex gap-2">
        {!finished && !stepDone && (
          <button onClick={showHint} disabled={hintLevel >= maxHintLevel(step)} className="min-h-12 flex-1 rounded-2xl bg-surface shadow-[var(--shadow)] disabled:opacity-40">
            Hint
          </button>
        )}
        {stepDone && !finished && (
          <button onClick={() => resetStep(stepIndex + 1)} className="min-h-12 flex-1 rounded-2xl bg-accent font-semibold text-accent-text">
            Next
          </button>
        )}
        {finished && (
          <>
            <button onClick={() => { resetStep(0); setFinished(false); setTotals({ hints: 0, mistakes: 0 }); }} className="min-h-12 flex-1 rounded-2xl bg-surface shadow-[var(--shadow)]">
              Replay
            </button>
            <Link href="/learn" className="grid min-h-12 flex-1 place-items-center rounded-2xl bg-accent font-semibold text-accent-text">
              More lessons
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
