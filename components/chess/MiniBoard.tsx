"use client";

import { memo } from "react";
import { piecesOf } from "@/lib/chess/rules";
import { useSettings } from "@/lib/client/settings";
import { Piece } from "./Pieces";

/** A small, static picture of a position (lesson and puzzle thumbnails). */
export const MiniBoard = memo(function MiniBoard({ fen, size = 96, className = "" }: { fen: string; size?: number; className?: string }) {
  const { settings } = useSettings();
  const bySquare = new Map(piecesOf(fen).map((p) => [p.square, p]));
  const cells = [];
  for (let rank = 8; rank >= 1; rank--) {
    for (let file = 0; file < 8; file++) {
      const square = `${"abcdefgh"[file]}${rank}`;
      const piece = bySquare.get(square as never);
      const light = (file + rank) % 2 === 1;
      cells.push(
        <div key={square} className={light ? "sq-light" : "sq-dark"}>
          {piece && <Piece type={piece.type} color={piece.color} set={settings.pieceSet} className="h-full w-full" />}
        </div>,
      );
    }
  }
  return (
    <div aria-hidden="true" className={`grid shrink-0 grid-cols-8 grid-rows-8 overflow-hidden rounded-lg shadow-[0_1px_3px_rgba(0,0,0,.18)] ${className}`} style={{ width: size, height: size }}>
      {cells}
    </div>
  );
});
