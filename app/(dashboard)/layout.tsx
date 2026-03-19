"use client";

import { TopBar } from "@/components/layout/TopBar";
import { Sidebar } from "@/components/layout/Sidebar";
import { SidebarProvider } from "@/contexts/SidebarContext";
import { AssistantSidePanel } from "@/components/assistant/AssistantSidePanel";
import { AssistantProvider } from "@/contexts/AssistantContext";
import { ConciergeProvider, useConcierge } from "@/contexts/ConciergeContext";
import { ConciergeOverlay } from "@/components/concierge/ConciergeOverlay";
import { Loader } from "@/components/ui/Loader";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { useApp } from "@/contexts/AppContext";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { hasAuth } from "@/lib/auth";
import { Sparkles, X } from "lucide-react";

// ── First-time setup banner ───────────────────────────────────────────────────
// Shown only when onboarding has never been started (no persisted state).
// Dismissed permanently via localStorage so it never reappears.

const BANNER_DISMISSED_KEY = "n2p_onboarding_banner_dismissed";

function FirstTimeSetupBanner() {
  const { open, stage } = useConcierge();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Don't show if already dismissed or if onboarding is/was in progress
    const dismissed = localStorage.getItem(BANNER_DISMISSED_KEY) === "1";
    const inProgress = stage !== "welcome_scrape";
    setVisible(!dismissed && !inProgress);
  }, [stage]);

  function dismiss() {
    localStorage.setItem(BANNER_DISMISSED_KEY, "1");
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="flex items-center justify-between gap-2 px-4 py-2 bg-[#e8f0fe] border-b border-[#c5d8fb] shrink-0">
      <div className="flex flex-wrap items-center gap-2 text-sm text-[#1a56b0] min-w-0">
        <Sparkles className="w-4 h-4 shrink-0 text-[#1a73e8]" aria-hidden="true" />
        <span className="truncate"><span className="hidden sm:inline">New account? </span>Get set up in minutes.</span>
        <button
          onClick={() => { open(); dismiss(); }}
          className="font-semibold underline hover:no-underline shrink-0"
        >
          Start guided setup →
        </button>
      </div>
      <button
        onClick={dismiss}
        className="p-1 rounded hover:bg-[#c5d8fb] text-[#1a73e8] transition-colors"
        aria-label="Dismiss setup banner"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mounted, setMounted] = useState(false);
  const { loading, error } = useApp();
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && !loading && !hasAuth()) {
      router.push("/login");
      return;
    }
  }, [mounted, loading, router]);

  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8f9fa]">
        <Loader variant="full" label="Loading..." />
      </div>
    );
  }

  if (!hasAuth()) {
    return null;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8f9fa]">
        <Loader variant="full" label="Loading..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8f9fa]">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-[#1a73e8] text-white rounded-md hover:bg-[#1557b0]"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <ConciergeProvider>
      <AssistantProvider>
        <SidebarProvider>
          <div className="min-h-screen flex flex-col bg-[#f8f9fa]">
            <TopBar />
            <FirstTimeSetupBanner />
            <div className="flex flex-1 overflow-hidden relative">
              <Sidebar />
              <main className="flex-1 overflow-auto p-4 sm:p-6 min-w-0">
                <ErrorBoundary>{children}</ErrorBoundary>
              </main>
            </div>
            <AssistantSidePanel />
            <ErrorBoundary context="Concierge">
              <ConciergeOverlay />
            </ErrorBoundary>
          </div>
        </SidebarProvider>
      </AssistantProvider>
    </ConciergeProvider>
  );
}
