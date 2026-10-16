import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Time Machine", robots: { index: false, follow: false, googleBot: { index: false, follow: false } }, alternates: { canonical: null }, openGraph: { title: "Time Machine", url: null } };

export default function Layout({ children }: { children: React.ReactNode }) { return children; }
