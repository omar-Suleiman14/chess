import Link from "@/components/navigation/PrefetchLink";
import { notFound } from "next/navigation";
import { StaticLesson } from "@/components/learn/StaticLesson";
import { PageHeader } from "@/components/shell/AppShell";
import { SiteFooter } from "@/components/site/SiteFooter";
import { StructuredData } from "@/components/site/StructuredData";
import { ALL_STATIC_LESSONS, findStaticLesson } from "@/lib/chess/lessons/curriculum";
import { absoluteUrl, pageMetadata } from "@/lib/seo";

export function generateStaticParams() { return ALL_STATIC_LESSONS.map(({ id }) => ({ lessonId: id })); }

export async function generateMetadata({ params }: { params: Promise<{ lessonId: string }> }) {
  const { lessonId } = await params;
  const lesson = findStaticLesson(lessonId);
  if (!lesson) notFound();
  return pageMetadata(lesson.title, `${lesson.summary} Practise on the board with progressive hints in this free interactive chess lesson.`, `/learn/${lesson.id}`);
}

export default async function LessonPage({ params }: { params: Promise<{ lessonId: string }> }) {
  const { lessonId } = await params;
  const lesson = findStaticLesson(lessonId);
  if (!lesson) notFound();
  const related = ALL_STATIC_LESSONS.filter((item) => item.id !== lesson.id && (item.topic === lesson.topic || item.section === lesson.section)).slice(0, 4);
  return (
    <>
    <main id="main-content" className="mx-auto min-h-dvh max-w-2xl px-3 pb-6">
      <PageHeader title={lesson.title} />
      <nav aria-label="Breadcrumb" className="px-2 py-3 text-sm text-muted"><Link href="/">Home</Link> / <Link href="/learn">Learn chess</Link> / <span aria-current="page">{lesson.title}</span></nav>
      <p className="mb-4 px-2 text-muted">{lesson.summary}</p>
      <StaticLesson lesson={lesson} />
      <section className="mt-8 grid gap-3 px-2 text-sm leading-7"><h2 className="text-lg font-semibold">What you’ll practise</h2>
        <p>Make the requested move on the board. If you get stuck, ask for a hint and try again. This lesson has {lesson.steps.length} interactive {lesson.steps.length === 1 ? "position" : "positions"}.</p>
        <ul className="list-disc pl-5">{lesson.steps.map((step) => <li key={step.id}>{step.prompt}</li>)}</ul>
        {related.length > 0 && <><h2 className="text-lg font-semibold">Keep learning</h2><ul>{related.map((item) => <li key={item.id}><Link className="underline" href={`/learn/${item.id}`}>{item.title}</Link> — {item.summary}</li>)}</ul></>}
        <Link href="/learn" className="underline">Browse all chess lessons</Link>
      </section>
    </main>
    <SiteFooter />
    <StructuredData data={{ "@context": "https://schema.org", "@type": "LearningResource", name: lesson.title, description: lesson.summary, url: absoluteUrl(`/learn/${lesson.id}`), learningResourceType: "Interactive lesson", educationalUse: "practice", inLanguage: "en", isAccessibleForFree: true, teaches: lesson.topic }} />
    <StructuredData data={{ "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "Home", item: absoluteUrl("/") }, { "@type": "ListItem", position: 2, name: "Learn chess", item: absoluteUrl("/learn") }, { "@type": "ListItem", position: 3, name: lesson.title, item: absoluteUrl(`/learn/${lesson.id}`) }] }} />
    </>
  );
}
