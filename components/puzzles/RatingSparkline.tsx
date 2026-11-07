/** A small rating trend line; hidden until there are two points. */
export function RatingSparkline({ points }: { points: number[] }) {
  if (points.length < 2) return null;
  const w = 180, h = 56;
  const min = Math.min(...points), max = Math.max(...points);
  const span = Math.max(20, max - min);
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${((i / (points.length - 1)) * w).toFixed(1)},${(h - 4 - ((p - min) / span) * (h - 8)).toFixed(1)}`).join(" ");
  const up = points[points.length - 1] >= points[0];
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} role="img" aria-label={`Rating trend over the last ${points.length} puzzles`} className="max-w-full">
      <path d={path} fill="none" stroke={up ? "#81b64c" : "#e05f4e"} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
