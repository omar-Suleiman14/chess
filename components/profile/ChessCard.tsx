"use client";

import { blobatar } from "blobatar";
import "blobatar/motion.css";
import { motion } from "motion/react";
import QRCode from "qrcode";
import { useEffect, useMemo, useState } from "react";
import { FatmaSprite } from "@/components/fatma/FatmaSprite";

// Chess identity card in the Chaos card language (art panel, arc, bold name,
// mono title, numbered pill, serif "member since"), landscape orientation.
// Independent implementation; no Chaos (AGPL) source is copied.

export type CardTheme = { bg: string; art: string; accent: string; sub: string; text: string; pill: string };

export const CARD_THEMES: Record<string, CardTheme> = {
  sky: { bg: "#f3f8ff", art: "linear-gradient(135deg,#a9cbff 0%,#72a9ff 45%,#33d4f2 100%)", accent: "#2563eb", sub: "#2f5bd3", text: "#8b97ad", pill: "#bfd3fb" },
  sunset: { bg: "#fff7f0", art: "linear-gradient(135deg,#ffd7b0 0%,#ffa66c 50%,#f2733d 100%)", accent: "#e8590c", sub: "#c2410c", text: "#a8927f", pill: "#fbd5bd" },
  mint: { bg: "#f5fbf3", art: "linear-gradient(135deg,#c8ecd9 0%,#8fd3b9 50%,#56b39a 100%)", accent: "#0f8a6b", sub: "#0f766e", text: "#8aa39a", pill: "#c3e8d8" },
  rose: { bg: "#fff5f8", art: "linear-gradient(135deg,#ffd0e0 0%,#f797bb 50%,#e2648f 100%)", accent: "#d61f69", sub: "#be185d", text: "#a8899a", pill: "#fbcadb" },
  ink: { bg: "#1b1a18", art: "linear-gradient(135deg,#4a4842 0%,#2c2b27 55%,#171614 100%)", accent: "#f4f1ea", sub: "#d6d2c8", text: "#8f8b82", pill: "#4a4842" },
};

export function themeOf(id: string): CardTheme {
  return CARD_THEMES[id] ?? CARD_THEMES.sky;
}

export type CardData = {
  alias: string;
  avatarSeed: string;
  hue: number;
  cardTheme: string;
  memberNumber: number | null;
  memberSince: number;
  title: string;
  climb: { rating: number; rd: number; games: number; beaten: number } | null;
  rivalry: { wins: number; losses: number; draws: number } | null;
  /** Sherine's own card in the player deck. */
  fatma?: boolean;
};

export const FATMA_CARD: CardData = {
  alias: "sherine",
  avatarSeed: "fatma",
  hue: 330,
  cardTheme: "rose",
  memberNumber: 0,
  memberSince: Date.UTC(2026, 9, 16),
  title: "Your rival · nominal 3000",
  climb: null,
  rivalry: null,
  fatma: true,
};

export type CardFace = "identity" | "climb" | "rivalry";

export function Avatar({ seed, hue, size = 72 }: { seed: string; hue: number; size?: number }) {
  // blobatar returns static SVG markup generated from the seed (no user HTML).
  const svg = useMemo(() => blobatar(seed, { hue, background: false, animate: "always" }), [seed, hue]);
  return <span className="block [&>svg]:h-full [&>svg]:w-full" style={{ width: size, height: size }} aria-hidden="true" dangerouslySetInnerHTML={{ __html: svg }} />;
}

function Arc() {
  return (
    <svg className="absolute inset-x-0 top-[44%] h-[34%] w-full" viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true">
      <path d="M-2 26 Q50 -4 102 26" stroke="rgba(255,255,255,0.92)" strokeWidth="7" fill="none" />
    </svg>
  );
}

function ArtPanel({ face, data, theme }: { face: CardFace; data: CardData; theme: CardTheme }) {
  return (
    <div className="relative h-full overflow-hidden rounded-[16px]" style={{ background: theme.art }}>
      <div className="absolute left-1/2 top-1/2 aspect-square w-[62%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/25" />
      <Arc />
      <div className="absolute inset-0 grid place-items-center">
        {face === "identity" && (data.fatma ? <FatmaSprite expression="smug" size={110} /> : <Avatar seed={data.avatarSeed} hue={data.hue} size={100} />)}
        {face === "climb" && (
          <span className="absolute inset-x-0 top-[12%] text-center font-mono font-bold leading-none text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.25)]">
            <span className="block text-[34px] tabular-nums">{data.climb && data.climb.games > 0 ? data.climb.rating : "—"}</span>
            <span className="mt-1 block text-[10px] uppercase tracking-[0.2em]">{data.climb && data.climb.games > 0 ? `± ${Math.round(data.climb.rd * 1.96)}` : "unrated"}</span>
          </span>
        )}
        {face === "rivalry" && <FatmaSprite expression="smug" size={92} />}
      </div>
    </div>
  );
}

function CardFront({ face, data }: { face: CardFace; data: CardData }) {
  const theme = themeOf(data.cardTheme);
  const since = new Date(data.memberSince).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).replace(/(\w{3})\w*/, "$1");
  const headline =
    face === "identity"
      ? data.fatma
        ? { name: "Sherine", line: data.title, mono: "stockfish 19 lite · on your device" }
        : { name: `@${data.alias}`, line: data.title, mono: "chess by chaos" }
      : face === "climb"
        ? { name: "The Climb", line: data.climb ? `${data.climb.beaten} of 11 levels beaten` : "Stats hidden", mono: data.climb ? `${data.climb.games} rated games` : `@${data.alias}` }
        : { name: "vs Sherine", line: data.rivalry ? `${data.rivalry.wins}W · ${data.rivalry.draws}D · ${data.rivalry.losses}L` : "Stats hidden", mono: "nominal 3000 · full power" };
  return (
    <div className="absolute inset-0 grid grid-cols-[38%_1fr] gap-2.5 rounded-[22px] p-2.5 @min-[400px]:grid-cols-[44%_1fr] @min-[400px]:gap-4 @min-[400px]:p-3.5 [backface-visibility:hidden]" style={{ background: theme.bg }}>
      <ArtPanel face={face} data={data} theme={theme} />
      <div className="flex min-w-0 flex-col py-1 pr-1">
        <p className="truncate text-[clamp(16px,6cqw,30px)] font-extrabold leading-[1.05] tracking-tight" style={{ color: theme.accent }}>
          {headline.name}
        </p>
        <p className="mt-1 line-clamp-2 font-mono text-[clamp(10px,3.4cqw,14px)] leading-snug" style={{ color: theme.sub }}>
          {headline.line}
        </p>
        <p className="mt-1 hidden truncate font-mono text-[11px] @min-[360px]:block" style={{ color: theme.text }}>
          {headline.mono}
        </p>
        <div className="mt-auto flex flex-col items-start justify-between gap-1 @min-[400px]:flex-row @min-[400px]:items-end @min-[400px]:gap-2">
          <span className="flex h-6 shrink-0 items-stretch overflow-hidden whitespace-nowrap rounded-[5px] border-[1.5px] font-mono text-[clamp(8px,1.9vw,10px)] font-bold" style={{ borderColor: theme.accent, color: theme.accent }}>
            <span className="grid place-items-center px-1.5">CHESS</span>
            <span className="w-2.5" style={{ background: theme.pill }} />
            <span className="grid place-items-center px-1.5">No. {String(data.memberNumber ?? 0).padStart(4, "0")}</span>
          </span>
          <span className="shrink-0 whitespace-nowrap text-left font-serif @min-[400px]:text-right text-[clamp(8px,1.9vw,10px)] uppercase leading-tight" style={{ color: theme.accent }}>
            Member since{" "}
            <span className="normal-case @min-[400px]:block">{since}</span>
          </span>
        </div>
      </div>
    </div>
  );
}

function CardBack({ data, url }: { data: CardData; url: string }) {
  const theme = themeOf(data.cardTheme);
  const [svg, setSvg] = useState("");
  useEffect(() => {
    void QRCode.toString(url, { type: "svg", margin: 0, errorCorrectionLevel: "H", color: { dark: "#14161fff", light: "#00000000" } }).then(setSvg);
  }, [url]);
  return (
    <div data-card-back="true" className="absolute inset-0 grid grid-cols-[44%_1fr] gap-2 rounded-[22px] p-2.5 @min-[400px]:gap-4 @min-[400px]:p-3.5 [backface-visibility:hidden] [transform:rotateY(180deg)]" style={{ background: theme.bg }}>
      <div className="relative grid place-items-center rounded-[16px]" style={{ background: theme.art }}>
        <div className="relative w-[72%]">
          <span className="block [&>svg]:h-auto [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} aria-hidden="true" />
          <span className="absolute left-1/2 top-1/2 grid h-[24%] w-[24%] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-[22%] bg-[#1d1c1a] ring-2 ring-white" aria-hidden="true">
            <svg viewBox="0 0 64 64" className="h-[70%] w-[70%]"><g fill="#fff"><rect x="8" y="8" width="12" height="12" rx="2" /><rect x="32" y="8" width="12" height="12" rx="2" /><rect x="20" y="20" width="12" height="12" rx="2" /><rect x="44" y="20" width="12" height="12" rx="2" /><rect x="8" y="32" width="12" height="12" rx="2" /><rect x="32" y="32" width="12" height="12" rx="2" /><rect x="20" y="44" width="12" height="12" rx="2" /><rect x="44" y="44" width="12" height="12" rx="2" /></g></svg>
          </span>
        </div>
      </div>
      <div className="flex min-w-0 flex-col justify-center gap-1.5">
        <p className="text-[clamp(16px,3.6vw,22px)] font-extrabold leading-tight" style={{ color: theme.accent }}>
          Scan to see this card
        </p>
        <p className="break-all font-mono text-[11px]" style={{ color: theme.text }}>
          {url.replace(/^https?:\/\//, "")}
        </p>
        <div className="mt-2">
          {data.fatma ? <FatmaSprite expression="idle" size={48} /> : <Avatar seed={data.avatarSeed} hue={data.hue} size={44} />}
        </div>
      </div>
    </div>
  );
}

/** One flippable card. Tap/Enter flips to the QR side. */
export function ChessCard({ face, data, url, flipped, onFlip, interactive = true, reducedMotion = false }: { face: CardFace; data: CardData; url: string; flipped: boolean; onFlip?: () => void; interactive?: boolean; reducedMotion?: boolean }) {
  return (
    <motion.div
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : -1}
      aria-label={interactive ? `${face === "identity" ? (data.fatma ? "Sherine's card" : `Chess card for @${data.alias}`) : face === "climb" ? "Climb card" : "Sherine rivalry card"}. ${flipped ? "Showing QR code" : "Activate to show QR code"}.` : undefined}
      onClick={interactive ? onFlip : undefined}
      onKeyDown={(e) => interactive && (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onFlip?.())}
      className="@container relative aspect-[1.586] w-full cursor-pointer rounded-[22px] shadow-[0_18px_50px_rgba(0,0,0,0.28)] [transform-style:preserve-3d]"
      animate={{ rotateY: flipped ? 180 : 0 }}
      transition={reducedMotion ? { duration: 0 } : { type: "spring", stiffness: 260, damping: 28 }}
    >
      <CardFront face={face} data={data} />
      <CardBack data={data} url={url} />
    </motion.div>
  );
}
