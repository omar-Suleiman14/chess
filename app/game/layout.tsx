import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Game", robots: { index: false, follow: false, googleBot: { index: false, follow: false } }, alternates: { canonical: null }, openGraph: { title: "Game", url: null } };

export default function Layout({ children }: { children: React.ReactNode }) { return children; }
