import { Spinner } from "./Spinner";

export function LoadingSpinner({ label = "Loading", className = "py-24" }: { label?: string; className?: string }) {
  return <div className={`loading-spinner grid place-items-center text-muted ${className}`} role="status" aria-label={label}>
    <Spinner /><span className="sr-only">{label}</span>
  </div>;
}
