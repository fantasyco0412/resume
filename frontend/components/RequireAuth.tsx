"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";

interface RequireAuthProps {
  children: React.ReactNode;
  /** Wraps page content; use to keep the top nav visible while auth loads. */
  shell: (content: React.ReactNode) => React.ReactNode;
}

export default function RequireAuth({ children, shell }: RequireAuthProps) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/");
    }
  }, [loading, user, router]);

  if (loading) {
    return shell(
      <div className="flex flex-1 items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return shell(children);
}
