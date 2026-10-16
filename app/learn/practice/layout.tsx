import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Practice", robots: { index: false, follow: false, googleBot: { index: false, follow: false } }, alternates: { canonical: null }, openGraph: { title: "Practice", url: null } };

export default function Layout({ children }: { children: React.ReactNode }) { return children; }
