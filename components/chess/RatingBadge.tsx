"use client";

import { useId, useState } from "react";
import { Dialog } from "@/components/ui/Dialog";
import type { Opponent } from "@/lib/chess/engine/opponents";

export type PlayerRating = { pool: string; rating: number; rd: number; volatility: number; games: number; provisional: boolean; delta: number | null };

export function RatingBadge({ rating, unrated = false }: { rating: PlayerRating | null | undefined; unrated?: boolean }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const pool = rating?.pool === "climb" ? "Climb" : rating?.pool.startsWith("timed:") ? `Timed ${rating.pool.slice(6)}` : null;
  const label = rating ? `${rating.rating}${rating.provisional ? "?" : ""}${unrated ? " · Unrated" : ""}` : unrated ? "Unrated" : "Not rated yet";
  return <>
    <button onClick={() => setOpen(true)} aria-haspopup="dialog" aria-controls={open ? id : undefined} aria-label={`Rating details: ${label}${pool ? `, ${pool}` : ""}`} className="min-h-11 shrink-0 rounded-lg px-1 text-xs font-medium text-muted"><bdi>{label}</bdi>{rating?.delta != null && <span className="ms-1 font-mono text-ink">{rating.delta >= 0 ? "+" : "−"}{Math.abs(rating.delta)}</span>}<span aria-hidden="true" className="ms-1">ⓘ</span></button>
    {open && <Dialog title="Rating details" description={pool ?? "Unrated play"} onClose={() => setOpen(false)} focusTitle>
      <div id={id} className="text-sm">{rating ? <><p>{rating.provisional ? "Provisional" : "Established"} · {rating.games} rated games</p><p className="mt-2">Glicko-2 rating {rating.rating} · deviation ±{rating.rd} · volatility {rating.volatility.toFixed(4)}.</p><p className="mt-2 text-muted">A question mark means uncertainty is high. Each time control has a separate pool. This is an app rating, not a FIDE or Chess.com rating.</p>{unrated && <p className="mt-2">This game does not change the displayed pool rating.</p>}</> : <p>{unrated ? "Full Power and practice do not award a rating." : "Sign in and finish an eligible Climb or Timed game to keep a rating."}</p>}</div>
    </Dialog>}
  </>;
}

export function BotRatingBadge({ opponent }: { opponent: Opponent | undefined }) {
  const [open, setOpen] = useState(false);
  const full = opponent?.id.startsWith("full-power") || opponent?.id === "climb-11";
  const label = full ? "Full Power" : opponent ? `${opponent.rating} · Estimated` : "Strength unknown";
  return <><button onClick={() => setOpen(true)} aria-label={`Bot strength: ${label}`} aria-haspopup="dialog" className="pointer-events-auto min-h-11 px-1 text-xs text-muted">{label} <span aria-hidden="true">ⓘ</span></button>{open && <Dialog title="Sherine's strength" onClose={() => setOpen(false)} focusTitle><p className="text-sm">{full ? "3000 is a nominal Full Power label, not a measured human Elo. Stockfish runs without an artificial strength limit." : "This strength is an uncalibrated estimate. Bot comparisons measure relative performance, not verified human Elo."}</p></Dialog>}</>;
}
