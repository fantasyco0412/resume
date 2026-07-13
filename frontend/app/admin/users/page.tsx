"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { ToastContainer, useToast } from "@/components/Toast";
import { adminFetch, readAdminError } from "@/lib/admin-api";
import type { StoredUserLevel } from "@/lib/supabase/database.types";
import type { AdminUserRow, AdminUsersResult } from "@/lib/supabase/services/admin-users";
import {
  DEFAULT_STORED_USER_LEVEL,
  STORED_USER_LEVELS,
  userLevelBadgeClass,
  userLevelLabel,
} from "@/lib/user-level";

const PAGE_SIZE_OPTIONS = [10, 20, 50] as const;

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

const emptyCreateForm = () => ({
  email: "",
  password: "",
  fullName: "",
  userLevel: DEFAULT_STORED_USER_LEVEL as StoredUserLevel,
});

export default function AdminUsersPage() {
  const { user, loading: authLoading } = useAuth();
  const { toasts, showToast, dismissToast } = useToast();
  const [rows, setRows] = useState<AdminUserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(20);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState(emptyCreateForm);
  const [creating, setCreating] = useState(false);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [updatingLevelUserId, setUpdatingLevelUserId] = useState<string | null>(null);
  const [savingNoteUserId, setSavingNoteUserId] = useState<string | null>(null);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(searchQuery), 300);
    return () => window.clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    setPage(1);
  }, [debouncedQuery, pageSize]);

  const loadUsers = useCallback(async () => {
    if (!user?.id) return;

    setLoading(true);
    setError(null);
    setForbidden(false);

    try {
      const params = new URLSearchParams({
        page: String(page),
        perPage: String(pageSize),
      });
      if (debouncedQuery.trim()) {
        params.set("q", debouncedQuery.trim());
      }

      const response = await adminFetch(`/api/admin/users?${params.toString()}`);

      if (response.status === 403) {
        setForbidden(true);
        setRows([]);
        setTotal(0);
        return;
      }

      if (!response.ok) {
        throw new Error(await readAdminError(response));
      }

      const data = (await response.json()) as AdminUsersResult;
      setRows(data.users);
      setTotal(data.total);
      setNoteDrafts((current) => {
        const next = { ...current };
        for (const row of data.users) {
          next[row.id] = row.adminNote ?? "";
        }
        return next;
      });
    } catch (loadError) {
      console.error("Failed to load admin users:", loadError);
      setError(loadError instanceof Error ? loadError.message : "Failed to load users");
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [user?.id, page, pageSize, debouncedQuery]);

  useEffect(() => {
    if (!authLoading && user?.id) {
      void loadUsers();
    }
  }, [authLoading, user?.id, loadUsers]);

  const handleCreateUser = async (event: React.FormEvent) => {
    event.preventDefault();
    setCreating(true);

    try {
      const response = await adminFetch("/api/admin/users", {
        method: "POST",
        body: JSON.stringify({
          email: createForm.email.trim(),
          password: createForm.password,
          fullName: createForm.fullName.trim() || undefined,
          userLevel: createForm.userLevel,
        }),
      });

      if (!response.ok) {
        throw new Error(await readAdminError(response));
      }

      setCreateForm(emptyCreateForm());
      setShowCreateForm(false);
      setPage(1);
      showToast("success", "User created.");
      await loadUsers();
    } catch (createError) {
      console.error("Failed to create user:", createError);
      showToast(
        "error",
        createError instanceof Error ? createError.message : "Failed to create user"
      );
    } finally {
      setCreating(false);
    }
  };

  const handleUpdateLevel = async (row: AdminUserRow, userLevel: StoredUserLevel) => {
    if (row.level === "admin" || row.storedLevel === userLevel) return;

    setUpdatingLevelUserId(row.id);

    try {
      const response = await adminFetch("/api/admin/users", {
        method: "PATCH",
        body: JSON.stringify({
          userId: row.id,
          userLevel,
        }),
      });

      if (!response.ok) {
        throw new Error(await readAdminError(response));
      }

      const updated = (await response.json()) as AdminUserRow;
      setRows((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      showToast("success", `User level updated to ${userLevelLabel(userLevel)}.`);
    } catch (updateError) {
      console.error("Failed to update user level:", updateError);
      showToast(
        "error",
        updateError instanceof Error ? updateError.message : "Failed to update user level"
      );
    } finally {
      setUpdatingLevelUserId(null);
    }
  };

  const handleSaveNote = async (row: AdminUserRow) => {
    const draft = noteDrafts[row.id] ?? row.adminNote ?? "";
    const saved = row.adminNote ?? "";
    if (draft.trim() === saved.trim()) return;

    setSavingNoteUserId(row.id);

    try {
      const response = await adminFetch("/api/admin/users", {
        method: "PATCH",
        body: JSON.stringify({
          userId: row.id,
          adminNote: draft,
        }),
      });

      if (!response.ok) {
        throw new Error(await readAdminError(response));
      }

      const updated = (await response.json()) as AdminUserRow;
      setRows((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      setNoteDrafts((current) => ({
        ...current,
        [updated.id]: updated.adminNote ?? "",
      }));
      showToast("success", "Note saved.");
    } catch (saveError) {
      console.error("Failed to save user note:", saveError);
      showToast(
        "error",
        saveError instanceof Error ? saveError.message : "Failed to save note"
      );
    } finally {
      setSavingNoteUserId(null);
    }
  };

  const handleDeleteUser = async (row: AdminUserRow) => {
    const label = row.fullName || row.email || "this user";
    if (!confirm(`Delete ${label}? This removes their account, profile, bids, and interviews.`)) {
      return;
    }

    setDeletingUserId(row.id);

    try {
      const response = await adminFetch(
        `/api/admin/users?userId=${encodeURIComponent(row.id)}`,
        { method: "DELETE" }
      );

      if (!response.ok) {
        throw new Error(await readAdminError(response));
      }

      showToast("success", "User deleted.");
      await loadUsers();
    } catch (deleteError) {
      console.error("Failed to delete user:", deleteError);
      showToast(
        "error",
        deleteError instanceof Error ? deleteError.message : "Failed to delete user"
      );
    } finally {
      setDeletingUserId(null);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

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
          Your account is not configured as an admin. Add your email to{" "}
          <code className="rounded bg-slate-100 px-1 py-0.5 text-xs dark:bg-slate-800">ADMIN_EMAILS</code>{" "}
          on the backend.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      <div className="glass-panel p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">User management</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              Create, view, and delete registered users.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setShowCreateForm((open) => !open)}
              className="btn-primary text-sm"
            >
              {showCreateForm ? "Cancel" : "Add user"}
            </button>
            <button type="button" onClick={() => void loadUsers()} className="btn-soft text-sm">
              Refresh
            </button>
          </div>
        </div>

        {showCreateForm ? (
          <form onSubmit={(event) => void handleCreateUser(event)} className="mt-4 space-y-3 rounded-xl border border-slate-200/90 p-4 dark:border-slate-600/60">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-50">New user</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="create-email" className="filter-label">
                  Email
                </label>
                <input
                  id="create-email"
                  type="email"
                  required
                  value={createForm.email}
                  onChange={(event) =>
                    setCreateForm((current) => ({ ...current, email: event.target.value }))
                  }
                  className="filter-control"
                  placeholder="user@example.com"
                />
              </div>
              <div>
                <label htmlFor="create-password" className="filter-label">
                  Password
                </label>
                <input
                  id="create-password"
                  type="password"
                  required
                  minLength={6}
                  value={createForm.password}
                  onChange={(event) =>
                    setCreateForm((current) => ({ ...current, password: event.target.value }))
                  }
                  className="filter-control"
                  placeholder="At least 6 characters"
                />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="create-name" className="filter-label">
                  Full name (optional)
                </label>
                <input
                  id="create-name"
                  type="text"
                  value={createForm.fullName}
                  onChange={(event) =>
                    setCreateForm((current) => ({ ...current, fullName: event.target.value }))
                  }
                  className="filter-control"
                  placeholder="Jane Doe"
                />
              </div>
              <div>
                <label htmlFor="create-level" className="filter-label">
                  User level
                </label>
                <select
                  id="create-level"
                  value={createForm.userLevel}
                  onChange={(event) =>
                    setCreateForm((current) => ({
                      ...current,
                      userLevel: event.target.value as StoredUserLevel,
                    }))
                  }
                  className="filter-select"
                >
                  {STORED_USER_LEVELS.map((level) => (
                    <option key={level} value={level}>
                      {userLevelLabel(level)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex justify-end">
              <button type="submit" disabled={creating} className="btn-primary px-4 py-2 text-sm">
                {creating ? "Creating…" : "Create user"}
              </button>
            </div>
          </form>
        ) : null}

        <div className="mt-4">
          <label htmlFor="admin-user-search" className="filter-label">
            Search
          </label>
          <input
            id="admin-user-search"
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Email, name, or note…"
            className="filter-control"
          />
        </div>
      </div>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      ) : null}

      <div className="glass-panel overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600" />
          </div>
        ) : rows.length === 0 ? (
          <p className="px-6 py-12 text-center text-sm text-slate-500 dark:text-slate-300">
            {debouncedQuery.trim() ? "No users match your search." : "No users found."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-600/60">
              <thead className="bg-slate-50/90 dark:bg-slate-800/90">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Email
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Joined
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Last sign-in
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Level
                  </th>
                  <th className="min-w-[12rem] px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Note
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white dark:divide-slate-600/40 dark:bg-slate-900/20">
                {rows.map((row) => {
                  const isSelf = row.id === user.id;
                  const isDeleting = deletingUserId === row.id;
                  const isUpdatingLevel = updatingLevelUserId === row.id;
                  const isSavingNote = savingNoteUserId === row.id;
                  const noteValue = noteDrafts[row.id] ?? row.adminNote ?? "";

                  return (
                    <tr key={row.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50">
                      <td className="px-4 py-3 text-sm text-slate-900 dark:text-slate-50">
                        {row.email || "—"}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-200">
                        {row.fullName ? (
                          <Link
                            href={`/admin/users/${row.id}`}
                            className="font-medium text-blue-700 hover:underline dark:text-blue-300"
                          >
                            {row.fullName}
                          </Link>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-700 dark:text-slate-200">
                        {formatDate(row.createdAt)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-700 dark:text-slate-200">
                        {formatDate(row.lastSignInAt)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        {row.level === "admin" ? (
                          <span
                            className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${userLevelBadgeClass(row.level)}`}
                            title="Admin access is controlled by ADMIN_EMAILS"
                          >
                            {userLevelLabel(row.level)}
                          </span>
                        ) : (
                          <select
                            value={row.storedLevel}
                            disabled={isUpdatingLevel}
                            onChange={(event) =>
                              void handleUpdateLevel(row, event.target.value as StoredUserLevel)
                            }
                            className="select-compact min-w-[7rem] py-1 text-xs"
                          >
                            {STORED_USER_LEVELS.map((level) => (
                              <option key={level} value={level}>
                                {userLevelLabel(level)}
                              </option>
                            ))}
                          </select>
                        )}
                      </td>
                      <td className="px-4 py-3 align-top">
                        <textarea
                          value={noteValue}
                          disabled={isSavingNote}
                          onChange={(event) =>
                            setNoteDrafts((current) => ({
                              ...current,
                              [row.id]: event.target.value,
                            }))
                          }
                          onBlur={() => void handleSaveNote(row)}
                          rows={2}
                          placeholder="Internal note…"
                          className="filter-control min-w-[12rem] resize-y py-1.5 text-xs"
                        />
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => void handleDeleteUser(row)}
                          disabled={isSelf || isDeleting}
                          className="text-sm font-medium text-red-600 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-50 dark:text-red-400 dark:hover:text-red-300"
                          title={isSelf ? "You cannot delete your own account" : undefined}
                        >
                          {isDeleting ? "Deleting…" : "Delete"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-300">
        <span>
          {total === 0
            ? "No users"
            : `Showing ${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} of ${total}`}
        </span>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5">
            <span>Per page</span>
            <select
              value={pageSize}
              onChange={(event) => setPageSize(Number(event.target.value))}
              className="select-compact min-w-[4.5rem] py-1 text-xs"
            >
              {PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            disabled={page <= 1}
            className="btn-soft disabled:cursor-not-allowed disabled:opacity-50"
          >
            Previous
          </button>
          <span>
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
            disabled={page >= totalPages}
            className="btn-soft disabled:cursor-not-allowed disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
