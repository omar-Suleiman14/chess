"use client";

import { pieceName, type Color } from "@/lib/chess/rules";
import type { CapturedPiece } from "@/lib/chess/captures";
import { useSettings } from "@/lib/client/settings";
import { Piece } from "./Pieces";

// Black pieces vanish on the dark theme; a thin light halo keeps them readable on any background.
const DARK_PIECE_HALO = { filter: "drop-shadow(0 0 0.6px rgba(255,255,255,0.95)) drop-shadow(0 0 1.4px rgba(255,255,255,0.55))" };

/** Groups of the same piece, in the order captures.ts sorts them (pawns first). */
function groupPieces(pieces: CapturedPiece[]): CapturedPiece[][] {
  const groups: CapturedPiece[][] = [];
  for (const piece of pieces) {
    const last = groups[groups.length - 1];
    if (last && last[0] === piece) last.push(piece);
    else groups.push([piece]);
  }
  return groups;
}

/**
 * Captured material, chess.com style: identical pieces overlap tightly in a
 * stack, each kind of piece is its own small group, and the material lead
 * follows as "+N".
 */
export function CapturedPieces({ pieces = [], color = "b", advantage = 0 }: { pieces?: CapturedPiece[]; color?: Color; advantage?: number }) {
  const { settings } = useSettings();
  const description = pieces.length ? pieces.map(pieceName).join(", ") : "none";
  return (
    <div className="flex min-h-5 min-w-0 items-center" role="img" aria-label={`Captured pieces: ${description}${advantage > 0 ? `. Material advantage +${advantage}` : ""}`}>
      <div className="flex min-w-0 flex-wrap items-center gap-x-1" aria-hidden="true">
        {groupPieces(pieces).map((group) => (
          <span key={`${group[0]}-${group.length}`} className="flex shrink-0 items-center">
            {group.map((piece, i) => (
              // Each extra piece of the same kind tucks under the previous one, leaving ~40% showing.
              <span key={i} className={`block h-5 w-4 shrink-0 ${i > 0 ? "-ms-2.5" : ""}`}>
                <Piece type={piece} color={color} set={settings.pieceSet} className="h-full w-full object-contain" style={color === "b" ? DARK_PIECE_HALO : undefined} />
              </span>
            ))}
          </span>
        ))}
      </div>
      {advantage > 0 && <span className="ms-1.5 shrink-0 text-xs font-medium tabular-nums text-muted" aria-hidden="true">+{advantage}</span>}
    </div>
  );
}
