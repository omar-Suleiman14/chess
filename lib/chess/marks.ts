import { useCallback, useState } from "react";
import type { Square } from "chess.js";

/** Right-click annotations, as on every major chess site. */
export type MarkColor = "red" | "green" | "blue" | "orange";
export type Mark = { from: Square; to: Square; color: MarkColor };

export const MARK_FILL: Record<MarkColor, string> = {
  red: "rgb(235 97 80 / .8)",
  green: "rgb(172 206 89 / .8)",
  blue: "rgb(82 176 220 / .8)",
  orange: "rgb(255 170 0 / .8)",
};

/** Plain right-click is red for squares and orange for arrows; modifiers pick a colour. */
export function markColor(event: { shiftKey: boolean; ctrlKey: boolean; altKey: boolean; metaKey: boolean }, arrow: boolean): MarkColor {
  if (event.shiftKey) return "green";
  if (event.altKey) return "blue";
  if (event.ctrlKey || event.metaKey) return arrow ? "red" : "orange";
  return arrow ? "orange" : "red";
}

/** Adding the same mark twice removes it; a new colour replaces the old one. */
export function toggleMark(marks: Mark[], mark: Mark): Mark[] {
  const existing = marks.find((m) => m.from === mark.from && m.to === mark.to);
  const rest = marks.filter((m) => m !== existing);
  return existing && existing.color === mark.color ? rest : [...rest, mark];
}

/** Marks for one position: a new move or a board flip (a new key) clears them. */
export function useBoardMarks(key: string): [Mark[], (update: (current: Mark[]) => Mark[]) => void] {
  const [state, setState] = useState<{ key: string; list: Mark[] }>({ key, list: [] });
  const update = useCallback(
    (change: (current: Mark[]) => Mark[]) => setState((previous) => ({ key, list: change(previous.key === key ? previous.list : []) })),
    [key],
  );
  return [state.key === key ? state.list : EMPTY, update];
}

const EMPTY: Mark[] = [];
