import Link from "@/components/navigation/PrefetchLink";

/** "By continuing…" line shown above actions that create an account or share your name. */
export function LegalNote({ action = "continuing", className = "" }: { action?: string; className?: string }) {
  return (
    <p className={`text-center text-xs leading-5 text-muted ${className}`}>
      By {action}, you agree to our <Link href="/terms" className="underline">Terms of use</Link> and <Link href="/privacy" className="underline">Privacy policy</Link>.
    </p>
  );
}
