import type { Color } from "@/lib/chess/rules";
import { MARK_FILL, type Mark } from "@/lib/chess/marks";

function coordsOf(square: string, orientation: Color): { col: number; row: number } {
  const file = square.charCodeAt(0) - 97;
  const rank = Number(square[1]) - 1;
  return orientation === "w" ? { col: file, row: 7 - rank } : { col: 7 - file, row: rank };
}

/** Right-click arrows drawn over the board (viewBox units are squares). */
export function MarkArrows({ marks, orientation }: { marks: Mark[]; orientation: Color }) {
  return (
    <svg aria-hidden="true" data-mark-arrows className="pointer-events-none absolute inset-0 z-30 h-full w-full" viewBox="0 0 8 8">
      {marks.map((m) => <MarkArrow key={`${m.from}${m.to}`} mark={m} orientation={orientation} />)}
    </svg>
  );
}

/** A thick translucent arrow; knight jumps bend at a right angle. */
function MarkArrow({ mark, orientation }: { mark: Mark; orientation: Color }) {
  const a = coordsOf(mark.from, orientation);
  const b = coordsOf(mark.to, orientation);
  const x1 = a.col + 0.5, y1 = a.row + 0.5, x2 = b.col + 0.5, y2 = b.row + 0.5;
  const dx = Math.abs(b.col - a.col), dy = Math.abs(b.row - a.row);
  const knight = (dx === 1 && dy === 2) || (dx === 2 && dy === 1);
  // Bend along the longer leg first.
  const corner = knight ? (dy > dx ? { x: x1, y: y2 } : { x: x2, y: y1 }) : null;
  const tailX = corner ? corner.x : x1, tailY = corner ? corner.y : y1;
  const len = Math.hypot(x2 - tailX, y2 - tailY);
  const ux = (x2 - tailX) / len, uy = (y2 - tailY) / len;
  const head = 0.42, half = 0.27, width = 0.2;
  // The shaft starts a little off the source centre and stops at the arrowhead base.
  const baseX = x2 - ux * head, baseY = y2 - uy * head;
  const firstX = corner ? corner.x : x2, firstY = corner ? corner.y : y2;
  const firstLen = Math.hypot(firstX - x1, firstY - y1);
  const sx = x1 + ((firstX - x1) / firstLen) * 0.3, sy = y1 + ((firstY - y1) / firstLen) * 0.3;
  const points = corner ? `${sx},${sy} ${corner.x},${corner.y} ${baseX},${baseY}` : `${sx},${sy} ${baseX},${baseY}`;
  const fill = MARK_FILL[mark.color];
  return (
    <g data-mark-arrow={`${mark.from}${mark.to}`} opacity="0.9">
      <polyline points={points} fill="none" stroke={fill} strokeWidth={width} strokeLinejoin="miter" />
      <polygon points={`${x2},${y2} ${baseX - uy * half},${baseY + ux * half} ${baseX + uy * half},${baseY - ux * half}`} fill={fill} />
    </g>
  );
}
