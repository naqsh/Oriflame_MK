import Link from "next/link";

export default function NotFound() {
  return (
    <section className="space-y-4">
      <h1 className="font-heading text-3xl font-semibold">Page not found</h1>
      <p className="text-muted-foreground">
        We could not find that page. It may have moved, or the product or category may no
        longer be listed.
      </p>
      <p className="flex gap-4">
        <Link href="/" className="underline">
          Go to the homepage
        </Link>
        <Link href="/products" className="underline">
          Browse all products
        </Link>
      </p>
    </section>
  );
}
