"use client";

import { pieceName, type Color } from "@/lib/chess/rules";
import type { CapturedPiece } from "@/lib/chess/captures";
import { useSettings } from "@/lib/client/settings";
import { Piece } from "./Pieces";

export function CapturedPieces({ pieces = [], color = "b", advantage = 0 }: { pieces?: CapturedPiece[]; color?: Color; advantage?: number }) {
  const { settings } = useSettings();
  const description = pieces.length ? pieces.map(pieceName).join(", ") : "none";
  return (
    <div className="flex min-h-5 min-w-0 items-center" role="img" aria-label={`Captured pieces: ${description}${advantage > 0 ? `. Material advantage +${advantage}` : ""}`}>
      <div className="flex min-w-0 flex-wrap items-center -space-x-1.5" aria-hidden="true">
        {pieces.map((piece, i) => <span key={`${piece}-${i}`} className="block h-5 w-4 shrink-0"><Piece type={piece} color={color} set={settings.pieceSet} className="h-full w-full object-contain" /></span>)}
      </div>
      {advantage > 0 && <span className="ml-2 shrink-0 text-xs font-medium tabular-nums text-muted" aria-hidden="true">+{advantage}</span>}
    </div>
  );
}
