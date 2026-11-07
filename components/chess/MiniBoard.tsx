"use client";

import { memo, useEffect, useRef, useState } from "react";
import { piecesOf } from "@/lib/chess/rules";
import { useSettings } from "@/lib/client/settings";
import { Piece } from "./Pieces";

/** A small, static picture of a position (lesson and puzzle thumbnails). */
export const MiniBoard = memo(function MiniBoard({ fen, size = 96, className = "" }: { fen: string; size?: number; className?: string }) {
  const { settings } = useSettings();
  // Thumbnails below the fold only draw their pieces once they scroll near the screen.
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === "undefined") { const t = setTimeout(() => setVisible(true), 0); return () => clearTimeout(t); }
    const io = new IntersectionObserver((entries) => { if (entries.some((e) => e.isIntersecting)) { setVisible(true); io.disconnect(); } }, { rootMargin: "300px" });
    io.observe(node);
    return () => io.disconnect();
  }, []);
  const bySquare = new Map(piecesOf(fen).map((p) => [p.square, p]));
  const cells = [];
  for (let rank = 8; rank >= 1; rank--) {
    for (let file = 0; file < 8; file++) {
      const square = `${"abcdefgh"[file]}${rank}`;
      const piece = bySquare.get(square as never);
      const light = (file + rank) % 2 === 1;
      cells.push(
        <div key={square} className={light ? "sq-light" : "sq-dark"}>
          {visible && piece && <Piece type={piece.type} color={piece.color} set={settings.pieceSet} className="h-full w-full" />}
        </div>,
      );
    }
  }
  return (
    <div ref={ref} aria-hidden="true" className={`grid shrink-0 grid-cols-8 grid-rows-8 overflow-hidden rounded-lg shadow-[0_1px_3px_rgba(0,0,0,.18)] ${className}`} style={{ width: size, height: size }}>
      {cells}
    </div>
  );
});
