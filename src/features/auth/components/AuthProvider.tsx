"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

interface AuthContextValue {
  user: User | null;
  /** true while the initial session check is in flight */
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  isLoading: true,
});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();

    // Resolve the current session immediately
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user ?? null);
      setIsLoading(false);
    });

    // Keep state in sync with Supabase auth events
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}
