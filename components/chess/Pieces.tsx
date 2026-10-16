// "Chaos Minimal" piece set: original simple silhouettes drawn for this
// project (GPL-3.0 with the repository). 45x45 viewBox.
import type { Color } from "@/lib/chess/rules";

type PieceType = "p" | "n" | "b" | "r" | "q" | "k";

const BODY: Record<PieceType, string> = {
  p: "M22.5 8.5a5.5 5.5 0 0 1 3.4 9.8c2.4 1.5 4.1 4.3 4.6 8.2l.9 6.5h2.1a2 2 0 0 1 2 2V37H10.5v-2a2 2 0 0 1 2-2h2.1l.9-6.5c.5-3.9 2.2-6.7 4.6-8.2a5.5 5.5 0 0 1 2.4-9.8z",
  r: "M12 37h21v-4h-3l-1.5-11h3v-8h-4v3h-3v-3h-4v3h-3v-3h-4v8h3l-1.5 11h-3z",
  b: "M22.5 5.2a2.4 2.4 0 1 1 0 4.8a2.4 2.4 0 1 1 0-4.8zM22.5 10.8c-5 4.2-7 8.6-5.4 13.2h10.8c1.6-4.6-.4-9-5.4-13.2zM17.2 25h10.6v3H17.2zM18.5 28.5h8c.4 2 2 3.3 4.9 4.5V37H13.6v-4c2.9-1.2 4.5-2.5 4.9-4.5z",
  n: "M14 37h19.5c.2-6.5-1.6-11-5-14.2c1.2-3 2-6.6.8-10.3c-1 2-2.8 3-5 3.3l-2.3-4.3l-1.2 4.3c-4.3 1.4-8 5.3-9 9.6l-.6 3c1.1 1.9 3.3 2 4.5.8l3-2.9c1.2.9 3 .9 4.2-.1c-3.6 4.5-8.4 6.2-9.4 10.8z",
  q: "M13 33L10.8 16.5l6.4 7.5l2-11.5l3.3 10.6l3.3-10.6l2 11.5l6.4-7.5L32 33zM12 33.6h21V37H12z",
  k: "M21.4 4.5h2.2v3.2h3.2v2.2h-3.2v3.6h-2.2V9.9h-3.2V7.7h3.2zM22.5 14.5c-5.8 0-9.6 4-8.6 9.5l2 8.4h13.2l2-8.4c1-5.5-2.8-9.5-8.6-9.5zM13 33.2h19V37H13z",
};

// Small details drawn over the silhouette (contrasting stroke).
const DETAIL: Partial<Record<PieceType, string>> = {
  b: "M24.6 14.6l-4.2 5.2",
  n: "M20.6 15.6h.01",
  r: "M14.5 22h16",
  k: "M16.6 27.5h11.8",
  q: "M13.4 30h18.2",
};

const TIPS: Partial<Record<PieceType, Array<[number, number]>>> = {
  q: [[10.8, 15], [19.2, 11], [25.8, 11], [34.2, 15], [22.5, 21.5]],
};

export function Piece({ type, color, className }: { type: PieceType; color: Color; className?: string }) {
  const white = color === "w";
  const fill = white ? "#fbf9f4" : "#24231f";
  const stroke = white ? "#24231f" : "#0d0c0b";
  const detail = white ? "#24231f" : "#e9e5dc";
  return (
    <svg viewBox="0 0 45 45" className={className} aria-hidden="true" focusable="false">
      <g strokeLinejoin="round" strokeLinecap="round">
        <path d={BODY[type]} fill={fill} stroke={stroke} strokeWidth={1.6} fillRule="evenodd" />
        {TIPS[type]?.map(([cx, cy], i) => (
          <circle key={i} cx={cx} cy={cy} r={1.9} fill={fill} stroke={stroke} strokeWidth={1.4} />
        ))}
        {DETAIL[type] && <path d={DETAIL[type]} fill="none" stroke={detail} strokeWidth={type === "n" ? 2.6 : 1.3} />}
      </g>
    </svg>
  );
}
