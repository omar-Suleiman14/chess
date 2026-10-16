import { PageToolbar } from "@/components/shell/AppShell";
import { SiteFooter } from "./SiteFooter";
import { StructuredData } from "./StructuredData";
import { absoluteUrl } from "@/lib/seo";

const TITLES: Record<string, string> = { "/about": "About Chess by Chaos", "/privacy": "Privacy policy", "/terms": "Terms of use", "/cookies": "Cookie and browser storage policy", "/contact": "Contact us", "/accessibility": "Accessibility", "/help": "Help and frequently asked questions", "/licenses": "Open-source licences" };

export function InfoPage({ title, path, children, updated = true }: { title: string; path: string; children: React.ReactNode; updated?: boolean }) {
  return <>
    <main id="main-content" className="mx-auto min-h-[65dvh] max-w-2xl pb-8">
      <PageToolbar />
      <header className="px-5 pb-9 pt-8 sm:pt-12">
        <h1 className="max-w-[22ch] text-[clamp(36px,6vw,56px)] font-semibold leading-[1.08] tracking-[-0.045em]">{TITLES[path] ?? title}</h1>
        {updated && <p className="mt-6 text-base text-muted">Last updated <time dateTime="2026-10-16">October 16, 2026</time></p>}
      </header>
      <article className="info-content grid gap-7 px-5 text-base leading-7">{children}</article>
    </main>
    <SiteFooter />
    <StructuredData data={{ "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "Home", item: absoluteUrl("/") }, { "@type": "ListItem", position: 2, name: title, item: absoluteUrl(path) }] }} />
  </>;
}
