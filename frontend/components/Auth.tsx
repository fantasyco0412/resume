"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import ThemeToggle from "@/components/ThemeToggle";
import { ToastContainer, useToast } from "@/components/Toast";

interface AuthProps {
  onAuthSuccess: () => void;
}

export default function Auth({ onAuthSuccess }: AuthProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { toasts, showToast, dismissToast } = useToast();

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      if (data.user) {
        onAuthSuccess();
      }
    } catch (err: any) {
      showToast("error", err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex h-dvh overflow-hidden">
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <div className="absolute right-4 top-4 z-10 sm:right-6 sm:top-6">
        <ThemeToggle />
      </div>
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden opacity-80 dark:opacity-30">
        <div className="absolute left-[-120px] top-[-120px] h-72 w-72 rounded-full bg-cyan-200/70 blur-3xl dark:bg-blue-600/10" />
        <div className="absolute bottom-[-120px] right-[-80px] h-72 w-72 rounded-full bg-blue-200/70 blur-3xl dark:bg-cyan-600/8" />
      </div>

      <div className="mx-auto flex w-full max-w-5xl flex-1 items-center justify-center px-4 py-6 sm:px-6">
        <div className="grid w-full max-h-full gap-5 lg:grid-cols-[1.1fr_0.9fr] lg:gap-6">
          <section className="animate-rise-in hidden rounded-3xl border border-white/20 bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 p-8 text-white shadow-[0_30px_80px_-40px_rgba(15,23,42,0.8)] lg:block xl:p-10">
            <p className="mb-4 inline-flex rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200">
              Resume Tailor
            </p>
            <h1 className="font-display mb-4 text-3xl font-semibold leading-tight tracking-tight xl:text-4xl">
              Craft job-ready resumes with a cleaner, faster workflow
            </h1>
            <p className="max-w-md text-sm text-slate-200 xl:text-base">
              Analyze any job description, tailor your resume instantly, and generate a polished output for each role.
            </p>
          </section>

          <section className="glass-panel animate-rise-in w-full p-6 sm:p-8 lg:p-10">
            <h2 className="font-display mb-2 text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50 sm:text-3xl">
              Welcome back
            </h2>
            <p className="mb-6 text-sm text-slate-600 dark:text-slate-300 sm:mb-8">
              Sign in to continue tailoring resumes.
            </p>

            <form onSubmit={handleSignIn} className="space-y-4">
              <div>
                <label htmlFor="email" className="field-label">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="input-shell"
                  placeholder="your@email.com"
                />
              </div>

              <div>
                <label htmlFor="password" className="field-label">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="input-shell"
                  placeholder="••••••••"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full"
              >
                {loading ? "Signing in..." : "Sign In"}
              </button>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}
