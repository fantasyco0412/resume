"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ADMIN_NAV = [
  { href: "/admin", label: "Overview", exact: true },
  { href: "/admin/users", label: "User management" },
  { href: "/admin/settings", label: "General settings" },
] as const;

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <main className="page-shell">
      <div className="mx-auto w-full max-w-[1600px] space-y-6">
        <div>
          <h1 className="page-title">Admin</h1>
          <p className="page-subtitle mt-1">Manage users and application settings.</p>
        </div>

        <div className="flex flex-col gap-6 md:flex-row md:items-start">
          <aside className="glass-panel w-full shrink-0 overflow-hidden md:w-52">
            <nav className="flex flex-row gap-1 p-2 md:flex-col">
              {ADMIN_NAV.map((item) => {
                const active =
                  "exact" in item && item.exact
                    ? pathname === item.href
                    : pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={
                      active
                        ? "tab-pill tab-pill-active px-4 py-2.5 text-sm font-medium"
                        : "tab-pill px-4 py-2.5 text-sm font-medium"
                    }
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </aside>

          <div className="min-w-0 flex-1">{children}</div>
        </div>
      </div>
    </main>
  );
}
