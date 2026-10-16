// Piece artwork from open-licensed sets (see THIRD_PARTY_NOTICES.md).
import type { Color } from "@/lib/chess/rules";

export const PIECE_SETS = [
  { id: "cburnett", name: "Classic" },
  { id: "merida", name: "Merida" },
  { id: "chessnut", name: "Chessnut" },
  { id: "mpchess", name: "MP Chess" },
  { id: "fantasy", name: "Fantasy" },
] as const;

export type PieceSet = (typeof PIECE_SETS)[number]["id"];

export function pieceUrl(set: PieceSet, color: Color, type: string): string {
  return `/pieces/${set}/${color}${type.toUpperCase()}.svg`;
}

export function Piece({ type, color, set = "cburnett", className, style }: { type: string; color: Color; set?: PieceSet; className?: string; style?: React.CSSProperties }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- tiny static SVGs; next/image adds nothing here
    <img src={pieceUrl(set, color, type)} alt="" aria-hidden="true" draggable={false} className={className} style={style} decoding="async" />
  );
}
