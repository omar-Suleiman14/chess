"use client";

// Small confirmations ("Position copied", "Request sent") so every action visibly lands.
export type Toast = { id: number; text: string; tone: "success" | "error" | "info" };

let next = 1;
let toasts: Toast[] = [];
const listeners = new Set<() => void>();
const emit = () => { for (const l of listeners) l(); };

export function toast(text: string, tone: Toast["tone"] = "success") {
  const item = { id: next++, text, tone };
  toasts = [...toasts.slice(-2), item];
  emit();
  setTimeout(() => { toasts = toasts.filter((t) => t.id !== item.id); emit(); }, tone === "error" ? 5000 : 2600);
}

export const toastStore = {
  subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
  snapshot: () => toasts,
  server: (): Toast[] => [],
};
