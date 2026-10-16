"use client";

import { pieceName, type Color } from "@/lib/chess/rules";
import type { CapturedPiece } from "@/lib/chess/captures";
import { useSettings } from "@/lib/client/settings";
import { Piece } from "./Pieces";

// Black pieces vanish on the dark theme; a thin light halo keeps them readable on any background.
const DARK_PIECE_HALO = { filter: "drop-shadow(0 0 0.6px rgba(255,255,255,0.95)) drop-shadow(0 0 1.4px rgba(255,255,255,0.55))" };

export function CapturedPieces({ pieces = [], color = "b", advantage = 0 }: { pieces?: CapturedPiece[]; color?: Color; advantage?: number }) {
  const { settings } = useSettings();
  const description = pieces.length ? pieces.map(pieceName).join(", ") : "none";
  return (
    <div className="flex min-h-5 min-w-0 items-center" role="img" aria-label={`Captured pieces: ${description}${advantage > 0 ? `. Material advantage +${advantage}` : ""}`}>
      <div className="flex min-w-0 flex-wrap items-center -space-x-1.5" aria-hidden="true">
        {pieces.map((piece, i) => <span key={`${piece}-${i}`} className="block h-6 w-[18px] shrink-0"><Piece type={piece} color={color} set={settings.pieceSet} className="h-full w-full object-contain" style={color === "b" ? DARK_PIECE_HALO : undefined} /></span>)}
      </div>
      {advantage > 0 && <span className="ms-2 shrink-0 text-xs font-medium tabular-nums text-muted" aria-hidden="true">+{advantage}</span>}
    </div>
  );
}
