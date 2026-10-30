"use client";

import { PageHeader } from "@/components/shell/AppShell";
import { Piece } from "@/components/chess/Pieces";
import { BOARD_THEMES, type BoardTheme } from "@/lib/experience/boardThemes";
import { useSettings } from "@/lib/client/settings";
import { haptic } from "@/lib/client/haptics";
import { playSound } from "@/lib/client/sound";

function Preview({ theme }: { theme: BoardTheme }) {
  const cells: Array<[string, "n" | "p", "w" | "b"]> = [[theme.light, "n", "b"], [theme.dark, "n", "w"], [theme.dark, "p", "b"], [theme.light, "p", "w"]];
  return (
    <span className="grid h-[92px] w-[92px] shrink-0 grid-cols-2 overflow-hidden rounded-[3px] shadow-[0_2px_10px_rgb(0_0_0/0.35)]" aria-hidden="true">
      {cells.map(([background, type, color], i) => (
        <span key={i} style={{ background }} className="p-[3px]"><Piece type={type} color={color} set={theme.pieces} className="h-full w-full" /></span>
      ))}
    </span>
  );
}

/** Board themes: one tap changes the board colours and pieces together. */
export default function ThemePage() {
  const { boardTheme, setBoardTheme, settings } = useSettings();
  const current = boardTheme || settings.palette;
  return (
    <main className="mx-auto min-h-dvh max-w-xl pb-10">
      <PageHeader title="Theme" />
      <ul className="overflow-hidden sm:mx-4 sm:rounded-2xl" role="radiogroup" aria-label="Board theme">
        {BOARD_THEMES.map((theme) => {
          const selected = current === theme.id;
          return (
            <li key={theme.id}>
              <button
                role="radio"
                aria-checked={selected}
                onClick={() => {
                  if (!selected) {
                    haptic("select");
                    if (settings.sound) playSound("move", settings.volume);
                  }
                  setBoardTheme(theme.id);
                }}
                className="relative flex h-[126px] w-full items-start justify-between gap-4 px-5 py-4 text-start transition-[filter] active:brightness-90"
                style={{ background: theme.art }}
              >
                <span className="flex items-center gap-2 text-[22px] font-semibold text-white [text-shadow:0_1px_3px_rgb(0_0_0/0.45)]">
                  {theme.name}
                  {selected && (
                    <span className="grid h-6 w-6 place-items-center rounded-full bg-white text-[#1f1e1b] [text-shadow:none]" aria-hidden="true">
                      <svg viewBox="0 0 24 24" className="h-4 w-4"><path d="m5 12 4 4L19 6" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    </span>
                  )}
                </span>
                <Preview theme={theme} />
                {selected && <span className="pointer-events-none absolute inset-0 ring-4 ring-inset ring-white/80" aria-hidden="true" />}
              </button>
            </li>
          );
        })}
      </ul>
      <p className="mt-4 px-5 text-xs text-muted">A theme sets the board colours and pieces together. You can still change pieces on their own in Settings.</p>
    </main>
  );
}
