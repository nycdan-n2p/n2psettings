"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { useRouter, usePathname } from "next/navigation";
import { hasAuth, getTokenClaims } from "@/lib/auth";
import { fetchBootstrap, type BootstrapData } from "@/lib/bootstrap";

interface AppContextValue {
  bootstrap: BootstrapData | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

const DEFAULT_ACCOUNT_ID = 1017456;
const DEFAULT_USER_ID = 80623;

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
      // Prefer IDs decoded from the JWT. Fall back to account data returned
      // by the bootstrap call itself once the first response comes back.
      const claims = getTokenClaims();
      const accountId =
        claims.accountId ?? DEFAULT_ACCOUNT_ID;
      const userId =
        claims.userId ?? DEFAULT_USER_ID;

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
