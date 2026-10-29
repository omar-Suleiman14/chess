import type { Experience } from "./config";

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
export function themeTokens(
  experience: Experience,
  palette: keyof typeof BOARD_SEEDS,
  dark: boolean,
): Record<string, string> {
  const expressive = experience.appearance === "expressive";
  const seed =
    experience.colorSource === "board"
      ? BOARD_SEEDS[palette]
      : experience.customColor;
  const bg = expressive
    ? mix(dark ? "#17151a" : "#fffbff", seed, dark ? 0.08 : 0.025)
    : dark
      ? "#191919"
      : "#ffffff";
  const surface = expressive
    ? mix(dark ? "#252229" : "#f5eff7", seed, 0.06)
    : dark
      ? "#222222"
      : "#f7f7f5";
  const secondary = expressive
    ? mix(dark ? "#322e37" : "#ece4f0", seed, 0.1)
    : dark
      ? "#2c2c2c"
      : "#efefed";
  let accent = expressive
    ? mix(seed, dark ? "#ffffff" : "#000000", dark ? 0.6 : 0.05)
    : dark
      ? "#f0efed"
      : "#37352f";
  let onAccent = contrast(accent, "#ffffff") >= 4.5 ? "#ffffff" : "#171717";
  if (contrast(accent, onAccent) < 4.5) {
    accent = dark ? "#d7c6ee" : "#59436e";
    onAccent = dark ? "#21192a" : "#ffffff";
  }
  return {
    "--bg": bg,
    "--surface": surface,
    "--surface-2": secondary,
    "--text": dark ? "#f1f0ee" : "#37352f",
    "--muted": dark ? "#b7b5b1" : "#686660",
    "--line": dark ? "#53504d" : "#d7d5d0",
    "--accent": accent,
    "--accent-text": onAccent,
    "--focus": expressive ? accent : dark ? "#95baff" : "#245ab4",
    "--theme-seed": seed,
    "--switch-on": expressive ? accent : "#2168d4",
    "--switch-off": dark ? "#55534f" : "#d4d3cf",
    "--danger": dark ? "#ffb4ab" : "#b42318",
    "--ok": dark ? "#9fdbb2" : "#1b6e43",
    "--shadow": dark
      ? "0 1px 2px #0004, 0 8px 24px #0002"
      : "0 1px 2px #24221e0a, 0 6px 18px #24221e08",
  };
}

// Same safe primitive attributes before hydration; no user strings become HTML.
export const THEME_BOOTSTRAP = `try{const s=JSON.parse(localStorage.getItem('cbc.settings.v1')||'{}'),e=s.experience||{},r=document.documentElement,a=['classic','expressive','glass'].includes(e.appearance)?e.appearance:s.glass==='on'?'glass':'classic',m=['light','dark','system'].includes(e.colorMode)?e.colorMode:'light';r.dataset.appearance=a;r.dataset.colorMode=m;r.dataset.tone=m==='dark'||m==='system'&&matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';r.style.colorScheme=r.dataset.tone;const p=['ivory','sage','slate','blue'].includes(s.palette)?s.palette:'ivory',c=JSON.parse(localStorage.getItem('cbc.theme.v1')||'null');r.dataset.palette=p;r.dataset.contrast=s.highContrast===true?'high':'normal';if(c&&c.fingerprint===JSON.stringify([a,e.colorSource||'board',e.customColor||'#6750a4',p]))for(const[k,v]of Object.entries(c[r.dataset.tone]||{}))if(/^--[a-z-]+$/.test(k)&&/^#[0-9a-fA-F]{6}$/.test(v))r.style.setProperty(k,v);if(s.highContrast===true){r.style.setProperty('--muted',r.dataset.tone==='dark'?'#eeeeee':'#333333');r.style.setProperty('--line',r.dataset.tone==='dark'?'#aaaaaa':'#666666');}}catch{}`;
