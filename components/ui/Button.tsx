"use client";

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  /** "clear": a quiet surface control. "tint": the primary action. */
  variant?: "clear" | "tint";
  children?: ReactNode;
};

/** The shared Classic control surface: solid, crisp, with a soft press. */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button({ variant = "clear", className = "", children, ...props }, ref) {
  const surface = variant === "tint" ? "bg-accent text-accent-text" : "bg-surface text-ink ring-1 ring-inset ring-line/70";
  return (
    <button ref={ref} {...props} data-variant={variant} className={`press-overlay ${surface} disabled:opacity-40 ${className}`}>
      {children}
    </button>
  );
});
