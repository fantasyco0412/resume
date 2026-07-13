"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { ensureProfile } from "@/lib/supabase/ensure-profile";
import type { User } from "@supabase/supabase-js";

interface AuthContextType {
  user: User | null;
  accessToken: string | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  accessToken: null,
  loading: true,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const ensuredUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    let active = true;

    const finishLoading = () => {
      if (active) setLoading(false);
    };

    const applySession = async (nextUser: User | null, token: string | null) => {
      if (!active) return;
      setUser(nextUser);
      setAccessToken(token);

      if (!nextUser || ensuredUserIdRef.current === nextUser.id) {
        return;
      }

      ensuredUserIdRef.current = nextUser.id;
      try {
        await ensureProfile(nextUser.id);
      } catch (error) {
        console.warn("Could not ensure profile (Supabase may be unreachable):", error);
      }
    };

    // onAuthStateChange handles INITIAL_SESSION — avoid duplicate getSession + refresh calls
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      const nextUser = session?.user ?? null;
      const nextUserId = nextUser?.id ?? null;

      // Token refresh on tab focus — session is still valid; don't touch React state.
      if (event === "TOKEN_REFRESHED" && nextUserId && ensuredUserIdRef.current === nextUserId) {
        setAccessToken(session?.access_token ?? null);
        finishLoading();
        return;
      }

      // Same signed-in user re-emitted (common when returning to a background tab).
      if (nextUserId && ensuredUserIdRef.current === nextUserId) {
        setAccessToken(session?.access_token ?? null);
        finishLoading();
        return;
      }

      void applySession(nextUser, session?.access_token ?? null);
      finishLoading();
    });

    // Fallback: if auth init hangs (network timeout), still render the app
    const loadingTimeout = window.setTimeout(finishLoading, 4000);

    return () => {
      active = false;
      subscription.unsubscribe();
      window.clearTimeout(loadingTimeout);
    };
  }, []);

  const signOut = async () => {
    ensuredUserIdRef.current = null;
    await supabase.auth.signOut();
    setUser(null);
    setAccessToken(null);
  };

  return (
    <AuthContext.Provider value={{ user, accessToken, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
