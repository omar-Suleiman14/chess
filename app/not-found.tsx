import Link from "@/components/navigation/PrefetchLink";
import { InfoPage } from "@/components/site/InfoPage";

export default function NotFound() {
  return <InfoPage title="Page not found" path="/404"><p>This page does not exist or the link is no longer available.</p><p><Link href="/">Play chess</Link>, <Link href="/learn">browse lessons</Link>, or <Link href="/search">search the site</Link>.</p></InfoPage>;
}
