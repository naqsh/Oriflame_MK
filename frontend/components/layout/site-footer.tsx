import Link from "next/link";

import { SITE_DISCLAIMER } from "@/lib/seo/site";

export const FOOTER_LINKS = [
  { href: "/about", label: "About" },
  { href: "/referral", label: "How buying works" },
  { href: "/contact", label: "Contact" },
  { href: "/privacy", label: "Privacy" },
  { href: "/cookies", label: "Cookies" },
  { href: "/terms", label: "Terms" },
] as const;

export function SiteFooter() {
  return (
    <footer className="border-t">
      <div className="mx-auto max-w-6xl space-y-3 px-4 py-6 text-sm text-muted-foreground">
        <nav aria-label="Footer">
          <ul className="flex flex-wrap gap-x-4 gap-y-2">
            {FOOTER_LINKS.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="underline-offset-4 hover:underline">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <p>{SITE_DISCLAIMER}</p>
      </div>
    </footer>
  );
}
