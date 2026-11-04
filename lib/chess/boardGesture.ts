import { FILES, type Color, type Square } from "./rules";

/** Hit testing must respect both colors and reject the outer right/bottom edge. */
export function squareFromClientPoint(
  x: number,
  y: number,
  rect: Pick<DOMRect, "left" | "top" | "width" | "height">,
  orientation: Color,
): Square | null {
  if (![x, y, rect.left, rect.top, rect.width, rect.height].every(Number.isFinite) || rect.width <= 0 || rect.height <= 0) return null;
  const col = Math.floor((x - rect.left) * 8 / rect.width);
  const row = Math.floor((y - rect.top) * 8 / rect.height);
  if (col < 0 || col > 7 || row < 0 || row > 7) return null;
  return `${FILES[orientation === "w" ? col : 7 - col]}${orientation === "w" ? 8 - row : row + 1}` as Square;
}

/** Touch needs a little more slop than a mouse to prevent accidental drags. */
export function dragActivated(startX: number, startY: number, x: number, y: number, pointerType: string): boolean {
  const threshold = pointerType === "touch" ? 8 : 4;
  return (x - startX) ** 2 + (y - startY) ** 2 > threshold ** 2;
}
