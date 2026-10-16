# Search visibility and launch operations

The implementation targets `https://chess.chaos.fail`. Set `NEXT_PUBLIC_APP_URL` to the actual canonical production origin before building. Metadata, canonical links, structured data and the sitemap use this value. Do not set it to a preview hostname. Vercel preview builds automatically receive noindex directives and a disallow-all robots file; other staging environments must set `SEO_NOINDEX=true` before building. Never use that flag on the canonical production build.

See [navigation, caching, and database indexes](CACHING.md) for intent prefetch, refresh invalidation and its spinner, HTTP cache lifetimes, indexed local storage, and Convex’s reactive cache.

## Implemented

- Unique titles and descriptions for public game modes, lessons, help, and information pages.
- Self-referencing canonicals, Open Graph and Twitter cards, a generated 1200×630 PNG share image, favicon, Apple icon, and web manifest with PNG app icons.
- Server-rendered homepage explanations and curated lesson summaries, prompts, related lessons, and breadcrumbs.
- WebSite/WebApplication, LearningResource, and breadcrumb JSON-LD reflecting visible content. No fabricated reviews or rating claims. No promise of a rich-result feature for these types.
- `/sitemap.xml`: public canonical pages and every curated lesson; no private records, invite codes, custom lessons, user cards, or search results. No artificial modification timestamps.
- `/robots.txt`: discovery of the sitemap and access to render resources. Personal pages remain crawlable so crawlers can see their noindex directives. Robots controls are not authentication.
- Noindex metadata and X-Robots-Tag headers on personal, invite, benchmark, search, and integration routes. Public player cards intentionally remain out of search for privacy.
- Public `/search?q=...` searches lesson titles/summaries, feature pages and FAQ content without an external search provider or access to personal records. Results are server rendered, escaped, bounded and noindex.
- About, Help/FAQ, Contact, Privacy, Terms, Cookies/storage, Accessibility, and Licences pages linked through navigation and public footers.
- Google and Bing verification meta tags configurable through environment values.
- Authentication dialogs link to Privacy and Terms; optional Clerk SDK telemetry is disabled in the client provider.

## Required external setup

These are account, mailbox, or organizational tasks, not actions completed by committing source files.

1. **Confirm operator details and activate `support@wareed.io`.** The project owner authorized an `@wareed.io` address; the published address needs a functioning inbox or alias. Confirm the legal operator/contact details and adapt the policy/terms to the operator’s jurisdiction and actual hosting arrangements. Current text describes code behavior and deliberately does not invent a legal entity, street address, retention deadline, or jurisdiction. Review actual provider contracts, processing grounds, child-user rules, and backup retention before treating the text as a complete legal compliance assessment.
2. **Deploy the changes.** Use the existing project’s deployment workflow. A local build does not change the live site. Use Clerk production keys and the configured production backend; the live-site audit on 16 October 2026 showed a Clerk development-key warning. Validate production auth origins and MCP configuration separately. No backend deployment is required solely for these SEO changes.
   In Clerk Dashboard → Legal, configure the published Privacy and Terms URLs and decide whether to require express legal acceptance on sign-up. The UI links added in source do not enable that account-level setting. See [Clerk’s legal-compliance guide](https://clerk.com/docs/guides/secure/legal-compliance).
3. **Google Search Console:** add the `chess.chaos.fail` domain property and publish the provided DNS TXT verification record. Alternatively, use URL-prefix verification and put its meta-tag value in `GOOGLE_SITE_VERIFICATION`, then rebuild. Submit `https://chess.chaos.fail/sitemap.xml`. Inspect the home, Learn, one lesson, and a help page. Request indexing for representative public URLs. Ownership cannot be established with a made-up token.
4. **Bing Webmaster Tools:** import the verified Google property or add the site manually. If using HTML-meta verification, set `BING_SITE_VERIFICATION` to the supplied value and rebuild. Submit the same sitemap. Bing discovery can also help search experiences that use its index; it does not guarantee placement.
5. **Domains:** ensure HTTPS works, choose one canonical hostname, and redirect any alternate hostnames or HTTP versions permanently at the hosting/domain layer. Do not redirect preview hosts to production while using them for testing. Confirm 404s stay 404s.
6. **Validate the deployed build:** run the automated checks below against production, use Search Console URL Inspection, test breadcrumbs in Google Rich Results Test, and inspect other schema in Schema Markup Validator. Check actual share previews. Crawl public internal links for redirects or errors after domain/content changes.
7. **Performance and usability:** measure homepage, Learn, and a lesson with PageSpeed Insights on mobile and desktop after deploying. Track field Core Web Vitals in Search Console when enough traffic exists. Engine download is substantial: keep it on play/analysis paths and cached under its versioned URL. Do not claim measured scores or WCAG conformance without results.
8. **Ongoing search work:** review Search Console queries, clicks, impressions, index coverage, sitemap fetch status, and canonical selection after two to four weeks, then monthly. Improve lessons and help based on real questions. Keep attribution and policy content synchronized with product changes. Build relevant links through the source repository and real project/community profiles; avoid paid spam links, invented testimonials, mass doorway pages, or keyword stuffing.

Google does not guarantee crawling, indexing, rankings, a chosen snippet, or rich results. No robots or sitemap trick forces instant inclusion. IndexNow and analytics have not been enabled: neither is required for crawlability, and both need deliberate provider/configuration choices. If analytics or optional tracking is added, update the privacy/storage notice and implement applicable consent controls before loading it.

## Search intent and content maintenance

The initial targets follow working product features, rather than invented search-volume estimates:

- Home: Chess by Chaos, free chess online, play chess against Stockfish, browser chess.
- `/climb`: beginner chess bots, chess practice against a computer, progressive chess opponents.
- `/timed`: timed chess practice, 3+2 chess, 5+3 chess, 10+5 chess, 15+10 chess.
- `/play`: play chess with a friend, chess invitation link, private chess room.
- `/learn`: learn chess, interactive chess lessons, chess rules and tactics.
- Curated lesson URLs: specific piece movement, castling and en passant, escaping check, checkmate, forks and pins, endgame basics, opening principles, Queen’s Gambit, Sicilian, Italian, Ruy Lopez, London, French, and Caro-Kann.
- `/help`: PGN import/export, game review, local Stockfish, account sync, ratings, and AI connector help.

Use Search Console evidence to choose future lesson expansions. Each new indexable URL should provide a distinct lesson or useful explanation and be linked from the learning path, with an accurate title, summary, and canonical URL. Avoid separate near-identical pages for every keyword variation. Do not imply competitive online matchmaking, officially calibrated Elo, tournament certification, or guaranteed offline reloads: these are not verified product capabilities.

## Running the checks

```powershell
npm run build
node node_modules/next/dist/bin/next start --port 3100
```

In another terminal:

```powershell
node scripts/check-seo.mjs http://localhost:3100
```

The check fetches every sitemap URL as a crawler and asserts status, unique title, description, canonical, indexing directives, share metadata and headings. It also checks personal-route exclusions, search behavior/input escaping, real 404s, and assets. For a custom origin, set `NEXT_PUBLIC_APP_URL` for the check to match the value used at build time. Run `npm run lint`, `npm run typecheck` and `npm test` for repository checks.

## Primary references

- [Google developer SEO guide](https://developers.google.com/search/docs/fundamentals/get-started-developers)
- [Sitemaps](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap)
- [Canonical URLs](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls)
- [Robots meta tags](https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag)
- [Site names](https://developers.google.com/search/docs/appearance/site-names)
- [Breadcrumb structured data](https://developers.google.com/search/docs/appearance/structured-data/breadcrumb)
- [Search Console](https://search.google.com/search-console/about)
- [Bing Webmaster Tools](https://www.bing.com/webmasters/about)
- [Privacy notice contents and operator details (ICO)](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/individual-rights/the-right-to-be-informed/what-privacy-information-should-we-provide/)
- [Clerk SDK telemetry controls](https://clerk.com/legal/telemetry)
