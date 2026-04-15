"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ConciergeProvider } from "@/contexts/ConciergeContext";
import { ConciergeOverlay } from "@/components/concierge/ConciergeOverlay";
import { AssistantProvider } from "@/contexts/AssistantContext";
import { Loader } from "@/components/ui/Loader";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { useApp } from "@/contexts/AppContext";
import { hasAuth } from "@/lib/auth";

export default function WelcomeShell({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const { loading, error } = useApp();
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && !loading && !hasAuth()) {
      router.push(`/login?returnUrl=${encodeURIComponent("/welcome")}`);
    }
  }, [mounted, loading, router]);

  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f0f7ff]">
        <Loader variant="full" label="Loading…" />
      </div>
    );
  }

  if (!hasAuth()) {
    return null;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f0f7ff]">
        <Loader variant="full" label="Loading…" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f0f7ff] px-4">
        <div className="text-center max-w-sm">
          <p className="text-red-600 mb-4 text-sm">{error}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="px-4 py-2 rounded-[16px] bg-[#1a73e8] text-white text-sm font-medium hover:bg-[#1557b0]"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <AssistantProvider>
      <ConciergeProvider>
        {children}
        <ErrorBoundary context="Concierge">
          <ConciergeOverlay />
        </ErrorBoundary>
      </ConciergeProvider>
    </AssistantProvider>
  );
}
