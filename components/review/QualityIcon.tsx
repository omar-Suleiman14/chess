import { MOVE_QUALITY, type MoveQuality } from "@/lib/chess/review";

/** A move label as a coloured round badge (!!, !, ★, ?!, ?, ??…). */
export function QualityIcon({ quality, size = 28 }: { quality: MoveQuality; size?: number }) {
  const style = MOVE_QUALITY[quality];
  return (
    <span
      role="img"
      aria-label={style.label}
      data-quality={quality}
      className="inline-grid shrink-0 place-items-center rounded-full font-black leading-none text-white shadow-[inset_0_-2px_0_rgba(0,0,0,.18)]"
      style={{ width: size, height: size, backgroundColor: style.color, fontSize: Math.round(size * 0.46) }}
    >
      {style.symbol}
    </span>
  );
}
