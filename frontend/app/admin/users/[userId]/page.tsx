"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import AdminUserProfileView from "@/components/admin/AdminUserProfileView";
import { apiUrl } from "@/lib/api-config";
import { supabase } from "@/lib/supabase";
import type { AdminUserDetail } from "@/lib/supabase/services/admin-users";

export default function AdminUserDetailPage() {
  const params = useParams<{ userId: string }>();
  const userId = params.userId;
  const { user, loading: authLoading } = useAuth();
  const [detail, setDetail] = useState<AdminUserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

  const loadDetail = useCallback(async () => {
    if (!user || !userId) return;

    setLoading(true);
    setError(null);
    setForbidden(false);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        setError("Sign in required");
        return;
      }

      const response = await fetch(
        `${apiUrl("/api/admin/user-profile")}?userId=${encodeURIComponent(userId)}`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      if (response.status === 403) {
        setForbidden(true);
        return;
      }

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `Request failed (${response.status})`);
      }

      setDetail((await response.json()) as AdminUserDetail);
    } catch (loadError) {
      console.error("Failed to load admin user profile:", loadError);
      setError(loadError instanceof Error ? loadError.message : "Failed to load user profile");
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [user?.id, userId]);

  useEffect(() => {
    if (!authLoading && user?.id) {
      void loadDetail();
    }
  }, [authLoading, user?.id, loadDetail]);

  if (authLoading || !user) {
    return (
      <div className="flex justify-center py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600" />
      </div>
    );
  }

  if (forbidden) {
    return (
      <div className="glass-panel p-6">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">Access denied</h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          Your account is not configured as an admin.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass-panel p-6">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">Could not load profile</h2>
        <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>
      </div>
    );
  }

  if (!detail) {
    return null;
  }

  return <AdminUserProfileView detail={detail} />;
}
