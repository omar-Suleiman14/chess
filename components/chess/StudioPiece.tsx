import type { CSSProperties, ReactNode } from "react";
import type { Color } from "@/lib/chess/rules";

/**
 * Original Staunton-inspired vector set, drawn for Chess by Chaos.
 * Intentionally independent of third-party logos, bitmaps and piece paths.
 * Every piece shares a consistent foot, contour weight and matte palette.
 */
export function StudioPiece({ type, color, className, style }: { type: string; color: Color; className?: string; style?: CSSProperties }) {
  const dark = color === "b";
  const fill = dark ? "#262523" : "#f7f4ee";
  const stroke = dark ? "#10100f" : "#24211e";
  const detail = dark ? "#d5cdc1" : "#635b52";
  const base = (x = 15, width = 50) => <>
    <path d={`M${x + 6} 61h${width - 12}a4 4 0 0 1 4 4v2h-${width - 4}a4 4 0 0 1 4-4z`} fill={fill} stroke={stroke} strokeWidth="2.4" />
    <path d={`M${x + 2} 67h${width - 4}`} stroke={detail} strokeWidth="1.25" />
  </>;
  let body: ReactNode;
  switch (type.toLowerCase()) {
    case "p":
      body = <>
        <circle cx="40" cy="22" r="11" fill={fill} stroke={stroke} strokeWidth="2.6" />
        <path d="M30 35h20l-3 5c1 9 7 15 11 20H22c4-5 10-11 11-20z" fill={fill} stroke={stroke} strokeWidth="2.6" strokeLinejoin="round" />
        <path d="M28 41h24M26 58h28" stroke={detail} strokeWidth="1.7" strokeLinecap="round" />
        {base(18, 44)}
      </>;
      break;
    case "r":
      body = <>
        <path d="M16 13h10v8h8v-8h12v8h8v-8h10v18H16z" fill={fill} stroke={stroke} strokeWidth="2.7" strokeLinejoin="round" />
        <path d="M23 31h34l-3 28H26z" fill={fill} stroke={stroke} strokeWidth="2.8" />
        <path d="M20 31h40M26 38h28M25 58h30" stroke={detail} strokeWidth="1.8" strokeLinecap="round" />
        {base(11, 58)}
      </>;
      break;
    case "n":
      body = <>
        <path d="M20 59c2-9 5-16 7-23l-9-9c5-2 9-6 11-13l9 5c15-8 30 3 28 21l-7 20z" fill={fill} stroke={stroke} strokeWidth="2.9" strokeLinejoin="round" />
        <path d="M30 20c5 3 8 7 10 13l-10 8-11-2-5 8 13 5" fill="none" stroke={stroke} strokeWidth="3.1" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M43 28c8 2 13 8 14 16M33 42c2 6 3 10 2 17" fill="none" stroke={detail} strokeWidth="2" strokeLinecap="round" />
        <circle cx="33" cy="30" r="2.6" fill={dark ? detail : stroke} />
        {base(11, 58)}
      </>;
      break;
    case "b":
      body = <>
        <path d="M40 12c-14 13-20 25-17 34 2 7 8 12 11 14h12c3-2 9-7 11-14 3-9-3-21-17-34z" fill={fill} stroke={stroke} strokeWidth="2.8" strokeLinejoin="round" />
        <path d="M45 23 34 43" stroke={detail} strokeWidth="3.3" strokeLinecap="round" />
        <circle cx="40" cy="12" r="4.4" fill={fill} stroke={stroke} strokeWidth="2" />
        <path d="M25 51h30l-3 8H28z" fill={fill} stroke={stroke} strokeWidth="2.1" />
        {base(12, 56)}
      </>;
      break;
    case "q":
      body = <>
        <circle cx="12" cy="19" r="4.5" fill={fill} stroke={stroke} strokeWidth="2" />
        <circle cx="26" cy="12" r="4.5" fill={fill} stroke={stroke} strokeWidth="2" />
        <circle cx="40" cy="9" r="4.5" fill={fill} stroke={stroke} strokeWidth="2" />
        <circle cx="54" cy="12" r="4.5" fill={fill} stroke={stroke} strokeWidth="2" />
        <circle cx="68" cy="19" r="4.5" fill={fill} stroke={stroke} strokeWidth="2" />
        <path d="M13 24 23 55h34l10-31-17 13-10-21-10 21z" fill={fill} stroke={stroke} strokeWidth="2.7" strokeLinejoin="round" />
        <path d="M26 45h28M22 55h36" stroke={detail} strokeWidth="1.8" strokeLinecap="round" />
        {base(10, 60)}
      </>;
      break;
    case "k":
      body = <>
        <path d="M40 7v18M32 15h16" stroke={stroke} strokeWidth="5" strokeLinecap="round" />
        <path d="M40 7v18M32 15h16" stroke={fill} strokeWidth="2.4" strokeLinecap="round" />
        <path d="M28 29c-9 4-11 12-7 19l5 8h28l5-8c4-7 2-15-7-19l-6 5h-12z" fill={fill} stroke={stroke} strokeWidth="2.8" strokeLinejoin="round" />
        <path d="M29 35c-2 7-1 14 3 21m19-21c2 7 1 14-3 21M26 57h28" fill="none" stroke={detail} strokeWidth="1.7" strokeLinecap="round" />
        {base(11, 58)}
      </>;
      break;
    default:
      body = null;
  }
  return (
    <svg className={className} style={style} viewBox="7 3 66 70" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
      <g strokeLinecap="round" strokeLinejoin="round">{body}</g>
    </svg>
  );
}
