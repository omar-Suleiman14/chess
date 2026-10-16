import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";
import ConvexClientProvider from "@/components/ConvexClientProvider";
import { AppShell } from "@/components/shell/AppShell";
import { SettingsProvider } from "@/lib/client/settings";
import { SyncProvider } from "@/lib/client/sync";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Chess by Chaos", template: "%s · Chess by Chaos" },
  description: "Play Sherine, a local Stockfish 19 Lite rival. Undo, replay, learn.",
  applicationName: "Chess by Chaos",
  icons: { icon: "/icon.svg" },
  appleWebApp: { capable: true, title: "Chess", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f4ef" },
    { media: "(prefers-color-scheme: dark)", color: "#141412" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <ClerkProvider dynamic>
          <ConvexClientProvider>
            <SettingsProvider>
              <SyncProvider>
                <AppShell>{children}</AppShell>
              </SyncProvider>
            </SettingsProvider>
          </ConvexClientProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
