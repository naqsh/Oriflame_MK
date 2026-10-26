import { SITE_DISCLAIMER } from "@/lib/seo/site";

export function SiteFooter() {
  return (
    <footer className="border-t">
      <div className="mx-auto max-w-6xl px-4 py-6 text-sm text-muted-foreground">
        <p>{SITE_DISCLAIMER}</p>
      </div>
    </footer>
  );
}
