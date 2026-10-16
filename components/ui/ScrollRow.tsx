"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Horizontal scroller with padding (so focus/selection rings aren't clipped),
 * edge fades and arrow buttons that appear only when there is more to see.
 * Nudges once on first view so it's obvious the row scrolls.
 */
export function ScrollRow({ children, label, selectedIndex, role = "group" }: { children: ReactNode; label: string; selectedIndex?: number; role?: "group" | "radiogroup" }) {
  const ref = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setEdges({ left: el.scrollLeft > 4, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 });
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    // Content grows as images load; watch the items, not just the box.
    for (const child of Array.from(el.children)) ro.observe(child);
    el.addEventListener("scrollend", measure);
    // Bring the selected item into view, otherwise hint that the row scrolls.
    const items = el.querySelectorAll<HTMLElement>("[data-scroll-item]");
    const selected = selectedIndex !== undefined ? items[selectedIndex] : undefined;
    let t1: ReturnType<typeof setTimeout> | undefined;
    let t2: ReturnType<typeof setTimeout> | undefined;
    if (selected && selected.offsetLeft + selected.offsetWidth > el.clientWidth) {
      el.scrollTo({ left: selected.offsetLeft - 16, behavior: "smooth" });
    } else if (el.scrollWidth > el.clientWidth + 4 && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      t1 = setTimeout(() => el.scrollBy({ left: 56, behavior: "smooth" }), 500);
      t2 = setTimeout(() => el.scrollBy({ left: -56, behavior: "smooth" }), 1050);
    }
    return () => {
      ro.disconnect();
      el.removeEventListener("scrollend", measure);
      if (t1) clearTimeout(t1);
      if (t2) clearTimeout(t2);
    };
    // Only on mount: don't fight the user's scrolling later.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const page = (dir: number) => {
    const el = ref.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.75, behavior: "smooth" });
    // Smooth scrolling may not emit a final scroll event everywhere.
    setTimeout(measure, 450);
  };

  const mask = `linear-gradient(to right, ${edges.left ? "transparent 0, #000 40px" : "#000 0"}, ${edges.right ? "#000 calc(100% - 40px), transparent 100%" : "#000 100%"})`;

  return (
    <div className="relative">
      <div
        ref={ref}
        onScroll={measure}
        role={role}
        aria-label={label}
        className="no-scrollbar flex snap-x snap-mandatory scroll-px-3 gap-2.5 overflow-x-auto scroll-smooth px-3 py-2"
        style={{ maskImage: mask, WebkitMaskImage: mask }}
      >
        {children}
      </div>
      <Arrow side="left" visible={edges.left} onClick={() => page(-1)} />
      <Arrow side="right" visible={edges.right} onClick={() => page(1)} />
    </div>
  );
}

function Arrow({ side, visible, onClick }: { side: "left" | "right"; visible: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      tabIndex={visible ? 0 : -1}
      aria-hidden={!visible}
      aria-label={side === "left" ? "Scroll left" : "Scroll right"}
      className={`absolute top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-surface shadow-[0_4px_14px_rgba(0,0,0,0.25)] transition-all duration-200 ${
        side === "left" ? "left-0" : "right-0"
      } ${visible ? "scale-100 opacity-100" : "pointer-events-none scale-75 opacity-0"}`}
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
        <path d={side === "left" ? "M15 5l-7 7 7 7" : "M9 5l7 7-7 7"} stroke="currentColor" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}
