export const BOARD_SEEDS = {
  ivory: "#8d6748",
  sage: "#4e7046",
  slate: "#596778",
  blue: "#356caa",
};
type RGB = [number, number, number];
const rgb = (hex: string): RGB => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
];
export function mix(a: string, b: string, amount: number): string {
  const left = rgb(a),
    right = rgb(b);
  return `#${left
    .map((n, i) =>
      Math.round(n * (1 - amount) + right[i] * amount)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}
export function luminance(hex: string): number {
  const values = rgb(hex).map((n) => {
    const s = n / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return values[0] * 0.2126 + values[1] * 0.7152 + values[2] * 0.0722;
}
export function contrast(a: string, b: string): number {
  const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (values[0] + 0.05) / (values[1] + 0.05);
}
/**
 * Classic: the single app design. Graphite ink on warm paper, white
 * surfaces, and one original accent (brass) reserved for "on" and "here"
 * states: switches, the active tab, selected rows. The board supplies colour.
 */
export function themeTokens(dark: boolean): Record<string, string> {
  return dark
    ? {
        "--bg": "#141413",
        "--surface": "#1e1e1c",
        "--surface-2": "#2a2927",
        "--text": "#f2f1ee",
        "--muted": "#aaa79f",
        "--line": "#3a3935",
        "--accent": "#f2f1ee",
        "--accent-text": "#141413",
        "--brand": "#e3ac63",
        "--focus": "#8ab4ff",
        "--switch-on": "#d39a4c",
        "--switch-off": "#4a4945",
        "--danger": "#ffb4ab",
        "--ok": "#9fdbb2",
        "--shadow": "0 1px 2px #0005, 0 8px 24px #0003",
      }
    : {
        "--bg": "#f7f6f3",
        "--surface": "#ffffff",
        "--surface-2": "#efede8",
        "--text": "#1f1e1b",
        "--muted": "#67645e",
        "--line": "#e1ded6",
        "--accent": "#1f1e1b",
        "--accent-text": "#ffffff",
        "--brand": "#a8691f",
        "--focus": "#245ab4",
        "--switch-on": "#b97a2c",
        "--switch-off": "#dddad3",
        "--danger": "#b42318",
        "--ok": "#1b6e43",
        "--shadow": "0 1px 2px #24221e0d, 0 6px 18px #24221e0a",
      };
}

import { BOARD_THEMES, BOARD_THEME_KEY, boardThemeVars } from "./boardThemes";

// Board theme colours, applied before first paint (hex values from our own table only).
const BOARD_THEME_TABLE = JSON.stringify(Object.fromEntries(BOARD_THEMES.map((theme) => [theme.id, boardThemeVars(theme)])));

// Same safe primitive attributes before hydration; no user strings become HTML.
export const THEME_BOOTSTRAP = `try{const s=JSON.parse(localStorage.getItem('cbc.settings.v1')||'{}'),e=s.experience||{},r=document.documentElement,m=['light','dark','system'].includes(e.colorMode)?e.colorMode:'light';r.dataset.appearance='classic';r.dataset.colorMode=m;r.dataset.tone=m==='dark'||m==='system'&&matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';r.style.colorScheme=r.dataset.tone;const p=['ivory','sage','slate','blue'].includes(s.palette)?s.palette:'ivory',c=JSON.parse(localStorage.getItem('cbc.theme.v1')||'null');r.dataset.palette=p;r.dataset.contrast=s.highContrast===true?'high':'normal';if(c&&c.fingerprint===JSON.stringify(['classic',p]))for(const[k,v]of Object.entries(c[r.dataset.tone]||{}))if(/^--[a-z-]+$/.test(k)&&/^#[0-9a-fA-F]{6}$/.test(v))r.style.setProperty(k,v);if(s.highContrast===true){r.style.setProperty('--muted',r.dataset.tone==='dark'?'#eeeeee':'#333333');r.style.setProperty('--line',r.dataset.tone==='dark'?'#aaaaaa':'#666666');}else{const t=${BOARD_THEME_TABLE}[localStorage.getItem('${BOARD_THEME_KEY}')];if(t)for(const[k,v]of Object.entries(t))r.style.setProperty(k,v);}}catch{}`;
