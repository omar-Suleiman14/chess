import { Spinner } from "./Spinner";

/** A spinner that says what is loading, so the wait has a reason. */
export function LoadingSpinner({ label = "Loading", className = "py-24" }: { label?: string; className?: string }) {
  return <div className={`loading-spinner grid place-items-center gap-3 text-muted ${className}`} role="status" aria-label={label}>
    <Spinner /><span className="text-sm">{label}…</span>
  </div>;
}

/** Placeholder rows shaped like the content that is about to appear. */
export function SkeletonRows({ rows = 3, label }: { rows?: number; label: string }) {
  return (
    <div role="status" aria-label={label} className="grid gap-2">
      <p className="px-1 text-sm text-muted">{label}…</p>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex animate-pulse items-center gap-3 rounded-2xl bg-surface p-3 shadow-[var(--shadow)]" style={{ animationDelay: `${i * 120}ms` }}>
          <div className="h-10 w-10 rounded-xl bg-surface-2" />
          <div className="grid flex-1 gap-2"><div className="h-3 w-1/2 rounded bg-surface-2" /><div className="h-2.5 w-1/3 rounded bg-surface-2" /></div>
        </div>
      ))}
    </div>
  );
}
