import type { ReactNode } from "react";
import type { NavIcon as NavIconName } from "./navigation";

/** Original line icons for every navigation surface; `active` fills them lightly. */
export function NavIcon({ name, active = false, className = "h-[25px] w-[25px]" }: { name: NavIconName; active?: boolean; className?: string }) {
  const fill = active ? 0.16 : 0;
  const s = { fill: "none", stroke: "currentColor", strokeWidth: active ? 2 : 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const shapes: Record<NavIconName, ReactNode> = {
    play: <>
      <rect x="4" y="4" width="16" height="16" rx="3" {...s} fill="currentColor" fillOpacity={fill} />
      <path d="M4 12h16M12 4v16" {...s} />
      <path d="M5.5 5.5h5v5h-5zM13.5 13.5h5v5h-5z" fill="currentColor" stroke="none" opacity={active ? 0.9 : 0.55} />
    </>,
    bots: <>
      <rect x="4.5" y="7.5" width="15" height="12" rx="4" {...s} fill="currentColor" fillOpacity={fill} />
      <path d="M12 7.5V4.5" {...s} /><circle cx="12" cy="3.8" r="1.1" fill="currentColor" />
      <circle cx="9.3" cy="13" r="1.35" fill="currentColor" /><circle cx="14.7" cy="13" r="1.35" fill="currentColor" />
      <path d="M10 16.4h4" {...s} />
    </>,
    learn: <>
      <path d="M12 6.5C10 5 7 4.6 4 5v13c3-.4 6 0 8 1.5 2-1.5 5-1.9 8-1.5V5c-3-.4-6 0-8 1.5z" {...s} fill="currentColor" fillOpacity={fill} />
      <path d="M12 6.5v13" {...s} />
    </>,
    review: <>
      <path d="M4.8 9A8 8 0 1 1 4 12" {...s} /><path d="M4 5v4h4" {...s} />
      <circle cx="12" cy="12" r="5.2" fill="currentColor" opacity={fill} /><path d="M12 8v4l2.6 1.6" {...s} />
    </>,
    more: <>
      <circle cx="12" cy="12" r="8.5" {...s} fill="currentColor" fillOpacity={fill} />
      <circle cx="8.2" cy="12" r="1.15" fill="currentColor" /><circle cx="12" cy="12" r="1.15" fill="currentColor" /><circle cx="15.8" cy="12" r="1.15" fill="currentColor" />
    </>,
    friends: <><circle cx="9" cy="8" r="3" {...s} fill="currentColor" fillOpacity={fill} /><path d="M3 20v-2a6 6 0 0 1 12 0v2M16 5a3 3 0 0 1 0 6m2 3a5 5 0 0 1 3 4v2" {...s} /></>,
    profile: <><circle cx="12" cy="8.5" r="3.5" {...s} fill="currentColor" fillOpacity={fill} /><path d="M5 20a7 7 0 0 1 14 0" {...s} /></>,
    settings: <><circle cx="12" cy="12" r="3" {...s} /><path d="M12 3.5v2.2M12 18.3v2.2M20.5 12h-2.2M5.7 12H3.5M18 6l-1.6 1.6M7.6 16.4 6 18M18 18l-1.6-1.6M7.6 7.6 6 6" {...s} /></>,
    clock: <><circle cx="12" cy="13" r="7.5" {...s} fill="currentColor" fillOpacity={fill} /><path d="M12 9v4l2.5 1.5M10 3h4" {...s} /></>,
    link: <><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" {...s} /></>,
    chart: <><path d="M4 20h16M7 16v-4M12 16V8M17 16v-7" {...s} /></>,
    search: <><circle cx="11" cy="11" r="6.5" {...s} /><path d="m16 16 4 4" {...s} /></>,
    info: <><circle cx="12" cy="12" r="8.5" {...s} /><path d="M12 11v5M12 8h.01" {...s} /></>,
  };
  return <svg viewBox="0 0 24 24" className={className} aria-hidden="true">{shapes[name]}</svg>;
}

/** The app icon (public/icon.svg), drawn inline: a dark tile with a checker of light squares. */
export function AppMark({ size = 32 }: { size?: number }) {
  const cells = [[0, 0], [2, 0], [1, 1], [3, 1], [0, 2], [2, 2], [1, 3], [3, 3]];
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden="true">
      <rect width="64" height="64" rx="14" fill="#1d1c1a" />
      {cells.map(([x, y]) => <rect key={`${x}${y}`} x={8 + x * 12} y={8 + y * 12} width="12" height="12" rx="2" fill="#f6f4ef" />)}
    </svg>
  );
}
