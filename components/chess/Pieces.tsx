// Piece artwork from open-licensed sets (see THIRD_PARTY_NOTICES.md).
import type { Color } from "@/lib/chess/rules";
import { StudioPiece } from "./StudioPiece";

export const PIECE_SETS = [
  { id: "cburnett", name: "Classic" },
  { id: "merida", name: "Merida" },
  { id: "chessnut", name: "Chessnut" },
  { id: "mpchess", name: "MP Chess" },
  { id: "fantasy", name: "Fantasy" },
  { id: "studio", name: "Studio" },
  { id: "chesscom", name: "Chess.com · Neo" },
] as const;

export type PieceSet = (typeof PIECE_SETS)[number]["id"];

export function pieceUrl(set: PieceSet, color: Color, type: string): string {
  // Keep the original Chess.com Neo pixels rather than approximating their
  // silhouettes in SVG. The same-origin route streams the source PNGs and
  // keeps image CSP/offline caching working without shipping copied art.
  if (set === "chesscom") return `/pieces/chesscom/${color}${type.toLowerCase()}.png`;
  return `/pieces/${set}/${color}${type.toUpperCase()}.svg`;
}

export function Piece({ type, color, set = "cburnett", className, style }: { type: string; color: Color; set?: PieceSet; className?: string; style?: React.CSSProperties }) {
  if (set === "studio") return <StudioPiece type={type} color={color} className={className} style={style} />;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- tiny static SVGs; next/image adds nothing here
    <img src={pieceUrl(set, color, type)} alt="" aria-hidden="true" draggable={false} className={className} style={style} decoding="async" />
  );
}
