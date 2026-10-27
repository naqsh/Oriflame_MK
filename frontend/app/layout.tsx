import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { SiteShell } from "@/components/layout/site-shell";
import { ShoppingListProvider } from "@/components/referral/shopping-list-provider";
import { SITE_DESCRIPTION, SITE_NAME, getSiteUrl } from "@/lib/seo/site";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  // Only the referral code uses it, so it is not preloaded on every page.
  preload: false,
});

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: { default: SITE_NAME, template: `%s | ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  openGraph: { type: "website", siteName: SITE_NAME, locale: "en_PK" },
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Development only. The condition is a build-time constant, so the production build
  // drops this import entirely and no web-vitals code ships to visitors.
  const WebVitals =
    process.env.NODE_ENV === "development"
      ? (await import("@/components/status/web-vitals")).WebVitals
      : null;
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        {WebVitals ? <WebVitals /> : null}
        <ShoppingListProvider>
          <SiteShell>{children}</SiteShell>
        </ShoppingListProvider>
      </body>
    </html>
  );
}
