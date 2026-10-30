"use client";

import { motion } from "motion/react";
import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Link from "@/components/navigation/PrefetchLink";
import { Sheet } from "@/components/ui/Sheet";
import { SwitchRow } from "@/components/ui/Switch";
import { Segmented } from "./GameScreen";
import { useSettings } from "@/lib/client/settings";
import { useCoachingPreferences } from "@/lib/client/useCoachingPreferences";
import { haptic, type HapticLevel } from "@/lib/client/haptics";
import { BOARD_THEMES, findBoardTheme } from "@/lib/experience/boardThemes";
import { NavIcon } from "@/components/shell/NavIcon";
import { useShell } from "@/components/shell/AppShell";
import type { TabId } from "@/components/shell/TabBar";

const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 1.9, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
const Icon = ({ children }: { children: ReactNode }) => <svg viewBox="0 0 24 24" className="h-[22px] w-[22px] shrink-0" aria-hidden="true">{children}</svg>;

export type GameMenuActions = {
  finished: boolean;
  canResign: boolean;
  canUndo: boolean;
  sound: boolean;
  onNew: () => void;
  onUndo: () => void;
  onResign: () => void;
  onShare: () => void;
  onSettings: () => void;
  onFriends: () => void;
  onFlip: () => void;
  onSound: () => void;
};

function Item({ icon, label, onClick, danger = false, disabled = false }: { icon: ReactNode; label: string; onClick: () => void; danger?: boolean; disabled?: boolean }) {
  return (
    <button role="menuitem" onClick={onClick} disabled={disabled} className={`press-overlay flex min-h-12 w-full items-center gap-4 rounded-xl px-3.5 text-start text-[16px] font-medium disabled:opacity-35 ${danger ? "text-danger" : ""}`}>
      {icon}
      <span className="min-w-0 flex-1">{label}</span>
    </button>
  );
}

const GO_TO: Array<[TabId, string]> = [["bots", "Bots"], ["learn", "Learn"], ["review", "Review"], ["more", "More"]];

/**
 * Chess.com-style Options menu: a compact card that springs up from the
 * Options button with the game actions, never a full-screen dialog.
 */
export function GameMenu({ anchor, onClose, actions }: { anchor: DOMRect; onClose: () => void; actions: GameMenuActions }) {
  const { reducedMotion } = useSettings();
  const { goToTab } = useShell();
  const ref = useRef<HTMLDivElement>(null);
  const run = (action: () => void) => () => { onClose(); action(); };
  useEffect(() => {
    haptic("select");
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>("button:not([disabled])")?.focus({ preventScroll: true });
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.stopPropagation(); onClose(); }
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
      const items = [...(ref.current?.querySelectorAll<HTMLElement>("[role=menuitem]:not([disabled])") ?? [])];
      const index = items.indexOf(document.activeElement as HTMLElement);
      items[(index + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length]?.focus();
      event.preventDefault();
    };
    window.addEventListener("keydown", onKey, true);
    return () => { window.removeEventListener("keydown", onKey, true); if (previous?.isConnected) previous.focus({ preventScroll: true }); };
  }, [onClose]);

  // Sit just above the button, aligned to its left edge, kept on screen.
  const width = Math.min(300, window.innerWidth - 24);
  const left = Math.max(12, Math.min(anchor.left, window.innerWidth - width - 12));
  const bottom = Math.max(12, window.innerHeight - anchor.top + 8);

  const menu = (
    <div className="fixed inset-0 z-[84]" onClick={onClose} role="presentation">
      <motion.div
        ref={ref}
        role="menu"
        aria-label="Game options"
        onClick={(event) => event.stopPropagation()}
        className="absolute grid gap-0.5 overflow-hidden rounded-[22px] bg-surface p-1.5 shadow-[0_18px_50px_rgb(0_0_0/0.28),0_2px_8px_rgb(0_0_0/0.12)] ring-1 ring-line"
        style={{ left, bottom, width, transformOrigin: "bottom left" }}
        initial={reducedMotion ? false : { opacity: 0, scale: 0.9, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 520, damping: 34, mass: 0.7 }}
      >
        <Item onClick={run(actions.onNew)} label={actions.finished ? "Show result" : "New game"} icon={<Icon><path d="M12 5v14M5 12h14" {...stroke} /></Icon>} />
        <Item onClick={run(actions.onUndo)} disabled={!actions.canUndo} label="Undo move" icon={<Icon><path d="M9 7L4 12l5 5M4 12h11a5 5 0 0 1 0 10h-2" {...stroke} /></Icon>} />
        <Item onClick={run(actions.onResign)} disabled={!actions.canResign} danger label="Resign" icon={<Icon><circle cx="12" cy="12" r="8" {...stroke} /><path d="m6.5 6.5 11 11" {...stroke} /></Icon>} />
        <Item onClick={run(actions.onShare)} label="Share game" icon={<Icon><circle cx="18" cy="5.5" r="2.5" {...stroke} /><circle cx="6" cy="12" r="2.5" {...stroke} /><circle cx="18" cy="18.5" r="2.5" {...stroke} /><path d="m8.2 10.8 7.6-4.1M8.2 13.2l7.6 4.1" {...stroke} /></Icon>} />
        <Item onClick={run(actions.onFriends)} label="Friends" icon={<NavIcon name="friends" className="h-[22px] w-[22px] shrink-0" />} />
        <Item onClick={run(actions.onSettings)} label="Settings" icon={<NavIcon name="settings" className="h-[22px] w-[22px] shrink-0" />} />
        <Item onClick={run(actions.onFlip)} label="Flip board" icon={<Icon><path d="M7 4v13m0 0l-3-3m3 3l3-3M17 20V7m0 0l-3 3m3-3l3 3" {...stroke} /></Icon>} />
        <Item onClick={actions.onSound} label={actions.sound ? "Disable sounds" : "Enable sounds"} icon={<Icon><path d="M4 9.5h3.5L12 5v14l-4.5-4.5H4z" {...stroke} />{actions.sound ? <path d="M16 9.5l5 5m0-5l-5 5" {...stroke} /> : <path d="M15.5 9a4 4 0 0 1 0 6" {...stroke} />}</Icon>} />
        <div className="mt-1 grid grid-cols-4 gap-1 border-t border-line px-0.5 pt-1.5" role="group" aria-label="Go to">
          {GO_TO.map(([id, label]) => (
            <button key={id} role="menuitem" onClick={run(() => goToTab(id))} className="press-overlay grid min-h-14 place-items-center gap-0.5 rounded-xl py-1.5 text-[11px] font-semibold text-muted">
              <NavIcon name={id} className="h-[22px] w-[22px]" />
              {label}
            </button>
          ))}
        </div>
      </motion.div>
    </div>
  );
  return createPortal(menu, document.body);
}

/** The in-game settings drawer: the switches you reach for mid-game, with a link to everything else. */
export function GameSettingsSheet({ onClose }: { onClose: () => void }) {
  const { settings, update, updateExperience, hapticLevel, setHapticLevel, chesscomSounds, setChesscomSounds, boardTheme } = useSettings();
  const { coaching, updateCoaching } = useCoachingPreferences();
  const theme = findBoardTheme(boardTheme || settings.palette) ?? BOARD_THEMES[0];
  const ambient = settings.experience.ambient;
  return (
    <Sheet
      title="Settings"
      onClose={onClose}
      footer={<Link href="/settings" className="grid min-h-12 place-items-center rounded-2xl bg-surface-2 text-sm font-semibold">All settings</Link>}
    >
      <div className="grid gap-4">
        <Link href="/settings/theme" className="press-overlay flex min-h-[68px] items-center gap-4 overflow-hidden rounded-2xl px-4 text-white" style={{ background: theme.art }}>
          <span className="grid h-11 w-11 shrink-0 grid-cols-2 overflow-hidden rounded-[3px] shadow-md" aria-hidden="true">
            {[theme.light, theme.dark, theme.dark, theme.light].map((color, i) => <span key={i} style={{ background: color }} />)}
          </span>
          <span className="min-w-0 flex-1 [text-shadow:0_1px_3px_rgb(0_0_0/0.45)]">
            <span className="block text-xs font-medium uppercase tracking-wide opacity-90">Board theme</span>
            <span className="block text-lg font-semibold">{theme.name}</span>
          </span>
          <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 rtl:rotate-180" aria-hidden="true"><path d="M9 5l7 7-7 7" {...stroke} /></svg>
        </Link>
        <div className="overflow-hidden rounded-2xl bg-surface-2/60 ring-1 ring-inset ring-line">
          <SwitchRow label="Sounds" checked={settings.sound} onChange={(sound) => update({ sound })} />
          <SwitchRow label="Chess.com sounds" checked={chesscomSounds} onChange={setChesscomSounds} />
          <SwitchRow label="Evaluation bar" checked={settings.evalBar} onChange={(evalBar) => update({ evalBar })} />
          <SwitchRow label="Show hint button" checked={coaching.hints} onChange={(hints) => updateCoaching({ hints })} />
          <SwitchRow label="Legal move dots" checked={settings.legalDots} onChange={(legalDots) => update({ legalDots })} />
          <SwitchRow label="Coordinates" checked={settings.coordinates} onChange={(coordinates) => update({ coordinates })} />
          <SwitchRow label="Live background" checked={ambient.mode === "ambient"} onChange={(on) => updateExperience({ ambient: { ...ambient, mode: on ? "ambient" : "minimal" } })} />
        </div>
        <Segmented<HapticLevel> label="Haptics" value={hapticLevel} onChange={(level) => { setHapticLevel(level); if (level !== "off") haptic("capture"); }} options={[["off", "Off"], ["subtle", "Subtle"], ["standard", "Standard"]]} />
      </div>
    </Sheet>
  );
}
