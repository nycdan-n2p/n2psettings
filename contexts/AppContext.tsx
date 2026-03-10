"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { useRouter, usePathname } from "next/navigation";
import { hasAuth, getTokenClaims, clearTokens } from "@/lib/auth";
import { fetchBootstrap, type BootstrapData } from "@/lib/bootstrap";

interface AppContextValue {
  bootstrap: BootstrapData | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [bootstrap, setBootstrap] = useState<BootstrapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  // Separate effect: redirect to /login when not authenticated.
  // This does NOT trigger a bootstrap refetch — only the redirect.
  useEffect(() => {
    if (!loading && !hasAuth() && pathname !== "/login") {
      router.push("/login");
    }
  }, [loading, pathname, router]);

  // Bootstrap fetch — stable callback with no pathname dependency.
  // Only re-created if router changes (effectively once per mount).
  const refetch = useCallback(async () => {
    if (!hasAuth()) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const claims = getTokenClaims();
      const accountId = claims.accountId;
      const userId = claims.userId;

      // If the JWT doesn't contain the required IDs the token is unusable —
      // clear all stored tokens so hasAuth() returns false, then redirect to
      // login. Without clearTokens() the stale token stays in localStorage and
      // causes an infinite redirect loop.
      if (!accountId || !userId) {
        clearTokens();
        setError("Your session has expired. Please log in again.");
        setLoading(false);
        router.push("/login");
        return;
      }

      const data = await fetchBootstrap(accountId, userId);
      setBootstrap(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load account data");
      setBootstrap(null);
    } finally {
      setLoading(false);
    }
  }, [router]); // ← no pathname here; redirect is handled by the separate effect above

  // Run bootstrap once on mount (refetch is stable so this fires only once)
  useEffect(() => {
    refetch();
  }, [refetch]);

  return (
    <AppContext.Provider value={{ bootstrap, loading, error, refetch }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
