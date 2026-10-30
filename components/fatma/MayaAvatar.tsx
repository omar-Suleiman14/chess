import type { Expression } from "@/lib/chess/personality/fatma";

type Face = { mouth: "smile" | "smirk" | "flat" | "frown" | "grin"; brows: "calm" | "up" | "angry" | "worried"; eyes: "open" | "happy" | "look-up" | "narrow" };

const FACES: Record<Expression, Face> = {
  idle: { mouth: "smile", brows: "calm", eyes: "open" },
  thinking: { mouth: "flat", brows: "up", eyes: "look-up" },
  smug: { mouth: "smirk", brows: "calm", eyes: "narrow" },
  amused: { mouth: "grin", brows: "up", eyes: "happy" },
  annoyed: { mouth: "flat", brows: "angry", eyes: "narrow" },
  impressed: { mouth: "grin", brows: "up", eyes: "open" },
  plea: { mouth: "frown", brows: "worried", eyes: "open" },
  angry: { mouth: "frown", brows: "angry", eyes: "narrow" },
  victory: { mouth: "grin", brows: "up", eyes: "happy" },
  defeat: { mouth: "frown", brows: "worried", eyes: "open" },
  grateful: { mouth: "smile", brows: "worried", eyes: "happy" },
};

const MOUTHS: Record<Face["mouth"], string> = {
  smile: "M20.6 31.4 Q24 34 27.4 31.4",
  smirk: "M21 32 Q25 33.6 27.8 30.6",
  flat: "M21.4 32 H26.6",
  frown: "M20.8 33 Q24 30.4 27.2 33",
  grin: "M20.2 31 Q24 35.6 27.8 31 Z",
};
const BROWS: Record<Face["brows"], [string, string]> = {
  calm: ["M17.6 22.4 Q19.6 21.4 21.8 22", "M26.2 22 Q28.4 21.4 30.4 22.4"],
  up: ["M17.6 21.4 Q19.6 20.2 21.8 20.9", "M26.2 20.9 Q28.4 20.2 30.4 21.4"],
  angry: ["M17.8 21.2 L21.8 22.8", "M30.2 21.2 L26.2 22.8"],
  worried: ["M17.8 22.8 L21.6 21.2", "M30.2 22.8 L26.4 21.2"],
};

/**
 * Maya, the strongest bot: an original illustrated portrait with the same
 * expressions as Sherine. She blinks, and her mouth moves while she talks.
 */
export function MayaAvatar({ expression, speaking = false, size = 48, reducedMotion = false }: { expression: Expression; speaking?: boolean; size?: number; reducedMotion?: boolean }) {
  const face = FACES[expression] ?? FACES.idle;
  const animate = !reducedMotion;
  const eyeY = face.eyes === "look-up" ? 25 : 26.2;
  const eyeX = face.eyes === "look-up" ? 0.7 : 0;
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} role="img" aria-label={speaking ? "Maya is talking" : `Maya looks ${expression}`} className="maya-avatar block">
      <defs>
        <clipPath id="maya-clip"><circle cx="24" cy="24" r="23" /></clipPath>
      </defs>
      <circle cx="24" cy="24" r="23" fill="#e9dcc6" />
      <g clipPath="url(#maya-clip)">
        {/* Hair behind, top, face, fringe */}
        <path d="M10.5 26 C9.5 12 17 7.5 24 7.5 C31 7.5 38.5 12 37.5 26 L37 35 C33 37 15 37 11 35 Z" fill="#2a1d18" />
        <path d="M13 48 C13.5 40 18 37.5 24 37.5 C30 37.5 34.5 40 35 48 Z" fill="#2f5d62" />
        <path d="M21 34.5 h6 v4.5 c-1.8 1.4 -4.2 1.4 -6 0 Z" fill="#c98f62" />
        <ellipse cx="24" cy="25.4" rx="10.6" ry="12" fill="#d9a477" />
        <path d="M13.2 24 C13 15 18 11.2 24.6 11.2 C30.4 11.2 35.4 14.6 34.9 22 C31 21.8 27.4 19.6 25.6 16.4 C23.6 20 18.8 22.8 13.2 24 Z" fill="#2a1d18" />
        <rect x="29.4" y="15.6" width="5.2" height="2" rx="1" transform="rotate(-24 32 16.6)" fill="var(--brand, #b97a2c)" />
        {/* Cheeks */}
        <ellipse cx="18.4" cy="30" rx="2" ry="1.1" fill="#e07f6a" opacity=".35" />
        <ellipse cx="29.6" cy="30" rx="2" ry="1.1" fill="#e07f6a" opacity=".35" />
        {/* Brows */}
        <g fill="none" stroke="#2a1d18" strokeWidth="1.15" strokeLinecap="round">
          <path d={BROWS[face.brows][0]} /><path d={BROWS[face.brows][1]} />
        </g>
        {/* Eyes */}
        <g className={animate ? "maya-avatar__eyes" : undefined} style={{ transformOrigin: `24px ${eyeY}px` }}>
          {face.eyes === "happy" ? (
            <g fill="none" stroke="#2a1d18" strokeWidth="1.3" strokeLinecap="round"><path d="M18.4 26.6 Q20 24.8 21.6 26.6" /><path d="M26.4 26.6 Q28 24.8 29.6 26.6" /></g>
          ) : (
            <g fill="#2a1d18">
              <ellipse cx={20 + eyeX} cy={eyeY} rx="1.35" ry={face.eyes === "narrow" ? 0.8 : 1.6} />
              <ellipse cx={28 + eyeX} cy={eyeY} rx="1.35" ry={face.eyes === "narrow" ? 0.8 : 1.6} />
              <circle cx={20.5 + eyeX} cy={eyeY - 0.6} r=".42" fill="#fff" /><circle cx={28.5 + eyeX} cy={eyeY - 0.6} r=".42" fill="#fff" />
            </g>
          )}
        </g>
        {/* Mouth: her expression, or talking */}
        {speaking && animate ? (
          <g className="maya-avatar__talk">
            <ellipse cx="24" cy="31.9" rx="2.4" ry="1.8" fill="#7a2f2a" />
            <path d={MOUTHS.smile} fill="none" stroke="#7a2f2a" strokeWidth="1.2" strokeLinecap="round" />
          </g>
        ) : face.mouth === "grin" ? (
          <path d={MOUTHS.grin} fill="#7a2f2a" />
        ) : (
          <path d={MOUTHS[face.mouth]} fill="none" stroke="#7a2f2a" strokeWidth="1.25" strokeLinecap="round" />
        )}
      </g>
    </svg>
  );
}
