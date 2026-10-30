import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";
import ConvexClientProvider from "@/components/ConvexClientProvider";
import { AppShell } from "@/components/shell/AppShell";
import { SettingsProvider } from "@/lib/client/settings";
import { SyncProvider } from "@/lib/client/sync";
import { NavigationProvider } from "@/components/navigation/NavigationProvider";
import { INDEXABLE, SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/seo";
import { THEME_BOOTSTRAP } from "@/lib/experience/theme";
import { WebVitalsReporter } from "@/components/shell/WebVitalsReporter";
import { OfflineSupport } from "@/lib/offline/client";
import { LaunchSplash } from "@/components/shell/LaunchSplash";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Chess by Chaos", template: "%s · Chess by Chaos" },
  metadataBase: new URL(SITE_URL),
  description: SITE_DESCRIPTION,
  applicationName: "Chess by Chaos",
  icons: { icon: [{ url: "/icon.svg", type: "image/svg+xml" }, { url: "/favicon.ico", sizes: "32x32" }], apple: "/apple-touch-icon.png" },
  robots: { index: INDEXABLE, follow: true, googleBot: { index: INDEXABLE, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 } },
  openGraph: { type: "website", siteName: SITE_NAME, title: SITE_NAME, description: SITE_DESCRIPTION, locale: "en_US" },
  twitter: { card: "summary_large_image", title: SITE_NAME, description: SITE_DESCRIPTION },
  verification: { google: process.env.GOOGLE_SITE_VERIFICATION, other: process.env.BING_SITE_VERIFICATION ? { "msvalidate.01": process.env.BING_SITE_VERIFICATION } : undefined },
  category: "games",
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
    <html lang="en" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} /></head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <LaunchSplash />
        <ClerkProvider telemetry={false} appearance={{ layout: { privacyPageUrl: "/privacy", termsPageUrl: "/terms" } }}>
          <ConvexClientProvider>
            <SettingsProvider>
              <WebVitalsReporter />
              <OfflineSupport />
              <SyncProvider>
                <NavigationProvider><AppShell>{children}</AppShell></NavigationProvider>
              </SyncProvider>
            </SettingsProvider>
          </ConvexClientProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
