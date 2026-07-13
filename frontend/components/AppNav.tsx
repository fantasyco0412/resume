"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import ThemeToggle from "@/components/ThemeToggle";

const NAV_ITEMS = [
  { href: "/generator", label: "Generator" },
  { href: "/history", label: "History" },
  { href: "/dashboard", label: "Statistics" },
  { href: "/admin", label: "Admin" },
] as const;

function getInitials(email: string | undefined): string {
  if (!email) return "?";
  const local = email.split("@")[0] ?? "";
  if (!local) return "?";
  const parts = local.split(/[._-]+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return local.slice(0, 2).toUpperCase();
}

export default function AppNav() {
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  return (
    <header className="nav-shell">
      <div className="mx-auto flex h-[4.25rem] max-w-[1400px] items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/generator" className="group flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 text-sm font-bold text-white shadow-[0_10px_24px_-14px_rgba(37,99,235,0.9)]">
            RT
          </span>
          <span className="font-display hidden text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-50 sm:block">
            Resume Tailor
          </span>
        </Link>

        <nav className="hidden items-center gap-1 rounded-2xl border border-slate-200/80 bg-slate-50/80 p-1 dark:border-slate-600/50 dark:bg-slate-800/90 md:flex">
          {NAV_ITEMS.map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== "/dashboard" && pathname.startsWith(`${item.href}/`));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={active ? "nav-pill nav-pill-active" : "nav-pill"}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-1">
          <ThemeToggle compact />
          <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-cyan-500 text-xs font-semibold text-white shadow-[0_10px_24px_-14px_rgba(37,99,235,0.85)] ring-2 ring-white transition hover:scale-[1.03] dark:ring-slate-600"
            aria-label="User menu"
            aria-expanded={menuOpen}
          >
            {getInitials(user?.email)}
          </button>

          {menuOpen && (
            <div className="dropdown-menu">
              <div className="border-b border-slate-100 px-3.5 py-3 dark:border-slate-600/50">
                <p className="truncate text-xs font-semibold text-slate-900 dark:text-slate-50">{user?.email}</p>
                <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-300">Signed in</p>
              </div>
              <Link href="/settings" className="dropdown-item">
                Settings
              </Link>
              <Link href="/settings/prompt" className="dropdown-item">
                Resume prompt
              </Link>
              <Link href="/profile" className="dropdown-item">
                Profile
              </Link>
              <Link href="/profile/change-password" className="dropdown-item">
                Change password
              </Link>
              <div className="my-1 border-t border-slate-100 dark:border-slate-600/50 md:hidden">
                {NAV_ITEMS.map((item) => (
                  <Link key={item.href} href={item.href} className="dropdown-item">
                    {item.label}
                  </Link>
                ))}
              </div>
              <button
                type="button"
                onClick={() => void signOut()}
                className="dropdown-item w-full border-t border-slate-100 text-left text-red-600 hover:bg-red-50 dark:border-slate-600/50 dark:text-red-400 dark:hover:bg-red-950/50"
              >
                Sign out
              </button>
            </div>
          )}
          </div>
        </div>
      </div>
    </header>
  );
}
