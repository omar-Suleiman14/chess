import Link from "@/components/navigation/PrefetchLink";
import { notFound } from "next/navigation";
import { InfoPage } from "@/components/site/InfoPage";
import { Overview } from "@/components/site/Overview";
import { INFORMATION } from "@/lib/site-content";
import { CONTACT_EMAIL, pageMetadata, PUBLIC_PAGES, REPOSITORY } from "@/lib/seo";

export const dynamicParams = false;
export function generateStaticParams() { return Object.keys(INFORMATION).map((info) => ({ info })); }

export async function generateMetadata({ params }: { params: Promise<{ info: string }> }) {
  const { info } = await params;
  const entry = PUBLIC_PAGES.find((p) => p.path === `/${info}`);
  if (!entry || !Object.hasOwn(INFORMATION, info)) notFound();
  return pageMetadata(entry.title, entry.description, entry.path);
}

export default async function InformationPage({ params }: { params: Promise<{ info: string }> }) {
  const { info } = await params;
  if (!Object.hasOwn(INFORMATION, info)) notFound();
  const page = INFORMATION[info];
  return <InfoPage title={page.title} path={`/${info}`}>
    <p>{page.intro}</p>
    {info === "about" && <Overview />}
    {page.sections.map((section) => <section key={section.title} className="grid gap-3"><h2 className="text-2xl font-semibold tracking-tight">{section.title}</h2>{section.paragraphs.map((text) => <p key={text}>{text}</p>)}</section>)}
    <section className="grid gap-3 border-t border-line pt-6"><h2 className="text-2xl font-semibold">Links</h2>
      <div className="flex flex-wrap gap-x-5 gap-y-2"><Link href="/learn">Learn chess</Link><Link href="/help">Help & FAQ</Link><Link href="/profile">Profile & data controls</Link><Link href="/settings">Settings</Link><a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a><a href={REPOSITORY}>Source code</a><a href={`${REPOSITORY}/issues`}>Report a bug</a></div>
      {(info === "privacy" || info === "cookies") && <p>Provider policies: <a href="https://clerk.com/legal/privacy">Clerk</a>, <a href="https://www.convex.dev/legal/privacy">Convex</a>, <a href="https://vercel.com/legal/privacy-policy">Vercel</a>. External AI providers have their own policies.</p>}
    </section>
  </InfoPage>;
}
