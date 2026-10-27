import type { Metadata } from "next";

import { ContentPage } from "@/components/content/content-page";
import { buildMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = buildMetadata({
  title: "Privacy",
  description:
    "What this store stores: a shopping list kept only in your browser and anonymous click counts. No accounts, payment details or addresses.",
  path: "/privacy",
});

export default function PrivacyPage() {
  return (
    <ContentPage title="Privacy">
      <p>This page describes exactly what this site stores and what it does not.</p>
      <h2>What we do not collect</h2>
      <ul>
        <li>No accounts, names, email addresses or phone numbers (unless you contact us yourself).</li>
        <li>No payment card details and no delivery addresses: you pay and give delivery details to Oriflame, on its website.</li>
        <li>No advertising or analytics trackers, and no cookies.</li>
      </ul>
      <h2>Your shopping list</h2>
      <p>
        If you add products to your list, the list (product, name, quantity and the price
        shown at the time) is kept in your own browser&apos;s storage. It is not sent to us
        or to Oriflame. You can clear it by removing the items or clearing this site&apos;s
        data in your browser.
      </p>
      <p>
        When you open your list, the site checks each product once to see whether it is still
        listed and whether its price changed. Each check asks only for that one product, never
        for your list or quantities.
      </p>
      <h2>&ldquo;Buy from Oriflame&rdquo; clicks</h2>
      <p>
        When you select &ldquo;Buy from Oriflame&rdquo;, we count the click anonymously: the
        time, where on the site it happened, which product (if any) and how many items were
        in your list. We do not store your IP address, browser details or any identifier, so
        a click cannot be linked to you.
      </p>
      <h2>Technical logs</h2>
      <p>
        To keep the site running, our servers log each request&apos;s time, the page
        requested, the response status and how long it took. These application logs do not
        include your IP address. The hosting provider that runs the site may keep its own
        standard logs.
      </p>
      <h2>Oriflame</h2>
      <p>
        When you continue to Oriflame, Oriflame&apos;s own privacy policy applies to what you
        do on its website.
      </p>
    </ContentPage>
  );
}
