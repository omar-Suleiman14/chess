import type { PieceSet } from "@/components/chess/Pieces";

/**
 * Board themes: board colours, a matching piece set and a scene for the
 * theme picker. The scenes are original CSS art; nothing is copied from
 * another app.
 */
export type BoardTheme = {
  id: string;
  name: string;
  light: string;
  dark: string;
  pieces: PieceSet;
  /** CSS background for the picker row. */
  art: string;
};

const coords = (light: string, dark: string) => ({ "--sq-coord-light": dark, "--sq-coord-dark": light });

export const BOARD_THEMES: BoardTheme[] = [
  { id: "green", name: "Green", light: "#ebecd0", dark: "#779556", pieces: "cburnett",
    art: "linear-gradient(120deg, #2f4721 0%, #577a3a 55%, #8fb468 100%)" },
  { id: "walnut", name: "Walnut", light: "#f0d9b5", dark: "#b58863", pieces: "merida",
    art: "repeating-linear-gradient(96deg, #4a2c1a 0 14px, #57331f 14px 22px, #3f2516 22px 40px), linear-gradient(#4a2c1a, #2e1a0f)" },
  { id: "tournament", name: "Tournament", light: "#eeeee2", dark: "#3d7a56", pieces: "chessnut",
    art: "radial-gradient(ellipse 60% 40% at 30% 60%, #e9c98f 0 30%, transparent 31%), radial-gradient(ellipse 40% 26% at 30% 60%, #d9b06c 0 40%, transparent 41%), linear-gradient(100deg, #e6c48a, #d7ad6b)" },
  { id: "ivory", name: "Ivory", light: "#efe6d5", dark: "#c3a982", pieces: "cburnett",
    art: "linear-gradient(135deg, #b89a72, #e7d9bf)" },
  { id: "leather", name: "Leather", light: "#f1d6ad", dark: "#9a5b34", pieces: "merida",
    art: "radial-gradient(circle at 20% 30%, #9b2a22 0, transparent 60%), radial-gradient(circle at 80% 70%, #5e1410 0, transparent 60%), #7d1d17" },
  { id: "ocean", name: "Ocean", light: "#d9edf2", dark: "#4a8db0", pieces: "cburnett",
    art: "radial-gradient(circle at 25% 40%, #ffffff40 0 3px, transparent 4px), radial-gradient(circle at 32% 55%, #ffffff30 0 5px, transparent 6px), radial-gradient(ellipse at 50% -20%, #5ec3f0, transparent 70%), linear-gradient(#0a6fa8, #04324f)" },
  { id: "cosmos", name: "Cosmos", light: "#9aa5bb", dark: "#3f4a68", pieces: "mpchess",
    art: "radial-gradient(1px 1px at 12% 30%, #fff, transparent), radial-gradient(1px 1px at 40% 70%, #fff, transparent), radial-gradient(1.5px 1.5px at 66% 20%, #fff, transparent), radial-gradient(1px 1px at 82% 60%, #fff, transparent), radial-gradient(1px 1px at 25% 85%, #fffa, transparent), radial-gradient(ellipse at 70% 40%, #2b3f7a80, transparent 60%), #08112a" },
  { id: "bubblegum", name: "Bubblegum", light: "#fde6ef", dark: "#e892b4", pieces: "fantasy",
    art: "radial-gradient(circle at 20% 40%, #ffffff55 0 22px, transparent 23px), radial-gradient(circle at 60% 70%, #ffffff40 0 30px, transparent 31px), radial-gradient(circle at 85% 25%, #ffffff30 0 18px, transparent 19px), linear-gradient(120deg, #e8457f, #f6a3c2)" },
  { id: "nature", name: "Nature", light: "#e5ecd1", dark: "#9bb46d", pieces: "chessnut",
    art: "radial-gradient(ellipse at 85% 20%, #4f7f1f 0 18%, transparent 40%), radial-gradient(ellipse at 30% 60%, #d6eb8a, transparent 60%), linear-gradient(120deg, #5f8f2a, #b6d36a)" },
  { id: "marble", name: "Marble", light: "#e8e6e1", dark: "#9d9992", pieces: "merida",
    art: "linear-gradient(115deg, transparent 40%, #ffffff30 42%, transparent 44%), linear-gradient(160deg, transparent 60%, #00000020 61%, transparent 63%), linear-gradient(135deg, #8a8781, #4e4c48)" },
  { id: "sand", name: "Sand", light: "#ede1c8", dark: "#c29c6d", pieces: "cburnett",
    art: "radial-gradient(ellipse at 30% 40%, #d8cbb0, transparent 60%), radial-gradient(ellipse at 75% 70%, #b7a98c, transparent 60%), #c8bba0" },
  { id: "pixel", name: "Pixel", light: "#f2f2f2", dark: "#6aa84f", pieces: "fantasy",
    art: "linear-gradient(transparent 72%, #7cc04a 72% 80%, #5b9a32 80%), linear-gradient(#7fcbe0, #9ad8e8)" },
  { id: "blue", name: "Blue", light: "#e4ebf3", dark: "#7d9bbd", pieces: "cburnett",
    art: "linear-gradient(180deg, #3f78ad, #2b5a87)" },
  { id: "sage", name: "Sage", light: "#e8ecdf", dark: "#93a57f", pieces: "cburnett",
    art: "linear-gradient(135deg, #6f8459, #b8c7a2)" },
  { id: "slate", name: "Slate", light: "#e3e6ea", dark: "#8a96a3", pieces: "cburnett",
    art: "linear-gradient(135deg, #3c454f, #7a8794)" },
  { id: "graphite", name: "Graphite", light: "#bdbdbd", dark: "#6f6f6f", pieces: "mpchess",
    art: "repeating-linear-gradient(110deg, #ffffff08 0 1px, transparent 1px 5px), linear-gradient(135deg, #4b4b4b, #2a2a2a)" },
];

export function findBoardTheme(id: string | null | undefined): BoardTheme | undefined {
  return BOARD_THEMES.find((theme) => theme.id === id);
}

/** CSS variables a theme sets on the page root. */
export function boardThemeVars(theme: BoardTheme): Record<string, string> {
  return { "--sq-light": theme.light, "--sq-dark": theme.dark, ...coords(theme.light, theme.dark) };
}

export const BOARD_THEME_KEY = "cbc.board.theme";
