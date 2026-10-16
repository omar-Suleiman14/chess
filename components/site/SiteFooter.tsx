import Link from "@/components/navigation/PrefetchLink";

export function SiteFooter() {
  return <footer className="mx-auto max-w-2xl px-5 py-8 text-sm text-muted">
    <nav aria-label="Site information" className="flex flex-wrap gap-x-5 gap-y-3">
      {[["/about", "About"], ["/search", "Search"], ["/help", "Help"], ["/contact", "Contact"], ["/privacy", "Privacy"], ["/terms", "Terms"], ["/cookies", "Cookies"], ["/accessibility", "Accessibility"], ["/licenses", "Licences"]].map(([href, label]) => <Link key={href} href={href} className="underline underline-offset-4">{label}</Link>)}
    </nav>
    <a href="/sitemap.xml" className="mt-3 inline-block underline underline-offset-4">Sitemap</a>
    <p className="mt-5">Chess by Chaos · Free and open source.</p>
  </footer>;
}
