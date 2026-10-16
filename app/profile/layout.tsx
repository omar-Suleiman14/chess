import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Profile", robots: { index: false, follow: false, googleBot: { index: false, follow: false } }, alternates: { canonical: null }, openGraph: { title: "Profile", url: null } };

export default function Layout({ children }: { children: React.ReactNode }) { return children; }
