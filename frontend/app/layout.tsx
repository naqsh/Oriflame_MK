import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { SiteShell } from "@/components/layout/site-shell";
import { ShoppingListProvider } from "@/components/referral/shopping-list-provider";
import { SITE_DESCRIPTION, SITE_NAME } from "@/lib/seo/site";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: SITE_NAME, template: `%s | ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <ShoppingListProvider>
          <SiteShell>{children}</SiteShell>
        </ShoppingListProvider>
      </body>
    </html>
  );
}
