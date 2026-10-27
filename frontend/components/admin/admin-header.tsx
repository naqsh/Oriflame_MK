import Link from "next/link";

/** Heading and back link shared by admin sub-pages. */
export function AdminHeader({ title }: { title: string }) {
  return (
    <header className="space-y-2">
      <Link href="/admin" className="text-sm underline">
        ← Admin
      </Link>
      <h1 className="font-heading text-3xl font-semibold">{title}</h1>
    </header>
  );
}
