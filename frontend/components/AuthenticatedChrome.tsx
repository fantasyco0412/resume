"use client";

import { usePathname } from "next/navigation";
import AppNav from "@/components/AppNav";
import RequireAuth from "@/components/RequireAuth";

const PUBLIC_PATHS = new Set(["/"]);

function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <AppNav />
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
    </div>
  );
}

export default function AuthenticatedChrome({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  if (PUBLIC_PATHS.has(pathname)) {
    return children;
  }

  return (
    <RequireAuth shell={(content) => <AppShell>{content}</AppShell>}>
      {children}
    </RequireAuth>
  );
}
