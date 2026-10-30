"use client";

import Link from "@/components/navigation/PrefetchLink";
import { AccountCard, PageHeader } from "@/components/shell/AppShell";
import { NavIcon } from "@/components/shell/NavIcon";
import { MORE_SECTIONS } from "@/components/shell/navigation";

/** Everything beyond the four main tabs, as a native-style grouped list (replaces the old drawer). */
export default function MorePage() {
  return (
    <main className="mx-auto min-h-dvh max-w-xl pb-10">
      <PageHeader title="More" />
      <div className="grid gap-6 px-4">
        <AccountCard />
        {MORE_SECTIONS.map((section) => (
          <section key={section.title} aria-label={section.title}>
            <h2 className="mb-2 px-1 text-[13px] font-medium uppercase tracking-wide text-muted">{section.title}</h2>
            <ul className="overflow-hidden rounded-2xl bg-surface shadow-[var(--shadow)]">
              {section.items.map((item) => (
                <li key={item.href} className="border-b border-line last:border-b-0">
                  <Link href={item.href} className="press-overlay flex min-h-[52px] items-center gap-3 px-4 py-2.5">
                    {item.icon ? <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-surface-2 text-ink"><NavIcon name={item.icon} className="h-[18px] w-[18px]" /></span> : <span className="w-8 shrink-0" aria-hidden="true" />}
                    <span className="min-w-0 flex-1 font-medium">{item.label}</span>
                    {item.hint && <span className="shrink-0 text-sm text-muted">{item.hint}</span>}
                    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-muted rtl:rotate-180" aria-hidden="true"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
        <p className="px-1 text-xs text-muted">Chess by Chaos is open source (GPL-3.0). Stockfish runs on your device.</p>
      </div>
    </main>
  );
}
