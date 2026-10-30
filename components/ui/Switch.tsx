"use client";

import { motion } from "motion/react";
import { useId } from "react";
import { haptic } from "@/lib/client/haptics";

export const IOS_SPRING = { type: "spring" as const, stiffness: 520, damping: 38, mass: 0.9 };

type SwitchProps = { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean };

/** Classic switch: a solid track and a white thumb that springs across, with a light tap. */
export function Switch({ checked, onChange, label, disabled }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => {
        haptic("select");
        onChange(!checked);
      }}
      className={`relative h-[31px] w-[51px] shrink-0 rounded-full transition-colors duration-200 disabled:opacity-40 ${checked ? "bg-[var(--switch-on)]" : "bg-[var(--switch-off)]"}`}
    >
      <motion.span
        className="absolute left-[2px] top-[2px] h-[27px] w-[27px] rounded-full bg-white shadow-[0_3px_8px_rgba(0,0,0,0.15),0_1px_1px_rgba(0,0,0,0.1)]"
        initial={false}
        animate={{ x: checked ? 20 : 0 }}
        transition={IOS_SPRING}
      />
    </button>
  );
}

/** A settings row: label (and hint) on the left, switch on the right. */
export function SwitchRow({ label, hint, badge, checked, onChange }: { label: string; hint?: string; badge?: string; checked: boolean; onChange: (v: boolean) => void }) {
  const id = useId();
  return (
    <div className="flex min-h-14 items-center justify-between gap-4 border-b border-line px-4 py-2.5 last:border-b-0">
      <span id={id}>
        <span className="flex items-center gap-2">
          {label}
          {badge && <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-muted">{badge}</span>}
        </span>
        {hint && <span className="block text-xs text-muted">{hint}</span>}
      </span>
      <Switch checked={checked} onChange={onChange} label={label} />
    </div>
  );
}
