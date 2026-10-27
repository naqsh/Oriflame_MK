import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";

import { ContentPage } from "@/components/content/content-page";
import { getContactDetails } from "@/lib/content/contact";
import { buildMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = buildMetadata({
  title: "Contact",
  description:
    "How to contact the independent consultant who runs this store. Orders, payment and delivery questions go to Oriflame.",
  path: "/contact",
});

/** Read per request, so the owner can set contact details without a rebuild. */
async function ContactMethods() {
  await connection();
  const { email, whatsapp } = getContactDetails();
  if (!email && !whatsapp) {
    return <p>Contact details will be published here by the store owner.</p>;
  }
  return (
    <ul>
      {email ? (
        <li>
          Email: <a href={`mailto:${email}`} className="underline">{email}</a>
        </li>
      ) : null}
      {whatsapp ? (
        <li>
          WhatsApp:{" "}
          <a
            href={`https://wa.me/${whatsapp}`}
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            +{whatsapp}
          </a>
        </li>
      ) : null}
    </ul>
  );
}

export default function ContactPage() {
  return (
    <ContentPage title="Contact">
      <p>
        For questions about products on this site, or help finding something, contact the
        store owner:
      </p>
      <Suspense fallback={<p>Loading contact details…</p>}>
        <ContactMethods />
      </Suspense>
      <h2>Orders, payment and delivery</h2>
      <p>
        Orders are placed on Oriflame&apos;s official website, so questions about an order,
        a payment or a delivery should go to Oriflame through its official website.
      </p>
    </ContentPage>
  );
}
