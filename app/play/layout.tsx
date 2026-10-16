import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata("Play a friend", "Create a chess room and invite a friend with a link, QR code, or PIN. Play a live game together in your browsers.", "/play");

export default function Layout({ children }: { children: React.ReactNode }) { return children; }
