import type { Metadata } from "next";

import { ContentPage } from "@/components/content/content-page";
import { buildMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = buildMetadata({
  title: "Cookies and browser storage",
  description:
    "This site sets no cookies. It uses your browser's storage only to keep your shopping list, so no consent banner is needed.",
  path: "/cookies",
});

export default function CookiesPage() {
  return (
    <ContentPage title="Cookies and browser storage">
      <h2>Cookies</h2>
      <p>This site does not set any cookies, including advertising or analytics cookies.</p>
      <h2>Browser storage</h2>
      <p>
        If you use the shopping list, it is saved in your browser&apos;s local storage under
        the name <code>oriflame-mk.shopping-list.v1</code>. It is needed for the list to work,
        stays on your device and is never sent to us. Remove it by emptying your list or
        clearing this site&apos;s data in your browser.
      </p>
      <h2>Consent</h2>
      <p>
        Because the site only stores what the shopping list needs, there is no consent
        banner. If non-essential cookies or trackers are ever added, this page will be
        updated and you will be asked first.
      </p>
      <h2>Oriflame</h2>
      <p>Oriflame&apos;s website sets its own cookies under its own policy.</p>
    </ContentPage>
  );
}
