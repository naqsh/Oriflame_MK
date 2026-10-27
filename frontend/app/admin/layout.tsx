import type { Metadata } from "next";

/** The admin area is never indexed (robots.txt also disallows /admin). */
export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return <div className="space-y-6">{children}</div>;
}
