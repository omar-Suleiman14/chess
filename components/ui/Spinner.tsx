/** Compact native-style indicator on a solid circular surface. */
export function Spinner({ className = "h-9 w-9" }: { className?: string }) {
  return <span className={`spinner-surface inline-grid shrink-0 place-items-center rounded-full ${className}`} aria-hidden="true">
    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none">
      {Array.from({ length: 8 }, (_, index) => <path key={index} className="spinner-segment" d="M12 3v4" transform={`rotate(${index * 45} 12 12)`} stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ opacity: .2 + index * .1, animationDelay: `${index * 45 - 360}ms` }} />)}
    </svg>
  </span>;
}
